import { readEvidenceCollectionPlans } from "@/features/evidence/collection-catalog";
import type { EvidenceCollectionQueueInput } from "@/features/evidence/collection-contracts";
import {
  assertEvidenceCollectionReceiptBinding,
  cancelEvidenceCollectionJob,
  claimEvidenceCollectionJob,
  EvidenceCollectionPolicyError,
  failEvidenceCollectionJob,
  heartbeatEvidenceCollectionJob,
  linkEvidenceCollectionCandidateJob,
  retryEvidenceCollectionJob,
  reviewEvidenceCollectionJob,
  submitEvidenceCollectionReceipt,
} from "@/features/evidence/collection-policy";
import {
  evidenceCollectionStorePath,
  mutateEvidenceCollectionJobDurably,
  queueEvidenceCollectionJobDurably,
  readEvidenceCollectionStore,
} from "@/features/evidence/collection-store";
import {
  operationalEvidenceDigest,
  recordOperationalEvidenceCandidate,
  type OperationalEvidenceReceipt,
  validateOperationalEvidenceReceipt,
} from "@/features/evidence/operational-receipts";
import { readEvidenceOperationSpecs } from "@/features/experiments/evidence-operations-train";

function planByVersion(version: string) {
  const plan = readEvidenceCollectionPlans().find((entry) => entry.version === version);
  if (!plan) throw new EvidenceCollectionPolicyError("not-found", 404, "Evidence collector plan was not found.");
  return plan;
}

function jobById(jobId: string) {
  const job = readEvidenceCollectionStore().jobs.find((entry) => entry.id === jobId);
  if (!job) throw new EvidenceCollectionPolicyError("not-found", 404, "Evidence collection job was not found.");
  return job;
}

function specByMilestone(version: string) {
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === version);
  if (!spec || spec.version === "v4.1.4") {
    throw new EvidenceCollectionPolicyError("invalid-input", 400, "The collection job does not reference a supported domain milestone.");
  }
  return spec;
}

export function queueEvidenceCollection(input: EvidenceCollectionQueueInput) {
  const plan = planByVersion(input.planVersion);
  return queueEvidenceCollectionJobDurably({ plan, queue: input });
}

export function claimEvidenceCollection(input: {
  jobId: string;
  workerId: string;
  expectedRevision: number;
  ttlMs?: number;
}) {
  const current = jobById(input.jobId);
  const plan = planByVersion(current.planVersion);
  return mutateEvidenceCollectionJobDurably({
    jobId: current.id,
    expectedRevision: input.expectedRevision,
    mutate: (job) => claimEvidenceCollectionJob({ job, plan, ...input }),
  });
}

export function heartbeatEvidenceCollection(input: {
  jobId: string;
  workerId: string;
  fenceToken: number;
  expectedRevision: number;
  ttlMs?: number;
}) {
  return mutateEvidenceCollectionJobDurably({
    jobId: input.jobId,
    expectedRevision: input.expectedRevision,
    mutate: (job) => heartbeatEvidenceCollectionJob({ job, ...input }),
  });
}

export function submitEvidenceCollectionCandidate(input: {
  jobId: string;
  workerId: string;
  fenceToken: number;
  expectedRevision: number;
  receipt: unknown;
}) {
  const current = jobById(input.jobId);
  const spec = specByMilestone(current.sourceMilestone);
  const validation = validateOperationalEvidenceReceipt({ receipt: input.receipt, spec });
  if (!validation.ok) {
    throw new EvidenceCollectionPolicyError("invalid-input", 400, validation.blockers.join(" "));
  }
  const receipt = input.receipt as OperationalEvidenceReceipt;
  assertEvidenceCollectionReceiptBinding({ job: current, receipt });
  const now = new Date().toISOString();
  const submission = {
    receipt,
    receiptDigest: operationalEvidenceDigest(receipt),
    validationDigest: operationalEvidenceDigest(validation),
    submittedAt: now,
    workerId: input.workerId,
  };
  const job = mutateEvidenceCollectionJobDurably({
    jobId: input.jobId,
    expectedRevision: input.expectedRevision,
    mutate: (entry) => submitEvidenceCollectionReceipt({ job: entry, submission, ...input }),
  });
  return { job, validation };
}

export function failEvidenceCollection(input: {
  jobId: string;
  workerId: string;
  fenceToken: number;
  expectedRevision: number;
  reason: string;
}) {
  const current = jobById(input.jobId);
  const plan = planByVersion(current.planVersion);
  return mutateEvidenceCollectionJobDurably({
    jobId: input.jobId,
    expectedRevision: input.expectedRevision,
    mutate: (job) => failEvidenceCollectionJob({ job, plan, ...input }),
  });
}

export function retryEvidenceCollection(input: {
  jobId: string;
  actorId: string;
  expectedRevision: number;
}) {
  return mutateEvidenceCollectionJobDurably({
    jobId: input.jobId,
    expectedRevision: input.expectedRevision,
    mutate: (job) => retryEvidenceCollectionJob({ job, ...input }),
  });
}

export function reviewEvidenceCollection(input: {
  jobId: string;
  reviewerId: string;
  decision: "accepted" | "rejected";
  reason: string;
  expectedRevision: number;
}) {
  const current = jobById(input.jobId);
  let reviewed = current;
  if (current.status !== "accepted") {
    reviewed = mutateEvidenceCollectionJobDurably({
      jobId: input.jobId,
      expectedRevision: input.expectedRevision,
      mutate: (entry) => reviewEvidenceCollectionJob({ job: entry, ...input, candidateDigest: null }),
    });
  } else if (input.decision !== "accepted") {
    throw new EvidenceCollectionPolicyError(
      "invalid-transition",
      409,
      "An accepted receipt cannot be reviewed again with a different decision.",
    );
  } else if (current.revision !== input.expectedRevision) {
    throw new EvidenceCollectionPolicyError(
      "revision-conflict",
      409,
      `Collection job revision changed from ${input.expectedRevision} to ${current.revision}.`,
    );
  } else if (current.review?.reviewerId !== input.reviewerId.trim()) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      400,
      "Only the recorded receipt reviewer can resume candidate linking.",
    );
  }
  if (input.decision === "rejected") {
    return { job: reviewed, candidateDigest: null };
  }
  if (reviewed.review?.candidateDigest) {
    return { job: reviewed, candidateDigest: reviewed.review.candidateDigest };
  }
  const spec = specByMilestone(reviewed.sourceMilestone);
  const recorded = recordOperationalEvidenceCandidate({ receipt: reviewed.submission?.receipt, spec });
  const candidateDigest = recorded.candidate.evidenceDigest;
  const linked = mutateEvidenceCollectionJobDurably({
    jobId: input.jobId,
    expectedRevision: reviewed.revision,
    mutate: (entry) => linkEvidenceCollectionCandidateJob({
      job: entry,
      reviewerId: input.reviewerId,
      candidateDigest,
      expectedRevision: reviewed.revision,
    }),
  });
  return { job: linked, candidateDigest };
}

export function cancelEvidenceCollection(input: {
  jobId: string;
  actorId: string;
  reason: string;
  expectedRevision: number;
}) {
  return mutateEvidenceCollectionJobDurably({
    jobId: input.jobId,
    expectedRevision: input.expectedRevision,
    mutate: (job) => cancelEvidenceCollectionJob({ job, ...input }),
  });
}

export function readEvidenceCollectionQueue() {
  const store = readEvidenceCollectionStore();
  return {
    ok: true as const,
    schemaVersion: store.schemaVersion,
    generatedAt: new Date().toISOString(),
    revision: store.revision,
    jobs: store.jobs,
    totals: {
      jobs: store.jobs.length,
      queued: store.jobs.filter((job) => job.status === "queued" || job.status === "retry-wait").length,
      running: store.jobs.filter((job) => job.status === "running").length,
      review: store.jobs.filter((job) => job.status === "review").length,
      accepted: store.jobs.filter((job) => job.status === "accepted").length,
      failed: store.jobs.filter((job) => job.status === "failed" || job.status === "rejected").length,
    },
    path: evidenceCollectionStorePath(),
  };
}

export function evidenceCollectionErrorStatus(error: unknown) {
  return error instanceof EvidenceCollectionPolicyError ? error.status : 400;
}
