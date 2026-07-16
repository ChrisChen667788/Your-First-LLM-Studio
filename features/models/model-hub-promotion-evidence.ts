import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { readExternalStorageMigrationEvidence } from "@/features/models/external-storage-migration";
import { readHubTransferSessions } from "@/features/models/hub-transfer-session";

export const MODEL_HUB_PROMOTION_EVIDENCE_SCHEMA_VERSION = "models.promotion-evidence.v1" as const;

function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function readOwnershipManifest(filePath?: string) {
  if (!filePath || !existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as {
      sourcePath?: string;
      destinationPath?: string;
      sourceDigest?: string;
      files?: Array<{ relative?: string; bytes?: number; sha256?: string }>;
      volume?: { external?: boolean; writable?: boolean; volumeUuid?: string; deviceIdentifier?: string };
    };
  } catch {
    return null;
  }
}

export function buildModelHubPromotionEvidence() {
  const transferEvidence = readHubTransferSessions();
  const storageEvidence = readExternalStorageMigrationEvidence();
  const hubReceipt = transferEvidence.receipts.find((entry) => entry.status === "pass") || null;
  const storageReceipt = hubReceipt
    ? storageEvidence.receipts.find((entry) =>
        entry.mode === "physical-volume" &&
        entry.status === "pass" &&
        entry.sourcePath &&
        path.resolve(entry.sourcePath) === path.resolve(hubReceipt.destination),
      ) || null
    : null;
  const ownership = readOwnershipManifest(storageReceipt?.ownershipManifest);
  const hubFiles = (hubReceipt?.files || [])
    .map((file) => ({ relative: file.path, bytes: file.bytes, sha256: file.verifiedSha256 || "" }))
    .sort((a, b) => a.relative.localeCompare(b.relative));
  const migratedFiles = (ownership?.files || [])
    .map((file) => ({ relative: file.relative || "", bytes: file.bytes || 0, sha256: file.sha256 || "" }))
    .sort((a, b) => a.relative.localeCompare(b.relative));
  const checks = {
    authenticatedHubReceipt: Boolean(hubReceipt?.authentication.verified && hubReceipt.authentication.subjectDigest),
    immutableRevision: Boolean(hubReceipt && /^[a-f0-9]{40}$/iu.test(hubReceipt.resolvedRevision)),
    multiFileChecksumReceipt: Boolean(hubReceipt && hubReceipt.totals.files >= 2 && hubReceipt.totals.files === hubReceipt.totals.verifiedChecksums),
    physicalMigrationReceipt: Boolean(storageReceipt?.volume?.external && storageReceipt.volume.writable),
    sourceDestinationBound: Boolean(hubReceipt && storageReceipt?.sourcePath && path.resolve(hubReceipt.destination) === path.resolve(storageReceipt.sourcePath)),
    directoryDigestBound: Boolean(storageReceipt?.sourceDigest && ownership?.sourceDigest === storageReceipt.sourceDigest),
    fileSetAndChecksumsBound: hubFiles.length >= 2 && JSON.stringify(hubFiles) === JSON.stringify(migratedFiles),
    ownershipVolumeBound: Boolean(
      storageReceipt?.volume?.volumeUuid &&
      ownership?.volume?.volumeUuid === storageReceipt.volume.volumeUuid &&
      ownership.volume.external === true,
    ),
  };
  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => `Model Hub promotion check failed: ${name}.`);
  const evidenceCore = {
    schemaVersion: MODEL_HUB_PROMOTION_EVIDENCE_SCHEMA_VERSION,
    status: blockers.length ? "hold" as const : "pass" as const,
    checks,
    blockers,
    hubReceipt,
    storageReceipt,
    ownershipManifest: storageReceipt?.ownershipManifest || null,
  };
  return {
    ok: true as const,
    ...evidenceCore,
    generatedAt: new Date().toISOString(),
    evidenceDigest: stableDigest(evidenceCore),
    paths: {
      hubReceipts: transferEvidence.paths.receipts,
      migrationReceipts: storageEvidence.path,
    },
  };
}
