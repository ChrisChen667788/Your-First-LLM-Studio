import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import type { ServerRequestEntry } from "@/features/models/server-request-ledger";

export const SERVER_LOG_RETENTION_SCHEMA_VERSION = "models.server-log-retention.v1" as const;
type ExportEntry = Omit<ServerRequestEntry, "callerKeyId"> & { callerAlias?: string };
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; retentionDays: number; sourceCount: number; exportedCount: number; expiredCount: number; exportDigest: string; checks: Record<string, boolean> };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability"); const STORE_FILE = path.join(DATA_DIR, "server-log-retention.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const value = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(value.receipts) ? value.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: SERVER_LOG_RETENTION_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }
export function buildRetainedServerLogExport(input: { entries: ServerRequestEntry[]; retentionDays: number; now?: Date }) {
  const now = input.now || new Date(); const cutoff = now.getTime() - input.retentionDays * 86_400_000;
  const retained: ExportEntry[] = input.entries.filter((entry) => Date.parse(entry.createdAt) >= cutoff).map(({ callerKeyId, ...entry }) => ({ ...entry, ...(callerKeyId ? { callerAlias: createHash("sha256").update(callerKeyId).digest("hex").slice(0, 12) } : {}) }));
  return { retained, expiredCount: input.entries.length - retained.length, digest: createHash("sha256").update(JSON.stringify(retained)).digest("hex") };
}
export function rehearseServerLogRetention() {
  const now = new Date("2026-07-16T00:00:00.000Z"); const base = { serverId: "local-ollama", modelId: "qwen3:4b", operation: "chat" as const, status: "success" as const, latencyMs: 420, promptTokens: 24, completionTokens: 48, profileId: "balanced" };
  const entries: ServerRequestEntry[] = [
    { ...base, id: "fresh-request", callerKeyId: "caller-key-private", createdAt: "2026-07-15T12:00:00.000Z" },
    { ...base, id: "old-request", callerKeyId: "old-private-key", createdAt: "2026-06-01T00:00:00.000Z" },
  ];
  const result = buildRetainedServerLogExport({ entries, retentionDays: 7, now }); const serialized = JSON.stringify(result.retained);
  const checks = { expiredRecordRemoved: result.expiredCount === 1, freshRecordRetained: result.retained[0]?.id === "fresh-request", callerKeyRedacted: !serialized.includes("caller-key-private") && Boolean(result.retained[0]?.callerAlias), digestMaterialized: /^[a-f0-9]{64}$/u.test(result.digest) };
  const receipt: Receipt = { id: `server-log-retention-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", retentionDays: 7, sourceCount: entries.length, exportedCount: result.retained.length, expiredCount: result.expiredCount, exportDigest: result.digest, checks }; persist(receipt); return receipt;
}
export function readServerLogRetentionEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: SERVER_LOG_RETENTION_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, path: STORE_FILE }; }
