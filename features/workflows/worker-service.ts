import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { readDurableJsonStore, updateDurableJsonStore } from "@/features/persistence/durable-json-store";
import { dispatchPersistedWorkflowEvent, readWorkflowExecutions, type WorkflowExecutionState } from "@/features/workflows/execution-reducer";
import { resolveWorkflowGraph } from "@/features/workflows/graph-registry";
import {
  claimWorkflowLeasePolicy,
  heartbeatWorkflowLeasePolicy,
  releaseWorkflowLeasePolicy,
  type WorkflowWorkerLease,
} from "@/features/workflows/worker-lease-policy";
import { executeWorkflowModelNode } from "@/features/workflows/model-provider-port";
import {
  createWorkflowNodeExecutorRegistry,
  executeWorkflowNode,
} from "@/features/workflows/node-executor-registry";
import type {
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutorRegistry,
} from "@/features/workflows/node-execution-contract";
import type { WorkflowGraph, WorkflowNode } from "@/features/workflows/graph-contract";

export const WORKFLOW_WORKER_SCHEMA_VERSION = "workflows.safe-worker.v1" as const;
type WorkerReceipt = { id: string; generatedAt: string; executionId: string; workerId: string; fenceToken: number; recoveryCount: number; status: "pass" | "failed"; outcome: "completed" | "waiting-approval" | "paused-breakpoint" | "protected-side-effect" | "step-budget" | "failed"; steps: number; leaseAcquired: boolean; leaseReleased: boolean; executorSchemaVersion?: "workflows.node-executor-registry.v1"; executedNodes?: Array<{ nodeId: string; kind: WorkflowNode["kind"]; executorId: string }>; error?: string };
type Store = { schemaVersion: typeof WORKFLOW_WORKER_SCHEMA_VERSION; leases: WorkflowWorkerLease[]; receipts: WorkerReceipt[]; fenceTokens?: Record<string, number> };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "workflow-worker.json");
function isWorkerStore(value: unknown): value is Store { if (!value || typeof value !== "object") return false; const candidate = value as Partial<Store>; return candidate.schemaVersion === WORKFLOW_WORKER_SCHEMA_VERSION && Array.isArray(candidate.leases) && Array.isArray(candidate.receipts); }
const storeOptions = { filePath: STORE_FILE, initial: (): Store => ({ schemaVersion: WORKFLOW_WORKER_SCHEMA_VERSION, leases: [], receipts: [], fenceTokens: {} }), validate: isWorkerStore };
function readStore() { return readDurableJsonStore(storeOptions); }
function executionById(id: string) { return readWorkflowExecutions().executions.find((entry) => entry.id === id) || null; }
function acquireLease(executionId: string, workerId: string) {
  const now = Date.now();
  const updated = updateDurableJsonStore(storeOptions, (store) => {
    const current = store.leases.find((entry) => entry.executionId === executionId) || null;
    const lease = claimWorkflowLeasePolicy({
      executionId,
      workerId,
      current,
      previousFenceToken: store.fenceTokens?.[executionId] || 0,
      now,
      ttlMs: 30_000,
    });
    return {
      ...store,
      leases: [lease, ...store.leases.filter((entry) => entry.executionId !== executionId)].slice(0, 100),
      fenceTokens: { ...(store.fenceTokens || {}), [executionId]: lease.fenceToken },
    };
  });
  const lease = updated.leases.find((entry) => entry.executionId === executionId);
  if (!lease) throw new Error("Workflow lease acquisition did not complete.");
  return lease;
}
function releaseLease(lease: WorkflowWorkerLease, receipt: WorkerReceipt) {
  updateDurableJsonStore(storeOptions, (store) => {
    const current = store.leases.find((entry) => entry.executionId === lease.executionId) || null;
    releaseWorkflowLeasePolicy({ current, workerId: lease.workerId, fenceToken: lease.fenceToken });
    return { ...store, leases: store.leases.filter((entry) => entry.executionId !== lease.executionId), receipts: [receipt, ...store.receipts].slice(0, 200) };
  });
}

export function heartbeatWorkflowWorkerLease(input: { executionId: string; workerId: string; fenceToken: number }) {
  const updated = updateDurableJsonStore(storeOptions, (store) => {
    const current = store.leases.find((entry) => entry.executionId === input.executionId) || null;
    const heartbeat = heartbeatWorkflowLeasePolicy({ ...input, current, now: Date.now(), ttlMs: 30_000 });
    return { ...store, leases: [heartbeat, ...store.leases.filter((entry) => entry.executionId !== input.executionId)].slice(0, 100) };
  });
  const heartbeat = updated.leases.find((entry) => entry.executionId === input.executionId);
  if (!heartbeat) throw new Error("Workflow lease heartbeat did not complete.");
  return heartbeat;
}

type WorkflowModelNodeRunner = (input: {
  graph: WorkflowGraph;
  node: WorkflowNode;
  state: WorkflowExecutionState;
}) => Promise<{ output: string }>;

type WorkflowWorkerDependencies = {
  runModelNode?: WorkflowModelNodeRunner;
  executorRegistry?: WorkflowNodeExecutorRegistry;
  executeNode?: (input: {
    graph: WorkflowGraph;
    node: WorkflowNode;
    state: WorkflowExecutionState;
  }) => Promise<WorkflowNodeExecutionResult>;
};

function inferredCondition(graph: WorkflowGraph, node: WorkflowNode) {
  const configured =
    typeof node.config.defaultCondition === "string"
      ? node.config.defaultCondition.trim()
      : "";
  if (configured) return configured;
  const outgoing = graph.edges.filter((edge) => edge.from === node.id);
  return outgoing.length === 1 ? outgoing[0]?.condition : undefined;
}

export async function runWorkflowSafeWorker(
  input: { executionId: string; workerId?: string; maxSteps?: number },
  dependencies: WorkflowWorkerDependencies = {},
) {
  const workerId = input.workerId?.trim() || `local-worker-${process.pid}`; const maxSteps = Math.max(1, Math.min(input.maxSteps || 12, 50));
  const registry =
    dependencies.executorRegistry ||
    createWorkflowNodeExecutorRegistry({
      runModelNode: dependencies.runModelNode || executeWorkflowModelNode,
    });
  const runNode =
    dependencies.executeNode ||
    ((nodeInput: Parameters<typeof executeWorkflowNode>[0]) =>
      executeWorkflowNode(nodeInput, registry));
  const lease = acquireLease(input.executionId, workerId); let state = executionById(input.executionId); let steps = 0; let outcome: WorkerReceipt["outcome"] = "failed"; let error: string | undefined; const executedNodes: NonNullable<WorkerReceipt["executedNodes"]> = [];
  try {
    if (!state) throw new Error("Workflow execution was not found.");
    if (state.status === "idle") state = dispatchPersistedWorkflowEvent(state.id, { type: "start" });
    while (state.status === "running" && steps < maxSteps) {
      const graph = resolveWorkflowGraph(state.graphId, state.graphVersion); if (!graph) throw new Error("Workflow graph version is unavailable.");
      const node = graph.nodes.find((entry) => entry.id === state?.currentNodeId); if (!node) throw new Error("Current workflow node is unavailable.");
      if (node.sideEffect === "write" || node.sideEffect === "external") { outcome = "protected-side-effect"; break; }
      const nodeResult = await runNode({ graph, node, state });
      const condition = nodeResult.condition || inferredCondition(graph, node);
      executedNodes.push({
        nodeId: node.id,
        kind: node.kind,
        executorId: nodeResult.executorId,
      });
      state = dispatchPersistedWorkflowEvent(state.id, {
        type: "node-succeeded",
        nodeId: node.id,
        condition,
        output: nodeResult.output,
      });
      steps += 1;
    }
    if (state.status === "completed") outcome = "completed";
    else if (state.status === "waiting-approval") outcome = "waiting-approval";
    else if (state.status === "paused-breakpoint") outcome = "paused-breakpoint";
    else if (steps >= maxSteps && state.status === "running") outcome = "step-budget";
    else if (state.status === "failed") { outcome = "failed"; error = state.error || "Workflow execution failed."; }
    else if (outcome === "failed") outcome = "protected-side-effect";
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Workflow worker failed.";
    outcome = "failed";
    if (state?.status === "running") {
      try {
        state = dispatchPersistedWorkflowEvent(state.id, { type: "failed", error });
      } catch {
        // Preserve the original provider or worker error in the receipt.
      }
    }
  }
  const receipt: WorkerReceipt = { id: `workflow-worker-${randomUUID()}`, generatedAt: new Date().toISOString(), executionId: input.executionId, workerId, fenceToken: lease.fenceToken, recoveryCount: lease.recoveryCount, status: outcome === "failed" ? "failed" : "pass", outcome, steps, leaseAcquired: true, leaseReleased: true, executorSchemaVersion: "workflows.node-executor-registry.v1", executedNodes, error };
  releaseLease(lease, receipt);
  return { receipt, execution: executionById(input.executionId) as WorkflowExecutionState | null };
}

export function readWorkflowWorkerEvidence() { const store = readStore(); return { ...store, ok: true as const, schemaVersion: WORKFLOW_WORKER_SCHEMA_VERSION, generatedAt: new Date().toISOString(), latestPassing: store.receipts.find((receipt) => receipt.status === "pass") || null, totals: { activeLeases: store.leases.filter((lease) => Date.parse(lease.expiresAt) > Date.now()).length, receipts: store.receipts.length, completed: store.receipts.filter((receipt) => receipt.outcome === "completed").length }, path: STORE_FILE }; }
