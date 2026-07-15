import { createHash, randomUUID } from "crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const DESKTOP_DATA_LIFECYCLE_SCHEMA_VERSION = "desktop.data-lifecycle.v1" as const;
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; checks: Record<string, boolean>; sourceDigest?: string; migratedDigest?: string; warning: string; error?: string };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "desktop-data-lifecycle.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: DESKTOP_DATA_LIFECYCLE_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }
function treeDigest(root: string) { const hash = createHash("sha256"); const walk = (directory: string) => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((entry) => { const absolute = path.join(directory, entry.name); const relative = path.relative(root, absolute); hash.update(relative); if (entry.isDirectory()) walk(absolute); else hash.update(readFileSync(absolute)); }); walk(root); return hash.digest("hex"); }

export function rehearseDesktopDataLifecycle() {
  const root = mkdtempSync(path.join(os.tmpdir(), "first-llm-desktop-data-")); let status: Receipt["status"] = "pass"; let error: string | undefined; let sourceDigest: string | undefined; let migratedDigest: string | undefined;
  const checks = { migrationAtomic: false, digestPreserved: false, uninstallPreservesData: false, explicitPurgeRemovesData: false, backupRestoresData: false };
  try {
    const legacy = path.join(root, "legacy-data"); const current = path.join(root, "current-data"); const appBundle = path.join(root, "FirstLLMStudio.app"); const backup = path.join(root, "backup-data");
    mkdirSync(path.join(legacy, "sessions"), { recursive: true }); writeFileSync(path.join(legacy, "settings.json"), '{"locale":"zh-CN"}\n'); writeFileSync(path.join(legacy, "sessions", "session.json"), '{"id":"fixture"}\n'); mkdirSync(appBundle);
    sourceDigest = treeDigest(legacy); cpSync(legacy, backup, { recursive: true }); renameSync(legacy, current); checks.migrationAtomic = !existsSync(legacy) && existsSync(current); migratedDigest = treeDigest(current); checks.digestPreserved = sourceDigest === migratedDigest;
    rmSync(appBundle, { recursive: true, force: true }); checks.uninstallPreservesData = existsSync(current) && treeDigest(current) === sourceDigest;
    const purgeFixture = path.join(root, "purge-data"); cpSync(current, purgeFixture, { recursive: true }); rmSync(purgeFixture, { recursive: true, force: true }); checks.explicitPurgeRemovesData = !existsSync(purgeFixture);
    rmSync(current, { recursive: true, force: true }); cpSync(backup, current, { recursive: true }); checks.backupRestoresData = treeDigest(current) === sourceDigest;
    if (!Object.values(checks).every(Boolean)) throw new Error("One or more desktop data lifecycle checks failed.");
  } catch (caught) { status = "failed"; error = caught instanceof Error ? caught.message : "Desktop data lifecycle rehearsal failed."; }
  finally { rmSync(root, { recursive: true, force: true }); }
  const receipt: Receipt = { id: `desktop-data-${randomUUID()}`, generatedAt: new Date().toISOString(), status, checks, sourceDigest, migratedDigest, warning: "This isolated fixture validates data semantics, not a signed clean-machine macOS uninstall.", error }; persist(receipt); return receipt;
}

export function readDesktopDataLifecycleEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: DESKTOP_DATA_LIFECYCLE_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, path: STORE_FILE }; }
