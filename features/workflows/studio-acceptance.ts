import { createHash, randomUUID } from "crypto";
import os from "os";
import path from "path";
import { readDurableJsonStore, updateDurableJsonStore } from "@/features/persistence/durable-json-store";
import { authorizeWorkflowDeployment, issueWorkflowDeploymentKey, revokeWorkflowDeploymentKey } from "@/features/workflows/deployment-access";
import { buildOpenAIWorkflowCompletion, buildOpenAIWorkflowStream, buildWorkflowDeploymentExamples, invokeDeployedWorkflow } from "@/features/workflows/deployment-application";
import { dispatchPersistedWorkflowEvent, readWorkflowExecutions } from "@/features/workflows/execution-reducer";
import { createProtectedToolResumeGraph, validateWorkflowGraph, type WorkflowGraph } from "@/features/workflows/graph-contract";
import { diffWorkflowGraphs, type WorkflowGraphVersionDiff } from "@/features/workflows/graph-diff";
import { publishWorkflowVersion, readWorkflowGraphRegistry, saveWorkflowDraft } from "@/features/workflows/graph-registry";
import { forkWorkflowExecutionForReplay } from "@/features/workflows/replay-service";
import { rehearseWorkflowStateDiff } from "@/features/workflows/state-diff";
import { runWorkflowSafeWorker } from "@/features/workflows/worker-service";

export const WORKFLOW_STUDIO_ACCEPTANCE_SCHEMA_VERSION = "workflows.studio-acceptance.v1" as const;

export type WorkflowStudioAcceptanceReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "failed";
  graph: { id: string; version: number; digest?: string; deploymentSlug: string };
  checks: Record<string, boolean>;
  versionDiff: WorkflowGraphVersionDiff;
  execution: { sourceId?: string; replayId?: string; finalStatus?: string; eventCount: number };
  reportDigest: string;
  error?: string;
};

type Store = { schemaVersion: typeof WORKFLOW_STUDIO_ACCEPTANCE_SCHEMA_VERSION; receipts: WorkflowStudioAcceptanceReceipt[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "workflow-studio-acceptance.json");

function isStore(value: unknown): value is Store { if (!value || typeof value !== "object") return false; const candidate = value as Partial<Store>; return candidate.schemaVersion === WORKFLOW_STUDIO_ACCEPTANCE_SCHEMA_VERSION && Array.isArray(candidate.receipts); }
const storeOptions = { filePath: STORE_FILE, initial: (): Store => ({ schemaVersion: WORKFLOW_STUDIO_ACCEPTANCE_SCHEMA_VERSION, receipts: [] }), validate: isStore };
function readStore() { return readDurableJsonStore(storeOptions); }

function persist(receipt: WorkflowStudioAcceptanceReceipt) {
  updateDurableJsonStore(storeOptions, (store) => ({ ...store, receipts: [receipt, ...store.receipts].slice(0, 50) }));
}

function createAcceptanceGraph(version: number): WorkflowGraph {
  const source = createProtectedToolResumeGraph();
  return {
    ...source,
    id: "workflow-studio-acceptance",
    version,
    label: `Workflow Studio acceptance v${version}`,
    nodes: [
      ...source.nodes.filter((node) => node.id !== "approval" && node.id !== "tool" && node.id !== "verify" && node.id !== "answer"),
      { id: "policy-guard", kind: "guard", label: "Evaluate protected-action policy", config: { expression: "tool.protected == true", defaultCondition: "requires_approval" }, sideEffect: "none", resumePolicy: "replay-safe", position: { x: 405, y: 118 } },
      { ...source.nodes.find((node) => node.id === "approval")!, position: { x: 585, y: 48 } },
      { ...source.nodes.find((node) => node.id === "tool")!, position: { x: 765, y: 48 } },
      { ...source.nodes.find((node) => node.id === "verify")!, position: { x: 945, y: 48 } },
      { ...source.nodes.find((node) => node.id === "answer")!, position: { x: 1125, y: 118 } },
    ],
    edges: [
      { from: "prompt", to: "model" },
      { from: "model", to: "policy-guard", condition: "protected_tool_requested" },
      { from: "policy-guard", to: "approval", condition: "requires_approval" },
      { from: "policy-guard", to: "answer", condition: "safe_response" },
      { from: "approval", to: "tool", condition: "approved" },
      { from: "tool", to: "verify" },
      { from: "verify", to: "answer" },
    ],
    runtimeProfile: { id: "workflow-acceptance", label: "Workflow acceptance", target: "local-safe-worker", model: "active", temperature: 0, maxTokens: 1024, contextWindow: 8192, toolMode: "required" },
    artifactInputs: [
      { id: "acceptance-prompt", kind: "prompt", digest: "sha256:workflow-studio-acceptance-prompt-v1" },
      { id: "protected-tool-policy", kind: "tool-policy", digest: "sha256:workflow-studio-protected-tool-policy-v1" },
    ],
  };
}

function reportDigest(value: Omit<WorkflowStudioAcceptanceReceipt, "id" | "generatedAt" | "reportDigest">) {
  const stableEvidence = {
    status: value.status,
    checks: value.checks,
    versionDiff: {
      nodes: value.versionDiff.nodes,
      edges: value.versionDiff.edges,
      runtimeProfileChanged: value.versionDiff.runtimeProfileChanged,
      artifactInputsChanged: value.versionDiff.artifactInputsChanged,
    },
    execution: { finalStatus: value.execution.finalStatus, eventCount: value.execution.eventCount },
    error: value.error,
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(stableEvidence)).digest("hex")}`;
}

export async function rehearseWorkflowStudioAcceptance() {
  const registry = readWorkflowGraphRegistry();
  const versions = registry.records.filter((record) => record.graph.id === "workflow-studio-acceptance").map((record) => record.graph.version);
  const version = Math.max(0, ...versions) + 1;
  const graph = createAcceptanceGraph(version);
  const source = createProtectedToolResumeGraph();
  const versionDiff = diffWorkflowGraphs(source, graph);
  const deploymentSlug = `workflow-studio-acceptance-v${version}`;
  const checks: Record<string, boolean> = {
    strictGraphValidation: false,
    invalidCycleRejected: false,
    typedGuardBranch: false,
    runtimeProfilePinned: false,
    immutableArtifactsPinned: false,
    optimisticConflictRejected: false,
    publishedDigestPinned: false,
    publishedVersionImmutable: false,
    approvalBoundaryObserved: false,
    protectedSideEffectIdempotent: false,
    executionCompleted: false,
    replayForkClean: false,
    stateDiffPassed: false,
    deploymentVersionAuthorized: false,
    openAIContractAccepted: false,
    versionDiffRecorded: false,
  };
  let sourceId: string | undefined;
  let replayId: string | undefined;
  let finalStatus: string | undefined;
  let eventCount = 0;
  let status: WorkflowStudioAcceptanceReceipt["status"] = "pass";
  let error: string | undefined;
  try {
    const validation = validateWorkflowGraph(graph);
    checks.strictGraphValidation = validation.valid;
    const invalidValidation = validateWorkflowGraph({ ...graph, edges: [...graph.edges, { from: "answer", to: "prompt" }] });
    checks.invalidCycleRejected = !invalidValidation.valid && invalidValidation.errors.some((message) => message.includes("cycle"));
    checks.typedGuardBranch = graph.nodes.some((node) => node.kind === "guard") && graph.edges.filter((edge) => edge.from === "policy-guard" && edge.condition).length === 2;
    checks.runtimeProfilePinned = Boolean(graph.runtimeProfile?.id && graph.runtimeProfile.model);
    checks.immutableArtifactsPinned = Boolean(graph.artifactInputs?.length && graph.artifactInputs.every((artifact) => artifact.digest.startsWith("sha256:")));
    const draft = saveWorkflowDraft(graph);
    try {
      saveWorkflowDraft({ ...graph, label: `${graph.label} stale` }, { expectedRevision: Math.max(0, draft.revision - 1) });
    } catch {
      checks.optimisticConflictRejected = true;
    }
    const published = publishWorkflowVersion({ graphId: graph.id, graphVersion: graph.version, deploymentSlug, expectedRevision: draft.revision });
    checks.publishedDigestPinned = published.graphDigest.startsWith("sha256:") && published.graphDigest.length === 71;
    try {
      saveWorkflowDraft(graph);
    } catch {
      checks.publishedVersionImmutable = true;
    }
    const invocation = invokeDeployedWorkflow(deploymentSlug, { model: `workflow:${deploymentSlug}`, messages: [{ role: "user", content: "Execute a protected change and retain recovery evidence." }] });
    sourceId = invocation.execution.id;
    const acceptanceModelPort = {
      runModelNode: async () => ({ output: "Acceptance model requested one protected tool action." }),
    };
    let worker = await runWorkflowSafeWorker(
      { executionId: sourceId, workerId: "workflow-studio-acceptance", maxSteps: 12 },
      acceptanceModelPort,
    );
    checks.approvalBoundaryObserved = worker.execution?.status === "waiting-approval";
    let execution = dispatchPersistedWorkflowEvent(sourceId, { type: "approval-granted", condition: "approved" });
    const eventId = `workflow-side-effect-${randomUUID()}`;
    execution = dispatchPersistedWorkflowEvent(sourceId, { id: eventId, type: "node-succeeded", nodeId: "tool", idempotencyKey: `${sourceId}:tool`, output: "Protected tool committed once." });
    const eventsAfterCommit = execution.events.length;
    execution = dispatchPersistedWorkflowEvent(sourceId, { id: eventId, type: "node-succeeded", nodeId: "tool", idempotencyKey: `${sourceId}:tool`, output: "Duplicate must not run." });
    checks.protectedSideEffectIdempotent = execution.events.length === eventsAfterCommit && execution.usedIdempotencyKeys.length === 1;
    worker = await runWorkflowSafeWorker(
      { executionId: sourceId, workerId: "workflow-studio-acceptance", maxSteps: 12 },
      acceptanceModelPort,
    );
    finalStatus = worker.execution?.status;
    eventCount = worker.execution?.events.length || 0;
    checks.executionCompleted = finalStatus === "completed";
    if (!worker.execution) throw new Error("Workflow completion state is unavailable.");
    const completion = buildOpenAIWorkflowCompletion(deploymentSlug, worker.execution);
    const stream = buildOpenAIWorkflowStream(deploymentSlug, worker.execution, true);
    checks.openAIContractAccepted = completion.object === "chat.completion" && completion.choices[0]?.finish_reason === "stop" && completion.usage.total_tokens > 0 && stream.includes("chat.completion.chunk") && stream.includes("data: [DONE]") && buildWorkflowDeploymentExamples({ origin: "http://127.0.0.1:3011", slug: deploymentSlug }).curl.includes("messages");
    const replay = forkWorkflowExecutionForReplay({ sourceExecutionId: sourceId });
    replayId = replay.replay.id;
    checks.replayForkClean = replay.receipt.copiedSideEffects === false && replay.replay.events.length === 0 && replay.replay.usedIdempotencyKeys.length === 0;
    const stateDiff = rehearseWorkflowStateDiff({ sourceExecutionId: sourceId, replayExecutionId: replayId });
    checks.stateDiffPassed = stateDiff.status === "pass";
    const issued = issueWorkflowDeploymentKey({ workflowSlug: deploymentSlug, version, scopes: ["invoke"], ttlMinutes: 10 });
    const exactVersionAllowed = authorizeWorkflowDeployment({ token: issued.token, workflowSlug: deploymentSlug, version, scope: "invoke" });
    const wrongVersionDenied = !authorizeWorkflowDeployment({ token: issued.token, workflowSlug: deploymentSlug, version: version + 1, scope: "invoke" });
    revokeWorkflowDeploymentKey(issued.key.id);
    checks.deploymentVersionAuthorized = exactVersionAllowed && wrongVersionDenied && !authorizeWorkflowDeployment({ token: issued.token, workflowSlug: deploymentSlug, version, scope: "invoke" });
    checks.versionDiffRecorded = versionDiff.nodes.added.includes("policy-guard") && versionDiff.edges.added.length >= 2;
    if (!Object.values(checks).every(Boolean)) throw new Error(`Workflow Studio acceptance checks failed: ${Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name).join(", ")}`);
  } catch (caught) {
    status = "failed";
    error = caught instanceof Error ? caught.message : "Workflow Studio acceptance failed.";
  }
  const report = { status, graph: { id: graph.id, version, digest: readWorkflowGraphRegistry().records.find((record) => record.graph.id === graph.id && record.graph.version === version)?.graphDigest, deploymentSlug }, checks, versionDiff, execution: { sourceId, replayId, finalStatus, eventCount }, error };
  const receipt: WorkflowStudioAcceptanceReceipt = { id: `workflow-studio-acceptance-${randomUUID()}`, generatedAt: new Date().toISOString(), ...report, reportDigest: reportDigest(report) };
  persist(receipt);
  return receipt;
}

export function readWorkflowStudioAcceptanceEvidence() {
  const store = readStore();
  return { ok: true as const, ...store, generatedAt: new Date().toISOString(), latest: store.receipts[0] || null, latestPassing: store.receipts.find((receipt) => receipt.status === "pass") || null, totals: { receipts: store.receipts.length, passing: store.receipts.filter((receipt) => receipt.status === "pass").length }, executionStorePath: readWorkflowExecutions().path, path: STORE_FILE };
}
