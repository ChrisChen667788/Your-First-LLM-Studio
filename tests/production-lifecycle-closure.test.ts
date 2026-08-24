import assert from "node:assert/strict";
import test from "node:test";

import { buildProductionLifecycleClosureState } from "@/features/experiments/production-lifecycle-closure";

const now = Date.parse("2026-08-22T00:00:00.000Z");
const decisionDigest = "a".repeat(64);
const transitionDigest = "b".repeat(64);
const rollbackDigest = "c".repeat(64);

function artifact<T>(payload: T, digest: string) {
  return {
    present: true,
    payload,
    digest,
    signatureVerified: true,
    trustAnchorPinned: true,
  };
}

function fixture() {
  return {
    now,
    decision: {
      decisionStatus: "approved",
      decisionDigest,
      issuerOrganizationId: "release-authority",
      evidenceIssuerOrganizationId: "evidence-authority",
    },
    transition: artifact(
      {
        schemaVersion: "enterprise.external-transition-witness.v1",
        witnessId: "transition-2026-08-22",
        generatedAt: "2026-08-21T00:00:00.000Z",
        expiresAt: "2026-08-29T00:00:00.000Z",
        decision: { digest: decisionDigest, decisionId: "decision-2026-08-22", releaseVersion: "v2.0.0" },
        transition: {
          environment: "production",
          outcome: "completed",
          controlPlaneRevision: "control-plane-20260822",
          multiRegionFailover: true,
          targetIsolation: true,
          postDeployHealth: true,
        },
        issuer: { organizationId: "transition-witness", operatorId: "operator-a", keyId: "key-a" },
      },
      transitionDigest,
    ),
    rollback: artifact(
      {
        schemaVersion: "enterprise.independent-rollback-witness.v1",
        witnessId: "rollback-2026-08-22",
        generatedAt: "2026-08-21T00:00:00.000Z",
        expiresAt: "2026-08-29T00:00:00.000Z",
        transition: { digest: transitionDigest, witnessId: "transition-2026-08-22", releaseVersion: "v2.0.0" },
        rollback: { planId: "rollback-plan-2026", planDigest: "d".repeat(64), rehearsal: "passed", measuredRpoMs: 0, measuredRtoMs: 1000 },
        issuer: { organizationId: "rollback-witness", operatorId: "operator-b", keyId: "key-b" },
      },
      rollbackDigest,
    ),
    closure: artifact(
      {
        schemaVersion: "enterprise.release-closure-archive.v1",
        archiveId: "closure-2026-08-22",
        generatedAt: "2026-08-21T00:00:00.000Z",
        expiresAt: "2026-08-29T00:00:00.000Z",
        closure: { status: "closed", releaseVersion: "v2.0.0" },
        chain: { decisionDigest, transitionDigest, rollbackDigest },
        issuer: { organizationId: "closure-archive", operatorId: "operator-c", keyId: "key-c" },
      },
      "e".repeat(64),
    ),
  };
}

test("a complete three-stage lifecycle chain is verified but never authorizes production", () => {
  const state = buildProductionLifecycleClosureState(
    fixture() as Parameters<typeof buildProductionLifecycleClosureState>[0],
  );
  assert.equal(state.summary.chainComplete, true);
  assert.equal(state.summary.verifiedStages, 3);
  assert.equal(state.stages.closure.status, "verified");
  assert.equal(state.productionStatus, "blocked");
});

test("digest or issuer reuse invalidates downstream lifecycle stages", () => {
  const input = fixture();
  input.rollback.payload.transition.digest = "f".repeat(64);
  input.closure.payload.issuer.organizationId = "transition-witness";
  const state = buildProductionLifecycleClosureState(
    input as Parameters<typeof buildProductionLifecycleClosureState>[0],
  );
  assert.equal(state.stages.rollback.status, "invalid");
  assert.equal(state.stages.closure.status, "invalid");
  assert.equal(state.summary.chainComplete, false);
  assert.equal(state.productionStatus, "blocked");
});
