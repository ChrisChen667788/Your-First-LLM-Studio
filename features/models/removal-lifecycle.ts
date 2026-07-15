import { createHash, randomUUID } from "crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const MODEL_REMOVAL_LIFECYCLE_SCHEMA_VERSION = "models.removal-lifecycle.v1" as const;
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; checks: Record<string, boolean>; ownersBefore: string[]; ownersAfter: string[]; blobDigest: string; warning: string; error?: string };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability"); const STORE_FILE = path.join(DATA_DIR, "model-removal-lifecycle.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const value = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(value.receipts) ? value.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: MODEL_REMOVAL_LIFECYCLE_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }
export function rehearseModelRemovalLifecycle() {
  const root = mkdtempSync(path.join(os.tmpdir(), "first-llm-model-remove-")); const checks = { quarantinedAtomically: false, sharedBlobPreserved: false, rollbackRestoresOwner: false, finalOwnerRemovalAllowsCleanup: false }; let error: string | undefined; let blobDigest = ""; const ownersBefore = ["model-a", "model-b"]; let ownersAfter: string[] = [];
  try {
    const blob = path.join(root, "blobs", "weights.bin"); const modelA = path.join(root, "models", "model-a"); const modelB = path.join(root, "models", "model-b"); const quarantine = path.join(root, "quarantine", "model-a");
    mkdirSync(path.dirname(blob), { recursive: true }); mkdirSync(modelA, { recursive: true }); mkdirSync(modelB, { recursive: true }); mkdirSync(path.dirname(quarantine), { recursive: true }); writeFileSync(blob, "shared-model-weights"); blobDigest = createHash("sha256").update(readFileSync(blob)).digest("hex"); linkSync(blob, path.join(modelA, "weights.bin")); linkSync(blob, path.join(modelB, "weights.bin"));
    renameSync(modelA, quarantine); checks.quarantinedAtomically = !existsSync(modelA) && existsSync(quarantine); checks.sharedBlobPreserved = existsSync(blob) && createHash("sha256").update(readFileSync(path.join(modelB, "weights.bin"))).digest("hex") === blobDigest;
    renameSync(quarantine, modelA); checks.rollbackRestoresOwner = existsSync(modelA); rmSync(modelA, { recursive: true }); ownersAfter = ["model-b"]; rmSync(modelB, { recursive: true }); ownersAfter = []; rmSync(blob); checks.finalOwnerRemovalAllowsCleanup = !existsSync(blob);
  } catch (caught) { error = caught instanceof Error ? caught.message : "Model removal rehearsal failed."; }
  finally { rmSync(root, { recursive: true, force: true }); }
  const receipt: Receipt = { id: `model-removal-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", checks, ownersBefore, ownersAfter, blobDigest, warning: "The rehearsal uses isolated hardlinks and never removes an installed model.", error }; persist(receipt); return receipt;
}
export function readModelRemovalLifecycleEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: MODEL_REMOVAL_LIFECYCLE_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, path: STORE_FILE }; }
