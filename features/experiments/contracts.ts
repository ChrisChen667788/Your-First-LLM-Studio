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
  | "complete"
  | "planned"
  | "blocked"
  | "evidence-needed";

export type ReleaseTrainTrack =
  | "ops"
  | "models"
  | "rag"
  | "finetune"
  | "deployment"
  | "release"
  | "desktop"
  | "runtime"
  | "platform"
  | "ecosystem"
  | "workflow"
  | "governance"
  | "evaluation";

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

export type GaReleaseEvidenceBundleStatus = "pass" | "evidence-needed" | "blocked";

export type GaReleaseEvidenceBundleSource = {
  id: string;
  label: string;
  status: GaReleaseEvidenceBundleStatus;
  evidence: string[];
  blockers: string[];
  metrics: Record<string, string | number | boolean | null>;
  digest: string;
};

export type GaReleaseEvidenceBundle = {
  schemaVersion: "experiments.ga-release-evidence-bundle.v1";
  generatedAt: string;
  version: "v1.0.0";
  scope: "ga-release";
  artifactPath: string;
  persistedAt: string | null;
  nonCloudReadiness: {
    status: GaReleaseEvidenceBundleStatus;
    completionPct: number;
    blockers: string[];
  };
  productionReadiness: {
    status: GaReleaseEvidenceBundleStatus;
    completionPct: number;
    blockers: string[];
  };
  sources: GaReleaseEvidenceBundleSource[];
  integrity: {
    algorithm: "sha256";
    digest: string;
    stateDigest: string;
    verified: boolean;
    sourceDigestCount: number;
  };
  totals: {
    sourceCount: number;
    passingSourceCount: number;
    blockerCount: number;
    routeSmokeHistoryCount: number;
    providerSnapshotCount: number;
    compatibilityDeleteReadyCount: number;
  };
};

export type GaReleaseEvidenceBundleVerification = {
  generatedAt: string;
  status: "in-sync" | "drifted" | "missing" | "invalid";
  persistedPath: string;
  persistedGeneratedAt: string | null;
  persistedDigest: string | null;
  liveStateDigest: string;
  persistedStateDigest: string | null;
  changedSourceIds: string[];
  persistedIntegrityOk: boolean;
  invalidSourceIds: string[];
};

export type GaReleaseEvidenceBundleHistory = {
  generatedAt: string;
  historyDir: string;
  totalCount: number;
  verifiedCount: number;
  invalidCount: number;
  latestAt: string | null;
  entries: Array<{
    file: string;
    generatedAt: string | null;
    nonCloudStatus: GaReleaseEvidenceBundleStatus | "unknown";
    productionStatus: GaReleaseEvidenceBundleStatus | "unknown";
    integrityStatus: "verified" | "invalid" | "missing";
    digest: string | null;
    sizeBytes: number;
  }>;
};

export type GaReleaseEvidenceBundleRetentionResult = {
  appliedAt: string;
  beforeCount: number;
  afterCount: number;
  removedCount: number;
  protectedLatest: boolean;
  policy: {
    maxBundles: number;
    maxAgeDays: number;
  };
};

export type PublicReleaseEvidenceFileCheck = {
  label: string;
  relativePath: string;
  exists: boolean;
  sizeBytes: number;
  minBytes: number;
  updatedAt: string | null;
  lfsPointer: boolean;
  ok: boolean;
};

export type PublicReleaseEvidenceFlow = {
  id: string;
  label: string;
  route: string;
  selector?: string;
  screenshotPath: string;
  command: string;
  purpose: string;
  screenshot: PublicReleaseEvidenceFileCheck;
  ok: boolean;
};

export type PublicReleaseEvidenceResponse = {
  ok: true;
  schemaVersion: "experiments.public-release-evidence.v1";
  generatedAt: string;
  docsRoute: {
    route: string;
    filePath: string;
    exists: boolean;
    ok: boolean;
  };
  docsFiles: PublicReleaseEvidenceFileCheck[];
  demoCapture: {
    manifestPath: string;
    manifestExists: boolean;
    schemaVersion: string | null;
    flowCount: number;
    verifiedFlowCount: number;
    flows: PublicReleaseEvidenceFlow[];
    ok: boolean;
  };
  distillation: {
    operationCount: number;
    completedOperationCount: number;
    latestOperationId: string | null;
    latestDatasetId: string | null;
    latestManifestPath: string | null;
    latestDatasetPath: string | null;
    latestReportPath: string | null;
    ok: boolean;
  };
  totals: {
    checkCount: number;
    passingCheckCount: number;
    blockerCount: number;
    completionPct: number;
  };
  blockers: string[];
  releaseNoteDraft: string[];
};
