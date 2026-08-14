import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { readExtensionTrustPolicy, type ExtensionPermission } from "@/features/extensions/registry";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

export const EXTENSION_PERMISSION_GRANTS_SCHEMA_VERSION = "extensions.permission-grants.v1" as const;
type Grant = { id: string; extensionId: string; permission: ExtensionPermission; resourceScope: string; state: "active" | "revoked"; confirmed: boolean; grantedAt: string; expiresAt?: string; revokedAt?: string };
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; checks: Record<string, boolean>; grantIds: string[] };
type Store = { schemaVersion: typeof EXTENSION_PERMISSION_GRANTS_SCHEMA_VERSION; grants: Grant[]; receipts: Receipt[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "extension-permission-grants.json");
const emptyStore = (): Store => ({ schemaVersion: EXTENSION_PERMISSION_GRANTS_SCHEMA_VERSION, grants: [], receipts: [] });
const isStore = (value: unknown): value is Store => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Store>;
  return candidate.schemaVersion === EXTENSION_PERMISSION_GRANTS_SCHEMA_VERSION
    && Array.isArray(candidate.grants)
    && Array.isArray(candidate.receipts);
};
const readStore = () => readJsonFileDurably(STORE_FILE, emptyStore, isStore);
const updateStore = (mutator: (store: Store) => Store) => updateJsonFileDurably(STORE_FILE, emptyStore, mutator, isStore);

export function grantExtensionPermission(input: { extensionId: string; permission: ExtensionPermission; resourceScope: string; confirmed?: boolean; expiresAt?: string }) {
  const policy = readExtensionTrustPolicy();
  const requiresConfirmation = policy.confirmationPermissions.includes(input.permission);
  if (requiresConfirmation && !input.confirmed) throw new Error(`${input.permission} requires explicit confirmation.`);
  if (!input.resourceScope.trim()) throw new Error("resourceScope is required.");
  const now = new Date().toISOString();
  const grant: Grant = { id: `extension-grant-${randomUUID()}`, extensionId: input.extensionId.trim(), permission: input.permission, resourceScope: input.resourceScope.trim(), state: "active", confirmed: Boolean(input.confirmed), grantedAt: now, expiresAt: input.expiresAt };
  updateStore((store) => ({
    ...store,
    grants: [grant, ...store.grants.filter((entry) => !(entry.extensionId === grant.extensionId && entry.permission === grant.permission && entry.resourceScope === grant.resourceScope))],
  }));
  return grant;
}

export function revokeExtensionGrant(grantId: string) {
  const outcome: { value?: Grant } = {};
  updateStore((store) => {
    const current = store.grants.find((entry) => entry.id === grantId);
    if (!current) throw new Error("Extension permission grant was not found.");
    const next: Grant = { ...current, state: "revoked", revokedAt: new Date().toISOString() };
    outcome.value = next;
    return { ...store, grants: store.grants.map((entry) => entry.id === grantId ? next : entry) };
  });
  if (!outcome.value) throw new Error("Extension permission revoke did not complete.");
  return outcome.value;
}

export function authorizeExtensionPermission(input: { extensionId: string; permission: ExtensionPermission; resourceScope: string; now?: Date }) {
  const now = input.now || new Date();
  return readStore().grants.some((entry) => entry.extensionId === input.extensionId && entry.permission === input.permission && entry.resourceScope === input.resourceScope && entry.state === "active" && (!entry.expiresAt || Date.parse(entry.expiresAt) > now.getTime()));
}

export function rehearseExtensionPermissionGrants() {
  let unconfirmedDenied = false;
  try { grantExtensionPermission({ extensionId: "local-rehearsal.acceptance-tool", permission: "workspace:write", resourceScope: "workspace:fixture", confirmed: false }); } catch { unconfirmedDenied = true; }
  const readGrant = grantExtensionPermission({ extensionId: "local-rehearsal.acceptance-tool", permission: "workspace:read", resourceScope: "workspace:fixture" });
  const writeGrant = grantExtensionPermission({ extensionId: "local-rehearsal.acceptance-tool", permission: "workspace:write", resourceScope: "workspace:fixture", confirmed: true });
  const allowedBeforeRevoke = authorizeExtensionPermission({ extensionId: writeGrant.extensionId, permission: writeGrant.permission, resourceScope: writeGrant.resourceScope });
  revokeExtensionGrant(writeGrant.id);
  const deniedAfterRevoke = !authorizeExtensionPermission({ extensionId: writeGrant.extensionId, permission: writeGrant.permission, resourceScope: writeGrant.resourceScope });
  const checks = { unconfirmedDangerousGrantDenied: unconfirmedDenied, readGrantAllowed: authorizeExtensionPermission({ extensionId: readGrant.extensionId, permission: readGrant.permission, resourceScope: readGrant.resourceScope }), confirmedWriteAllowed: allowedBeforeRevoke, revokedGrantDenied: deniedAfterRevoke };
  const receipt: Receipt = { id: `extension-grants-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", checks, grantIds: [readGrant.id, writeGrant.id] };
  updateStore((store) => ({ ...store, receipts: [receipt, ...store.receipts].slice(0, 100) }));
  return receipt;
}

export function readExtensionPermissionGrantEvidence() {
  const store = readStore();
  return { ...store, ok: true as const, generatedAt: new Date().toISOString(), latestPassing: store.receipts.find((entry) => entry.status === "pass") || null, totals: { grants: store.grants.length, active: store.grants.filter((entry) => entry.state === "active").length, revoked: store.grants.filter((entry) => entry.state === "revoked").length }, path: STORE_FILE };
}
