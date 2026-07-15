import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { readServerInstanceRegistry } from "@/features/models/server-instance-registry";
import { readServerRequestLedger } from "@/features/models/server-request-ledger";
import { runServerLifecycleAction } from "@/features/models/server-lifecycle";

export const IDLE_UNLOAD_DAEMON_SCHEMA_VERSION = "models.idle-unload-daemon.v1" as const;
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const RECEIPT_FILE = path.join(DATA_DIR, "idle-unload-daemon-receipts.json");
type Decision = { serverId: string; modelId?: string; idleMs: number; thresholdMs: number; decision: "skip" | "would-unload" | "unloaded" | "failed"; reason: string };
type Receipt = { id: string; generatedAt: string; mode: "dry-run" | "execute"; status: "pass" | "failed"; decisions: Decision[] };
function readReceipts(): Receipt[] { if (!existsSync(RECEIPT_FILE)) return []; try { const parsed = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(RECEIPT_FILE, `${JSON.stringify({ schemaVersion: IDLE_UNLOAD_DAEMON_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }

export async function runIdleUnloadDaemonTick(input: { execute?: boolean; now?: string } = {}) {
  const nowMs = input.now ? Date.parse(input.now) : Date.now();
  if (!Number.isFinite(nowMs)) throw new Error("now must be an ISO timestamp.");
  const ledger = readServerRequestLedger();
  const decisions: Decision[] = [];
  for (const server of readServerInstanceRegistry().instances) {
    const thresholdMs = server.idleTtlMinutes * 60_000;
    const latestRequest = ledger.entries.filter((entry) => entry.serverId === server.id && (!server.activeModelId || entry.modelId === server.activeModelId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const activityAt = Date.parse(latestRequest?.createdAt || server.updatedAt);
    const idleMs = Math.max(0, nowMs - activityAt);
    if (!server.autoEvict || server.state !== "ready" || !server.activeModelId || idleMs < thresholdMs) {
      decisions.push({ serverId: server.id, modelId: server.activeModelId, idleMs, thresholdMs, decision: "skip", reason: !server.autoEvict ? "Auto-evict is disabled." : server.state !== "ready" ? `Server state is ${server.state}.` : !server.activeModelId ? "No active model is registered." : "Idle threshold has not elapsed." });
      continue;
    }
    if (!input.execute) { decisions.push({ serverId: server.id, modelId: server.activeModelId, idleMs, thresholdMs, decision: "would-unload", reason: "Idle threshold elapsed; dry-run preserved runtime state." }); continue; }
    const action = await runServerLifecycleAction({ serverId: server.id, action: "unload", modelId: server.activeModelId });
    decisions.push({ serverId: server.id, modelId: server.activeModelId, idleMs, thresholdMs, decision: action.status === "pass" ? "unloaded" : "failed", reason: action.status === "pass" ? "Idle model unloaded." : action.error || "Unload failed." });
  }
  const receipt: Receipt = { id: `idle-tick-${randomUUID()}`, generatedAt: new Date().toISOString(), mode: input.execute ? "execute" : "dry-run", status: decisions.some((decision) => decision.decision === "failed") ? "failed" : "pass", decisions };
  persist(receipt); return receipt;
}

export function readIdleUnloadDaemonEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: IDLE_UNLOAD_DAEMON_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, path: RECEIPT_FILE }; }
