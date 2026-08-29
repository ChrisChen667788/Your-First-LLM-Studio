import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_INTELLIGENCE_DEFINITIONS,
  buildAiOperationsIntelligenceState,
} from "@/features/experiments/ai-operations-intelligence-train";
import {
  DEPLOYMENT_LIFECYCLE_ASSURANCE_DEFINITIONS,
  buildDeploymentLifecycleAssuranceState,
} from "@/features/experiments/deployment-lifecycle-assurance-train";
import type {
  ExternalAssuranceArtifact,
  ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import {
  buildOperationalSourceSignalSnapshot,
  type OperationalSourceSignal,
  type OperationalSourceSignalId,
} from "@/features/experiments/operational-source-signals";
import { RELEASE_TRAIN_MILESTONES } from "@/features/experiments/release-train";

const now = Date.parse("2026-08-28T00:00:00.000Z");

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
        generatedAt: "2026-08-27T00:00:00.000Z",
        expiresAt: "2026-09-28T00:00:00.000Z",
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

const signalIds: OperationalSourceSignalId[] = [
  "runtime-fleet",
  "provider-reliability",
  "workload-slo",
  "token-cost",
  "benchmark-drift",
  "retrieval-drift",
  "agent-action-safety",
  "workflow-recovery",
  "finetune-roi",
  "independent-ops-review",
  "deployment-portability",
  "data-sovereignty",
  "customer-keys",
  "continuity-exit",
  "independent-lifecycle-review",
];

function sourceSignals(attentionIds: OperationalSourceSignalId[] = []) {
  return buildOperationalSourceSignalSnapshot(
    signalIds.map((id): OperationalSourceSignal => {
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

test("operational source signals keep local readiness distinct from external-only review", () => {
  const complete = sourceSignals();
  assert.equal(complete.summary.totalSignals, 15);
  assert.equal(complete.summary.sourceOwnedSignals, 13);
  assert.equal(complete.summary.passingSignals, 13);
  assert.equal(complete.summary.externalOnlySignals, 2);
  assert.equal(complete.localStatus, "pass");

  const attention = sourceSignals(["provider-reliability"]);
  assert.equal(attention.localStatus, "attention");
  assert.equal(attention.summary.attentionSignals, 1);
});

test("v2.4 AI operations chain verifies ten records without authorizing production", () => {
  const anchor = {
    version: "v2.3.4",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "assurance-closure-archive",
    issuerOrganizationId: "assurance-archive-authority",
  };
  const state = buildAiOperationsIntelligenceState({
    anchor,
    artifacts: artifactsFor(AI_OPERATIONS_INTELLIGENCE_DEFINITIONS, {
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
  assert.equal(state.versions[0]?.sourceSignal?.id, "runtime-fleet");
});

test("v2.5 lifecycle chain binds v2.4.9 and preserves independent closure", () => {
  const anchor = {
    version: "v2.4.9",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "ai-operations-independent-review",
    issuerOrganizationId: "ai-operations-review-authority",
  };
  const artifacts = artifactsFor(DEPLOYMENT_LIFECYCLE_ASSURANCE_DEFINITIONS, {
    version: anchor.version,
    digest: anchor.digest,
    recordId: anchor.recordId,
  });
  const complete = buildDeploymentLifecycleAssuranceState({
    anchor,
    artifacts,
    sourceSignals: sourceSignals(),
    now,
  });
  assert.equal(complete.summary.verifiedVersions, 5);
  assert.equal(complete.sourceSummary.sourceOwnedSignals, 4);
  assert.equal(complete.productionStatus, "blocked");

  artifacts[4]!.payload!.issuer!.organizationId = "external-authority-3";
  const invalid = buildDeploymentLifecycleAssuranceState({
    anchor,
    artifacts,
    sourceSignals: sourceSignals(),
    now,
  });
  assert.equal(invalid.versions[4]?.checks.finalReviewerIndependent, false);
  assert.equal(invalid.versions[4]?.evidenceStatus, "invalid");
});

test("local attention and missing external evidence remain visible and fail-closed", () => {
  const state = buildAiOperationsIntelligenceState({
    anchor: {
      version: "v2.3.4",
      evidenceStatus: "missing",
      digest: null,
      recordId: null,
      issuerOrganizationId: null,
    },
    artifacts: [],
    sourceSignals: sourceSignals(["workload-slo", "token-cost"]),
    now,
  });
  assert.equal(state.localStatus, "attention");
  assert.equal(state.summary.verifiedVersions, 0);
  assert.ok(state.versions.every((version) => version.evidenceStatus === "missing"));
  assert.equal(state.productionStatus, "blocked");
});

test("release train contains all fifteen v2.4-v2.5 evidence milestones", () => {
  const expected = new Set([
    ...AI_OPERATIONS_INTELLIGENCE_DEFINITIONS,
    ...DEPLOYMENT_LIFECYCLE_ASSURANCE_DEFINITIONS,
  ].map((definition) => definition.version));
  const milestones = RELEASE_TRAIN_MILESTONES.filter((milestone) =>
    expected.has(milestone.version),
  );
  assert.equal(milestones.length, 15);
  assert.ok(milestones.every((milestone) => milestone.status === "evidence-needed"));
});
