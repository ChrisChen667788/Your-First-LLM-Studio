import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const MODEL_TRANSFER_SCHEDULER_SCHEMA_VERSION = "models.transfer-scheduler.v1" as const;
type Job = { id: string; host: string; priority: number; state: "queued" | "retry-wait" | "cancelled"; attempts: number; nextAttemptAt?: string };
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; selected: string[]; deferred: string[]; checks: Record<string, boolean>; limits: { global: number; perHost: number } };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability"); const STORE_FILE = path.join(DATA_DIR, "model-transfer-scheduler.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const value = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(value.receipts) ? value.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: MODEL_TRANSFER_SCHEDULER_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 200) }, null, 2)}\n`, "utf8"); }

export function planModelTransfers(input: { jobs: Job[]; globalLimit: number; perHostLimit: number; now?: Date }) {
  const now = input.now || new Date(); const hostCounts = new Map<string, number>(); const selected: Job[] = [];
  const eligible = input.jobs.filter((job) => job.state !== "cancelled" && (!job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= now.getTime())).sort((a, b) => b.priority - a.priority || a.attempts - b.attempts || a.id.localeCompare(b.id));
  for (const job of eligible) { if (selected.length >= input.globalLimit) break; const count = hostCounts.get(job.host) || 0; if (count >= input.perHostLimit) continue; selected.push(job); hostCounts.set(job.host, count + 1); }
  return { selected, deferred: input.jobs.filter((job) => !selected.some((entry) => entry.id === job.id)) };
}

export function rehearseModelTransferScheduler() {
  const now = new Date("2026-07-16T00:00:00.000Z"); const future = new Date(now.getTime() + 60_000).toISOString();
  const jobs: Job[] = [
    { id: "hf-high", host: "huggingface.co", priority: 100, state: "queued", attempts: 0 },
    { id: "hf-low", host: "huggingface.co", priority: 10, state: "queued", attempts: 0 },
    { id: "ms-medium", host: "modelscope.cn", priority: 50, state: "queued", attempts: 0 },
    { id: "retry-backoff", host: "modelscope.cn", priority: 90, state: "retry-wait", attempts: 2, nextAttemptAt: future },
    { id: "cancelled", host: "example.invalid", priority: 999, state: "cancelled", attempts: 0 },
  ];
  const plan = planModelTransfers({ jobs, globalLimit: 2, perHostLimit: 1, now }); const selected = plan.selected.map((entry) => entry.id); const deferred = plan.deferred.map((entry) => entry.id);
  const checks = { globalLimitRespected: selected.length === 2, hostLimitRespected: new Set(plan.selected.map((entry) => entry.host)).size === 2, priorityRespected: selected.includes("hf-high") && selected.includes("ms-medium"), retryBackoffRespected: deferred.includes("retry-backoff"), cancelledExcluded: deferred.includes("cancelled") };
  const receipt: Receipt = { id: `transfer-schedule-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", selected, deferred, checks, limits: { global: 2, perHost: 1 } }; persist(receipt); return receipt;
}
export function readModelTransferSchedulerEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: MODEL_TRANSFER_SCHEDULER_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, path: STORE_FILE }; }
