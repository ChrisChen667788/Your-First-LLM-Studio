import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.env.FIRST_LLM_STUDIO_BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const dataDir = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
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

const extensionAcceptance = await post("/api/extensions/acceptance");
const extensionReceipt = extensionAcceptance.body.receipt;

const workflow = await post("/api/workflows", {
  action: "create",
  input: "Post-v1 hardening safe worker rehearsal.",
});
const executionId = workflow.body.execution.id;
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

const artifactAcceptance = await post("/api/artifacts/acceptance");
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
    acceptanceId: extensionReceipt.id,
    status: extensionReceipt.status,
    checks: extensionReceipt.checks,
    lifecycle: extensionReceipt.lifecycle,
    security: extensionReceipt.security,
    mcp: extensionReceipt.mcp,
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
    provenance: artifactAcceptance.body.receipt.provenance,
    registry: artifactAcceptance.body.receipt.registry,
    checks: artifactAcceptance.body.receipt.checks,
  },
  usage: usageReconciliation.body.receipt,
  totals: hardening.body.totals,
};

mkdirSync(dataDir, { recursive: true });
const reportPath = path.join(dataDir, "post-v1-hardening-rehearsal.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
const ok = hardening.body.totals.ready === hardening.body.totals.slices;
console.log(JSON.stringify({ ok, reportPath, totals: hardening.body.totals }, null, 2));
if (!ok) process.exitCode = 1;
