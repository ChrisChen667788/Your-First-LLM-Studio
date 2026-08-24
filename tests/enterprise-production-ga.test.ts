import assert from "node:assert/strict";
import test from "node:test";

import { buildEnterpriseProductionGaState } from "@/features/experiments/enterprise-production-ga";

function fixture() {
  return {
    controlPlane: { localStatus: "pass", stateDigest: "a".repeat(64) },
    externalReadiness: {
      schemaVersion: "experiments.external-production-readiness.v1",
      status: "ready",
      checks: [
        { id: "oidc-scim", accepted: true },
        { id: "postgres-rls", accepted: true },
        { id: "enterprise-retrieval", accepted: true },
        { id: "otel-langfuse", accepted: true },
        { id: "cloud-kms-object-lock", accepted: true },
      ],
      blockers: [],
    },
    desktopAcceptance: {
      schemaVersion: "desktop.external-acceptance.v1",
      ready: true,
      checks: {
        contractMatched: true,
        requestDigestMatched: true,
        packageMatched: true,
        hostIndependent: true,
        identityTrusted: true,
        checksComplete: true,
        signatureVerified: true,
        keyPinned: true,
      },
      blockers: [],
    },
    releaseSecurity: { status: "pass", integrity: { status: "verified" } },
    releaseBundle: {
      productionReadiness: { status: "pass" },
      integrity: { verified: true, digest: "b".repeat(64) },
    },
    evidenceAuthority: {
      schemaVersion: "experiments.production-evidence-authority.v1",
      evidenceStatus: "verified",
      productionStatus: "blocked",
    },
    releaseDecision: {
      schemaVersion: "experiments.release-authority-decision-ledger.v1",
      decisionStatus: "approved",
      productionStatus: "blocked",
    },
    lifecycle: {
      schemaVersion: "experiments.production-lifecycle-closure.v1",
      productionStatus: "blocked",
      stages: {
        transition: { status: "verified" },
        rollback: { status: "verified" },
        closure: { status: "verified" },
      },
    },
  };
}

test("v2.0.0 keeps production blocked even when every local fixture reports pass", () => {
  const state = buildEnterpriseProductionGaState(
    fixture() as Parameters<typeof buildEnterpriseProductionGaState>[0],
  );
  assert.equal(state.localStatus, "pass");
  assert.equal(state.externalStatus, "hold");
  assert.equal(state.productionStatus, "blocked");
  assert.equal(state.checks.localPromotionDenied, true);
  assert.equal(state.checks.evidenceAuthorityContractBound, true);
  assert.equal(state.checks.releaseDecisionLedgerContractBound, true);
  assert.equal(state.checks.lifecycleClosureContractBound, true);
  assert.equal(state.externalGates.independentSecurityAssessment, false);
  assert.equal(state.externalGates.organizationSignoff, false);
});

test("missing source integrity or candidate reconciliation keeps the local projection on hold", () => {
  const input = fixture();
  input.controlPlane.localStatus = "hold";
  input.controlPlane.stateDigest = "not-a-digest";
  input.releaseSecurity.integrity.status = "missing";
  const state = buildEnterpriseProductionGaState(
    input as Parameters<typeof buildEnterpriseProductionGaState>[0],
  );
  assert.equal(state.localStatus, "hold");
  assert.equal(state.checks.controlPlaneCandidateBound, false);
  assert.equal(state.checks.controlPlaneStateDigestBound, false);
  assert.equal(state.checks.releaseSecurityIntegrityVerified, false);
  assert.equal(state.productionStatus, "blocked");
});
