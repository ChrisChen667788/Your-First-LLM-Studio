import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { readModelCompatibilityEvidence } from "@/features/models/compatibility-manifest";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";

export const MODEL_BENCHMARK_HANDOFF_SCHEMA_VERSION = "models.benchmark-handoff.v1" as const;
type Receipt = { id: string; generatedAt: string; status: "ready" | "hold"; modelId: string; targetId: string; promptSetId: string; compatibilityReceiptId?: string; benchmarkRequest: { targetIds: string[]; benchmarkMode: "suite"; promptSetId: string; runs: number; contextWindow: number }; blockers: string[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability"); const STORE_FILE = path.join(DATA_DIR, "model-benchmark-handoffs.json");
function readReceipts(): Receipt[] { return readDurableReceipts(STORE_FILE, MODEL_BENCHMARK_HANDOFF_SCHEMA_VERSION); }
function persist(receipt: Receipt) { prependDurableReceipt(STORE_FILE, MODEL_BENCHMARK_HANDOFF_SCHEMA_VERSION, receipt, 200); }
export function createModelBenchmarkHandoff(input: { modelId: string; targetId: string; promptSetId?: string; runs?: number; contextWindow?: number }) { const compatibility = readModelCompatibilityEvidence().receipts.find((entry) => entry.modelId === input.modelId && entry.status === "pass"); const blockers = compatibility ? [] : ["A passing compatibility manifest is required before benchmark handoff."]; const promptSetId = input.promptSetId?.trim() || "milestone-formal"; const receipt: Receipt = { id: `model-benchmark-${randomUUID()}`, generatedAt: new Date().toISOString(), status: blockers.length ? "hold" : "ready", modelId: input.modelId, targetId: input.targetId, promptSetId, compatibilityReceiptId: compatibility?.id, benchmarkRequest: { targetIds: [input.targetId], benchmarkMode: "suite", promptSetId, runs: Math.max(1, Math.min(input.runs || 1, 5)), contextWindow: Math.max(2048, Math.min(input.contextWindow || 4096, 131072)) }, blockers }; persist(receipt); return receipt; }
export function readModelBenchmarkHandoffEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: MODEL_BENCHMARK_HANDOFF_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestReady: receipts.find((entry) => entry.status === "ready") || null, path: STORE_FILE }; }
