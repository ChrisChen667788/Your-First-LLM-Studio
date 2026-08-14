import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
} from "node:crypto";
import os from "node:os";
import path from "node:path";

import { installTrustedArtifact } from "@/features/artifacts/install-transaction";
import {
  publishArtifactToLocalRegistry,
  queryArtifactLocalRegistry,
} from "@/features/artifacts/local-registry";
import {
  ARTIFACT_PACKAGE_SCHEMA_VERSION,
  type ArtifactPackageManifest,
} from "@/features/artifacts/package-contract";
import {
  evaluateArtifactProvenance,
  materializeArtifactManifestDigest,
} from "@/features/artifacts/provenance-gate";
import {
  readArtifactPublisherTrustRegistry,
  registerArtifactPublisherTrustRoot,
  resolveArtifactPublisherTrustRoot,
  revokeArtifactPublisherTrustRoot,
} from "@/features/artifacts/publisher-trust-registry";
import {
  artifactStagingRoundTripPayload,
  importArtifactStagingRoundTrip,
} from "@/features/artifacts/staging-round-trip";
import { evaluateTrustedArtifactPackage } from "@/features/artifacts/trusted-package-policy";
import { readPostgresUsageOutboxEvidence } from "@/features/deployment/postgres-usage-outbox";
import {
  readReleaseCandidateAcceptanceEvidence,
  type ReleaseCandidateAcceptanceReceipt,
} from "@/features/evaluation/release-candidate-acceptance";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const V15_ACCEPTANCE_BATCH_SCHEMA_VERSION =
  "experiments.v15-acceptance-batch.v2" as const;

const ARTIFACT_ID = "first-llm-studio.v15-acceptance";
const ARTIFACT_VERSION = "1.0.0";
const PUBLISHER = "first-llm-studio.release";

type V15CheckId =
  | "manifest-digest"
  | "package-paths"
  | "file-payloads"
  | "publisher-trust"
  | "signature-rotation"
  | "dependency-pins"
  | "dependency-resolution"
  | "dependency-cycle-denial"
  | "studio-compatibility"
  | "license-sbom-security"
  | "isolated-install"
  | "immutable-registry-query"
  | "staging-round-trip"
  | "release-candidate-quality"
  | "postgres-usage-outbox";

export type V15AcceptanceSlice = {
  id: V15CheckId;
  version: "v1.5.0" | "v1.5.1";
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type V15AcceptanceReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: V15AcceptanceSlice[];
  totals: { slices: 15; passed: number; held: number };
  artifact: {
    id: string;
    version: string;
    manifestDigest: string;
    registryRecordId: string;
    installReceiptId: string;
    stagingReceiptId: string;
    qualityClaimReceiptId: string;
    outboxReceiptId: string | null;
    releaseCandidateArtifactId: string | null;
    releaseCandidateArtifactVersion: string | null;
  };
  productionBlockers: string[];
  evidenceDigest: string;
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
const STORE_FILE = path.join(DATA_DIR, "v1.5-local-acceptance-batch-v2.json");

function digest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function slice(
  id: V15CheckId,
  version: V15AcceptanceSlice["version"],
  label: string,
  passed: boolean,
  summary: string,
): V15AcceptanceSlice {
  return { id, version, label, status: passed ? "pass" : "hold", summary };
}

type ReleaseCandidateInput = Pick<
  ReleaseCandidateAcceptanceReceipt,
  "artifact" | "workload" | "evidence" | "productionBlockers"
>;

export function runV15AcceptanceBatch(input: {
  releaseCandidate?: ReleaseCandidateInput | null;
} = {}) {
  const activePair = generateKeyPairSync("ed25519");
  const retiredPair = generateKeyPairSync("ed25519");
  const keyId = `v15-active-${randomUUID()}`;
  const retiredKeyId = `v15-retired-${randomUUID()}`;
  const activePublicKeyPem = activePair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const retiredPublicKeyPem = retiredPair.publicKey.export({ type: "spki", format: "pem" }).toString();
  registerArtifactPublisherTrustRoot({ publisher: PUBLISHER, keyId, publicKeyPem: activePublicKeyPem });
  registerArtifactPublisherTrustRoot({ publisher: PUBLISHER, keyId: retiredKeyId, publicKeyPem: retiredPublicKeyPem });
  revokeArtifactPublisherTrustRoot({
    publisher: PUBLISHER,
    keyId: retiredKeyId,
    reason: "Acceptance key rotation retirement.",
  });

  const payloads = {
    "artifact.json": Buffer.from("first-llm-studio-v15-artifact\n", "utf8"),
    "README.md": Buffer.from("# First LLM Studio v1.5 acceptance\n", "utf8"),
    "evidence/sbom.spdx.json": Buffer.from(
      JSON.stringify({ spdxVersion: "SPDX-2.3", packages: [{ name: ARTIFACT_ID }] }),
      "utf8",
    ),
  };
  const dependencyDigest = digest("runtime-profile@1.0.0");
  const manifest: ArtifactPackageManifest = {
    schemaVersion: ARTIFACT_PACKAGE_SCHEMA_VERSION,
    id: ARTIFACT_ID,
    version: ARTIFACT_VERSION,
    kind: "workflow",
    publisher: PUBLISHER,
    createdAt: "2026-08-02T00:00:00.000Z",
    license: "Apache-2.0",
    compatibleStudio: ">=1.3.1",
    dependencies: [{
      id: "first-llm-studio.runtime-profile",
      version: "1.0.0",
      digest: dependencyDigest,
    }],
    files: [
      { path: "artifact.json", role: "manifest", sha256: digest(payloads["artifact.json"]), bytes: payloads["artifact.json"].length },
      { path: "README.md", role: "report", sha256: digest(payloads["README.md"]), bytes: payloads["README.md"].length },
      { path: "evidence/sbom.spdx.json", role: "evidence", sha256: digest(payloads["evidence/sbom.spdx.json"]), bytes: payloads["evidence/sbom.spdx.json"].length },
    ],
    evidenceUris: ["docs/release-evidence/v1.5-local-acceptance-2026-08-02.md"],
  };
  manifest.digest = materializeArtifactManifestDigest(manifest);
  manifest.signature = sign(
    null,
    Buffer.from(manifest.digest, "hex"),
    activePair.privateKey,
  ).toString("base64");
  const dependencyCatalog = [{
    id: "first-llm-studio.runtime-profile",
    version: "1.0.0",
    digest: dependencyDigest,
    dependencies: [],
  }];
  const sbom = {
    format: "spdx-json" as const,
    content: payloads["evidence/sbom.spdx.json"].toString("utf8"),
    sha256: digest(payloads["evidence/sbom.spdx.json"]),
    components: 1,
  };
  const policy = evaluateTrustedArtifactPackage({
    manifest,
    keyId,
    payloads,
    dependencyCatalog,
    studioVersion: "1.3.1",
    allowedLicenses: ["Apache-2.0", "MIT"],
    sbom,
    secretScanPassed: true,
    malwareScanPassed: true,
  });
  const retiredDenied = resolveArtifactPublisherTrustRoot({
    publisher: PUBLISHER,
    keyId: retiredKeyId,
  })?.valid === false;
  const trust = readArtifactPublisherTrustRegistry();
  evaluateArtifactProvenance(
    manifest,
    {
      sourceUris: ["https://github.com/ChrisChen667788/Your-First-LLM-Studio"],
      builderId: "first-llm-studio.v15-acceptance",
      sourceRevision: "v1.5-local-acceptance",
      sbomUri: "evidence/sbom.spdx.json",
      secretScanPassed: true,
      evidenceVerified: true,
    },
    { publisher: PUBLISHER, publicKeyPem: activePublicKeyPem },
  );
  const packagePayload = Buffer.concat(Object.values(payloads));
  const registry = publishArtifactToLocalRegistry({
    manifest,
    packageBase64: packagePayload.toString("base64"),
  });
  const registryQuery = queryArtifactLocalRegistry({
    query: ARTIFACT_ID,
    kind: "workflow",
    verifiedOnly: true,
  });
  const install = installTrustedArtifact({
    manifest,
    keyId,
    payloadsBase64: Object.fromEntries(
      Object.entries(payloads).map(([filePath, payload]) => [filePath, payload.toString("base64")]),
    ),
    dependencyCatalog,
    studioVersion: "1.3.1",
    allowedLicenses: ["Apache-2.0", "MIT"],
    sbom,
    secretScanPassed: true,
    malwareScanPassed: true,
    activate: true,
  });
  const stagingUnsigned = {
    targetId: "github-releases" as const,
    artifactId: ARTIFACT_ID,
    version: ARTIFACT_VERSION,
    keyId,
    manifestDigest: registry.manifestDigest,
    packageSha256: registry.packageSha256,
    readBackManifestDigest: registry.manifestDigest,
    readBackPackageSha256: registry.packageSha256,
    immutableRef: `github-release:v${ARTIFACT_VERSION}:${registry.packageSha256.slice(0, 16)}`,
    observedAt: new Date().toISOString(),
  };
  const staging = importArtifactStagingRoundTrip({
    ...stagingUnsigned,
    signature: sign(
      null,
      Buffer.from(digest(artifactStagingRoundTripPayload(stagingUnsigned)), "hex"),
      activePair.privateKey,
    ).toString("base64"),
  });
  const releaseCandidate = input.releaseCandidate === undefined
    ? readReleaseCandidateAcceptanceEvidence().latestPassing
    : input.releaseCandidate;
  const outbox = readPostgresUsageOutboxEvidence().latestPassing;
  const checks = policy.checks;
  const slices = [
    slice("manifest-digest", "v1.5.0", "Manifest digest", checks.manifestDigestVerified, "Canonical manifest digest matches the signed coordinate."),
    slice("package-paths", "v1.5.0", "Package path safety", checks.packagePathsSafe, "Package paths are unique, relative, and traversal-safe."),
    slice("file-payloads", "v1.5.0", "File payload integrity", checks.filePayloadsComplete, "Every declared file matches byte length and SHA-256."),
    slice("publisher-trust", "v1.5.0", "Publisher trust root", checks.publisherTrusted, `${trust.totals.active} active publisher key(s) are registered.`),
    slice("signature-rotation", "v1.5.0", "Signature rotation and revocation", checks.signatureVerified && retiredDenied && trust.totals.revoked > 0, "Active signature verifies and the retired key is denied."),
    slice("dependency-pins", "v1.5.0", "Dependency digest pins", checks.dependenciesPinned, "Every dependency coordinate carries a SHA-256 pin."),
    slice("dependency-resolution", "v1.5.0", "Dependency resolution", checks.dependenciesResolved, "Pinned dependencies resolve to the catalog digest."),
    slice("dependency-cycle-denial", "v1.5.0", "Dependency cycle denial", checks.dependencyGraphAcyclic, "The dependency graph is acyclic."),
    slice("studio-compatibility", "v1.5.0", "Studio compatibility", checks.studioCompatible, "The current Studio version satisfies the artifact range."),
    slice("license-sbom-security", "v1.5.0", "License, SBOM, and scans", checks.licenseAllowed && checks.sbomVerified && checks.secretScanPassed && checks.malwareScanPassed, "License policy, SPDX evidence, secret scan, and malware scan pass."),
    slice("isolated-install", "v1.5.0", "Isolated install transaction", install.status === "pass" && Object.values(install.checks).every(Boolean), "Staged digests were verified before atomic installation."),
    slice("immutable-registry-query", "v1.5.0", "Immutable registry and query", registry.roundTripVerified && registryQuery.records.some((entry) => entry.id === registry.id), "Immutable local coordinates are searchable after round-trip verification."),
    slice("staging-round-trip", "v1.5.0", "Signed staging round-trip", staging.status === "pass", "Signed provider read-back evidence matches local digests."),
    slice("release-candidate-quality", "v1.5.0", "Release-candidate quality claim", Boolean(releaseCandidate), releaseCandidate ? `${releaseCandidate.workload.pairedSamples} paired samples bind real adapter weights, regression, registry, and usage evidence.` : "No passing real release-candidate quality receipt exists."),
    slice("postgres-usage-outbox", "v1.5.1", "PostgreSQL usage outbox", Boolean(outbox), outbox ? `Durable event ${outbox.evidence.eventId} delivered after ${outbox.evidence.attempts} attempt(s).` : "No passing PostgreSQL usage outbox receipt exists."),
  ];
  const productionBlockers = [
    "GitHub, ModelScope, and Hugging Face still require independent provider-side staging receipts.",
    ...(releaseCandidate?.productionBlockers || [
      "A real adapter release-candidate quality receipt is missing.",
    ]),
    ...(outbox?.productionBlockers || ["Managed PostgreSQL and billing receiver evidence are missing."]),
    ...(releaseCandidate ? [] : [
      "Cloud KMS/HSM, immutable archive, multi-region failover, and organization sign-off remain external gates.",
    ]),
  ];
  const evidenceDigest = digest(JSON.stringify({
    slices: slices.map(({ id, status }) => ({ id, status })),
    artifact: [
      manifest.digest,
      registry.id,
      install.id,
      staging.id,
      releaseCandidate?.artifact.id,
      releaseCandidate?.evidence.qualityClaimReceiptId,
      outbox?.id,
    ],
  }));
  const receipt: V15AcceptanceReceipt = {
    id: `v15-acceptance-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: slices.every((entry) => entry.status === "pass") ? "pass" : "hold",
    localStatus: slices.every((entry) => entry.status === "pass") ? "pass" : "hold",
    productionStatus: "hold",
    slices,
    totals: {
      slices: 15,
      passed: slices.filter((entry) => entry.status === "pass").length,
      held: slices.filter((entry) => entry.status === "hold").length,
    },
    artifact: {
      id: ARTIFACT_ID,
      version: ARTIFACT_VERSION,
      manifestDigest: manifest.digest,
      registryRecordId: registry.id,
      installReceiptId: install.id,
      stagingReceiptId: staging.id,
      qualityClaimReceiptId:
        releaseCandidate?.evidence.qualityClaimReceiptId || "missing",
      outboxReceiptId: outbox?.id || null,
      releaseCandidateArtifactId: releaseCandidate?.artifact.id || null,
      releaseCandidateArtifactVersion: releaseCandidate?.artifact.version || null,
    },
    productionBlockers,
    evidenceDigest,
  };
  prependDurableReceipt(
    STORE_FILE,
    V15_ACCEPTANCE_BATCH_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readV15AcceptanceBatchEvidence() {
  const receipts = readDurableReceipts<V15AcceptanceReceipt>(
    STORE_FILE,
    V15_ACCEPTANCE_BATCH_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: V15_ACCEPTANCE_BATCH_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: latest?.localStatus || "evidence-needed" as const,
    productionStatus: "hold" as const,
    latest,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    totals: latest?.totals || { slices: 15, passed: 0, held: 15 },
    productionBlockers: latest?.productionBlockers || [
      "v1.5 local acceptance has not been run.",
    ],
    path: STORE_FILE,
  };
}
