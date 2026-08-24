import assert from "node:assert/strict";
import test from "node:test";

import { buildPostGaOperationsTrainState } from "@/features/experiments/post-ga-operations-train";
import { RELEASE_TRAIN_MILESTONES } from "@/features/experiments/release-train";

const now = Date.parse("2026-08-22T00:00:00.000Z");
const closureDigest = "e".repeat(64);
const versions = ["v2.1.0", "v2.1.1", "v2.1.2", "v2.1.3", "v2.1.4", "v2.1.5", "v2.1.6", "v2.1.7", "v2.1.8", "v2.1.9"];
const schemas = [
  "enterprise.external-operations-continuity.v1",
  "enterprise.production-slo-attestation.v1",
  "enterprise.change-incident-provenance.v1",
  "enterprise.data-governance-attestation.v1",
  "enterprise.identity-access-recertification.v1",
  "enterprise.production-supply-chain-reverification.v1",
  "enterprise.quality-drift-safety-review.v1",
  "enterprise.capacity-cost-reconciliation.v1",
  "enterprise.disaster-recovery-cadence.v1",
  "enterprise.independent-operations-review.v1",
];

function digest(index: number) {
  return String(index).repeat(64);
}

function semantic(index: number) {
  const evidenceDigest = "f".repeat(64);
  switch (index) {
    case 0: return { continuity: { status: "active", observationWindowHours: 24, telemetryEvidenceDigest: evidenceDigest, incidentStatus: "no-unresolved-critical" } };
    case 1: return { slo: { status: "met", observationWindowHours: 24, metricsDigest: evidenceDigest, errorBudgetStatus: "within-budget" } };
    case 2: return { change: { status: "closed", changeReviewDigest: evidenceDigest, incidentLedgerDigest: evidenceDigest, unresolvedCriticalIncidents: 0 } };
    case 3: return { data: { retentionPolicyDigest: evidenceDigest, deletionPropagation: "verified", auditArchiveIntegrity: "verified", unresolvedLegalHoldConflicts: 0 } };
    case 4: return { identity: { accessReviewStatus: "passed", lifecycleEvidenceDigest: evidenceDigest, privilegedAccessReviewDigest: evidenceDigest, unresolvedCriticalFindings: 0 } };
    case 5: return { supplyChain: { artifactInventoryDigest: evidenceDigest, vulnerabilityReview: "passed", revocationStatus: "clear", unsignedArtifactCount: 0 } };
    case 6: return { quality: { policyDigest: evidenceDigest, qualityStatus: "within-policy", safetyStatus: "passed", driftStatus: "none" } };
    case 7: return { capacity: { capacityPlanDigest: evidenceDigest, budgetStatus: "within-budget", settlementStatus: "reconciled", headroomPct: 1 } };
    case 8: return { recovery: { rehearsalDigest: evidenceDigest, status: "passed", measuredRpoMs: 0, measuredRtoMs: 1, crossRegion: "verified" } };
    default: return { review: { status: "accepted", chainDigests: Array.from({ length: 9 }, (_, entryIndex) => digest(entryIndex)), reviewDigest: evidenceDigest } };
  }
}

function fixture() {
  return {
    now,
    closure: {
      productionStatus: "blocked",
      stages: { closure: { status: "verified", digest: closureDigest, issuerOrganizationId: "v200-closure-authority" } },
    },
    artifacts: versions.map((version, index) => ({
      present: true,
      digest: digest(index),
      signatureVerified: true,
      trustAnchorPinned: true,
      payload: {
        schemaVersion: schemas[index],
        recordId: `post-ga-${index}`,
        generatedAt: "2026-08-21T00:00:00.000Z",
        expiresAt: "2026-08-29T00:00:00.000Z",
        ...(index === 0
          ? { release: { releaseVersion: "v2.0.0", closureArchiveDigest: closureDigest } }
          : { predecessor: { version: versions[index - 1], digest: digest(index - 1), recordId: `post-ga-${index - 1}` } }),
        ...semantic(index),
        issuer: { organizationId: `operations-authority-${index}`, operatorId: `operator-${index}`, keyId: `key-${index}` },
      },
    })),
  };
}

test("the complete v2.1 operations chain verifies but never authorizes production", () => {
  const state = buildPostGaOperationsTrainState(fixture() as Parameters<typeof buildPostGaOperationsTrainState>[0]);
  assert.equal(state.sourceStatus, "pass");
  assert.equal(state.summary.verifiedVersions, 10);
  assert.equal(state.summary.chainComplete, true);
  assert.equal(state.versions[9]?.evidenceStatus, "verified");
  assert.equal(state.productionStatus, "blocked");
});

test("a broken predecessor or non-independent final reviewer invalidates the protected chain", () => {
  const input = fixture();
  input.artifacts[4].payload.predecessor.digest = "x".repeat(64);
  input.artifacts[9].payload.issuer.organizationId = "operations-authority-8";
  const state = buildPostGaOperationsTrainState(input as Parameters<typeof buildPostGaOperationsTrainState>[0]);
  assert.equal(state.versions[4]?.evidenceStatus, "invalid");
  assert.equal(state.versions[5]?.evidenceStatus, "invalid");
  assert.equal(state.versions[9]?.evidenceStatus, "invalid");
  assert.equal(state.productionStatus, "blocked");
});

test("missing evidence and malformed digests remain fail-closed", () => {
  const missing = buildPostGaOperationsTrainState({
    now,
    closure: {
      productionStatus: "blocked",
      stages: { closure: { status: "missing", digest: null, issuerOrganizationId: null } },
    },
    artifacts: [],
  } as Parameters<typeof buildPostGaOperationsTrainState>[0]);
  assert.equal(missing.summary.verifiedVersions, 0);
  assert.ok(missing.versions.every((version) => version.evidenceStatus === "missing"));
  assert.equal(missing.productionStatus, "blocked");

  const malformed = fixture();
  malformed.artifacts[2].digest = "z".repeat(64);
  const state = buildPostGaOperationsTrainState(
    malformed as Parameters<typeof buildPostGaOperationsTrainState>[0],
  );
  assert.equal(state.versions[2]?.evidenceStatus, "invalid");
  assert.equal(state.versions[3]?.evidenceStatus, "invalid");
  assert.equal(state.productionStatus, "blocked");
});

test("the fifteen source-complete external milestones remain evidence-needed", () => {
  const externalVersions = new Set([
    "v2.0.1",
    "v2.0.2",
    "v2.0.3",
    "v2.0.4",
    "v2.0.5",
    ...versions,
  ]);
  const milestones = RELEASE_TRAIN_MILESTONES.filter((milestone) =>
    externalVersions.has(milestone.version),
  );

  assert.equal(milestones.length, 15);
  assert.ok(milestones.every((milestone) => milestone.status === "evidence-needed"));
});
