import {
  type EvidenceCollectionJob,
  type EvidenceCollectionPlan,
  type EvidenceCollectionQueueInput,
  type EvidenceCollectionStore,
} from "@/features/evidence/collection-contracts";
import {
  createEvidenceCollectionJob,
  EvidenceCollectionPolicyError,
} from "@/features/evidence/collection-policy";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_PATH = getLocalAgentDataPath(
  "experiments",
  "v4.2.0-v4.3.4-evidence-collection-jobs.json",
);
const JOB_STATUSES = new Set([
  "queued",
  "running",
  "retry-wait",
  "review",
  "accepted",
  "rejected",
  "failed",
  "cancelled",
]);
const EVENT_TYPES = new Set([
  "queued",
  "claimed",
  "heartbeat",
  "receipt-submitted",
  "candidate-linked",
  "retry-scheduled",
  "retried",
  "accepted",
  "rejected",
  "cancelled",
]);

export function emptyEvidenceCollectionStore(): EvidenceCollectionStore {
  return {
    schemaVersion: "evidence.collection-job-store.v1",
    revision: 0,
    jobs: [],
    idempotency: {},
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown) {
  return typeof value === "string" && value.length > 0;
}

function timestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function digest(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function nullableTimestamp(value: unknown) {
  return value === null || timestamp(value);
}

function validLease(value: unknown) {
  if (value === null) return true;
  if (!record(value)) return false;
  return (
    text(value.workerId) &&
    Number.isInteger(value.fenceToken) &&
    Number(value.fenceToken) >= 1 &&
    timestamp(value.acquiredAt) &&
    timestamp(value.heartbeatAt) &&
    timestamp(value.expiresAt) &&
    Date.parse(String(value.acquiredAt)) <= Date.parse(String(value.heartbeatAt)) &&
    Date.parse(String(value.heartbeatAt)) < Date.parse(String(value.expiresAt))
  );
}

function validSubmission(value: unknown) {
  if (value === null) return true;
  if (!record(value)) return false;
  return (
    record(value.receipt) &&
    digest(value.receiptDigest) &&
    digest(value.validationDigest) &&
    timestamp(value.submittedAt) &&
    text(value.workerId)
  );
}

function validReview(value: unknown) {
  if (value === null) return true;
  if (!record(value)) return false;
  return (
    (value.decision === "accepted" || value.decision === "rejected") &&
    text(value.reviewerId) &&
    text(value.reason) &&
    timestamp(value.reviewedAt) &&
    (value.candidateDigest === null || digest(value.candidateDigest)) &&
    (value.decision === "accepted" || value.candidateDigest === null)
  );
}

function validEvent(value: unknown) {
  if (!record(value)) return false;
  return (
    text(value.id) &&
    typeof value.type === "string" &&
    EVENT_TYPES.has(value.type) &&
    text(value.actorId) &&
    timestamp(value.at) &&
    Number.isInteger(value.revision) &&
    Number(value.revision) >= 1 &&
    text(value.detail)
  );
}

function isCollectionJob(value: unknown): value is EvidenceCollectionJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const job = value as Partial<EvidenceCollectionJob>;
  const structurallyValid = (
    job.schemaVersion === "evidence.collection-job.v1" &&
    text(job.id) &&
    text(job.planVersion) &&
    text(job.sourceMilestone) &&
    text(job.subjectId) &&
    text(job.organizationId) &&
    text(job.operatorId) &&
    text(job.idempotencyKey) &&
    typeof job.status === "string" &&
    JOB_STATUSES.has(job.status) &&
    Number.isInteger(job.attempt) &&
    Number(job.attempt) >= 0 &&
    Number.isInteger(job.maxAttempts) &&
    Number(job.maxAttempts) >= 1 &&
    Number(job.attempt) <= Number(job.maxAttempts) &&
    Number.isInteger(job.revision) &&
    Number(job.revision) >= 1 &&
    timestamp(job.createdAt) &&
    timestamp(job.updatedAt) &&
    Date.parse(String(job.createdAt)) <= Date.parse(String(job.updatedAt)) &&
    nullableTimestamp(job.nextAttemptAt) &&
    validLease(job.lease) &&
    validSubmission(job.submission) &&
    validReview(job.review) &&
    Array.isArray(job.blockers) &&
    job.blockers.every((blocker) => typeof blocker === "string") &&
    Array.isArray(job.events) &&
    job.events.length >= 1 &&
    job.events.length <= 100 &&
    job.events.every(validEvent) &&
    job.events.every((entry) => entry.revision <= Number(job.revision)) &&
    job.events[0]?.revision === job.revision
  );
  if (!structurallyValid || !job.status) return false;
  if (job.status === "running" && !job.lease) return false;
  if (job.lease && job.lease.fenceToken !== job.attempt) return false;
  if (job.status !== "running" && job.lease) return false;
  if (job.status === "retry-wait" && !job.nextAttemptAt) return false;
  if (job.status !== "retry-wait" && job.nextAttemptAt) return false;
  if (["review", "accepted", "rejected"].includes(job.status) && !job.submission) return false;
  if (["accepted", "rejected"].includes(job.status) && job.review?.decision !== job.status) return false;
  if (!["accepted", "rejected", "cancelled"].includes(job.status) && job.review) return false;
  if (job.status === "cancelled" && job.review?.decision === "accepted") return false;
  if (job.review && !job.submission) return false;
  return true;
}

export function validateEvidenceCollectionStore(value: unknown): value is EvidenceCollectionStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const store = value as Partial<EvidenceCollectionStore>;
  if (!(
    store.schemaVersion === "evidence.collection-job-store.v1" &&
    Number.isInteger(store.revision) &&
    Number(store.revision) >= 0 &&
    Array.isArray(store.jobs) &&
    store.jobs.length <= 500 &&
    store.jobs.every(isCollectionJob) &&
    Boolean(store.idempotency) &&
    typeof store.idempotency === "object" &&
    !Array.isArray(store.idempotency)
  )) return false;
  const jobs = store.jobs;
  const idempotency = store.idempotency as Record<string, unknown>;
  if (new Set(jobs.map((job) => job.id)).size !== jobs.length) return false;
  if (new Set(jobs.map((job) => job.idempotencyKey)).size !== jobs.length) return false;
  const entries = Object.entries(idempotency);
  return (
    entries.length === jobs.length &&
    entries.every(([key, jobId]) =>
      text(key) && typeof jobId === "string" &&
      jobs.some((job) => job.id === jobId && job.idempotencyKey === key)
    )
  );
}

const options = {
  filePath: STORE_PATH,
  initial: emptyEvidenceCollectionStore,
  validate: validateEvidenceCollectionStore,
};

export function insertEvidenceCollectionJob(
  store: EvidenceCollectionStore,
  job: EvidenceCollectionJob,
) {
  const existingId = store.idempotency[job.idempotencyKey];
  const existing = existingId ? store.jobs.find((entry) => entry.id === existingId) : null;
  if (existing) {
    const sameRequest =
      existing.planVersion === job.planVersion &&
      existing.sourceMilestone === job.sourceMilestone &&
      existing.subjectId === job.subjectId &&
      existing.organizationId === job.organizationId &&
      existing.operatorId === job.operatorId;
    if (!sameRequest) {
      throw new EvidenceCollectionPolicyError(
        "revision-conflict",
        409,
        "The idempotency key is already bound to a different collection request.",
      );
    }
    return { store, job: existing, deduplicated: true };
  }
  if (store.jobs.length >= 500) {
    throw new EvidenceCollectionPolicyError(
      "capacity-exceeded", 409,
      "Collection queue capacity reached. Retained jobs and idempotency bindings were not evicted.",
    );
  }
  const jobs = [job, ...store.jobs];
  const next = {
    ...store,
    revision: store.revision + 1,
    jobs,
    idempotency: Object.fromEntries(jobs.map((entry) => [entry.idempotencyKey, entry.id])),
  } satisfies EvidenceCollectionStore;
  return { store: next, job, deduplicated: false };
}

export function replaceEvidenceCollectionJob(
  store: EvidenceCollectionStore,
  jobId: string,
  expectedRevision: number,
  mutate: (job: EvidenceCollectionJob) => EvidenceCollectionJob,
) {
  const current = store.jobs.find((entry) => entry.id === jobId);
  if (!current) {
    throw new EvidenceCollectionPolicyError("not-found", 404, "Evidence collection job was not found.");
  }
  if (current.revision !== expectedRevision) {
    throw new EvidenceCollectionPolicyError(
      "revision-conflict",
      409,
      `Collection job revision changed from ${expectedRevision} to ${current.revision}.`,
    );
  }
  const nextJob = mutate(current);
  return {
    store: {
      ...store,
      revision: store.revision + 1,
      jobs: [nextJob, ...store.jobs.filter((entry) => entry.id !== jobId)].slice(0, 500),
    } satisfies EvidenceCollectionStore,
    job: nextJob,
  };
}

export function readEvidenceCollectionStore() {
  return readJsonFileDurably(options.filePath, options.initial, options.validate);
}

export function queueEvidenceCollectionJobDurably(input: {
  plan: EvidenceCollectionPlan;
  queue: EvidenceCollectionQueueInput;
  now?: Date;
}) {
  const candidate = createEvidenceCollectionJob(input);
  let result = { job: candidate, deduplicated: false };
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      const inserted = insertEvidenceCollectionJob(store, candidate);
      result = { job: inserted.job, deduplicated: inserted.deduplicated };
      return inserted.store;
    },
    options.validate,
  );
  return result;
}

export function mutateEvidenceCollectionJobDurably(input: {
  jobId: string;
  expectedRevision: number;
  mutate: (job: EvidenceCollectionJob) => EvidenceCollectionJob;
}): EvidenceCollectionJob {
  let result: EvidenceCollectionJob | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      const replaced = replaceEvidenceCollectionJob(
        store,
        input.jobId,
        input.expectedRevision,
        input.mutate,
      );
      result = replaced.job;
      return replaced.store;
    },
    options.validate,
  );
  if (!result) throw new EvidenceCollectionPolicyError("not-found", 404, "Evidence collection job was not updated.");
  return result;
}

export function evidenceCollectionStorePath() {
  return STORE_PATH;
}
