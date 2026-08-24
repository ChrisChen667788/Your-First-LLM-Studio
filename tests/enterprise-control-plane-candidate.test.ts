import assert from "node:assert/strict";
import test from "node:test";

import { buildEnterpriseControlPlaneCandidateState } from "@/features/deployment/enterprise-control-plane-candidate";

function fixture(hasReleaseSecurity = true, revision = "a".repeat(16)) {
  return {
    deployment: {
      revision,
      localReadiness: { completionPct: 100 },
      productionReadiness: { completionPct: 0 },
      controlPlane: { cloud: { configured: false } },
    },
    haFinOps: { metrics: { failoverRehearsals: 1 } },
    identity: { latestPassing: { id: "identity-1" } },
    settlement: { latestPassing: { id: "settlement-1" } },
    retention: { latestPassing: { id: "retention-1" } },
    security: {
      status: hasReleaseSecurity ? "pass" : "evidence-needed",
      integrity: { status: hasReleaseSecurity ? "verified" : "missing" },
    },
    rehearsal: {
      id: "control-plane-rehearsal-1",
      generatedAt: "2026-08-21T00:00:00.000Z",
      deploymentRevision: "a".repeat(16),
      references: {
        usageRecordId: "usage-1",
        auditRecordId: "audit-1",
        signingReceiptId: "signing-1",
        failoverReceiptId: "failover-1",
        identityReceiptId: "identity-1",
        settlementReceiptId: "settlement-1",
        retentionReceiptId: "retention-1",
      },
      checks: {
        revisionBound: true,
        scopedPolicyBound: true,
        usageLedgerBound: true,
        settlementRetryBound: true,
        auditArchiveBound: true,
        identityLifecycleBound: true,
        redactionRetentionBound: true,
        haRpoRtoBound: true,
        approvalBoundaryBound: true,
      },
    },
    now: Date.parse("2026-08-21T01:00:00.000Z"),
  };
}

test("enterprise control-plane candidate joins deployment, identity, retention, settlement, HA, and security evidence", () => {
  const state = buildEnterpriseControlPlaneCandidateState(
    fixture() as Parameters<typeof buildEnterpriseControlPlaneCandidateState>[0],
  );
  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "hold");
  assert.equal(state.checks.deploymentRevisionBound, true);
  assert.equal(state.checks.releaseSecurityBound, true);
});

test("stale deployment revision or missing release security evidence keeps the candidate fail-closed", () => {
  const state = buildEnterpriseControlPlaneCandidateState(
    fixture(false, "b".repeat(16)) as Parameters<typeof buildEnterpriseControlPlaneCandidateState>[0],
  );
  assert.equal(state.localStatus, "hold");
  assert.equal(state.checks.deploymentRevisionBound, false);
  assert.equal(state.checks.releaseSecurityBound, false);
});
