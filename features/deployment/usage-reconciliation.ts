import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { readServerRequestLedger } from "@/features/models/server-request-ledger";
import { appendDeploymentUsageAccountingRecord } from "@/features/deployment/control-plane";

export const USAGE_RECONCILIATION_SCHEMA_VERSION = "deployment.usage-reconciliation.v1" as const;
type Receipt = { id: string; generatedAt: string; status: "pass" | "hold"; ledgerDigest: string; sourceRequests: number; usageRecordId: string; expected: { promptTokens: number; completionTokens: number; totalTokens: number }; recorded: { promptTokens: number; completionTokens: number; totalTokens: number }; differences: { promptTokens: number; completionTokens: number; totalTokens: number } };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability"); const STORE_FILE = path.join(DATA_DIR, "usage-reconciliation-receipts.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: USAGE_RECONCILIATION_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 200) }, null, 2)}\n`, "utf8"); }

export function reconcileServerUsageToOutbox(input: { operatorId?: string; tenantId?: string } = {}) {
  const ledger = readServerRequestLedger(); if (!ledger.entries.length) throw new Error("Server request ledger has no records to reconcile.");
  const expected = { promptTokens: ledger.totals.promptTokens, completionTokens: ledger.totals.completionTokens, totalTokens: ledger.totals.promptTokens + ledger.totals.completionTokens };
  const ledgerDigest = createHash("sha256").update(JSON.stringify(ledger.entries.map((entry) => [entry.id, entry.promptTokens, entry.completionTokens]).sort())).digest("hex");
  const usage = appendDeploymentUsageAccountingRecord({ operatorId: input.operatorId?.trim() || "local-reconciliation-worker", tenantId: input.tenantId?.trim() || "local-lab", targetId: "server-request-ledger", promptTokens: expected.promptTokens, completionTokens: expected.completionTokens, idempotencyKey: `server-ledger:${ledgerDigest}` });
  const recorded = { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, totalTokens: usage.totalTokens };
  const differences = { promptTokens: recorded.promptTokens - expected.promptTokens, completionTokens: recorded.completionTokens - expected.completionTokens, totalTokens: recorded.totalTokens - expected.totalTokens };
  const receipt: Receipt = { id: `usage-reconciliation-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(differences).every((value) => value === 0) ? "pass" : "hold", ledgerDigest, sourceRequests: ledger.entries.length, usageRecordId: usage.id, expected, recorded, differences };
  persist(receipt); return receipt;
}

export function readUsageReconciliationEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: USAGE_RECONCILIATION_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, path: STORE_FILE }; }
