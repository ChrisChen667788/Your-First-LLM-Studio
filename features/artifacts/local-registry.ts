import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { materializeArtifactManifestDigest, readArtifactProvenanceEvidence } from "@/features/artifacts/provenance-gate";
import { validateArtifactPackage, type ArtifactPackageManifest } from "@/features/artifacts/package-contract";
import { readJsonFileDurably, updateJsonFileDurably } from "@/features/persistence/durable-json-file";

export const ARTIFACT_LOCAL_REGISTRY_SCHEMA_VERSION = "artifacts.local-registry.v1" as const;
export type ArtifactRegistryRecord = { id: string; artifactId: string; version: string; kind: string; publisher: string; manifestDigest: string; packageSha256: string; packageBytes: number; directory: string; publishedAt: string; roundTripVerified: boolean };
type Store = { schemaVersion: typeof ARTIFACT_LOCAL_REGISTRY_SCHEMA_VERSION; records: ArtifactRegistryRecord[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const REGISTRY_ROOT = path.join(DATA_DIR, "artifact-local-registry"); const STORE_FILE = path.join(DATA_DIR, "artifact-local-registry.json");
function emptyStore(): Store { return { schemaVersion: ARTIFACT_LOCAL_REGISTRY_SCHEMA_VERSION, records: [] }; }
function isStore(value: unknown): value is Store { if (!value || typeof value !== "object") return false; const candidate = value as Partial<Store>; return candidate.schemaVersion === ARTIFACT_LOCAL_REGISTRY_SCHEMA_VERSION && Array.isArray(candidate.records); }
function readStore(): Store { return readJsonFileDurably(STORE_FILE, emptyStore, isStore); }
function safe(value: string, label: string) { if (!/^[a-z0-9][a-z0-9._-]+$/i.test(value)) throw new Error(`${label} is not safe for a registry path.`); return value; }

export function publishArtifactToLocalRegistry(input: { manifest: ArtifactPackageManifest; packageBase64: string }) {
  const validation = validateArtifactPackage(input.manifest); if (!validation.valid) throw new Error(validation.errors.join(" "));
  const digest = materializeArtifactManifestDigest(input.manifest); if (input.manifest.digest !== digest) throw new Error("Artifact manifest digest is not materialized correctly.");
  const provenance = readArtifactProvenanceEvidence().receipts.find((receipt) => receipt.artifactId === input.manifest.id && receipt.version === input.manifest.version && receipt.status === "pass");
  if (!provenance) throw new Error("A passing provenance receipt is required before registry publication.");
  const payload = Buffer.from(input.packageBase64 || "", "base64"); if (!payload.length) throw new Error("Artifact package payload is required."); if (payload.length > 20 * 1024 * 1024) throw new Error("Artifact package exceeds the 20 MB local registry limit.");
  const artifactId = safe(input.manifest.id, "artifact id"); const version = safe(input.manifest.version, "artifact version"); const directory = path.join(REGISTRY_ROOT, artifactId, version); const packageSha256 = createHash("sha256").update(payload).digest("hex");
  const existing = readStore().records.find((entry) => entry.artifactId === input.manifest.id && entry.version === input.manifest.version);
  if (existing && (existing.manifestDigest !== digest || existing.packageSha256 !== packageSha256)) throw new Error("Artifact coordinates are immutable and already reference different content.");
  if (existing) return existing;
  const staging = mkdtempSync(path.join(os.tmpdir(), "first-llm-artifact-publish-"));
  try {
    writeFileSync(path.join(staging, "manifest.json"), `${JSON.stringify(input.manifest, null, 2)}\n`, "utf8"); writeFileSync(path.join(staging, "package.bin"), payload, { mode: 0o400 });
    mkdirSync(path.dirname(directory), { recursive: true });
    if (!existsSync(directory)) renameSync(staging, directory);
    const roundTripVerified = createHash("sha256").update(readFileSync(path.join(directory, "package.bin"))).digest("hex") === packageSha256;
    if (!roundTripVerified) throw new Error("Artifact registry round-trip digest verification failed.");
    const record: ArtifactRegistryRecord = { id: `artifact-registry-${randomUUID()}`, artifactId: input.manifest.id, version: input.manifest.version, kind: input.manifest.kind, publisher: input.manifest.publisher, manifestDigest: digest, packageSha256, packageBytes: payload.length, directory, publishedAt: new Date().toISOString(), roundTripVerified };
    updateJsonFileDurably(STORE_FILE, emptyStore, (store) => ({ ...store, records: [record, ...store.records.filter((entry) => !(entry.artifactId === record.artifactId && entry.version === record.version))].slice(0, 500) }), isStore);
    return record;
  } finally { if (existsSync(staging)) rmSync(staging, { recursive: true, force: true }); }
}

export function readArtifactLocalRegistry() { const store = readStore(); return { ...store, ok: true as const, schemaVersion: ARTIFACT_LOCAL_REGISTRY_SCHEMA_VERSION, generatedAt: new Date().toISOString(), totals: { records: store.records.length, verified: store.records.filter((record) => record.roundTripVerified).length, bytes: store.records.reduce((sum, record) => sum + record.packageBytes, 0) }, paths: { root: REGISTRY_ROOT, store: STORE_FILE } }; }

export function queryArtifactLocalRegistry(input: {
  query?: string;
  kind?: string;
  publisher?: string;
  verifiedOnly?: boolean;
}) {
  const query = input.query?.trim().toLowerCase() || "";
  const records = readStore().records.filter((record) =>
    (!query || `${record.artifactId} ${record.version} ${record.kind} ${record.publisher}`.toLowerCase().includes(query)) &&
    (!input.kind || record.kind === input.kind) &&
    (!input.publisher || record.publisher === input.publisher) &&
    (!input.verifiedOnly || record.roundTripVerified),
  );
  return {
    ok: true as const,
    schemaVersion: ARTIFACT_LOCAL_REGISTRY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    filters: { ...input, query },
    records,
    total: records.length,
  };
}
