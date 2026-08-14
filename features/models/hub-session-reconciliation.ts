import { randomUUID } from "crypto";
import { existsSync, statSync } from "fs";
import os from "os";
import path from "path";
import { readHubTransferSessions } from "@/features/models/hub-transfer-session";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";

export const HUB_SESSION_RECONCILIATION_SCHEMA_VERSION = "models.hub-session-reconciliation.v1" as const;
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const RECEIPT_FILE = path.join(DATA_DIR, "hub-session-reconciliation.json");

type Receipt = { id: string; generatedAt: string; status: "pass" | "hold"; sessions: number; files: number; completed: number; missing: number; checksumMetadataMissing: number; retryExhausted: number; findings: string[] };
function readReceipts(): Receipt[] { return readDurableReceipts(RECEIPT_FILE, HUB_SESSION_RECONCILIATION_SCHEMA_VERSION); }
function persist(receipt: Receipt) { prependDurableReceipt(RECEIPT_FILE, HUB_SESSION_RECONCILIATION_SCHEMA_VERSION, receipt, 50); }

export function reconcileHubTransferSessions() {
  const registry = readHubTransferSessions();
  let files = 0; let completed = 0; let missing = 0; let checksumMetadataMissing = 0; let retryExhausted = 0;
  const findings: string[] = [];
  for (const session of registry.sessions) {
    for (const file of session.files) {
      files += 1;
      const job = file.job;
      if (job?.status === "completed") {
        completed += 1;
        if (!job.completedFile || !existsSync(job.completedFile) || !statSync(job.completedFile).isFile()) { missing += 1; findings.push(`${session.id}:${file.path} completed file is missing.`); }
        if (!job.verifiedSha256) { checksumMetadataMissing += 1; findings.push(`${session.id}:${file.path} lacks verified SHA-256 metadata.`); }
      }
      if ((file.attempts || 0) >= 5 && job?.status !== "completed") { retryExhausted += 1; findings.push(`${session.id}:${file.path} exhausted its retry budget.`); }
    }
  }
  const receipt: Receipt = { id: `hub-reconcile-${randomUUID()}`, generatedAt: new Date().toISOString(), status: missing || checksumMetadataMissing || retryExhausted ? "hold" : "pass", sessions: registry.sessions.length, files, completed, missing, checksumMetadataMissing, retryExhausted, findings };
  persist(receipt); return receipt;
}

export function readHubSessionReconciliationEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: HUB_SESSION_RECONCILIATION_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, latest: receipts[0] || null, path: RECEIPT_FILE }; }
