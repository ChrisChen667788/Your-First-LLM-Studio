import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQualityPolicySafetyReviewState,
  isQualityPolicyWaiverActive,
} from "@/features/evaluation/quality-policy-safety-review";

function fixture(hasRealEvidence = true) {
  return {
    qualityCi: {
      latestPassing: hasRealEvidence
        ? {
            id: "quality-ci-1",
            checks: { pairedConfidencePass: true, judgeCalibrated: true },
          }
        : null,
    },
    artifactBinding: {
      latestPassing: hasRealEvidence ? { id: "artifact-binding-1" } : null,
    },
    regression: {
      latestPassing: hasRealEvidence ? { id: "regression-1" } : null,
    },
    rehearsal: {
      id: "quality-policy-rehearsal-1",
      generatedAt: "2026-08-21T00:00:00.000Z",
      policyRevision: "quality-policy-safety.v1",
      policyDigest: "sha256:fixture",
      checks: {
        riskTierBound: true,
        pairedNonInferiority: true,
        safetyProbeSuitePass: true,
        latencyCostWithinBudget: true,
        calibrationDisagreementReviewed: true,
        expiredWaiverDenied: true,
        rollbackPlaybookBound: true,
        redTeamReceiptBound: true,
      },
    },
    now: Date.parse("2026-08-21T01:00:00.000Z"),
  };
}

test("quality policy joins risk, safety, performance, review, and independently bound quality evidence", () => {
  const state = buildQualityPolicySafetyReviewState(
    fixture() as Parameters<typeof buildQualityPolicySafetyReviewState>[0],
  );
  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "hold");
  assert.equal(state.checks.expiredWaiverDenied, true);
  assert.equal(state.checks.artifactBindingBound, true);
});

test("expired and self-approved waivers fail closed, and fixture policy mechanics cannot replace evidence", () => {
  const now = Date.parse("2026-08-21T01:00:00.000Z");
  const digest = "a".repeat(64);
  assert.equal(
    isQualityPolicyWaiverActive(
      {
        ownerRole: "release-owner",
        reviewerRole: "safety-reviewer",
        expiresAt: "2026-08-21T00:30:00.000Z",
        reasonDigest: digest,
        rollbackPlaybookDigest: digest,
      },
      now,
    ),
    false,
  );
  assert.equal(
    isQualityPolicyWaiverActive(
      {
        ownerRole: "release-owner",
        reviewerRole: "release-owner",
        expiresAt: "2026-08-21T02:00:00.000Z",
        reasonDigest: digest,
        rollbackPlaybookDigest: digest,
      },
      now,
    ),
    false,
  );
  const state = buildQualityPolicySafetyReviewState(
    fixture(false) as Parameters<typeof buildQualityPolicySafetyReviewState>[0],
  );
  assert.equal(state.localStatus, "hold");
  assert.equal(state.checks.safetyProbeSuitePass, true);
  assert.equal(state.checks.qualityCiEvidenceBound, false);
});
