import { createHash, verify } from "node:crypto";

import {
  materializeArtifactManifestDigest,
} from "@/features/artifacts/provenance-gate";
import type { ArtifactPackageManifest } from "@/features/artifacts/package-contract";
import { resolveArtifactPublisherTrustRoot } from "@/features/artifacts/publisher-trust-registry";

export const ARTIFACT_TRUSTED_PACKAGE_POLICY_SCHEMA_VERSION =
  "artifacts.trusted-package-policy.v1" as const;

export type ArtifactDependencyNode = {
  id: string;
  version: string;
  digest: string;
  dependencies: Array<{ id: string; version: string; digest?: string }>;
};

export type ArtifactSbomEvidence = {
  format: "spdx-json" | "cyclonedx-json";
  content: string;
  sha256: string;
  components: number;
};

function parseVersion(value: string) {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)/u);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left: number[], right: number[]) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function satisfiesStudioCompatibility(range: string, version: string) {
  const current = parseVersion(version);
  if (!current) return false;
  const normalized = range.trim();
  if (normalized === "*" || normalized === "latest") return true;
  const minimum = normalized.match(/^>=(\d+\.\d+\.\d+)$/u);
  if (minimum) {
    const expected = parseVersion(minimum[1]);
    return Boolean(expected && compareVersions(current, expected) >= 0);
  }
  const compatible = normalized.match(/^\^(\d+\.\d+\.\d+)$/u);
  if (compatible) {
    const expected = parseVersion(compatible[1]);
    return Boolean(
      expected && current[0] === expected[0] && compareVersions(current, expected) >= 0,
    );
  }
  const exact = parseVersion(normalized);
  return Boolean(exact && compareVersions(current, exact) === 0);
}

function safePackagePath(value: string) {
  return Boolean(
    value &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value.split("/").every((part) => part && part !== "." && part !== ".."),
  );
}

function dependencyGraphChecks(input: {
  manifest: ArtifactPackageManifest;
  catalog: ArtifactDependencyNode[];
}) {
  const byCoordinate = new Map(
    input.catalog.map((node) => [`${node.id}@${node.version}`, node]),
  );
  const dependenciesPinned = input.manifest.dependencies.every(
    (dependency) => /^[a-f0-9]{64}$/u.test(dependency.digest || ""),
  );
  const dependenciesResolved = input.manifest.dependencies.every((dependency) => {
    const resolved = byCoordinate.get(`${dependency.id}@${dependency.version}`);
    return Boolean(resolved && resolved.digest === dependency.digest);
  });
  let cyclic = false;
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (coordinate: string) => {
    if (visiting.has(coordinate)) {
      cyclic = true;
      return;
    }
    if (visited.has(coordinate)) return;
    visiting.add(coordinate);
    const node = byCoordinate.get(coordinate);
    for (const dependency of node?.dependencies || []) {
      visit(`${dependency.id}@${dependency.version}`);
    }
    visiting.delete(coordinate);
    visited.add(coordinate);
  };
  for (const dependency of input.manifest.dependencies) {
    visit(`${dependency.id}@${dependency.version}`);
  }
  return { dependenciesPinned, dependenciesResolved, dependencyGraphAcyclic: !cyclic };
}

export function evaluateTrustedArtifactPackage(input: {
  manifest: ArtifactPackageManifest;
  keyId: string;
  payloads: Record<string, Buffer>;
  dependencyCatalog: ArtifactDependencyNode[];
  studioVersion: string;
  allowedLicenses: string[];
  sbom: ArtifactSbomEvidence;
  secretScanPassed: boolean;
  malwareScanPassed: boolean;
  evaluatedAt?: string;
}) {
  const evaluatedAt = input.evaluatedAt || new Date().toISOString();
  const manifestDigest = materializeArtifactManifestDigest(input.manifest);
  const trust = resolveArtifactPublisherTrustRoot({
    publisher: input.manifest.publisher,
    keyId: input.keyId,
    at: evaluatedAt,
  });
  const paths = input.manifest.files.map((file) => file.path);
  const filePayloadsComplete = input.manifest.files.every((file) => {
    const payload = input.payloads[file.path];
    return Boolean(
      payload && payload.length === file.bytes &&
      createHash("sha256").update(payload).digest("hex") === file.sha256,
    );
  });
  const graph = dependencyGraphChecks({
    manifest: input.manifest,
    catalog: input.dependencyCatalog,
  });
  const checks = {
    manifestDigestVerified:
      /^[a-f0-9]{64}$/u.test(input.manifest.digest || "") &&
      input.manifest.digest === manifestDigest,
    packagePathsSafe:
      paths.length === new Set(paths).size && paths.every(safePackagePath),
    filePayloadsComplete,
    publisherTrusted: Boolean(trust?.valid),
    signingKeyNotRevoked: Boolean(trust && trust.status !== "revoked"),
    signatureVerified: Boolean(
      trust?.valid && input.manifest.signature &&
      verify(
        null,
        Buffer.from(manifestDigest, "hex"),
        trust.publicKeyPem,
        Buffer.from(input.manifest.signature, "base64"),
      ),
    ),
    dependenciesPinned: graph.dependenciesPinned,
    dependenciesResolved: graph.dependenciesResolved,
    dependencyGraphAcyclic: graph.dependencyGraphAcyclic,
    studioCompatible: satisfiesStudioCompatibility(
      input.manifest.compatibleStudio,
      input.studioVersion,
    ),
    licenseAllowed: input.allowedLicenses.includes(input.manifest.license),
    sbomVerified:
      input.sbom.components > 0 &&
      createHash("sha256").update(input.sbom.content).digest("hex") === input.sbom.sha256,
    secretScanPassed: input.secretScanPassed,
    malwareScanPassed: input.malwareScanPassed,
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Trusted artifact package check failed: ${check}.`);
  return {
    schemaVersion: ARTIFACT_TRUSTED_PACKAGE_POLICY_SCHEMA_VERSION,
    evaluatedAt,
    status: blockers.length ? "blocked" as const : "pass" as const,
    artifact: {
      id: input.manifest.id,
      version: input.manifest.version,
      kind: input.manifest.kind,
      publisher: input.manifest.publisher,
      keyId: input.keyId,
      manifestDigest,
      bytes: Object.values(input.payloads).reduce((sum, payload) => sum + payload.length, 0),
    },
    checks,
    blockers,
  };
}
