import type {
  AgentFineTuneAdapterArtifact,
  AgentFineTuneBundleArchive,
  AgentFineTuneCurvePoint,
  AgentFineTuneDataset,
  AgentFineTuneDatasetFormat,
  AgentFineTuneDatasetQuality,
  AgentFineTuneDatasetValidation,
  AgentFineTuneJob,
  AgentFineTuneJobProgress,
  AgentFineTuneJobStatus,
  AgentFineTuneOperation,
  AgentFineTuneRecipe,
  AgentFineTuneReportExport,
  AgentFineTuneReportFormat,
  AgentFineTuneRunComparisonSummary,
  AgentFineTuneSourceSurface,
  AgentFineTuneSummary,
} from "@/lib/agent/types";

export const FINETUNE_CONTRACT_VERSION = "finetune.contract.v1" as const;

export type FineTuneContractVersion = typeof FINETUNE_CONTRACT_VERSION;

export type FineTuneSurface = AgentFineTuneSourceSurface;

export type FineTuneRouteOwner = {
  route: string;
  surface: FineTuneSurface;
  owner: "features/finetune";
  adminOnly?: boolean;
};

export const FINETUNE_ROUTE_OWNERS: FineTuneRouteOwner[] = [
  {
    route: "/fine-tune",
    surface: "fine-tune-studio",
    owner: "features/finetune",
  },
  {
    route: "/admin",
    surface: "admin-embedded",
    owner: "features/finetune",
    adminOnly: true,
  },
];

export type FineTuneStudioTab =
  | "dataset"
  | "train"
  | "evaluate-predict"
  | "chat-adapter"
  | "export"
  | "reports";

export type FineTuneWorkflowStage = "setup" | "run" | "evidence";

export type FineTuneWorkflowStepContract = {
  contractVersion: FineTuneContractVersion;
  id: FineTuneStudioTab;
  stage: FineTuneWorkflowStage;
  owner: "features/finetune";
  primaryPort: keyof FineTuneApplicationPort | "ui-only";
  adminMirror: boolean;
};

export const FINETUNE_WORKFLOW_STEPS: FineTuneWorkflowStepContract[] = [
  {
    contractVersion: FINETUNE_CONTRACT_VERSION,
    id: "dataset",
    stage: "setup",
    owner: "features/finetune",
    primaryPort: "saveDataset",
    adminMirror: true,
  },
  {
    contractVersion: FINETUNE_CONTRACT_VERSION,
    id: "train",
    stage: "run",
    owner: "features/finetune",
    primaryPort: "stageJob",
    adminMirror: true,
  },
  {
    contractVersion: FINETUNE_CONTRACT_VERSION,
    id: "evaluate-predict",
    stage: "run",
    owner: "features/finetune",
    primaryPort: "runOperation",
    adminMirror: true,
  },
  {
    contractVersion: FINETUNE_CONTRACT_VERSION,
    id: "chat-adapter",
    stage: "run",
    owner: "features/finetune",
    primaryPort: "runOperation",
    adminMirror: true,
  },
  {
    contractVersion: FINETUNE_CONTRACT_VERSION,
    id: "export",
    stage: "run",
    owner: "features/finetune",
    primaryPort: "runOperation",
    adminMirror: true,
  },
  {
    contractVersion: FINETUNE_CONTRACT_VERSION,
    id: "reports",
    stage: "evidence",
    owner: "features/finetune",
    primaryPort: "exportReport",
    adminMirror: true,
  },
];

export type FineTuneDatasetDraft = {
  contractVersion: FineTuneContractVersion;
  label: string;
  format: AgentFineTuneDatasetFormat;
  sourcePath?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceType: AgentFineTuneDataset["sourceType"];
  refreshCadenceHours?: number;
  quality?: AgentFineTuneDatasetQuality;
};

export type FineTuneRecipeDraft = {
  contractVersion: FineTuneContractVersion;
  label: string;
  datasetId: string;
  baseTargetId: string;
  adapterName: string;
  sequenceLength: number;
  batchSize: number;
  epochs: number;
  learningRate: number;
  fineTuneMethod: AgentFineTuneRecipe["fineTuneMethod"];
  optimizer: AgentFineTuneRecipe["optimizer"];
  numLayers: number;
  gradientAccumulationSteps: number;
  loraRank: number;
  loraAlpha: number;
  gradientCheckpointing: boolean;
  validationSplitPct: number;
  saveEverySteps: number;
  seed: number;
  benchmarkSuiteId?: string;
  notes?: string;
};

export type FineTuneJobDraft = {
  contractVersion: FineTuneContractVersion;
  recipeId: string;
  sourceSurface: FineTuneSurface;
  startImmediately?: boolean;
};

export type FineTuneTrainingRun = {
  contractVersion: FineTuneContractVersion;
  job: AgentFineTuneJob;
  recipe?: AgentFineTuneRecipe;
  dataset?: AgentFineTuneDataset;
  adapter?: AgentFineTuneAdapterArtifact;
  progress?: AgentFineTuneJobProgress;
  curve: AgentFineTuneCurvePoint[];
};

export type FineTuneReportBundle = {
  report: AgentFineTuneReportExport;
  archive?: AgentFineTuneBundleArchive;
  runComparison?: AgentFineTuneRunComparisonSummary;
};

export type FineTuneOperationRequest =
  (
    | {
      kind: "evaluation";
      adapterId: string;
      datasetId: string;
      checkpointPath?: string;
      maxSamples?: number;
      maxNewTokens?: number;
      temperature?: number;
      topP?: number;
      metrics?: string[];
      savePredictions?: boolean;
    }
  | {
      kind: "chat-adapter";
      adapterId: string;
      prompt: string;
      systemPrompt?: string;
      role?: string;
      maxNewTokens?: number;
      temperature?: number;
      topP?: number;
      skipSpecialTokens?: boolean;
      renderHtmlTags?: boolean;
    }
  | {
      kind: "export-adapter";
      adapterId: string;
      exportFormat?: "adapter-bundle" | "merged-mlx" | "gguf";
      quantization?: "none" | "q8" | "q4";
      maxShardSizeGb?: number;
      outputDir?: string;
      hubId?: string;
      includeDatasetCard?: boolean;
    }
  | {
      kind: "distillation";
      teacherTargetId: string;
      outputPath?: string;
      sampleCount?: number;
      maxNewTokens?: number;
      temperature?: number;
      topP?: number;
      seedPrompt?: string;
      includeReasoningTrace?: boolean;
    }
  ) & {
    sourceSurface?: FineTuneSurface;
  };

export type FineTuneCompareHandoff = {
  source: "fine-tune";
  jobId: string;
  adapterId: string;
  baseTargetId?: string;
  targetIds: string[];
  prompt: string;
  createdAt: string;
};

export type FineTuneBenchmarkHandoff = {
  source: "fine-tune";
  jobId: string;
  adapterId: string;
  suiteId?: string;
  targetIds: string[];
  runNote: string;
  createdAt: string;
};

export type FineTuneApplicationPort = {
  readSummary(): Promise<AgentFineTuneSummary>;
  validateDataset(input: FineTuneDatasetDraft): Promise<AgentFineTuneDatasetValidation>;
  saveDataset(input: FineTuneDatasetDraft): Promise<AgentFineTuneDataset>;
  saveRecipe(input: FineTuneRecipeDraft): Promise<AgentFineTuneRecipe>;
  stageJob(input: FineTuneJobDraft): Promise<AgentFineTuneJob>;
  startJob(jobId: string): Promise<AgentFineTuneJob>;
  cancelJob(jobId: string): Promise<AgentFineTuneJob>;
  rerunJob(jobId: string): Promise<AgentFineTuneJob>;
  exportReport(input: { jobId: string; format: AgentFineTuneReportFormat }): Promise<AgentFineTuneReportExport>;
  downloadBundle(jobId: string): Promise<AgentFineTuneBundleArchive>;
  runOperation(input: FineTuneOperationRequest): Promise<AgentFineTuneOperation>;
};

export type FineTuneWorkerPort = {
  start(job: AgentFineTuneJob): Promise<{ pid?: number | null; status: AgentFineTuneJobStatus }>;
  stop(jobId: string): Promise<{ status: AgentFineTuneJobStatus }>;
  readProgress(jobId: string): Promise<AgentFineTuneJobProgress | null>;
  readCurve(jobId: string): Promise<AgentFineTuneCurvePoint[]>;
};

export type FineTuneArtifactPort = {
  attachAdapter(adapterId: string): Promise<AgentFineTuneAdapterArtifact>;
  detachAdapter(adapterId: string): Promise<AgentFineTuneAdapterArtifact>;
  openArtifact(path: string): Promise<{ ok: boolean; path: string }>;
};
