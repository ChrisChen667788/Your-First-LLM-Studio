import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.env.FIRST_LLM_STUDIO_BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const dataDir = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(",")}}`
    : JSON.stringify(value);

async function json(pathname, init, accepted = [200]) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json();
  if (!accepted.includes(response.status)) {
    throw new Error(`${pathname} returned ${response.status}: ${body.error || body.detail || "unknown error"}`);
  }
  return { status: response.status, body };
}

async function post(pathname, body, accepted) {
  return json(pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, accepted);
}

function createSignedExtension(version, source) {
  const bundle = {
    schemaVersion: "first-llm-extension-bundle.v1",
    files: [{ path: "index.mjs", contentBase64: Buffer.from(source).toString("base64") }],
  };
  const payload = Buffer.from(JSON.stringify(bundle));
  const pair = generateKeyPairSync("ed25519");
  const digest = createHash("sha256").update(payload).digest("hex");
  return {
    manifest: {
      schemaVersion: "first-llm-extension.v1",
      id: "local-rehearsal.safe-tool",
      name: "Local safe tool rehearsal",
      version,
      publisher: "local-rehearsal-hardening",
      kind: "tool",
      entrypoint: "index.mjs",
      permissions: ["workspace:read"],
      compatibleStudio: ">=1.0.0",
      digest,
      signature: sign(null, Buffer.from(digest, "hex"), pair.privateKey).toString("base64"),
    },
    payloadBase64: payload.toString("base64"),
    publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

const desktop = await post("/api/desktop/update-channel", {
  channel: "stable",
  fromVersion: "1.0.0",
  toVersion: "1.1.0",
});
const deduplication = await post("/api/models/content-deduplication", {});
const hubReconciliation = await post("/api/models/hub-transfers/reconcile", {}, [200, 422]);

const serverRegistration = await post("/api/models/server-instances/actions", {
  serverId: "local-ollama",
  action: "register",
  modelId: "qwen3:0.6b",
  autoEvict: true,
  idleTtlMinutes: 1,
});
const serverHotSwitch = await post("/api/models/server-instances/actions", {
  serverId: "local-ollama",
  action: "hot-switch",
  modelId: "qwen3:0.6b",
});
const fleetConformance = await post("/api/runtime/fleet-conformance", {
  action: "run-server",
  serverId: "local-ollama",
  modelId: "qwen3:0.6b",
}, [200, 422]);
const idleUnload = await post("/api/models/server-instances/idle-unload", {
  execute: false,
  now: new Date(Date.now() + 2 * 60_000).toISOString(),
});

const extensionV1 = createSignedExtension("1.0.0", "export default { name: 'safe-tool-v1' };\n");
const extensionV2 = createSignedExtension("1.1.0", "export default { name: 'safe-tool-v2' };\n");
const extensionInstallV1 = await post("/api/extensions/installations", extensionV1);
const extensionInstallV2 = await post("/api/extensions/installations", extensionV2);
const extensionRollback = await post("/api/extensions/installations", {
  action: "rollback",
  extensionId: extensionV1.manifest.id,
  targetVersion: extensionV1.manifest.version,
});

const deployment = await post("/api/workflows/deploy/protected-tool-resume", {
  input: "Post-v1 hardening safe worker rehearsal.",
}, [202]);
const executionId = deployment.body.execution.id;
const workflowApprovalStop = await post("/api/workflows/worker", { executionId, workerId: "hardening-rehearsal", maxSteps: 12 });
if (workflowApprovalStop.body.receipt.outcome !== "waiting-approval") {
  throw new Error(`Workflow worker did not stop for approval: ${workflowApprovalStop.body.receipt.outcome}`);
}
await post("/api/workflows", { action: "dispatch", executionId, event: { type: "approval-granted" } });
await post("/api/workflows", {
  action: "dispatch",
  executionId,
  event: { type: "node-succeeded", nodeId: "tool", idempotencyKey: `hardening:${executionId}`, output: "Protected action completed by explicit rehearsal event." },
});
const workflowCompletion = await post("/api/workflows/worker", { executionId, workerId: "hardening-rehearsal", maxSteps: 12 });
if (workflowCompletion.body.execution?.status !== "completed") {
  throw new Error(`Workflow did not complete after explicit side-effect event: ${workflowCompletion.body.execution?.status || "missing"}`);
}
const workflowReplay = await post("/api/workflows/replay", { sourceExecutionId: executionId });

const policySimulation = await post("/api/governance/policy-simulator", {});
const qualityBaseline = Array.from({ length: 40 }, (_, index) => 0.50 + (index % 5) * 0.005);
const qualityCandidate = qualityBaseline.map((value, index) => value + 0.08 + (index % 3) * 0.001);
const latencyBaseline = Array.from({ length: 40 }, (_, index) => 100 + (index % 7));
const latencyCandidate = latencyBaseline.map((value, index) => value - 10 - (index % 2));
const regressionSuite = await post("/api/evaluation/regression-suite", {
  metrics: [
    { id: "quality", label: "Answer quality", direction: "higher-is-better", baseline: qualityBaseline, candidate: qualityCandidate, minimumImprovement: 0.05, minimumSamples: 30 },
    { id: "latency", label: "Latency", direction: "lower-is-better", baseline: latencyBaseline, candidate: latencyCandidate, minimumImprovement: 5, minimumSamples: 30 },
  ],
});

const artifactPayload = Buffer.from("first-llm-studio post-v1 hardening artifact fixture\n");
const artifactFileDigest = createHash("sha256").update(artifactPayload).digest("hex");
const artifactManifest = {
  schemaVersion: "artifacts.package.v1",
  id: "local-rehearsal.hardening-package",
  version: "1.0.0",
  kind: "workflow",
  publisher: "local-rehearsal-hardening",
  createdAt: "2026-07-14T00:00:00.000Z",
  license: "Apache-2.0",
  compatibleStudio: ">=1.0.0",
  dependencies: [{ id: "runtime-profile", version: "1.0.0", digest: createHash("sha256").update("runtime-profile@1.0.0").digest("hex") }],
  files: [{ path: "manifest.json", role: "manifest", sha256: artifactFileDigest, bytes: artifactPayload.length }],
  evidenceUris: ["docs/release-evidence/post-v1-hardening-15-slice-2026-07-14.md"],
};
artifactManifest.digest = createHash("sha256").update(stable(artifactManifest)).digest("hex");
const artifactPair = generateKeyPairSync("ed25519");
artifactManifest.signature = sign(null, Buffer.from(artifactManifest.digest, "hex"), artifactPair.privateKey).toString("base64");
const artifactProvenance = await post("/api/artifacts/packages", {
  manifest: artifactManifest,
  provenance: {
    sourceUris: ["https://github.com/ChrisChen667788/local-agent-lab"],
    builderId: "local-rehearsal-hardening",
    sourceRevision: "working-tree-2026-07-14",
    sbomUri: "package-lock.json",
    secretScanPassed: true,
    evidenceVerified: true,
    publicKeyPem: artifactPair.publicKey.export({ type: "spki", format: "pem" }).toString(),
  },
});
const artifactRegistry = await post("/api/artifacts/registry", {
  manifest: artifactManifest,
  packageBase64: artifactPayload.toString("base64"),
});
const usageReconciliation = await post("/api/deployment/usage-reconciliation", {
  operatorId: "local-reconciliation-worker",
  tenantId: "local-lab",
});
const hardening = await json("/api/experiments/post-v1-hardening");

const report = {
  schemaVersion: "experiments.post-v1-hardening-rehearsal.v1",
  generatedAt: new Date().toISOString(),
  desktop: desktop.body.receipt,
  deduplication: deduplication.body.receipt,
  hubReconciliation: hubReconciliation.body.receipt,
  server: {
    registration: serverRegistration.body.receipt,
    hotSwitch: serverHotSwitch.body.receipt,
    fleet: fleetConformance.body.snapshot,
    idleUnload: idleUnload.body.receipt,
  },
  extensions: {
    v1: extensionInstallV1.body.result.receipt,
    v2: extensionInstallV2.body.result.receipt,
    rollback: extensionRollback.body.result,
  },
  workflow: {
    executionId,
    approvalStop: workflowApprovalStop.body.receipt,
    completion: workflowCompletion.body.receipt,
    replay: workflowReplay.body.receipt,
  },
  policy: policySimulation.body.receipt,
  regressionSuite: regressionSuite.body.receipt,
  artifact: {
    provenance: artifactProvenance.body.receipt,
    registry: artifactRegistry.body.record,
  },
  usage: usageReconciliation.body.receipt,
  totals: hardening.body.totals,
};

mkdirSync(dataDir, { recursive: true });
const reportPath = path.join(dataDir, "post-v1-hardening-rehearsal.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: hardening.body.totals.ready === hardening.body.totals.slices, reportPath, totals: hardening.body.totals }, null, 2));
