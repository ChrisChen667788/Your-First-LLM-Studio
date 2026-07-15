import { createHash, randomUUID, verify } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { validateArtifactPackage, type ArtifactPackageManifest } from "@/features/artifacts/package-contract";

export const ARTIFACT_PROVENANCE_GATE_SCHEMA_VERSION = "artifacts.provenance-gate.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const RECEIPT_FILE = path.join(DATA_DIR, "artifact-provenance-receipts.json");

type ProvenanceInput = { sourceUris?: string[]; builderId?: string; sourceRevision?: string; sbomUri?: string; secretScanPassed?: boolean; evidenceVerified?: boolean; publicKeyPem?: string };
type ProvenanceReceipt = { id: string; generatedAt: string; artifactId: string; version: string; status: "pass" | "hold" | "blocked"; score: number; checks: Record<string, boolean>; blockers: string[]; warnings: string[] };

function readReceipts(): ProvenanceReceipt[] { if (!existsSync(RECEIPT_FILE)) return []; try { const parsed = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as { receipts?: ProvenanceReceipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; } }
function persist(receipt: ProvenanceReceipt) { mkdirSync(path.dirname(RECEIPT_FILE), { recursive: true }); writeFileSync(RECEIPT_FILE, `${JSON.stringify({ schemaVersion: ARTIFACT_PROVENANCE_GATE_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 200) }, null, 2)}\n`, "utf8"); }

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function materializeArtifactManifestDigest(manifest: ArtifactPackageManifest) {
  const { digest: _digest, signature: _signature, ...payload } = manifest;
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function readTrustRoots() {
  try { const parsed = JSON.parse(process.env.FIRST_LLM_ARTIFACT_TRUST_ROOTS_JSON || "{}") as Record<string, string>; return parsed && typeof parsed === "object" ? parsed : {}; }
  catch { return {}; }
}

export function evaluateArtifactProvenance(manifest: ArtifactPackageManifest, provenance: ProvenanceInput) {
  const validation = validateArtifactPackage(manifest);
  const materializedDigest = materializeArtifactManifestDigest(manifest);
  const configuredKey = readTrustRoots()[manifest.publisher];
  const rehearsalKey = process.env.NODE_ENV !== "production" && manifest.publisher.startsWith("local-rehearsal") ? provenance.publicKeyPem : undefined;
  const publicKey = configuredKey || rehearsalKey;
  let signatureVerified = false;
  if (publicKey && manifest.signature && manifest.digest === materializedDigest) {
    try { signatureVerified = verify(null, Buffer.from(materializedDigest, "hex"), publicKey, Buffer.from(manifest.signature, "base64")); } catch { signatureVerified = false; }
  }
  const checks = {
    manifestValid: validation.valid,
    manifestDigestVerified: manifest.digest === materializedDigest,
    dependencyDigestsPinned: manifest.dependencies.every((dependency) => Boolean(dependency.digest)),
    sourceDeclared: Boolean(provenance.sourceUris?.length && provenance.sourceRevision),
    builderDeclared: Boolean(provenance.builderId),
    sbomDeclared: Boolean(provenance.sbomUri),
    secretScanPassed: provenance.secretScanPassed === true,
    evidenceVerified: provenance.evidenceVerified === true && manifest.evidenceUris.length > 0,
    signatureVerified,
  };
  const hardChecks = ["manifestValid", "manifestDigestVerified", "dependencyDigestsPinned", "secretScanPassed", "signatureVerified"] as const;
  const blockers = hardChecks.filter((key) => !checks[key]).map((key) => `Required provenance check failed: ${key}.`);
  const warnings = [...validation.warnings, ...Object.entries(checks).filter(([key, value]) => !value && !hardChecks.includes(key as typeof hardChecks[number])).map(([key]) => `Optional provenance check is missing: ${key}.`)];
  const score = Math.round(Object.values(checks).filter(Boolean).length / Object.keys(checks).length * 100);
  const receipt: ProvenanceReceipt = { id: `provenance-${randomUUID()}`, generatedAt: new Date().toISOString(), artifactId: manifest.id, version: manifest.version, status: blockers.length ? "blocked" : warnings.length ? "hold" : "pass", score, checks, blockers, warnings };
  persist(receipt); return receipt;
}

export function readArtifactProvenanceEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: ARTIFACT_PROVENANCE_GATE_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, path: RECEIPT_FILE }; }
