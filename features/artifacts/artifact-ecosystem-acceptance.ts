import { createHash, generateKeyPairSync, sign } from "crypto";
import {
  materializeArtifactManifestDigest,
  evaluateArtifactProvenance,
} from "@/features/artifacts/provenance-gate";
import {
  ARTIFACT_PACKAGE_SCHEMA_VERSION,
  type ArtifactPackageManifest,
} from "@/features/artifacts/package-contract";
import { publishArtifactToLocalRegistry } from "@/features/artifacts/local-registry";

const ACCEPTANCE_ARTIFACT_ID = "first-llm-studio.acceptance-package";
const ACCEPTANCE_PUBLISHER = "first-llm-studio.acceptance";

export function runArtifactEcosystemAcceptance() {
  const payload = Buffer.from(
    "first-llm-studio artifact provenance and registry acceptance\n",
    "utf8",
  );
  const pair = generateKeyPairSync("ed25519");
  const manifest: ArtifactPackageManifest = {
    schemaVersion: ARTIFACT_PACKAGE_SCHEMA_VERSION,
    id: ACCEPTANCE_ARTIFACT_ID,
    version: "1.0.0",
    kind: "workflow",
    publisher: ACCEPTANCE_PUBLISHER,
    createdAt: "2026-07-26T00:00:00.000Z",
    license: "Apache-2.0",
    compatibleStudio: ">=1.3.1",
    dependencies: [
      {
        id: "runtime-profile",
        version: "1.0.0",
        digest: createHash("sha256").update("runtime-profile@1.0.0").digest("hex"),
      },
    ],
    files: [
      {
        path: "manifest.json",
        role: "manifest",
        sha256: createHash("sha256").update(payload).digest("hex"),
        bytes: payload.length,
      },
    ],
    evidenceUris: [
      "docs/release-evidence/v1.3.1-hard-issue-closure-2026-07-26.md",
    ],
  };
  manifest.digest = materializeArtifactManifestDigest(manifest);
  manifest.signature = sign(
    null,
    Buffer.from(manifest.digest, "hex"),
    pair.privateKey,
  ).toString("base64");
  const publicKeyPem = pair.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const provenance = evaluateArtifactProvenance(
    manifest,
    {
      sourceUris: ["https://github.com/ChrisChen667788/Your-First-LLM-Studio"],
      builderId: "first-llm-studio.artifact-acceptance",
      sourceRevision: "v1.3.1-hard-issue-closure",
      sbomUri: "package-lock.json",
      secretScanPassed: true,
      evidenceVerified: true,
    },
    { publisher: ACCEPTANCE_PUBLISHER, publicKeyPem },
  );
  if (provenance.status !== "pass") {
    throw new Error(
      `Artifact provenance acceptance failed: ${provenance.blockers.join(" ")}`,
    );
  }
  const registry = publishArtifactToLocalRegistry({
    manifest,
    packageBase64: payload.toString("base64"),
  });
  return {
    schemaVersion: "artifacts.ecosystem-acceptance.v1" as const,
    generatedAt: new Date().toISOString(),
    status: registry.roundTripVerified ? ("pass" as const) : ("failed" as const),
    provenance,
    registry,
    checks: {
      manifestDigestVerified: provenance.checks.manifestDigestVerified,
      signatureVerified: provenance.checks.signatureVerified,
      dependencyDigestsPinned: provenance.checks.dependencyDigestsPinned,
      secretScanPassed: provenance.checks.secretScanPassed,
      registryRoundTripVerified: registry.roundTripVerified,
    },
  };
}
