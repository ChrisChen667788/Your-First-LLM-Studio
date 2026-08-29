import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExternalAssuranceArtifact,
  ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import {
  GOVERNED_AUTONOMY_READINESS_DEFINITIONS,
  buildGovernedAutonomyReadinessState,
} from "@/features/experiments/governed-autonomy-readiness-train";
import {
  buildGovernedAutonomySourceSignalSnapshot,
  type GovernedAutonomySourceSignal,
  type GovernedAutonomySourceSignalId,
} from "@/features/experiments/governed-autonomy-source-signals";
import {
  OPEN_ECOSYSTEM_INTEROPERABILITY_DEFINITIONS,
  buildOpenEcosystemInteroperabilityState,
} from "@/features/experiments/open-ecosystem-interoperability-train";
import { RELEASE_TRAIN_MILESTONES } from "@/features/experiments/release-train";

const now = Date.parse("2026-08-29T00:00:00.000Z");

function digest(character: string) {
  return character.repeat(64);
}

function artifactsFor(
  definitions: ExternalAssuranceDefinition[],
  anchor: { version: string; digest: string; recordId: string },
) {
  return definitions.map((definition, index) => {
    const marker = index.toString(16);
    const predecessor = index === 0
      ? anchor
      : {
          version: definitions[index - 1]!.version,
          digest: digest((index - 1).toString(16)),
          recordId: `authority-record-${index - 1}`,
        };
    return {
      present: true,
      digest: digest(marker),
      signatureVerified: true,
      trustAnchorPinned: true,
      payload: {
        schemaVersion: definition.schemaVersion,
        recordId: `authority-record-${index}`,
        generatedAt: "2026-08-28T00:00:00.000Z",
        expiresAt: "2026-09-29T00:00:00.000Z",
        predecessor,
        control: {
          status: "passed",
          primaryEvidenceDigest: digest("a"),
          ...(definition.requireSecondaryDigest
            ? { secondaryEvidenceDigest: digest("b") }
            : {}),
          observationWindowHours: definition.minObservationWindowHours,
          coveragePct: definition.minimumCoveragePct,
          unresolvedCriticalFindings: 0,
          assertions: definition.requiredAssertions,
          ...(definition.finalReview
            ? {
                reviewedDigests: definitions
                  .slice(0, index)
                  .map((_, reviewedIndex) => digest(reviewedIndex.toString(16))),
                reviewDigest: digest("c"),
              }
            : {}),
        },
        issuer: {
          organizationId: `external-authority-${index}`,
          operatorId: `external-operator-${index}`,
          keyId: `external-key-${index}`,
        },
      },
    } satisfies ExternalAssuranceArtifact;
  });
}

const signalIds: GovernedAutonomySourceSignalId[] = [
  "model-selection-policy",
  "provider-routing-safety",
  "grounded-context-policy",
  "tool-permission-policy",
  "protected-action-approval",
  "workflow-replay-safety",
  "benchmark-quality-policy",
  "adapter-rollback-policy",
  "audit-provenance",
  "independent-autonomy-review",
  "openai-api-compatibility",
  "mcp-extension-interoperability",
  "artifact-model-portability",
  "workspace-identity-portability",
  "independent-interoperability-review",
];

function sourceSignals(attentionIds: GovernedAutonomySourceSignalId[] = []) {
  return buildGovernedAutonomySourceSignalSnapshot(
    signalIds.map((id): GovernedAutonomySourceSignal => {
      const externalOnly = id.startsWith("independent-");
      const attention = attentionIds.includes(id);
      return {
        id,
        label: id,
        status: externalOnly ? "external-only" : attention ? "attention" : "pass",
        summary: `${id} source signal`,
        checks: { sourceContractPresent: !attention },
        metrics: {},
        blockers: attention ? [`${id} needs evidence.`] : [],
        evidenceUri: "/experiments",
      };
    }),
  );
}

test("governed autonomy signals keep local readiness separate from independent reviews", () => {
  const complete = sourceSignals();
  assert.equal(complete.summary.totalSignals, 15);
  assert.equal(complete.summary.sourceOwnedSignals, 13);
  assert.equal(complete.summary.passingSignals, 13);
  assert.equal(complete.summary.externalOnlySignals, 2);
  assert.equal(complete.localStatus, "pass");

  const attention = sourceSignals(["provider-routing-safety"]);
  assert.equal(attention.localStatus, "attention");
  assert.equal(attention.summary.attentionSignals, 1);
});

test("v2.6 governed autonomy verifies ten records without authorizing production", () => {
  const anchor = {
    version: "v2.5.4",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "deployment-lifecycle-closure",
    issuerOrganizationId: "deployment-lifecycle-authority",
  };
  const state = buildGovernedAutonomyReadinessState({
    anchor,
    artifacts: artifactsFor(GOVERNED_AUTONOMY_READINESS_DEFINITIONS, {
      version: anchor.version,
      digest: anchor.digest,
      recordId: anchor.recordId,
    }),
    sourceSignals: sourceSignals(),
    now,
  });

  assert.equal(state.summary.verifiedVersions, 10);
  assert.equal(state.summary.chainComplete, true);
  assert.equal(state.sourceSummary.sourceOwnedSignals, 9);
  assert.equal(state.sourceSummary.externalOnlySignals, 1);
  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "blocked");
  assert.equal(state.versions[0]?.sourceSignal?.id, "model-selection-policy");
});

test("v2.7 interoperability binds v2.6.9 and requires an independent final reviewer", () => {
  const anchor = {
    version: "v2.6.9",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "governed-autonomy-review",
    issuerOrganizationId: "governed-autonomy-authority",
  };
  const artifacts = artifactsFor(OPEN_ECOSYSTEM_INTEROPERABILITY_DEFINITIONS, {
    version: anchor.version,
    digest: anchor.digest,
    recordId: anchor.recordId,
  });
  const complete = buildOpenEcosystemInteroperabilityState({
    anchor,
    artifacts,
    sourceSignals: sourceSignals(),
    now,
  });
  assert.equal(complete.summary.verifiedVersions, 5);
  assert.equal(complete.sourceSummary.sourceOwnedSignals, 4);
  assert.equal(complete.productionStatus, "blocked");

  artifacts[4]!.payload!.issuer!.organizationId = "external-authority-3";
  const invalid = buildOpenEcosystemInteroperabilityState({
    anchor,
    artifacts,
    sourceSignals: sourceSignals(),
    now,
  });
  assert.equal(invalid.versions[4]?.checks.finalReviewerIndependent, false);
  assert.equal(invalid.versions[4]?.evidenceStatus, "invalid");
});

test("missing external records and local attention remain fail-closed", () => {
  const state = buildGovernedAutonomyReadinessState({
    anchor: {
      version: "v2.5.4",
      evidenceStatus: "missing",
      digest: null,
      recordId: null,
      issuerOrganizationId: null,
    },
    artifacts: [],
    sourceSignals: sourceSignals(["audit-provenance"]),
    now,
  });
  assert.equal(state.localStatus, "attention");
  assert.equal(state.summary.verifiedVersions, 0);
  assert.ok(state.versions.every((version) => version.evidenceStatus === "missing"));
  assert.equal(state.productionStatus, "blocked");
});

test("release train contains all fifteen v2.6-v2.7 evidence milestones", () => {
  const expected = new Set([
    ...GOVERNED_AUTONOMY_READINESS_DEFINITIONS,
    ...OPEN_ECOSYSTEM_INTEROPERABILITY_DEFINITIONS,
  ].map((definition) => definition.version));
  const milestones = RELEASE_TRAIN_MILESTONES.filter((milestone) =>
    expected.has(milestone.version),
  );
  assert.equal(milestones.length, 15);
  assert.ok(milestones.every((milestone) => milestone.status === "evidence-needed"));
});
