import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (
  process.env.FIRST_LLM_STUDIO_BASE_URL || "http://127.0.0.1:3011"
).replace(/\/+$/, "");
const dataDir =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const operatorToken = process.env.FIRST_LLM_OPERATOR_TOKEN?.trim();
const operatorHeaders = operatorToken
  ? { "x-first-llm-operator-key": operatorToken }
  : {};

async function json(pathname, init, accepted = [200]) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json();
  if (!accepted.includes(response.status)) {
    throw new Error(
      `${pathname} returned ${response.status}: ${body.error || body.detail || "unknown error"}`,
    );
  }
  return { status: response.status, body };
}

async function post(pathname, body, accepted, headers = {}) {
  return json(
    pathname,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...operatorHeaders,
        ...headers,
      },
      body: JSON.stringify(body),
    },
    accepted,
  );
}

execFileSync(
  process.execPath,
  [path.join(process.cwd(), "scripts/rehearse-post-v1-hardening.mjs")],
  { stdio: "inherit", timeout: 240_000 },
);

const desktop = await post("/api/desktop/data-lifecycle", {});
const storage = await post("/api/models/external-storage", {});
const compatibility = await post("/api/models/compatibility", {
  modelId: "qwen3:0.6b",
  format: "gguf",
  license: "Apache-2.0",
  tokenizerFiles: ["tokenizer.json"],
  chatTemplate: "qwen",
  parameterBillions: 0.6,
  quantizationBits: 4,
  runtime: "ollama",
});
const handoff = await post("/api/models/benchmark-handoff", {
  modelId: "qwen3:0.6b",
  targetId: "local-qwen3-0.6b",
  promptSetId: "milestone-formal",
  runs: 1,
  contextWindow: 4096,
});
const access = await post("/api/models/server-instances/access", {
  action: "rehearse",
  serverId: "local-ollama",
});
const network = await post("/api/models/server-instances/network-policy", {});
const operationPort = await post("/api/runtime/operation-port", {});
const remoteNode = await post("/api/runtime/remote-nodes", {});
const extensionAcceptance = await post("/api/extensions/acceptance");
const secretScope = await post("/api/extensions/secret-scope", {});

const deployment = await post("/api/workflows", {
  action: "create",
  input: "Post-v1 acceptance state diff rehearsal.",
});
const executionId = deployment.body.execution.id;
await post("/api/workflows/worker", {
  executionId,
  workerId: "acceptance-worker",
});
await post("/api/workflows", {
  action: "dispatch",
  executionId,
  event: { type: "approval-granted" },
});
await post("/api/workflows", {
  action: "dispatch",
  executionId,
  event: {
    type: "node-succeeded",
    nodeId: "tool",
    idempotencyKey: `acceptance:${executionId}`,
  },
});
await post("/api/workflows/worker", {
  executionId,
  workerId: "acceptance-worker",
});
const replay = await post("/api/workflows/replay", {
  sourceExecutionId: executionId,
});
const stateDiff = await post("/api/workflows/state-diff", {
  sourceExecutionId: executionId,
  replayExecutionId: replay.body.replay.id,
});

const retrievalDeployment = await post("/api/workflows/retrieval-graph", {});
const workflowKey = await post(
  "/api/workflows/deployment-access",
  {
    action: "issue",
    workflowSlug: "retrieval-grounded-answer",
    version: 1,
    scopes: ["invoke"],
    ttlMinutes: 10,
  },
  [201],
);
let retrievalRun;
try {
  retrievalRun = await post(
    "/api/workflows/deploy/retrieval-grounded-answer",
    { input: "Which evidence supports the release claim?" },
    [202],
    { authorization: `Bearer ${workflowKey.body.token}` },
  );
} finally {
  await post("/api/workflows/deployment-access", {
    action: "revoke",
    keyId: workflowKey.body.key.id,
  });
}
const retrievalWorker = await post("/api/workflows/worker", {
  executionId: retrievalRun.body.execution.id,
  workerId: "retrieval-acceptance-worker",
});
if (retrievalWorker.body.execution?.status !== "completed") {
  throw new Error(
    `Retrieval workflow ended as ${retrievalWorker.body.execution?.status || "missing"}.`,
  );
}

const sharedAssets = await post("/api/governance/shared-assets", {});
const sweep = await post("/api/evaluation/sweep-calibration", {});
const quality = await post("/api/artifacts/quality-claims", {
  artifactId: "first-llm-studio.acceptance-package",
  version: "1.0.0",
});
const acceptance = await json("/api/experiments/post-v1-acceptance");
const report = {
  schemaVersion: "experiments.post-v1-acceptance-rehearsal.v1",
  generatedAt: new Date().toISOString(),
  desktop: desktop.body.receipt,
  storage: storage.body.receipt,
  compatibility: compatibility.body.receipt,
  handoff: handoff.body.receipt,
  access: access.body.receipt,
  network: network.body.receipt,
  operationPort: operationPort.body.receipt,
  remoteNode: remoteNode.body.receipt,
  extension: {
    acceptance: extensionAcceptance.body.receipt,
    secretScope: secretScope.body.receipt,
  },
  workflow: {
    stateDiff: stateDiff.body.receipt,
    retrievalDeployment: retrievalDeployment.body.receipt,
    retrievalWorker: retrievalWorker.body.receipt,
  },
  governance: sharedAssets.body.receipt,
  evaluation: sweep.body.receipt,
  qualityBilling: quality.body.receipt,
  totals: acceptance.body.totals,
};
mkdirSync(dataDir, { recursive: true });
const reportPath = path.join(dataDir, "post-v1-acceptance-rehearsal.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
const ok = acceptance.body.totals.ready === acceptance.body.totals.slices;
console.log(
  JSON.stringify(
    {
      ok,
      reportPath,
      totals: acceptance.body.totals,
    },
    null,
    2,
  ),
);
if (!ok) process.exitCode = 1;
