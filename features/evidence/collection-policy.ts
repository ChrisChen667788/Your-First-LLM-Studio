import { randomUUID } from "node:crypto";

import {
  EVIDENCE_COLLECTION_JOB_SCHEMA_VERSION,
  type EvidenceCollectionJob,
  type EvidenceCollectionJobEvent,
  type EvidenceCollectionPlan,
  type EvidenceCollectionQueueInput,
  type EvidenceCollectionSubmission,
} from "@/features/evidence/collection-contracts";

export class EvidenceCollectionPolicyError extends Error {
  constructor(
    readonly code: "invalid-input" | "revision-conflict" | "invalid-transition" | "lease-conflict" | "lease-fenced" | "not-found" | "capacity-exceeded",
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EvidenceCollectionPolicyError";
  }
}

function identity(value: string, field: string) {
  const normalized = value.trim();
  if (
    !/^[a-z0-9][a-z0-9._:@/-]{2,127}$/iu.test(normalized) ||
    /^(?:demo|fixture|local|test|unknown)(?:[-_.:]|$)/iu.test(normalized)
  ) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      400,
      `${field} must be a durable non-placeholder identity.`,
    );
  }
  return normalized;
}

function boundedText(value: string, field: string, minimum = 3, maximum = 160) {
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      400,
      `${field} must contain ${minimum}-${maximum} characters.`,
    );
  }
  return normalized;
}

function assertRevision(job: EvidenceCollectionJob, expectedRevision: number) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new EvidenceCollectionPolicyError("invalid-input", 400, "expectedRevision must be a positive integer.");
  }
  if (job.revision !== expectedRevision) {
    throw new EvidenceCollectionPolicyError(
      "revision-conflict",
      409,
      `Collection job revision changed from ${expectedRevision} to ${job.revision}.`,
    );
  }
}

function event(input: {
  type: EvidenceCollectionJobEvent["type"];
  actorId: string;
  at: string;
  revision: number;
  detail: string;
}): EvidenceCollectionJobEvent {
  return { id: `collection-event-${randomUUID()}`, ...input };
}

function advance(
  job: EvidenceCollectionJob,
  input: {
    at: string;
    actorId: string;
    type: EvidenceCollectionJobEvent["type"];
    detail: string;
    patch: Partial<EvidenceCollectionJob>;
  },
) {
  const revision = job.revision + 1;
  return {
    ...job,
    ...input.patch,
    revision,
    updatedAt: input.at,
    events: [
      event({
        type: input.type,
        actorId: input.actorId,
        at: input.at,
        revision,
        detail: input.detail,
      }),
      ...job.events,
    ].slice(0, 100),
  } satisfies EvidenceCollectionJob;
}

function assertLease(
  job: EvidenceCollectionJob,
  input: { workerId: string; fenceToken: number; now: Date },
) {
  if (
    !job.lease ||
    job.lease.workerId !== input.workerId ||
    job.lease.fenceToken !== input.fenceToken
  ) {
    throw new EvidenceCollectionPolicyError(
      "lease-fenced",
      409,
      "The collection worker no longer owns the active fence token.",
    );
  }
  if (Date.parse(job.lease.expiresAt) <= input.now.getTime()) {
    throw new EvidenceCollectionPolicyError(
      "lease-fenced",
      409,
      "The collection worker lease expired before this mutation.",
    );
  }
}

export function assertEvidenceCollectionReceiptBinding(input: {
  job: EvidenceCollectionJob;
  receipt: EvidenceCollectionSubmission["receipt"];
}) {
  if (
    input.receipt.subjectId?.trim() !== input.job.subjectId ||
    input.receipt.operator?.organizationId?.trim() !== input.job.organizationId ||
    input.receipt.operator?.operatorId?.trim() !== input.job.operatorId
  ) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      400,
      "Receipt subject and operator identities must match the collection job binding.",
    );
  }
}

export function createEvidenceCollectionJob(input: {
  plan: EvidenceCollectionPlan;
  queue: EvidenceCollectionQueueInput;
  now?: Date;
  id?: string;
}) {
  if (input.plan.kind !== "collector") {
    throw new EvidenceCollectionPolicyError("invalid-input", 400, "Only collector plans can be queued.");
  }
  if (input.queue.planVersion !== input.plan.version) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      400,
      "The queued plan version does not match the selected collector plan.",
    );
  }
  if (!input.plan.sourceMilestones.includes(input.queue.sourceMilestone)) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      400,
      "The source milestone is not owned by the selected collector plan.",
    );
  }
  const now = (input.now || new Date()).toISOString();
  const operatorId = identity(input.queue.operatorId, "operatorId");
  const revision = 1;
  const job: EvidenceCollectionJob = {
    schemaVersion: EVIDENCE_COLLECTION_JOB_SCHEMA_VERSION,
    id: input.id || `collection-job-${randomUUID()}`,
    planVersion: input.plan.version,
    sourceMilestone: input.queue.sourceMilestone,
    subjectId: boundedText(input.queue.subjectId, "subjectId"),
    organizationId: identity(input.queue.organizationId, "organizationId"),
    operatorId,
    idempotencyKey: boundedText(input.queue.idempotencyKey, "idempotencyKey", 8, 128),
    status: "queued",
    attempt: 0,
    maxAttempts: input.plan.retryPolicy.maxAttempts,
    revision,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: null,
    lease: null,
    submission: null,
    review: null,
    blockers: [],
    events: [event({ type: "queued", actorId: operatorId, at: now, revision, detail: `Queued ${input.plan.version} for ${input.queue.sourceMilestone}.` })],
  };
  return job;
}

export function claimEvidenceCollectionJob(input: {
  job: EvidenceCollectionJob;
  plan: EvidenceCollectionPlan;
  workerId: string;
  expectedRevision: number;
  now?: Date;
  ttlMs?: number;
}) {
  assertRevision(input.job, input.expectedRevision);
  const now = input.now || new Date();
  const workerId = identity(input.workerId, "workerId");
  if (!["queued", "retry-wait", "running"].includes(input.job.status)) {
    throw new EvidenceCollectionPolicyError("invalid-transition", 409, `Cannot claim a ${input.job.status} job.`);
  }
  if (input.job.status === "retry-wait" && Date.parse(input.job.nextAttemptAt || "") > now.getTime()) {
    throw new EvidenceCollectionPolicyError("invalid-transition", 409, "The retry backoff window has not elapsed.");
  }
  const activeLease = input.job.lease && Date.parse(input.job.lease.expiresAt) > now.getTime()
    ? input.job.lease
    : null;
  if (activeLease && activeLease.workerId !== workerId) {
    throw new EvidenceCollectionPolicyError("lease-conflict", 409, `Collection job is leased by ${activeLease.workerId}.`);
  }
  const reusingLease = Boolean(activeLease);
  if (!reusingLease && input.job.attempt >= input.job.maxAttempts) {
    throw new EvidenceCollectionPolicyError("invalid-transition", 409, "Collection job exhausted its retry budget.");
  }
  const ttlMs = Math.max(5_000, Math.min(input.ttlMs || Math.min(input.plan.timeoutMs, 60_000), 10 * 60_000));
  // Attempts survive lease removal on failure/retry; never reuse a retired fence.
  const fenceToken = reusingLease ? activeLease!.fenceToken : input.job.attempt + 1;
  const at = now.toISOString();
  return advance(input.job, {
    at,
    actorId: workerId,
    type: reusingLease ? "heartbeat" : "claimed",
    detail: reusingLease ? "Collection lease refreshed." : `Collection attempt ${input.job.attempt + 1} claimed.`,
    patch: {
      status: "running",
      attempt: reusingLease ? input.job.attempt : input.job.attempt + 1,
      nextAttemptAt: null,
      lease: {
        workerId,
        fenceToken,
        acquiredAt: reusingLease ? activeLease!.acquiredAt : at,
        heartbeatAt: at,
        expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      },
    },
  });
}

export function heartbeatEvidenceCollectionJob(input: {
  job: EvidenceCollectionJob;
  workerId: string;
  fenceToken: number;
  expectedRevision: number;
  now?: Date;
  ttlMs?: number;
}) {
  assertRevision(input.job, input.expectedRevision);
  const now = input.now || new Date();
  assertLease(input.job, { workerId: input.workerId, fenceToken: input.fenceToken, now });
  const at = now.toISOString();
  return advance(input.job, {
    at,
    actorId: input.workerId,
    type: "heartbeat",
    detail: "Collection worker heartbeat accepted.",
    patch: {
      lease: {
        ...input.job.lease!,
        heartbeatAt: at,
        expiresAt: new Date(now.getTime() + Math.max(5_000, Math.min(input.ttlMs || 60_000, 10 * 60_000))).toISOString(),
      },
    },
  });
}

export function submitEvidenceCollectionReceipt(input: {
  job: EvidenceCollectionJob;
  submission: EvidenceCollectionSubmission;
  workerId: string;
  fenceToken: number;
  expectedRevision: number;
  now?: Date;
}) {
  assertRevision(input.job, input.expectedRevision);
  const now = input.now || new Date();
  assertLease(input.job, { workerId: input.workerId, fenceToken: input.fenceToken, now });
  return advance(input.job, {
    at: now.toISOString(),
    actorId: input.workerId,
    type: "receipt-submitted",
    detail: `Receipt ${input.submission.receiptDigest.slice(0, 12)} submitted for independent review.`,
    patch: {
      status: "review",
      lease: null,
      submission: input.submission,
      review: null,
      blockers: [],
    },
  });
}

export function failEvidenceCollectionJob(input: {
  job: EvidenceCollectionJob;
  plan: EvidenceCollectionPlan;
  workerId: string;
  fenceToken: number;
  expectedRevision: number;
  reason: string;
  now?: Date;
}) {
  assertRevision(input.job, input.expectedRevision);
  const now = input.now || new Date();
  assertLease(input.job, { workerId: input.workerId, fenceToken: input.fenceToken, now });
  const exhausted = input.job.attempt >= input.job.maxAttempts;
  const delay = Math.min(
    input.plan.retryPolicy.maxDelayMs,
    input.plan.retryPolicy.baseDelayMs * 2 ** Math.max(0, input.job.attempt - 1),
  );
  return advance(input.job, {
    at: now.toISOString(),
    actorId: input.workerId,
    type: "retry-scheduled",
    detail: boundedText(input.reason, "reason", 4, 240),
    patch: {
      status: exhausted ? "failed" : "retry-wait",
      lease: null,
      nextAttemptAt: exhausted ? null : new Date(now.getTime() + delay).toISOString(),
      blockers: [input.reason.trim()],
    },
  });
}

export function retryEvidenceCollectionJob(input: {
  job: EvidenceCollectionJob;
  actorId: string;
  expectedRevision: number;
  now?: Date;
}) {
  assertRevision(input.job, input.expectedRevision);
  if (!["retry-wait", "failed", "rejected"].includes(input.job.status)) {
    throw new EvidenceCollectionPolicyError("invalid-transition", 409, `Cannot retry a ${input.job.status} job.`);
  }
  if (input.job.attempt >= input.job.maxAttempts) {
    throw new EvidenceCollectionPolicyError("invalid-transition", 409, "Collection job exhausted its retry budget.");
  }
  const now = input.now || new Date();
  return advance(input.job, {
    at: now.toISOString(),
    actorId: identity(input.actorId, "actorId"),
    type: "retried",
    detail: "Collection job returned to the queue.",
    patch: { status: "queued", nextAttemptAt: null, lease: null, submission: null, review: null, blockers: [] },
  });
}

export function reviewEvidenceCollectionJob(input: {
  job: EvidenceCollectionJob;
  reviewerId: string;
  decision: "accepted" | "rejected";
  reason: string;
  expectedRevision: number;
  candidateDigest?: string | null;
  now?: Date;
}) {
  assertRevision(input.job, input.expectedRevision);
  if (input.job.status !== "review" || !input.job.submission) {
    throw new EvidenceCollectionPolicyError("invalid-transition", 409, "Only a submitted receipt can be reviewed.");
  }
  const reviewerId = identity(input.reviewerId, "reviewerId");
  if (reviewerId === input.job.operatorId) {
    throw new EvidenceCollectionPolicyError("invalid-input", 400, "Receipt reviewer must be distinct from the collection operator.");
  }
  const now = input.now || new Date();
  const reason = boundedText(input.reason, "reason", 4, 240);
  return advance(input.job, {
    at: now.toISOString(),
    actorId: reviewerId,
    type: input.decision,
    detail: reason,
    patch: {
      status: input.decision,
      review: {
        decision: input.decision,
        reviewerId,
        reason,
        reviewedAt: now.toISOString(),
        candidateDigest: input.decision === "accepted" ? input.candidateDigest || null : null,
      },
      blockers: input.decision === "rejected" ? [reason] : [],
    },
  });
}

export function linkEvidenceCollectionCandidateJob(input: {
  job: EvidenceCollectionJob;
  reviewerId: string;
  candidateDigest: string;
  expectedRevision: number;
  now?: Date;
}) {
  assertRevision(input.job, input.expectedRevision);
  if (input.job.status !== "accepted" || input.job.review?.decision !== "accepted" || !input.job.submission) {
    throw new EvidenceCollectionPolicyError(
      "invalid-transition",
      409,
      "Only an accepted receipt can be linked to an operational evidence candidate.",
    );
  }
  const reviewerId = identity(input.reviewerId, "reviewerId");
  if (reviewerId !== input.job.review.reviewerId) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      400,
      "Only the recorded receipt reviewer can link the accepted candidate.",
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.candidateDigest)) {
    throw new EvidenceCollectionPolicyError("invalid-input", 400, "candidateDigest must be a SHA-256 digest.");
  }
  if (input.job.review.candidateDigest === input.candidateDigest) return input.job;
  if (input.job.review.candidateDigest) {
    throw new EvidenceCollectionPolicyError(
      "invalid-transition",
      409,
      "The accepted receipt is already linked to another evidence candidate.",
    );
  }
  const now = input.now || new Date();
  return advance(input.job, {
    at: now.toISOString(),
    actorId: reviewerId,
    type: "candidate-linked",
    detail: `Operational evidence candidate ${input.candidateDigest.slice(0, 12)} linked.`,
    patch: {
      review: {
        ...input.job.review,
        candidateDigest: input.candidateDigest,
      },
    },
  });
}

export function cancelEvidenceCollectionJob(input: {
  job: EvidenceCollectionJob;
  actorId: string;
  reason: string;
  expectedRevision: number;
  now?: Date;
}) {
  assertRevision(input.job, input.expectedRevision);
  if (["accepted", "cancelled"].includes(input.job.status)) {
    throw new EvidenceCollectionPolicyError("invalid-transition", 409, `Cannot cancel a ${input.job.status} job.`);
  }
  const now = input.now || new Date();
  const reason = boundedText(input.reason, "reason", 4, 240);
  return advance(input.job, {
    at: now.toISOString(),
    actorId: identity(input.actorId, "actorId"),
    type: "cancelled",
    detail: reason,
    patch: { status: "cancelled", lease: null, nextAttemptAt: null, blockers: [reason] },
  });
}
