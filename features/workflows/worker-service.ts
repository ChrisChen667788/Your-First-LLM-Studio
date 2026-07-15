import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { dispatchPersistedWorkflowEvent, readWorkflowExecutions, type WorkflowExecutionState } from "@/features/workflows/execution-reducer";
import { resolveWorkflowGraph } from "@/features/workflows/graph-registry";

export const WORKFLOW_WORKER_SCHEMA_VERSION = "workflows.safe-worker.v1" as const;
type Lease = { executionId: string; workerId: string; acquiredAt: string; expiresAt: string };
type WorkerReceipt = { id: string; generatedAt: string; executionId: string; workerId: string; status: "pass" | "failed"; outcome: "completed" | "waiting-approval" | "paused-breakpoint" | "protected-side-effect" | "step-budget" | "failed"; steps: number; leaseAcquired: boolean; leaseReleased: boolean; error?: string };
type Store = { schemaVersion: typeof WORKFLOW_WORKER_SCHEMA_VERSION; leases: Lease[]; receipts: WorkerReceipt[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "workflow-worker.json");
function readStore(): Store { if (!existsSync(STORE_FILE)) return { schemaVersion: WORKFLOW_WORKER_SCHEMA_VERSION, leases: [], receipts: [] }; try { const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Partial<Store>; return { schemaVersion: WORKFLOW_WORKER_SCHEMA_VERSION, leases: Array.isArray(parsed.leases) ? parsed.leases : [], receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [] }; } catch { return { schemaVersion: WORKFLOW_WORKER_SCHEMA_VERSION, leases: [], receipts: [] }; } }
function writeStore(store: Store) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8"); }
function executionById(id: string) { return readWorkflowExecutions().executions.find((entry) => entry.id === id) || null; }
function acquireLease(executionId: string, workerId: string) {
  const store = readStore(); const now = Date.now(); const active = store.leases.find((lease) => lease.executionId === executionId && Date.parse(lease.expiresAt) > now && lease.workerId !== workerId);
  if (active) throw new Error(`Workflow execution is leased by ${active.workerId}.`);
  const lease: Lease = { executionId, workerId, acquiredAt: new Date(now).toISOString(), expiresAt: new Date(now + 30_000).toISOString() };
  writeStore({ ...store, leases: [lease, ...store.leases.filter((entry) => entry.executionId !== executionId)].slice(0, 100) }); return lease;
}
function releaseLease(executionId: string, receipt: WorkerReceipt) { const store = readStore(); writeStore({ ...store, leases: store.leases.filter((entry) => entry.executionId !== executionId), receipts: [receipt, ...store.receipts].slice(0, 200) }); }

export function runWorkflowSafeWorker(input: { executionId: string; workerId?: string; maxSteps?: number }) {
  const workerId = input.workerId?.trim() || `local-worker-${process.pid}`; const maxSteps = Math.max(1, Math.min(input.maxSteps || 12, 50));
  acquireLease(input.executionId, workerId); let state = executionById(input.executionId); let steps = 0; let outcome: WorkerReceipt["outcome"] = "failed"; let error: string | undefined;
  try {
    if (!state) throw new Error("Workflow execution was not found.");
    if (state.status === "idle") state = dispatchPersistedWorkflowEvent(state.id, { type: "start" });
    while (state.status === "running" && steps < maxSteps) {
      const graph = resolveWorkflowGraph(state.graphId, state.graphVersion); if (!graph) throw new Error("Workflow graph version is unavailable.");
      const node = graph.nodes.find((entry) => entry.id === state?.currentNodeId); if (!node) throw new Error("Current workflow node is unavailable.");
      if (node.sideEffect === "write" || node.sideEffect === "external") { outcome = "protected-side-effect"; break; }
      state = dispatchPersistedWorkflowEvent(state.id, { type: "node-succeeded", nodeId: node.id, condition: node.kind === "model" ? "protected_tool_requested" : undefined, output: node.kind === "output" ? `Workflow completed for: ${state.input}` : `${node.label} completed by safe worker.` });
      steps += 1;
    }
    if (state.status === "completed") outcome = "completed";
    else if (state.status === "waiting-approval") outcome = "waiting-approval";
    else if (state.status === "paused-breakpoint") outcome = "paused-breakpoint";
    else if (steps >= maxSteps && state.status === "running") outcome = "step-budget";
    else if (state.status === "failed") { outcome = "failed"; error = state.error || "Workflow execution failed."; }
    else if (outcome === "failed") outcome = "protected-side-effect";
  } catch (caught) { error = caught instanceof Error ? caught.message : "Workflow worker failed."; outcome = "failed"; }
  const receipt: WorkerReceipt = { id: `workflow-worker-${randomUUID()}`, generatedAt: new Date().toISOString(), executionId: input.executionId, workerId, status: outcome === "failed" ? "failed" : "pass", outcome, steps, leaseAcquired: true, leaseReleased: true, error };
  releaseLease(input.executionId, receipt);
  return { receipt, execution: executionById(input.executionId) as WorkflowExecutionState | null };
}

export function readWorkflowWorkerEvidence() { const store = readStore(); return { ...store, ok: true as const, schemaVersion: WORKFLOW_WORKER_SCHEMA_VERSION, generatedAt: new Date().toISOString(), latestPassing: store.receipts.find((receipt) => receipt.status === "pass") || null, totals: { activeLeases: store.leases.filter((lease) => Date.parse(lease.expiresAt) > Date.now()).length, receipts: store.receipts.length, completed: store.receipts.filter((receipt) => receipt.outcome === "completed").length }, path: STORE_FILE }; }
