import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { readDurableJsonStore, updateDurableJsonStore } from "@/features/persistence/durable-json-store";
import { createPersistedWorkflowExecution, readWorkflowExecutions } from "@/features/workflows/execution-reducer";
import { resolveWorkflowGraph } from "@/features/workflows/graph-registry";

export const WORKFLOW_REPLAY_SCHEMA_VERSION = "workflows.replay-fork.v1" as const;
type ReplayReceipt = { id: string; generatedAt: string; sourceExecutionId: string; replayExecutionId: string; graphId: string; graphVersion: number; copiedSideEffects: false; status: "pass" };
type ReplayStore = { schemaVersion: typeof WORKFLOW_REPLAY_SCHEMA_VERSION; receipts: ReplayReceipt[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "workflow-replay-forks.json");
function isReplayStore(value: unknown): value is ReplayStore { if (!value || typeof value !== "object") return false; const candidate = value as Partial<ReplayStore>; return candidate.schemaVersion === WORKFLOW_REPLAY_SCHEMA_VERSION && Array.isArray(candidate.receipts); }
const storeOptions = { filePath: STORE_FILE, initial: (): ReplayStore => ({ schemaVersion: WORKFLOW_REPLAY_SCHEMA_VERSION, receipts: [] }), validate: isReplayStore };
function readReceipts() { return readDurableJsonStore(storeOptions).receipts; }
function persist(receipt: ReplayReceipt) { updateDurableJsonStore(storeOptions, (store) => ({ ...store, receipts: [receipt, ...store.receipts].slice(0, 200) })); }

export function forkWorkflowExecutionForReplay(input: { sourceExecutionId: string; inputOverride?: string }) {
  const source = readWorkflowExecutions().executions.find((entry) => entry.id === input.sourceExecutionId); if (!source) throw new Error("Source workflow execution was not found.");
  const graph = resolveWorkflowGraph(source.graphId, source.graphVersion); if (!graph) throw new Error("Source workflow graph version is unavailable.");
  const replay = createPersistedWorkflowExecution(input.inputOverride?.trim() || source.input, graph);
  const receipt: ReplayReceipt = { id: `workflow-replay-${randomUUID()}`, generatedAt: new Date().toISOString(), sourceExecutionId: source.id, replayExecutionId: replay.id, graphId: graph.id, graphVersion: graph.version, copiedSideEffects: false, status: "pass" };
  persist(receipt); return { receipt, replay };
}

export function readWorkflowReplayEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: WORKFLOW_REPLAY_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, path: STORE_FILE }; }
