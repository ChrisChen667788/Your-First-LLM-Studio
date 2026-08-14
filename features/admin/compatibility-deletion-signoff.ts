import crypto from "crypto";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import {
  readAdminCompatibilityDeletionManifest,
  type AdminCompatibilityDeletionManifest,
} from "./compatibility-deletion-manifest";

const SIGNOFF_PATH = getLocalAgentDataPath(
  "admin-compatibility-deletion-signoffs.json",
);
const MAX_SIGNOFFS = 100;
type SignoffStore = {
  schemaVersion: "admin.compatibility-deletion-signoffs.v1";
  signoffs: AdminCompatibilityDeletionSignoff[];
};

export type AdminCompatibilityDeletionSignoff = {
  id: string;
  createdAt: string;
  operatorId: string;
  reason: string;
  manifestDigest: string;
  manifestStatus: "ready";
  sunsetAt: string;
};

export type AdminCompatibilityDeletionSignoffSummary = {
  schemaVersion: "admin.compatibility-deletion-signoffs.v1";
  generatedAt: string;
  path: string;
  currentManifestDigest: string;
  totalCount: number;
  currentCount: number;
  staleCount: number;
  latestAt: string | null;
  signoffs: Array<AdminCompatibilityDeletionSignoff & {
    current: boolean;
  }>;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digestAdminCompatibilityDeletionManifest(
  manifest: AdminCompatibilityDeletionManifest,
) {
  const { generatedAt: _generatedAt, ...payload } = manifest;
  return crypto
    .createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex");
}

function emptySignoffStore(): SignoffStore {
  return { schemaVersion: "admin.compatibility-deletion-signoffs.v1", signoffs: [] };
}

function isSignoffStore(value: unknown): value is SignoffStore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SignoffStore>;
  return candidate.schemaVersion === "admin.compatibility-deletion-signoffs.v1" && Array.isArray(candidate.signoffs);
}

function readStoredSignoffs(): AdminCompatibilityDeletionSignoff[] {
  return readJsonFileDurably(SIGNOFF_PATH, emptySignoffStore, isSignoffStore).signoffs;
}

export function readAdminCompatibilityDeletionSignoffs(): AdminCompatibilityDeletionSignoffSummary {
  const manifest = readAdminCompatibilityDeletionManifest();
  const currentManifestDigest = digestAdminCompatibilityDeletionManifest(manifest);
  const signoffs = readStoredSignoffs()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((signoff) => ({
      ...signoff,
      current: signoff.manifestDigest === currentManifestDigest,
    }));
  return {
    schemaVersion: "admin.compatibility-deletion-signoffs.v1",
    generatedAt: new Date().toISOString(),
    path: SIGNOFF_PATH,
    currentManifestDigest,
    totalCount: signoffs.length,
    currentCount: signoffs.filter((signoff) => signoff.current).length,
    staleCount: signoffs.filter((signoff) => !signoff.current).length,
    latestAt: signoffs[0]?.createdAt || null,
    signoffs,
  };
}

export function createAdminCompatibilityDeletionSignoff(input: {
  operatorId?: string;
  reason?: string;
}) {
  const operatorId = input.operatorId?.trim() || "";
  const reason = input.reason?.trim() || "";
  if (operatorId.length < 3) {
    throw new Error("A trusted operator identity is required.");
  }
  if (reason.length < 12) {
    throw new Error("A sign-off reason of at least 12 characters is required.");
  }
  const manifest = readAdminCompatibilityDeletionManifest();
  if (manifest.status !== "ready") {
    throw new Error(
      `Compatibility deletion is ${manifest.status}; all deletion gates must be ready before sign-off.`,
    );
  }
  const manifestDigest = digestAdminCompatibilityDeletionManifest(manifest);
  const outcome: {
    created: boolean;
    signoff?: AdminCompatibilityDeletionSignoff;
  } = { created: false };
  updateJsonFileDurably(
    SIGNOFF_PATH,
    emptySignoffStore,
    (store) => {
      const duplicate = store.signoffs.find(
        (entry) => entry.operatorId === operatorId && entry.manifestDigest === manifestDigest,
      );
      if (duplicate) {
        outcome.signoff = duplicate;
        return store;
      }
      outcome.created = true;
      outcome.signoff = {
        id: `compatibility-signoff-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
        operatorId,
        reason,
        manifestDigest,
        manifestStatus: "ready",
        sunsetAt: manifest.sunsetAt,
      };
      return { ...store, signoffs: [outcome.signoff, ...store.signoffs].slice(0, MAX_SIGNOFFS) };
    },
    isSignoffStore,
  );
  if (!outcome.signoff) throw new Error("Compatibility sign-off update did not produce a result.");
  return {
    ok: true,
    created: outcome.created,
    signoff: outcome.signoff,
    summary: readAdminCompatibilityDeletionSignoffs(),
  };
}

export function serializeAdminCompatibilityDeletionSignoffsAsMarkdown() {
  const summary = readAdminCompatibilityDeletionSignoffs();
  return [
    "# Admin Compatibility Deletion Sign-offs",
    "",
    `Generated: ${summary.generatedAt}`,
    `Current manifest SHA-256: ${summary.currentManifestDigest}`,
    `Sign-offs: ${summary.totalCount}`,
    `Current: ${summary.currentCount}`,
    `Stale: ${summary.staleCount}`,
    "",
    ...summary.signoffs.flatMap((signoff) => [
      `## ${signoff.operatorId}`,
      "",
      `- Created: ${signoff.createdAt}`,
      `- Current: ${signoff.current ? "yes" : "no"}`,
      `- Manifest SHA-256: ${signoff.manifestDigest}`,
      `- Sunset: ${signoff.sunsetAt}`,
      `- Reason: ${signoff.reason}`,
      "",
    ]),
  ].join("\n");
}
