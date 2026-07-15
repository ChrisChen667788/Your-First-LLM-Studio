import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { createPersistedWorkflowExecution, readWorkflowExecutions } from "@/features/workflows/execution-reducer";
import { resolveWorkflowGraph } from "@/features/workflows/graph-registry";

export const WORKFLOW_REPLAY_SCHEMA_VERSION = "workflows.replay-fork.v1" as const;
type ReplayReceipt = { id: string; generatedAt: string; sourceExecutionId: string; replayExecutionId: string; graphId: string; graphVersion: number; copiedSideEffects: false; status: "pass" };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "workflow-replay-forks.json");
function readReceipts(): ReplayReceipt[] { if (!existsSync(STORE_FILE)) return []; try { const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: ReplayReceipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; } }
function persist(receipt: ReplayReceipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: WORKFLOW_REPLAY_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 200) }, null, 2)}\n`, "utf8"); }

export function forkWorkflowExecutionForReplay(input: { sourceExecutionId: string; inputOverride?: string }) {
  const source = readWorkflowExecutions().executions.find((entry) => entry.id === input.sourceExecutionId); if (!source) throw new Error("Source workflow execution was not found.");
  const graph = resolveWorkflowGraph(source.graphId, source.graphVersion); if (!graph) throw new Error("Source workflow graph version is unavailable.");
  const replay = createPersistedWorkflowExecution(input.inputOverride?.trim() || source.input, graph);
  const receipt: ReplayReceipt = { id: `workflow-replay-${randomUUID()}`, generatedAt: new Date().toISOString(), sourceExecutionId: source.id, replayExecutionId: replay.id, graphId: graph.id, graphVersion: graph.version, copiedSideEffects: false, status: "pass" };
  persist(receipt); return { receipt, replay };
}

export function readWorkflowReplayEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: WORKFLOW_REPLAY_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, path: STORE_FILE }; }
