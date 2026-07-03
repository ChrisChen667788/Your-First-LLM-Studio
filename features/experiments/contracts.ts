import type { AgentTimelineEventStatus } from "@/lib/agent/types";

export type ExperimentEventKind =
  | "session"
  | "compare"
  | "benchmark"
  | "finetune"
  | "retrieval"
  | "model"
  | "provider";
export type ExperimentEventStatus = AgentTimelineEventStatus;

export type ExperimentArtifactKind =
  | "file"
  | "directory"
  | "url"
  | "api";

export type ExperimentArtifactRole =
  | "input"
  | "output"
  | "report"
  | "manifest"
  | "log"
  | "bundle"
  | "dataset"
  | "adapter"
  | "model"
  | "progress";

export type ExperimentArtifactReference = {
  id?: string;
  kind: ExperimentArtifactKind;
  role: ExperimentArtifactRole;
  label: string;
  uri: string;
  mimeType?: string;
};

export type ExperimentEntityType =
  | ExperimentEventKind
  | "job"
  | "operation"
  | "adapter"
  | "dataset"
  | "document"
  | "recipe"
  | "report"
  | "target";

export type ExperimentLinkRelation =
  | "source"
  | "derived-from"
  | "produced"
  | "uses"
  | "evaluates"
  | "compares"
  | "benchmarks"
  | "exports"
  | "attaches"
  | "continues";

export type ExperimentLinkReference = {
  relation: ExperimentLinkRelation;
  entityType: ExperimentEntityType;
  id: string;
  label?: string;
};

export type ExperimentSourceContext = {
  sourceKind: ExperimentEventKind;
  sourceId: string;
  sourceLabel?: string;
  jobId?: string;
  adapterId?: string;
  datasetId?: string;
  artifacts?: ExperimentArtifactReference[];
};

export type ExperimentEvent = {
  id: string;
  kind: ExperimentEventKind;
  status: ExperimentEventStatus;
  at: string;
  title: string;
  summary: string;
  relatedId?: string;
  targetIds?: string[];
  artifacts?: ExperimentArtifactReference[];
  links?: ExperimentLinkReference[];
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type AppendExperimentEventInput = Omit<ExperimentEvent, "id" | "at"> & {
  id?: string;
  at?: string;
};

export type ReadExperimentTimelineOptions = {
  limit?: number;
  kinds?: ExperimentEventKind[];
  statuses?: ExperimentEventStatus[];
};

export type ExperimentTimelineResponse = {
  ok: true;
  generatedAt: string;
  path: string;
  events: ExperimentEvent[];
};

export type ExperimentRetentionPolicy = {
  maxEvents: number;
  maxAgeDays: number;
  preserveFailures: boolean;
  preserveArtifacts: boolean;
};

export type ExperimentRetentionResult = {
  beforeCount: number;
  afterCount: number;
  removedCount: number;
  protectedCount: number;
  appliedAt: string;
  policy: ExperimentRetentionPolicy;
};

export type ReleaseTrainStatus =
  | "active"
  | "planned"
  | "blocked"
  | "evidence-needed";

export type ReleaseTrainTrack =
  | "ops"
  | "models"
  | "rag"
  | "finetune"
  | "deployment"
  | "release";

export type ReleaseTrainMilestone = {
  version: string;
  label: string;
  status: ReleaseTrainStatus;
  track: ReleaseTrainTrack;
  targetWindow: string;
  objective: string;
  scope: string[];
  acceptance: string[];
  evidence: string[];
  nextSlice: string;
};

export type ReleaseTrainResponse = {
  ok: true;
  generatedAt: string;
  activeVersion: string;
  milestones: ReleaseTrainMilestone[];
};

export type PromotionGateSourceStatus = "pass" | "watch" | "hold";

export type PromotionGateSource = {
  id:
    | "benchmark"
    | "provider-ops"
    | "fine-tune"
    | "adapter-export"
    | "docs-screenshots";
  label: string;
  status: PromotionGateSourceStatus;
  summary: string;
  metrics: Record<string, string | number | boolean | null>;
  evidence: string[];
  blockers: string[];
  releaseNoteDraft: string[];
};

export type PromotionGateResponse = {
  ok: true;
  schemaVersion: "experiments.promotion-gate.v1";
  generatedAt: string;
  activeVersion: string;
  overallStatus: PromotionGateSourceStatus;
  sources: PromotionGateSource[];
  blockers: string[];
  releaseNoteDraft: string[];
};

export type ReleaseEvidenceMatrixStatus =
  | "complete"
  | "in-progress"
  | "evidence-needed"
  | "blocked"
  | "planned";

export type ReleaseEvidenceMatrixRound = {
  version: string;
  label: string;
  track: ReleaseTrainTrack;
  targetWindow: string;
  status: ReleaseEvidenceMatrixStatus;
  completionPct: number;
  summary: string;
  shipped: string[];
  evidence: string[];
  blockers: string[];
  nextActions: string[];
  metrics: Record<string, string | number | boolean | null>;
};

export type ReleaseEvidenceMatrixResponse = {
  ok: true;
  schemaVersion: "experiments.release-evidence-matrix.v1";
  generatedAt: string;
  activeVersion: string;
  rounds: ReleaseEvidenceMatrixRound[];
  totals: {
    roundCount: number;
    completeCount: number;
    inProgressCount: number;
    evidenceNeededCount: number;
    blockedCount: number;
    plannedCount: number;
    averageCompletionPct: number;
  };
};
