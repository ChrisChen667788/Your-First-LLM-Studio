import { createHash, randomUUID, verify } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { readArtifactLocalRegistry } from "@/features/artifacts/local-registry";
import type { ArtifactRegistryTargetId } from "@/features/artifacts/registry-adapters";
import { resolveArtifactPublisherTrustRoot } from "@/features/artifacts/publisher-trust-registry";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const ARTIFACT_STAGING_ROUND_TRIP_SCHEMA_VERSION =
  "artifacts.staging-round-trip.v1" as const;

export type ArtifactStagingRoundTripInput = {
  targetId: ArtifactRegistryTargetId;
  artifactId: string;
  version: string;
  keyId: string;
  manifestDigest: string;
  packageSha256: string;
  readBackManifestDigest: string;
  readBackPackageSha256: string;
  immutableRef: string;
  observedAt: string;
  signature: string;
};

export type ArtifactStagingRoundTripReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "blocked";
  productionStatus: "hold";
  targetId: ArtifactRegistryTargetId;
  artifactId: string;
  version: string;
  immutableRef: string;
  checks: {
    localRegistrySourceFound: boolean;
    localManifestDigestMatched: boolean;
    localPackageDigestMatched: boolean;
    remoteManifestReadBackMatched: boolean;
    remotePackageReadBackMatched: boolean;
    immutableReferencePresent: boolean;
    publisherSignatureVerified: boolean;
  };
  blockers: string[];
  productionBlockers: string[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(DATA_DIR, "artifact-staging-round-trips.json");

export function artifactStagingRoundTripPayload(
  input: Omit<ArtifactStagingRoundTripInput, "signature">,
) {
  return JSON.stringify({
    targetId: input.targetId,
    artifactId: input.artifactId,
    version: input.version,
    keyId: input.keyId,
    manifestDigest: input.manifestDigest,
    packageSha256: input.packageSha256,
    readBackManifestDigest: input.readBackManifestDigest,
    readBackPackageSha256: input.readBackPackageSha256,
    immutableRef: input.immutableRef,
    observedAt: input.observedAt,
  });
}

export function importArtifactStagingRoundTrip(input: ArtifactStagingRoundTripInput) {
  const local = readArtifactLocalRegistry().records.find(
    (record) => record.artifactId === input.artifactId && record.version === input.version,
  ) || null;
  const trust = local ? resolveArtifactPublisherTrustRoot({
    publisher: local.publisher,
    keyId: input.keyId,
    at: input.observedAt,
  }) : null;
  const payload = artifactStagingRoundTripPayload(input);
  const checks = {
    localRegistrySourceFound: Boolean(local?.roundTripVerified),
    localManifestDigestMatched: Boolean(local && local.manifestDigest === input.manifestDigest),
    localPackageDigestMatched: Boolean(local && local.packageSha256 === input.packageSha256),
    remoteManifestReadBackMatched:
      input.readBackManifestDigest === input.manifestDigest,
    remotePackageReadBackMatched:
      input.readBackPackageSha256 === input.packageSha256,
    immutableReferencePresent:
      input.immutableRef.length >= 12 && !/\b(latest|main|master)\b/iu.test(input.immutableRef),
    publisherSignatureVerified: Boolean(
      trust?.valid && verify(
        null,
        Buffer.from(createHash("sha256").update(payload).digest("hex"), "hex"),
        trust.publicKeyPem,
        Buffer.from(input.signature, "base64"),
      ),
    ),
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Artifact staging round-trip check failed: ${check}.`);
  const receipt: ArtifactStagingRoundTripReceipt = {
    id: `artifact-staging-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : "pass",
    productionStatus: "hold",
    targetId: input.targetId,
    artifactId: input.artifactId,
    version: input.version,
    immutableRef: input.immutableRef,
    checks,
    blockers,
    productionBlockers: [
      "GitHub, ModelScope, and Hugging Face require independently captured provider-side receipts before marketplace promotion.",
      "Organization policy must approve publisher trust roots and registry credentials.",
    ],
  };
  prependDurableReceipt(
    STORE_FILE,
    ARTIFACT_STAGING_ROUND_TRIP_SCHEMA_VERSION,
    receipt,
    200,
  );
  return receipt;
}

export function readArtifactStagingRoundTripEvidence() {
  const receipts = readDurableReceipts<ArtifactStagingRoundTripReceipt>(
    STORE_FILE,
    ARTIFACT_STAGING_ROUND_TRIP_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: ARTIFACT_STAGING_ROUND_TRIP_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latestPassing: receipts.find((receipt) => receipt.status === "pass") || null,
    totals: {
      receipts: receipts.length,
      passing: receipts.filter((receipt) => receipt.status === "pass").length,
      targets: new Set(receipts.filter((receipt) => receipt.status === "pass").map((receipt) => receipt.targetId)).size,
    },
    productionStatus: "hold" as const,
    path: STORE_FILE,
  };
}
