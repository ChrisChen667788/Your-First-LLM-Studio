import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_ADJUDICATION_PLANS,
  buildEvidenceMetricPolicy,
  evidenceAdjudicationDigest,
  validateArtifactReadback,
  validateEvidenceAdjudicationCatalog,
  validateEvidenceMetricPolicy,
  validateReviewerAttestation,
  verifyEvidenceAdjudicationPackage,
} from "@/features/evidence/adjudication";
import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { buildEvidenceAdjudicationTrainState } from "@/features/experiments/evidence-adjudication-train";

const digest = (seed: string) => operationalEvidenceDigest({ seed });

function acceptedJob() {
  const policy = buildEvidenceMetricPolicy("v4.0.0");
  const receipt = {
    schemaVersion: "evidence.operational-candidate.v1",
    milestone: "v4.0.0",
    subjectId: "provider-account-001",
    environment: "managed" as const,
    workloadDigest: digest("workload"),
    artifactDigests: [digest("artifact")],
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    completedAt: new Date().toISOString(),
    outcome: "pass" as const,
    metrics: Object.fromEntries(policy.requiredMetrics.map((metric) => [metric, 1])),
    operator: { organizationId: "studio-org", operatorId: "collector-001" },
  };
  const receiptDigest = operationalEvidenceDigest(receipt);
  const job = {
    id: "collection-job-adjudication-001",
    sourceMilestone: "v4.0.0",
    operatorId: "collector-001",
    organizationId: "studio-org",
    status: "accepted",
    submission: { receipt, receiptDigest },
    review: { reviewerId: "reviewer-001", candidateDigest: digest("candidate") },
  } as unknown as EvidenceCollectionJob;
  return { job, policy, receiptDigest };
}

test("v4.4-v4.5 catalog keeps fifteen exact, actionable source contracts", () => {
  const catalog = validateEvidenceAdjudicationCatalog();
  assert.equal(catalog.ok, true);
  assert.equal(EVIDENCE_ADJUDICATION_PLANS.length, 15);
  assert.equal(EVIDENCE_ADJUDICATION_PLANS[0]?.version, "v4.4.0");
  assert.equal(EVIDENCE_ADJUDICATION_PLANS.at(-1)?.version, "v4.5.4");
});

test("reviewer and artifact contracts reject stale, placeholder, or incomplete evidence", () => {
  const now = new Date();
  const validReviewer = {
    schemaVersion: "evidence.reviewer-attestation.v1" as const,
    issuerId: "organization-idp",
    subjectId: "reviewer-001",
    organizationId: "studio-org",
    assurance: "external" as const,
    assertionDigest: digest("assertion"),
    keyFingerprint: digest("key"),
    issuedAt: new Date(now.getTime() - 60_000).toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
  };
  assert.equal(validateReviewerAttestation(validReviewer, now).ok, true);
  assert.equal(validateReviewerAttestation({ ...validReviewer, subjectId: "fixture-reviewer" }, now).ok, false);
  assert.equal(validateReviewerAttestation({ ...validReviewer, expiresAt: new Date(now.getTime() - 1).toISOString() }, now).ok, false);

  const readback = {
    schemaVersion: "evidence.artifact-readback.v1" as const,
    artifactDigest: digest("artifact"),
    locatorDigest: digest("locator"),
    byteLength: 128,
    storageClass: "external-immutable" as const,
    readAt: now.toISOString(),
    readerId: "archive-reader-001",
  };
  assert.equal(validateArtifactReadback(readback, now).ok, true);
  assert.equal(validateArtifactReadback({ ...readback, byteLength: 0 }, now).ok, false);
});

test("metric policies are complete, digest-bound, and reject unknown threshold edits", () => {
  const policy = buildEvidenceMetricPolicy("v4.0.0");
  assert.equal(validateEvidenceMetricPolicy(policy).ok, true);
  assert.equal(validateEvidenceMetricPolicy({ ...policy, minimums: { ...policy.minimums, inventedMetric: 1 } }).ok, false);
  assert.notEqual(policy.policyDigest, evidenceAdjudicationDigest({ ...policy, policyDigest: undefined }));
});

test("adjudication needs a real external port and binds its verified output", async () => {
  const { job, policy, receiptDigest } = acceptedJob();
  const now = new Date();
  const attestation = {
    schemaVersion: "evidence.reviewer-attestation.v1" as const,
    issuerId: "organization-idp",
    subjectId: "reviewer-001",
    organizationId: "studio-org",
    assurance: "external" as const,
    assertionDigest: digest("assertion"),
    keyFingerprint: digest("key"),
    issuedAt: new Date(now.getTime() - 60_000).toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
  };
  const artifact = {
    schemaVersion: "evidence.artifact-readback.v1" as const,
    artifactDigest: receiptDigest,
    locatorDigest: digest("locator"),
    byteLength: 512,
    storageClass: "external-immutable" as const,
    readAt: now.toISOString(),
    readerId: "archive-reader-001",
  };
  await assert.rejects(
    verifyEvidenceAdjudicationPackage({ job, attestation, artifact, policy }),
    /not configured/u,
  );
  const result = await verifyEvidenceAdjudicationPackage({
    job,
    attestation,
    artifact,
    policy,
    port: {
      async verifyReviewerAttestation(input) {
        return { verified: true, issuerId: input.issuerId, subjectId: input.subjectId, verificationDigest: digest("identity-verification") };
      },
      async readArtifact(input) {
        return { verified: true, artifactDigest: input.artifactDigest, readbackDigest: digest("archive-readback") };
      },
    },
  });
  assert.equal(result.receiptDigest, receiptDigest);
  assert.equal(result.evidenceDigest.length, 64);
});

test("adjudication train remains source complete and production blocked without live packages", () => {
  const state = buildEvidenceAdjudicationTrainState();
  assert.equal(state.sourceStatus, "pass");
  assert.equal(state.totals.sourcePassed, 15);
  assert.equal(state.totals.localPassed, 7);
  assert.equal(state.externalStatus, "hold");
  assert.equal(state.productionStatus, "blocked");
});
