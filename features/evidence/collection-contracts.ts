import type { OperationalEvidenceReceipt } from "@/features/evidence/operational-receipts";

export const EVIDENCE_COLLECTION_JOB_SCHEMA_VERSION =
  "evidence.collection-job.v1" as const;

export type EvidenceCollectionPlanKind = "control" | "collector" | "release";
export type EvidenceCollectionMode = "automatic" | "operator-assisted" | "external-import";
export type EvidenceCollectionTrack =
  | "platform"
  | "provider"
  | "agent"
  | "evaluation"
  | "models"
  | "runtime"
  | "rag"
  | "finetune"
  | "governance"
  | "release";

export type EvidenceCollectionPlan = {
  version: string;
  label: string;
  owner: string;
  track: EvidenceCollectionTrack;
  kind: EvidenceCollectionPlanKind;
  mode: EvidenceCollectionMode;
  sourceMilestones: string[];
  requiredInputs: string[];
  artifactKinds: string[];
  executionSteps: string[];
  timeoutMs: number;
  retryPolicy: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  localGate: string;
  externalGate: string;
};

export type EvidenceCollectionJobStatus =
  | "queued"
  | "running"
  | "retry-wait"
  | "review"
  | "accepted"
  | "rejected"
  | "failed"
  | "cancelled";

export type EvidenceCollectionLease = {
  workerId: string;
  fenceToken: number;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
};

export type EvidenceCollectionSubmission = {
  receipt: OperationalEvidenceReceipt;
  receiptDigest: string;
  validationDigest: string;
  submittedAt: string;
  workerId: string;
};

export type EvidenceCollectionReview = {
  decision: "accepted" | "rejected";
  reviewerId: string;
  reason: string;
  reviewedAt: string;
  candidateDigest: string | null;
};

export type EvidenceCollectionJobEvent = {
  id: string;
  type:
    | "queued"
    | "claimed"
    | "heartbeat"
    | "receipt-submitted"
    | "candidate-linked"
    | "retry-scheduled"
    | "retried"
    | "accepted"
    | "rejected"
    | "cancelled";
  actorId: string;
  at: string;
  revision: number;
  detail: string;
};

export type EvidenceCollectionJob = {
  schemaVersion: typeof EVIDENCE_COLLECTION_JOB_SCHEMA_VERSION;
  id: string;
  planVersion: string;
  sourceMilestone: string;
  subjectId: string;
  organizationId: string;
  operatorId: string;
  idempotencyKey: string;
  status: EvidenceCollectionJobStatus;
  attempt: number;
  maxAttempts: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  lease: EvidenceCollectionLease | null;
  submission: EvidenceCollectionSubmission | null;
  review: EvidenceCollectionReview | null;
  blockers: string[];
  events: EvidenceCollectionJobEvent[];
};

export type EvidenceCollectionQueueInput = {
  planVersion: string;
  sourceMilestone: string;
  subjectId: string;
  organizationId: string;
  operatorId: string;
  idempotencyKey: string;
};

export type EvidenceCollectionStore = {
  schemaVersion: "evidence.collection-job-store.v1";
  revision: number;
  jobs: EvidenceCollectionJob[];
  idempotency: Record<string, string>;
};
