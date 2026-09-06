import { readEvidenceCollectorPlans, validateEvidenceCollectionCatalog } from "@/features/evidence/collection-catalog";
import {
  createEvidenceCollectionJob,
  claimEvidenceCollectionJob,
  EvidenceCollectionPolicyError,
  reviewEvidenceCollectionJob,
  submitEvidenceCollectionReceipt,
} from "@/features/evidence/collection-policy";
import {
  emptyEvidenceCollectionStore,
  insertEvidenceCollectionJob,
} from "@/features/evidence/collection-store";

const digest = "a".repeat(64);

export function runEvidenceCollectionControlConformance() {
  const plan = readEvidenceCollectorPlans()[0]!;
  const started = new Date("2026-09-05T01:00:00.000Z");
  const job = createEvidenceCollectionJob({
    plan,
    now: started,
    id: "collection-job-conformance",
    queue: {
      planVersion: plan.version,
      sourceMilestone: plan.sourceMilestones[0]!,
      subjectId: "provider-account-conformance",
      organizationId: "studio-org",
      operatorId: "operator-001",
      idempotencyKey: "conformance-provider-catalog-001",
    },
  });
  const firstInsert = insertEvidenceCollectionJob(emptyEvidenceCollectionStore(), job);
  const secondInsert = insertEvidenceCollectionJob(firstInsert.store, job);
  const firstLease = claimEvidenceCollectionJob({
    job,
    plan,
    workerId: "worker-alpha",
    expectedRevision: job.revision,
    now: started,
    ttlMs: 30_000,
  });
  let exclusiveLease = false;
  try {
    claimEvidenceCollectionJob({
      job: firstLease,
      plan,
      workerId: "worker-beta",
      expectedRevision: firstLease.revision,
      now: new Date(started.getTime() + 1_000),
    });
  } catch (error) {
    exclusiveLease = error instanceof EvidenceCollectionPolicyError && error.code === "lease-conflict";
  }
  const recovered = claimEvidenceCollectionJob({
    job: firstLease,
    plan,
    workerId: "worker-beta",
    expectedRevision: firstLease.revision,
    now: new Date(started.getTime() + 31_000),
    ttlMs: 30_000,
  });
  let staleWorkerFenced = false;
  try {
    submitEvidenceCollectionReceipt({
      job: recovered,
      workerId: "worker-alpha",
      fenceToken: firstLease.lease!.fenceToken,
      expectedRevision: recovered.revision,
      now: new Date(started.getTime() + 32_000),
      submission: {
        receipt: {},
        receiptDigest: digest,
        validationDigest: digest,
        submittedAt: new Date(started.getTime() + 32_000).toISOString(),
        workerId: "worker-alpha",
      },
    });
  } catch (error) {
    staleWorkerFenced = error instanceof EvidenceCollectionPolicyError && error.code === "lease-fenced";
  }
  const reviewJob = submitEvidenceCollectionReceipt({
    job: recovered,
    workerId: "worker-beta",
    fenceToken: recovered.lease!.fenceToken,
    expectedRevision: recovered.revision,
    now: new Date(started.getTime() + 33_000),
    submission: {
      receipt: {},
      receiptDigest: digest,
      validationDigest: digest,
      submittedAt: new Date(started.getTime() + 33_000).toISOString(),
      workerId: "worker-beta",
    },
  });
  let fourEyes = false;
  try {
    reviewEvidenceCollectionJob({
      job: reviewJob,
      reviewerId: job.operatorId,
      decision: "accepted",
      reason: "Conformance review accepted.",
      expectedRevision: reviewJob.revision,
      candidateDigest: digest,
    });
  } catch (error) {
    fourEyes = error instanceof EvidenceCollectionPolicyError && error.code === "invalid-input";
  }
  const accepted = reviewEvidenceCollectionJob({
    job: reviewJob,
    reviewerId: "reviewer-002",
    decision: "accepted",
    reason: "Conformance review accepted.",
    expectedRevision: reviewJob.revision,
    candidateDigest: digest,
  });
  const catalog = validateEvidenceCollectionCatalog();
  const checks = {
    strictContract: job.schemaVersion === "evidence.collection-job.v1" && job.revision === 1,
    idempotentQueue: firstInsert.store.jobs.length === 1 && secondInsert.deduplicated && secondInsert.store.jobs.length === 1,
    exclusiveLease,
    expiredLeaseRecovered:
      recovered.lease!.workerId === "worker-beta" &&
      recovered.lease!.fenceToken === firstLease.lease!.fenceToken + 1,
    staleWorkerFenced,
    fourEyes,
    acceptedReview: accepted.status === "accepted" && accepted.review?.candidateDigest === digest,
    completeCollectorCatalog: catalog.ok,
  };
  return {
    ok: Object.values(checks).every(Boolean),
    schemaVersion: "evidence.collection-control-conformance.v1" as const,
    checks,
    catalog,
  };
}
