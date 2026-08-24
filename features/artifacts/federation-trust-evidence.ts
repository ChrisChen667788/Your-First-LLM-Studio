import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";

import { installTrustedArtifact, readArtifactInstallTransactions } from "@/features/artifacts/install-transaction";
import { publishArtifactToLocalRegistry, readArtifactLocalRegistry } from "@/features/artifacts/local-registry";
import { ARTIFACT_PACKAGE_SCHEMA_VERSION, type ArtifactPackageManifest } from "@/features/artifacts/package-contract";
import { evaluateArtifactProvenance, materializeArtifactManifestDigest, readArtifactProvenanceEvidence } from "@/features/artifacts/provenance-gate";
import { readArtifactPublisherTrustRegistry, registerArtifactPublisherTrustRoot, revokeArtifactPublisherTrustRoot } from "@/features/artifacts/publisher-trust-registry";
import { readArtifactRegistryAdapterCatalog } from "@/features/artifacts/registry-adapters";
import { artifactStagingRoundTripPayload, importArtifactStagingRoundTrip, readArtifactStagingRoundTripEvidence } from "@/features/artifacts/staging-round-trip";
import { evaluateTrustedArtifactPackage } from "@/features/artifacts/trusted-package-policy";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const ARTIFACT_FEDERATION_TRUST_SCHEMA_VERSION =
  "artifacts.federation-trust.v1" as const;
const STORE_SCHEMA_VERSION = "artifacts.federation-trust-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("artifacts", "v1.11.0-federation-trust.json");

type Status = "pass" | "hold";
type Rehearsal = {
  id: string;
  status: "pass" | "hold";
  artifact: { id: string; version: string; registryRecordId: string; stagingReceiptId: string; installReceiptId: string };
  checks: {
    activePublisherSignatureVerified: boolean;
    revokedPublisherDenied: boolean;
    localRegistryRoundTripVerified: boolean;
    trustedInstallPassed: boolean;
    signedReadBackMatched: boolean;
    tamperedReadBackDenied: boolean;
  };
};

export type ArtifactFederationTrustState = {
  localStatus: Status;
  productionStatus: "hold";
  checks: {
    immutableDigestTargets: boolean;
    remoteRoundTripRequired: boolean;
    remoteMutationDisabled: boolean;
    activeTrustRootPresent: boolean;
    revocationObserved: boolean;
    provenanceVerified: boolean;
    localRegistryRoundTripVerified: boolean;
    signedReadBackMatched: boolean;
    trustedInstallPassed: boolean;
    revokedOrTamperedArtifactDenied: boolean;
  };
  summary: {
    targets: number;
    digestVerifyingTargets: number;
    activeTrustRoots: number;
    revokedTrustRoots: number;
    localRegistryRecords: number;
    verifiedLocalRecords: number;
    signedReadBackReceiptId: string | null;
    rehearsal: Rehearsal | null;
  };
  blockers: string[];
  stateDigest: string;
};

export type ArtifactFederationTrustReceipt = ArtifactFederationTrustState & {
  id: string;
  generatedAt: string;
  evidenceDigest: string;
};

type Inputs = {
  adapters: ReturnType<typeof readArtifactRegistryAdapterCatalog>;
  publisherTrust: ReturnType<typeof readArtifactPublisherTrustRegistry>;
  provenance: ReturnType<typeof readArtifactProvenanceEvidence>;
  registry: ReturnType<typeof readArtifactLocalRegistry>;
  staging: ReturnType<typeof readArtifactStagingRoundTripEvidence>;
  installs: ReturnType<typeof readArtifactInstallTransactions>;
  rehearsal: Rehearsal | null;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildArtifactFederationTrustState(input: Inputs): ArtifactFederationTrustState {
  const latestReadBack = input.staging.latestPassing || null;
  const rehearsal = input.rehearsal;
  const checks = {
    immutableDigestTargets: input.adapters.targets.length > 0 && input.adapters.targets.every((target) => target.supportsImmutableVersion && target.supportsDigestVerification),
    remoteRoundTripRequired: input.adapters.policy.remoteRoundTripReceiptRequired === true,
    remoteMutationDisabled: input.adapters.policy.previewAdaptersMayMutateRemote === false,
    activeTrustRootPresent: input.publisherTrust.totals.active > 0,
    revocationObserved: input.publisherTrust.totals.revoked > 0,
    provenanceVerified: Boolean(input.provenance.latestPassing),
    localRegistryRoundTripVerified: input.registry.totals.verified > 0,
    signedReadBackMatched: Boolean(latestReadBack && latestReadBack.checks.publisherSignatureVerified && latestReadBack.checks.remoteManifestReadBackMatched && latestReadBack.checks.remotePackageReadBackMatched && latestReadBack.checks.immutableReferencePresent),
    trustedInstallPassed: Boolean(input.installs.latestPassing?.checks.trustedPolicyPassed && input.installs.latestPassing?.checks.atomicInstall),
    revokedOrTamperedArtifactDenied: Boolean(rehearsal?.checks.revokedPublisherDenied && rehearsal.checks.tamperedReadBackDenied),
  };
  const blockers = [
    ...(checks.immutableDigestTargets ? [] : ["Not every configured federation target requires immutable coordinates and digest verification."]),
    ...(checks.remoteRoundTripRequired ? [] : ["Remote read-back receipts are not required by the registry adapter policy."]),
    ...(checks.remoteMutationDisabled ? [] : ["Preview adapters may mutate remote registries."]),
    ...(checks.activeTrustRootPresent ? [] : ["No active publisher trust root is available."]),
    ...(checks.revocationObserved ? [] : ["No publisher-key revocation is recorded."]),
    ...(checks.provenanceVerified ? [] : ["No passing local provenance receipt is available."]),
    ...(checks.localRegistryRoundTripVerified ? [] : ["No verified local registry round-trip is available."]),
    ...(checks.signedReadBackMatched ? [] : ["No signed immutable read-back receipt matches local digests."]),
    ...(checks.trustedInstallPassed ? [] : ["No trusted atomic installation receipt is available."]),
    ...(checks.revokedOrTamperedArtifactDenied ? [] : ["No local rehearsal proves revoked and tampered artifacts are denied."]),
    "Real provider-side publish/read-back, organization-managed publisher approval, credential rotation, revocation propagation, quarantine review, and independent remote-registry evidence remain production HOLD gates.",
  ];
  const withoutDigest = {
    localStatus: blockers.length === 1 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    checks,
    summary: {
      targets: input.adapters.totals.targets,
      digestVerifyingTargets: input.adapters.totals.digestVerified,
      activeTrustRoots: input.publisherTrust.totals.active,
      revokedTrustRoots: input.publisherTrust.totals.revoked,
      localRegistryRecords: input.registry.totals.records,
      verifiedLocalRecords: input.registry.totals.verified,
      signedReadBackReceiptId: latestReadBack?.id || null,
      rehearsal,
    },
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState(rehearsal: Rehearsal | null) {
  return buildArtifactFederationTrustState({
    adapters: readArtifactRegistryAdapterCatalog(),
    publisherTrust: readArtifactPublisherTrustRegistry(),
    provenance: readArtifactProvenanceEvidence(),
    registry: readArtifactLocalRegistry(),
    staging: readArtifactStagingRoundTripEvidence(),
    installs: readArtifactInstallTransactions(),
    rehearsal,
  });
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

/** A local-only rehearsal: it never contacts or claims a third-party registry. */
export function runArtifactFederationTrustRehearsal() {
  const runId = randomUUID();
  const publisher = `local-rehearsal.v1110-${runId}`;
  const artifactId = `local-rehearsal.v1110-artifact-${runId}`;
  const active = generateKeyPairSync("ed25519");
  const retired = generateKeyPairSync("ed25519");
  const activeKeyId = `v1110-active-${runId}`;
  const retiredKeyId = `v1110-retired-${runId}`;
  const activePublicKeyPem = active.publicKey.export({ type: "spki", format: "pem" }).toString();
  const retiredPublicKeyPem = retired.publicKey.export({ type: "spki", format: "pem" }).toString();
  registerArtifactPublisherTrustRoot({ publisher, keyId: activeKeyId, publicKeyPem: activePublicKeyPem });
  registerArtifactPublisherTrustRoot({ publisher, keyId: retiredKeyId, publicKeyPem: retiredPublicKeyPem });
  revokeArtifactPublisherTrustRoot({ publisher, keyId: retiredKeyId, reason: "v1.11.0 local rehearsal key retirement." });

  const payloads = {
    "artifact.json": Buffer.from(`v1.11.0 federation rehearsal ${runId}\n`, "utf8"),
    "README.md": Buffer.from("# Local federation-trust rehearsal\n", "utf8"),
    "evidence/sbom.spdx.json": Buffer.from(JSON.stringify({ spdxVersion: "SPDX-2.3", packages: [{ name: artifactId }] }), "utf8"),
  };
  const dependencyDigest = sha256("local-rehearsal.runtime-profile@1.0.0");
  const manifest: ArtifactPackageManifest = {
    schemaVersion: ARTIFACT_PACKAGE_SCHEMA_VERSION,
    id: artifactId,
    version: "1.0.0",
    kind: "workflow",
    publisher,
    createdAt: new Date().toISOString(),
    license: "Apache-2.0",
    compatibleStudio: ">=1.3.1",
    dependencies: [{ id: "local-rehearsal.runtime-profile", version: "1.0.0", digest: dependencyDigest }],
    files: [
      { path: "artifact.json", role: "manifest", sha256: sha256(payloads["artifact.json"]), bytes: payloads["artifact.json"].length },
      { path: "README.md", role: "report", sha256: sha256(payloads["README.md"]), bytes: payloads["README.md"].length },
      { path: "evidence/sbom.spdx.json", role: "evidence", sha256: sha256(payloads["evidence/sbom.spdx.json"]), bytes: payloads["evidence/sbom.spdx.json"].length },
    ],
    evidenceUris: ["docs/release-evidence/v1.10.2-v1.12.0-source-train-2026-08-21.md"],
  };
  manifest.digest = materializeArtifactManifestDigest(manifest);
  manifest.signature = sign(null, Buffer.from(manifest.digest, "hex"), active.privateKey).toString("base64");
  const dependencyCatalog = [{ id: "local-rehearsal.runtime-profile", version: "1.0.0", digest: dependencyDigest, dependencies: [] }];
  const sbom = { format: "spdx-json" as const, content: payloads["evidence/sbom.spdx.json"].toString("utf8"), sha256: sha256(payloads["evidence/sbom.spdx.json"]), components: 1 };
  const policy = evaluateTrustedArtifactPackage({ manifest, keyId: activeKeyId, payloads, dependencyCatalog, studioVersion: "1.3.1", allowedLicenses: ["Apache-2.0"], sbom, secretScanPassed: true, malwareScanPassed: true });
  const revokedPolicy = evaluateTrustedArtifactPackage({ manifest, keyId: retiredKeyId, payloads, dependencyCatalog, studioVersion: "1.3.1", allowedLicenses: ["Apache-2.0"], sbom, secretScanPassed: true, malwareScanPassed: true });
  const provenance = evaluateArtifactProvenance(manifest, { sourceUris: ["local://v1.11.0-rehearsal"], builderId: "v1.11.0-federation-trust", sourceRevision: runId, sbomUri: "evidence/sbom.spdx.json", secretScanPassed: true, evidenceVerified: true }, { publisher, publicKeyPem: activePublicKeyPem });
  const registry = publishArtifactToLocalRegistry({ manifest, packageBase64: Buffer.concat(Object.values(payloads)).toString("base64") });
  const install = installTrustedArtifact({ manifest, keyId: activeKeyId, payloadsBase64: Object.fromEntries(Object.entries(payloads).map(([filePath, payload]) => [filePath, payload.toString("base64")])), dependencyCatalog, studioVersion: "1.3.1", allowedLicenses: ["Apache-2.0"], sbom, secretScanPassed: true, malwareScanPassed: true, activate: true });
  const unsignedReadBack = { targetId: "github-releases" as const, artifactId, version: manifest.version, keyId: activeKeyId, manifestDigest: registry.manifestDigest, packageSha256: registry.packageSha256, readBackManifestDigest: registry.manifestDigest, readBackPackageSha256: registry.packageSha256, immutableRef: `local-fixture:github-release:v${manifest.version}:${registry.packageSha256.slice(0, 16)}`, observedAt: new Date().toISOString() };
  const signedReadBack = importArtifactStagingRoundTrip({ ...unsignedReadBack, signature: sign(null, Buffer.from(sha256(artifactStagingRoundTripPayload(unsignedReadBack)), "hex"), active.privateKey).toString("base64") });
  const tamperedReadBack = { ...unsignedReadBack, readBackPackageSha256: "0".repeat(64), observedAt: new Date().toISOString() };
  const tampered = importArtifactStagingRoundTrip({ ...tamperedReadBack, signature: sign(null, Buffer.from(sha256(artifactStagingRoundTripPayload(tamperedReadBack)), "hex"), active.privateKey).toString("base64") });
  const rehearsal: Rehearsal = {
    id: `artifact-federation-rehearsal-${runId}`,
    status: "hold",
    artifact: { id: artifactId, version: manifest.version, registryRecordId: registry.id, stagingReceiptId: signedReadBack.id, installReceiptId: install.id },
    checks: {
      activePublisherSignatureVerified: policy.status === "pass" && policy.checks.signatureVerified,
      revokedPublisherDenied: revokedPolicy.status === "blocked" && !revokedPolicy.checks.publisherTrusted,
      localRegistryRoundTripVerified: registry.roundTripVerified && provenance.status === "pass",
      trustedInstallPassed: install.status === "pass" && Object.values(install.checks).every(Boolean),
      signedReadBackMatched: signedReadBack.status === "pass" && signedReadBack.checks.publisherSignatureVerified,
      tamperedReadBackDenied: tampered.status === "blocked" && !tampered.checks.remotePackageReadBackMatched,
    },
  };
  rehearsal.status = Object.values(rehearsal.checks).every(Boolean) ? "pass" : "hold";
  const state = readCurrentState(rehearsal);
  const withoutDigest = { id: `artifact-federation-${randomUUID()}`, generatedAt: new Date().toISOString(), ...state };
  const receipt: ArtifactFederationTrustReceipt = { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return { receipt, rehearsal, policy, revokedPolicy, signedReadBack, tampered };
}

export function readArtifactFederationTrustEvidence() {
  const receipts = readDurableReceipts<ArtifactFederationTrustReceipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const current = readCurrentState(receipts.find((receipt) => receipt.localStatus === "pass")?.summary.rehearsal || null);
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: ARTIFACT_FEDERATION_TRUST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
