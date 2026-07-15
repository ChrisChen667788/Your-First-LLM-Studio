import { createHash, randomUUID } from "crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const DESKTOP_PERMISSION_REPAIR_SCHEMA_VERSION = "desktop.permission-repair.v1" as const;
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; checks: Record<string, boolean>; beforeMode: string; afterMode: string; warning: string; error?: string };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "desktop-permission-repair.json");

function readReceipts(): Receipt[] {
  if (!existsSync(STORE_FILE)) return [];
  try { const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; }
}
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: DESKTOP_PERMISSION_REPAIR_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }
function digest(filePath: string) { return createHash("sha256").update(readFileSync(filePath)).digest("hex"); }
function assertRepairTarget(target: string, root: string) {
  const resolvedRoot = path.resolve(root); const resolvedTarget = path.resolve(target);
  if (!(resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`))) throw new Error("Permission repair target is outside the approved root.");
  if (lstatSync(resolvedTarget).isSymbolicLink()) throw new Error("Permission repair refuses symbolic-link targets.");
}

export function rehearseDesktopPermissionRepair() {
  const root = mkdtempSync(path.join(os.tmpdir(), "first-llm-permission-repair-"));
  let beforeMode = ""; let afterMode = ""; let error: string | undefined;
  const checks = { missingOwnerWriteDetected: false, repairApplied: false, contentDigestPreserved: false, symlinkEscapeDenied: false };
  try {
    const data = path.join(root, "data"); const config = path.join(data, "settings.json"); const outside = path.join(root, "outside"); const link = path.join(root, "data-link");
    mkdirSync(data); mkdirSync(outside); writeFileSync(config, '{"locale":"zh-CN"}\n'); const beforeDigest = digest(config);
    chmodSync(data, 0o500); beforeMode = (statSync(data).mode & 0o777).toString(8); checks.missingOwnerWriteDetected = (statSync(data).mode & 0o200) === 0;
    assertRepairTarget(data, root); chmodSync(data, 0o700); afterMode = (statSync(data).mode & 0o777).toString(8); checks.repairApplied = (statSync(data).mode & 0o700) === 0o700; checks.contentDigestPreserved = digest(config) === beforeDigest;
    symlinkSync(outside, link); try { assertRepairTarget(link, root); } catch { checks.symlinkEscapeDenied = true; }
  } catch (caught) { error = caught instanceof Error ? caught.message : "Permission repair rehearsal failed."; }
  finally { rmSync(root, { recursive: true, force: true }); }
  const receipt: Receipt = { id: `permission-repair-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", checks, beforeMode, afterMode, warning: "Only an isolated fixture was changed; user directories and macOS privacy permissions were not modified.", error };
  persist(receipt); return receipt;
}

export function readDesktopPermissionRepairEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: DESKTOP_PERMISSION_REPAIR_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, path: STORE_FILE }; }
