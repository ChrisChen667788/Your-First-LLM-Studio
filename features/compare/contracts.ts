import type {
  AgentBenchmarkMode,
  AgentCacheMode,
  AgentCompareIntent,
  AgentCompareLaneProgress,
  AgentCompareLaneResult,
  AgentCompareOutputShape,
  AgentCompareProgress,
  AgentCompareRequest,
  AgentCompareResponse,
  AgentCompareReviewSummaryDetail,
  AgentCompareReviewSummaryTone,
  AgentCompareSourceSurface,
  AgentExecution,
  AgentMessage,
  AgentProviderProfile,
  AgentThinkingMode,
  AgentToolRun,
  AgentUsage,
} from "@/lib/agent/types";

export const COMPARE_CONTRACT_VERSION = "compare.contract.v1" as const;

export type CompareContractVersion = typeof COMPARE_CONTRACT_VERSION;

export type CompareSurface = AgentCompareSourceSurface;

export type CompareRouteOwner = {
  route: string;
  surface: CompareSurface;
  owner: "features/compare";
  adminOnly?: boolean;
};

export const COMPARE_ROUTE_OWNERS: CompareRouteOwner[] = [
  {
    route: "/compare",
    surface: "compare-studio",
    owner: "features/compare",
  },
  {
    route: "/agent",
    surface: "agent-embedded",
    owner: "features/compare",
  },
];

export type CompareLaneRole = "base" | "candidate" | "reference";

export type CompareLaneDraft = {
  targetId: string;
  role: CompareLaneRole;
  label?: string;
  locked?: boolean;
  notes?: string;
};

export type CompareFairnessControls = {
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  enableTools: boolean;
  enableRetrieval: boolean;
  cacheMode?: AgentCacheMode;
};

export type ComparePromptDraft = {
  input: string;
  messages: AgentMessage[];
  systemPrompt?: string;
  intent: AgentCompareIntent;
  outputShape: AgentCompareOutputShape;
};

export type CompareRunDraft = {
  contractVersion: CompareContractVersion;
  requestId?: string;
  title?: string;
  sourceSurface: CompareSurface;
  prompt: ComparePromptDraft;
  lanes: CompareLaneDraft[];
  fairness: CompareFairnessControls;
  plannerEnabled?: boolean;
  memorySummary?: string;
};

export type CompareRunRecord = {
  contractVersion: CompareContractVersion;
  request: AgentCompareRequest;
  response?: AgentCompareResponse;
  progress?: AgentCompareProgress;
  sourceSurface: CompareSurface;
  createdAt: string;
  updatedAt: string;
};

export type CompareLaneReview = {
  targetId: string;
  targetLabel: string;
  role: CompareLaneRole;
  ok: boolean;
  summary: string;
  strengths: string[];
  risks: string[];
  citations?: string[];
};

export type CompareDiffDrawerState = {
  open: boolean;
  baseTargetId?: string;
  selectedTargetId?: string;
  reviewTone: AgentCompareReviewSummaryTone;
  reviewDetail: AgentCompareReviewSummaryDetail;
};

export type CompareBenchmarkHandoff = {
  source: "compare";
  compareRunId?: string;
  requestId: string;
  benchmarkMode: AgentBenchmarkMode;
  prompt: string;
  runNote: string;
  targetIds: string[];
  includeCompareOutputContract: boolean;
  createdAt: string;
};

export type CompareExportBundle = {
  requestId: string;
  markdown: string;
  compactMarkdown: string;
  laneMarkdown: Array<{
    targetId: string;
    targetLabel: string;
    markdown: string;
  }>;
};

export type CompareApplicationPort = {
  runCompare(input: CompareRunDraft): Promise<AgentCompareResponse>;
  readProgress(requestId: string): Promise<AgentCompareProgress | null>;
  exportMarkdown(requestId: string): Promise<CompareExportBundle>;
  sendToBenchmark(input: CompareBenchmarkHandoff): Promise<{ runId?: string; ok: boolean }>;
};

export type CompareInfrastructurePort = {
  runLane(input: {
    requestId: string;
    lane: CompareLaneDraft;
    prompt: ComparePromptDraft;
    fairness: CompareFairnessControls;
  }): Promise<AgentCompareLaneResult>;
  readLaneProgress(requestId: string, targetId: string): Promise<AgentCompareLaneProgress | null>;
};

export type CompareRuntimeSnapshot = {
  targetId: string;
  targetLabel: string;
  execution: AgentExecution;
  resolvedModel: string;
  providerProfile?: AgentProviderProfile;
  thinkingMode?: AgentThinkingMode;
  usage?: AgentUsage;
  toolRuns: AgentToolRun[];
  warning?: string;
};
