import { randomUUID } from "crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { verifyExtensionPackage } from "@/features/extensions/package-verification";
import { buildExtensionSandboxPolicy } from "@/features/extensions/process-sandbox";
import type { ExtensionManifest } from "@/features/extensions/registry";

export const EXTENSION_INSTALL_TRANSACTION_SCHEMA_VERSION = "extensions.install-transaction.v1" as const;

type Bundle = { schemaVersion: "first-llm-extension-bundle.v1"; files: Array<{ path: string; contentBase64: string; executable?: boolean }> };
type Installation = { extensionId: string; version: string; digest: string; installDir: string; state: "active" | "inactive" | "disabled" | "rolled-back"; installedAt: string; activatedAt?: string };
type LifecycleReceipt = { id: string; generatedAt: string; action: "install" | "rollback" | "enable" | "disable"; extensionId: string; fromVersion?: string; toVersion: string; status: "pass" | "failed"; summary: string };
type Store = { schemaVersion: typeof EXTENSION_INSTALL_TRANSACTION_SCHEMA_VERSION; installations: Installation[]; receipts: LifecycleReceipt[] };

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const INSTALL_ROOT = path.join(DATA_DIR, "extensions-installed");
const STORE_FILE = path.join(DATA_DIR, "extension-installations.json");

function readStore(): Store { if (!existsSync(STORE_FILE)) return { schemaVersion: EXTENSION_INSTALL_TRANSACTION_SCHEMA_VERSION, installations: [], receipts: [] }; try { const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Partial<Store>; return { schemaVersion: EXTENSION_INSTALL_TRANSACTION_SCHEMA_VERSION, installations: Array.isArray(parsed.installations) ? parsed.installations : [], receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [] }; } catch { return { schemaVersion: EXTENSION_INSTALL_TRANSACTION_SCHEMA_VERSION, installations: [], receipts: [] }; } }
function writeStore(store: Store) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8"); }
function safeSegment(value: string, label: string) { if (!/^[a-z0-9][a-z0-9.-]+$/i.test(value)) throw new Error(`${label} is not safe for an installation path.`); return value; }
function safeRelativePath(value: string) { const normalized = value.replace(/\\/g, "/").replace(/^\/+/, ""); if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === "..")) throw new Error(`Unsafe extension bundle path: ${value}`); return normalized; }
function parseBundle(payload: Buffer): Bundle {
  const bundle = JSON.parse(payload.toString("utf8")) as Partial<Bundle>;
  if (bundle.schemaVersion !== "first-llm-extension-bundle.v1" || !Array.isArray(bundle.files) || !bundle.files.length) throw new Error("Extension payload must be a non-empty first-llm-extension-bundle.v1 document.");
  if (bundle.files.length > 100) throw new Error("Extension bundle exceeds the 100-file limit.");
  return bundle as Bundle;
}

export function installVerifiedExtension(input: {
  manifest: ExtensionManifest;
  payloadBase64: string;
  publicKeyPem?: string;
  internalAcceptanceTrustRoot?: {
    publisher: string;
    publicKeyPem: string;
  };
}) {
  const verification = verifyExtensionPackage({
    manifest: input.manifest,
    payloadBase64: input.payloadBase64,
    publicKeyPem: input.publicKeyPem,
    internalAcceptanceTrustRoot: input.internalAcceptanceTrustRoot,
  });
  if (!verification.accepted) throw new Error(verification.errors.join(" ") || "Extension package verification failed.");
  const policy = buildExtensionSandboxPolicy(input.manifest);
  if (!policy.executionAllowed) throw new Error(policy.blockers.join(" "));
  const payload = Buffer.from(input.payloadBase64, "base64");
  const bundle = parseBundle(payload);
  const entrypoint = safeRelativePath(input.manifest.entrypoint);
  if (!bundle.files.some((file) => safeRelativePath(file.path) === entrypoint)) throw new Error("Extension entrypoint is missing from the signed bundle.");
  const extensionId = safeSegment(input.manifest.id, "extension id"); const version = safeSegment(input.manifest.version, "extension version");
  const finalDir = path.join(INSTALL_ROOT, extensionId, version);
  const staging = mkdtempSync(path.join(os.tmpdir(), "first-llm-extension-install-"));
  try {
    for (const file of bundle.files) {
      const relative = safeRelativePath(file.path); const destination = path.join(staging, relative);
      if (!destination.startsWith(`${staging}${path.sep}`)) throw new Error(`Extension file escaped staging: ${relative}`);
      const content = Buffer.from(file.contentBase64, "base64");
      if (content.length > 2 * 1024 * 1024) throw new Error(`Extension file exceeds the 2 MB limit: ${relative}`);
      mkdirSync(path.dirname(destination), { recursive: true }); writeFileSync(destination, content, { mode: file.executable || relative === entrypoint ? 0o500 : 0o400 });
    }
    mkdirSync(path.dirname(finalDir), { recursive: true });
    if (!existsSync(finalDir)) renameSync(staging, finalDir);
    const now = new Date().toISOString(); const store = readStore();
    const active = store.installations.find((entry) => entry.extensionId === extensionId && entry.state === "active");
    const installation: Installation = { extensionId, version, digest: verification.digest, installDir: finalDir, state: "active", installedAt: store.installations.find((entry) => entry.extensionId === extensionId && entry.version === version)?.installedAt || now, activatedAt: now };
    const installations = [installation, ...store.installations.filter((entry) => !(entry.extensionId === extensionId && entry.version === version)).map((entry) => entry.extensionId === extensionId && entry.state === "active" ? { ...entry, state: "inactive" as const } : entry)];
    const receipt: LifecycleReceipt = { id: `extension-lifecycle-${randomUUID()}`, generatedAt: now, action: "install", extensionId, fromVersion: active?.version, toVersion: version, status: "pass", summary: `Installed ${extensionId}@${version} with atomic activation.` };
    writeStore({ schemaVersion: EXTENSION_INSTALL_TRANSACTION_SCHEMA_VERSION, installations, receipts: [receipt, ...store.receipts].slice(0, 200) });
    return { installation, receipt, verification, policy };
  } finally { if (existsSync(staging)) rmSync(staging, { recursive: true, force: true }); }
}

export function rollbackExtensionVersion(input: { extensionId: string; targetVersion: string }) {
  const store = readStore(); const extensionId = safeSegment(input.extensionId, "extension id"); const targetVersion = safeSegment(input.targetVersion, "target version");
  const target = store.installations.find((entry) => entry.extensionId === extensionId && entry.version === targetVersion);
  if (!target || !existsSync(target.installDir)) throw new Error("Rollback target is not installed.");
  const active = store.installations.find((entry) => entry.extensionId === extensionId && entry.state === "active");
  if (active?.version === targetVersion) throw new Error("Rollback target is already active.");
  const now = new Date().toISOString();
  const installations = store.installations.map((entry) => entry.extensionId !== extensionId ? entry : entry.version === targetVersion ? { ...entry, state: "active" as const, activatedAt: now } : entry.state === "active" ? { ...entry, state: "rolled-back" as const } : entry);
  const receipt: LifecycleReceipt = { id: `extension-lifecycle-${randomUUID()}`, generatedAt: now, action: "rollback", extensionId, fromVersion: active?.version, toVersion: targetVersion, status: "pass", summary: `Rolled ${extensionId} back from ${active?.version || "inactive"} to ${targetVersion}.` };
  writeStore({ ...store, installations, receipts: [receipt, ...store.receipts].slice(0, 200) });
  return receipt;
}

export function setExtensionVersionEnabled(input: { extensionId: string; version: string; enabled: boolean }) {
  const store = readStore(); const extensionId = safeSegment(input.extensionId, "extension id"); const version = safeSegment(input.version, "extension version"); const target = store.installations.find((entry) => entry.extensionId === extensionId && entry.version === version);
  if (!target || !existsSync(target.installDir)) throw new Error("Extension version is not installed.");
  const now = new Date().toISOString(); const action = input.enabled ? "enable" as const : "disable" as const;
  const installations = store.installations.map((entry) => entry.extensionId !== extensionId ? entry : entry.version === version ? { ...entry, state: input.enabled ? "active" as const : "disabled" as const, activatedAt: input.enabled ? now : entry.activatedAt } : input.enabled && entry.state === "active" ? { ...entry, state: "inactive" as const } : entry);
  const receipt: LifecycleReceipt = { id: `extension-lifecycle-${randomUUID()}`, generatedAt: now, action, extensionId, fromVersion: version, toVersion: version, status: "pass", summary: `${input.enabled ? "Enabled" : "Disabled"} ${extensionId}@${version}.` };
  writeStore({ ...store, installations, receipts: [receipt, ...store.receipts].slice(0, 200) }); return receipt;
}

export function readExtensionInstallationEvidence() {
  const store = readStore();
  return { ...store, ok: true as const, schemaVersion: EXTENSION_INSTALL_TRANSACTION_SCHEMA_VERSION, generatedAt: new Date().toISOString(), totals: { installedVersions: store.installations.length, active: store.installations.filter((entry) => entry.state === "active").length, disabled: store.installations.filter((entry) => entry.state === "disabled").length, updates: store.receipts.filter((entry) => entry.action === "install" && Boolean(entry.fromVersion) && entry.fromVersion !== entry.toVersion).length, rollbacks: store.receipts.filter((entry) => entry.action === "rollback" && entry.status === "pass").length, enableDisableActions: store.receipts.filter((entry) => entry.action === "enable" || entry.action === "disable").length }, paths: { installRoot: INSTALL_ROOT, store: STORE_FILE } };
}
