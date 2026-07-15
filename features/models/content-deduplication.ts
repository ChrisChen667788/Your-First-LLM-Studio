import { createHash, randomUUID } from "crypto";
import { existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { readModelContentAddressIndex } from "@/features/models/content-address-index";

export const MODEL_CONTENT_DEDUP_SCHEMA_VERSION = "models.content-deduplication.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const RECEIPT_FILE = path.join(DATA_DIR, "model-content-dedup-receipts.json");

type DedupReceipt = { id: string; generatedAt: string; status: "pass" | "failed"; checks: Record<string, boolean>; bytesSaved: number; error?: string };

function readReceipts(): DedupReceipt[] { if (!existsSync(RECEIPT_FILE)) return []; try { const parsed = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as { receipts?: DedupReceipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; } }
function persist(receipt: DedupReceipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(RECEIPT_FILE, `${JSON.stringify({ schemaVersion: MODEL_CONTENT_DEDUP_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 50) }, null, 2)}\n`, "utf8"); }

export function buildModelContentDedupPlan() {
  const index = readModelContentAddressIndex();
  const actions = index.objects.flatMap((object) => {
    const canonical = object.canonicalPath;
    if (!canonical || !existsSync(canonical)) return [];
    const canonicalStat = statSync(canonical);
    return object.references.slice(1).map((reference) => {
      const duplicatePath = reference.path || "";
      let sameDevice = false;
      let regularFiles = false;
      try { const duplicateStat = statSync(duplicatePath); sameDevice = duplicateStat.dev === canonicalStat.dev; regularFiles = duplicateStat.isFile() && canonicalStat.isFile(); } catch {}
      return { sha256: object.sha256, canonicalPath: canonical, duplicatePath, bytes: object.bytes, sameDevice, regularFiles, eligible: sameDevice && regularFiles && duplicatePath !== canonical };
    });
  });
  return {
    ok: true as const,
    schemaVersion: MODEL_CONTENT_DEDUP_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "plan-only" as const,
    actions,
    totals: { actions: actions.length, eligible: actions.filter((action) => action.eligible).length, blocked: actions.filter((action) => !action.eligible).length, eligibleSavingsBytes: actions.filter((action) => action.eligible).reduce((sum, action) => sum + action.bytes, 0) },
    blockers: ["Applying this plan to model files requires an explicit operator-approved maintenance window."],
  };
}

export function runModelContentDedupRehearsal() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "first-llm-dedup-"));
  const canonical = path.join(directory, "canonical.bin");
  const duplicate = path.join(directory, "duplicate.bin");
  const temporaryLink = `${duplicate}.hardlink`;
  const content = Buffer.from("first-llm-content-address-rehearsal");
  let receipt: DedupReceipt;
  try {
    writeFileSync(canonical, content); writeFileSync(duplicate, content);
    const before = statSync(canonical).size + statSync(duplicate).size;
    linkSync(canonical, temporaryLink);
    renameSync(temporaryLink, duplicate);
    const canonicalStat = lstatSync(canonical); const duplicateStat = lstatSync(duplicate);
    const checks = {
      contentDigestMatches: createHash("sha256").update(readFileSync(duplicate)).digest("hex") === createHash("sha256").update(content).digest("hex"),
      sameDevice: canonicalStat.dev === duplicateStat.dev,
      sharedInode: canonicalStat.ino === duplicateStat.ino,
      linkCountIncreased: canonicalStat.nlink >= 2,
      atomicReplacementComplete: !existsSync(temporaryLink),
    };
    receipt = { id: `dedup-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", checks, bytesSaved: Math.max(0, before - statSync(canonical).size) };
  } catch (error) {
    receipt = { id: `dedup-${randomUUID()}`, generatedAt: new Date().toISOString(), status: "failed", checks: {}, bytesSaved: 0, error: error instanceof Error ? error.message : "Dedup rehearsal failed." };
  } finally { rmSync(directory, { recursive: true, force: true }); }
  persist(receipt); return receipt;
}

export function readModelContentDedupEvidence() { const receipts = readReceipts(); return { ...buildModelContentDedupPlan(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, path: RECEIPT_FILE }; }
