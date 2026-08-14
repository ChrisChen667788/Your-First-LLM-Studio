import { createHash, randomUUID } from "node:crypto";

import {
  buildWorkflowUpstreamContext,
  findLatestWorkflowNodeEnvelope,
} from "@/features/workflows/node-execution-contract";
import { readWorkflowNodeExecutorCapabilities } from "@/features/workflows/node-executor-registry";
import {
  WORKFLOW_GRAPH_SCHEMA_VERSION,
  type WorkflowGraph,
} from "@/features/workflows/graph-contract";
import {
  publishWorkflowVersion,
  readWorkflowGraphRegistry,
  saveWorkflowDraft,
} from "@/features/workflows/graph-registry";
import {
  createPersistedWorkflowExecution,
} from "@/features/workflows/execution-reducer";
import { runWorkflowSafeWorker } from "@/features/workflows/worker-service";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const WORKFLOW_EXECUTION_CLOSURE_SCHEMA_VERSION =
  "workflows.execution-closure.v1" as const;
const STORE_SCHEMA_VERSION = "workflows.execution-closure-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.6.7-workflow-execution-closure.json",
);

type Slice = {
  id: string;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type WorkflowExecutionClosureReceipt = {
  id: string;
  generatedAt: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  executions: {
    mixedGraphId: string | null;
    readOnlyToolGraphId: string | null;
    protectedToolGraphId: string | null;
  };
  slices: Slice[];
  totals: { slices: 15; passed: number; held: number };
  evidenceDigest: string;
  disclosure: string;
  error?: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slice(
  id: string,
  label: string,
  passed: boolean,
  summary: string,
): Slice {
  return { id, label, status: passed ? "pass" : "hold", summary };
}

function mixedGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    id: "workflow-execution-closure",
    version: 1,
    label: "Workflow execution closure v1",
    nodes: [
      { id: "input", kind: "input", label: "Question", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "retrieval", kind: "retrieval", label: "Local evidence", config: { topK: 4, aclRequired: false }, sideEffect: "read", resumePolicy: "replay-safe" },
      { id: "model", kind: "model", label: "Grounded response", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "evaluator", kind: "evaluator", label: "Citation evaluator", config: { minimumCitations: 1 }, sideEffect: "read", resumePolicy: "replay-safe" },
      { id: "guard", kind: "guard", label: "Evaluation gate", config: { expression: "evaluation.passed == true", trueCondition: "passed", falseCondition: "failed" }, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "accepted", kind: "output", label: "Accepted output", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "rejected", kind: "output", label: "Rejected output", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
    ],
    edges: [
      { from: "input", to: "retrieval" },
      { from: "retrieval", to: "model" },
      { from: "model", to: "evaluator" },
      { from: "evaluator", to: "guard" },
      { from: "guard", to: "accepted", condition: "passed" },
      { from: "guard", to: "rejected", condition: "failed" },
    ],
    runtimeProfile: { id: "workflow-execution-closure", label: "Execution closure", target: "local-first", model: "acceptance-port", temperature: 0, maxTokens: 256, contextWindow: 8192, toolMode: "off" },
    artifactInputs: [{ id: "workflow-execution-closure-prompt", kind: "prompt", digest: "sha256:workflow-execution-closure-v1" }],
  };
}

function readOnlyToolGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    id: "workflow-read-only-tool-acceptance",
    version: 1,
    label: "Workflow read-only tool acceptance v1",
    nodes: [
      { id: "input", kind: "input", label: "Request", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "read-version", kind: "tool", label: "Read VERSION", config: { toolName: "read_file", path: "VERSION", startLine: 1, endLine: 4 }, sideEffect: "read", resumePolicy: "replay-safe" },
      { id: "output", kind: "output", label: "Tool output", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
    ],
    edges: [
      { from: "input", to: "read-version" },
      { from: "read-version", to: "output" },
    ],
    artifactInputs: [{ id: "version-source", kind: "prompt", digest: "sha256:repository-version-source" }],
  };
}

function protectedToolGraph(): WorkflowGraph {
  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    id: "workflow-protected-tool-boundary",
    version: 1,
    label: "Workflow protected tool boundary v1",
    nodes: [
      { id: "input", kind: "input", label: "Request", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
      { id: "write", kind: "tool", label: "Protected write", config: { toolName: "write_file", protected: true }, sideEffect: "write", resumePolicy: "idempotency-key" },
      { id: "output", kind: "output", label: "Output", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
    ],
    edges: [
      { from: "input", to: "write" },
      { from: "write", to: "output" },
    ],
    artifactInputs: [{ id: "protected-tool-policy", kind: "tool-policy", digest: "sha256:workflow-protected-tool-policy" }],
  };
}

function ensurePublished(graph: WorkflowGraph) {
  const existing = readWorkflowGraphRegistry().records.find(
    (record) =>
      record.graph.id === graph.id && record.graph.version === graph.version,
  );
  if (existing?.state === "published") return existing;
  const draft = existing || saveWorkflowDraft(graph);
  return publishWorkflowVersion({
    graphId: graph.id,
    graphVersion: graph.version,
    deploymentSlug: graph.id,
    expectedRevision: draft.revision,
  });
}

export async function runWorkflowExecutionClosureAcceptance() {
  const slices: Slice[] = [];
  let mixedGraphId: string | null = null;
  let readOnlyToolGraphId: string | null = null;
  let protectedToolGraphId: string | null = null;
  let error: string | undefined;
  try {
    const capabilities = readWorkflowNodeExecutorCapabilities();
    slices.push(slice("registry-schema", "Typed executor registry", capabilities.schemaVersion === "workflows.node-executor-registry.v1", capabilities.schemaVersion));
    slices.push(slice("executor-coverage", "Executor kind coverage", capabilities.executors.length === 8, `${capabilities.executors.length}/8 executors.`));

    const graph = mixedGraph();
    const published = ensurePublished(graph);
    slices.push(slice("mixed-graph-published", "Mixed graph published", published.state === "published", published.graphDigest));
    const execution = createPersistedWorkflowExecution(
      "Explain the benchmark dataset catalog using retrieved evidence.",
      graph,
    );
    mixedGraphId = execution.id;
    let retrievalContextObserved = false;
    const mixed = await runWorkflowSafeWorker(
      { executionId: execution.id, workerId: "v167-workflow-acceptance", maxSteps: 12 },
      {
        runModelNode: async (input) => {
          const context = buildWorkflowUpstreamContext(input.state, input.graph);
          retrievalContextObserved = context.includes("local-hybrid-rerank");
          const retrieval = findLatestWorkflowNodeEnvelope(input.state, input.graph, "retrieval")?.data.retrieval as { results?: Array<{ citationLabel?: string }> } | undefined;
          const citation = retrieval?.results?.[0]?.citationLabel || "[R1]";
          return { output: `The benchmark catalog is available as workflow evidence ${citation}.` };
        },
      },
    );
    const mixedExecution = mixed.execution;
    const retrievalEnvelope = mixedExecution
      ? findLatestWorkflowNodeEnvelope(mixedExecution, graph, "retrieval")
      : null;
    const evaluatorEnvelope = mixedExecution
      ? findLatestWorkflowNodeEnvelope(mixedExecution, graph, "evaluator")
      : null;
    const guardEnvelope = mixedExecution
      ? findLatestWorkflowNodeEnvelope(mixedExecution, graph, "guard")
      : null;
    slices.push(slice("input-executed", "Input executor", mixed.receipt.executedNodes?.some((entry) => entry.kind === "input") === true, "Input entered the registry."));
    slices.push(slice("retrieval-executed", "Real retrieval executor", retrievalEnvelope?.data.backend === "local-hybrid-rerank", retrievalEnvelope?.summary || "Retrieval output missing."));
    const retrieval = retrievalEnvelope?.data.retrieval as { hitCount?: number } | undefined;
    slices.push(slice("retrieval-hits", "Retrieval evidence available", (retrieval?.hitCount || 0) > 0, `${retrieval?.hitCount || 0} hits.`));
    slices.push(slice("provider-context", "Provider upstream context", retrievalContextObserved, "The model port observed typed retrieval evidence."));
    slices.push(slice("citation-evaluator", "Citation evaluator", evaluatorEnvelope?.data.passed === true, evaluatorEnvelope?.summary || "Evaluator output missing."));
    slices.push(slice("typed-guard", "Typed guard branch", guardEnvelope?.data.condition === "passed", String(guardEnvelope?.data.condition || "missing")));
    slices.push(slice("mixed-completion", "Mixed workflow completion", mixed.receipt.outcome === "completed" && mixedExecution?.status === "completed", `${mixed.receipt.outcome}/${mixedExecution?.status || "missing"}`));
    slices.push(slice("final-output", "Final model output", mixedExecution?.output?.includes("benchmark catalog") === true, mixedExecution?.output || "Output missing."));

    const readGraph = readOnlyToolGraph();
    ensurePublished(readGraph);
    const readExecution = createPersistedWorkflowExecution("Read the repository version.", readGraph);
    readOnlyToolGraphId = readExecution.id;
    const readWorker = await runWorkflowSafeWorker({ executionId: readExecution.id, workerId: "v167-read-tool", maxSteps: 6 });
    const readEnvelope = readWorker.execution
      ? findLatestWorkflowNodeEnvelope(readWorker.execution, readGraph, "tool")
      : null;
    slices.push(slice("read-tool-executed", "Read-only tool execution", readWorker.receipt.executedNodes?.some((entry) => entry.executorId === "workspace-tool:read_file") === true, readEnvelope?.summary || "Read tool output missing."));
    slices.push(slice("read-tool-evidence", "Read-only tool evidence", String(readEnvelope?.data.output || "").includes("1.5.1"), "VERSION was read through the workspace tool port."));

    const protectedGraph = protectedToolGraph();
    ensurePublished(protectedGraph);
    const protectedExecution = createPersistedWorkflowExecution("Write a protected file.", protectedGraph);
    protectedToolGraphId = protectedExecution.id;
    const protectedWorker = await runWorkflowSafeWorker({ executionId: protectedExecution.id, workerId: "v167-protected-tool", maxSteps: 6 });
    const protectedToolExecuted = protectedWorker.receipt.executedNodes?.some((entry) => entry.nodeId === "write") === true;
    slices.push(slice("protected-write-blocked", "Protected write boundary", protectedWorker.receipt.outcome === "protected-side-effect" && !protectedToolExecuted, `${protectedWorker.receipt.outcome}; executed=${protectedToolExecuted}`));
    slices.push(slice("production-truth", "Production truth boundary", true, "Local executor acceptance does not promote distributed or production readiness."));
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Workflow execution closure acceptance failed.";
  }

  while (slices.length < 15) {
    slices.push(slice(`acceptance-error-${slices.length + 1}`, "Acceptance interrupted", false, error || "Acceptance did not reach this slice."));
  }
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const withoutDigest = {
    id: `v167-workflow-execution-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    localStatus: passed === 15 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    executions: { mixedGraphId, readOnlyToolGraphId, protectedToolGraphId },
    slices,
    totals: { slices: 15 as const, passed, held: 15 - passed },
    disclosure:
      "This receipt proves local node-executor orchestration with a deterministic acceptance model port. It is not model-quality, distributed-worker, enterprise ACL, or production evidence.",
    error,
  };
  const receipt: WorkflowExecutionClosureReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readWorkflowExecutionClosureEvidence() {
  const receipts = readDurableReceipts<WorkflowExecutionClosureReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: WORKFLOW_EXECUTION_CLOSURE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: receipts[0]?.localStatus || ("evidence-needed" as const),
    productionStatus: "hold" as const,
    latest: receipts[0] || null,
    latestPassing:
      receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    capabilities: readWorkflowNodeExecutorCapabilities(),
    receiptPath: RECEIPT_PATH,
  };
}
