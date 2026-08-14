import type { AdminCompatibilityDeletionManifest } from "@/features/admin/compatibility-deletion-manifest";
import type { AdminCompatibilitySunsetEvidence } from "@/features/admin/compatibility-sunset";
import type { BenchmarkReleaseEvidenceSummary } from "@/features/benchmark/contracts";
import type { ProviderOpsEvidenceSummary } from "@/features/providers/contracts";
import type {
  AgentBenchmarkReleaseEvidence,
  AgentMetricPercentiles,
  AgentProviderHealthDeskItem,
} from "@/lib/agent/types";

type MetricPercentiles = AgentMetricPercentiles;

export type AdminDashboardResponse = {
  generatedAt: string;
  target: {
    id: string;
    label: string;
    providerLabel: string;
    execution: "local" | "remote";
  };
  filters: {
    provider: string;
    providerProfile: string;
    benchmarkThinkingMode: string;
    benchmarkHeatmapPromptScope: string;
    benchmarkHeatmapSampleStatus: string;
    benchmarkHeatmapWindowMinutes: string;
    model: string;
    contextWindow: string;
  };
  availableModels: string[];
  availableProviders: string[];
  availableProviderProfiles: string[];
  availableBenchmarkThinkingModes: string[];
  availableContextWindows: number[];
  benchmarkTargetVersions: Array<{
    targetId: string;
    targetLabel: string;
    execution: "local" | "remote";
    standardResolvedModel: string;
    thinkingResolvedModel?: string | null;
  }>;
  benchmarkHistory: Array<{
    id: string;
    runId?: string;
    matchSource?: AgentBenchmarkReleaseEvidence["matchSource"];
    generatedAt: string;
    prompt: string;
    runNote?: string;
    benchmarkMode?: "prompt" | "dataset" | "suite";
    profileBatchScope?: "full-suite" | "comparison-subset";
    promptSetId?: string;
    promptSetLabel?: string;
    promptSetPromptCount?: number;
    datasetId?: string;
    datasetLabel?: string;
    datasetSourceLabel?: string;
    datasetSourceUrl?: string;
    datasetSampleCount?: number;
    suiteId?: string;
    suiteLabel?: string;
    suiteWorkloadCount?: number;
    contextWindow: number;
    runs: number;
    providerProfile?: string;
    thinkingMode?: string;
    results: Array<{
      targetId: string;
      targetLabel: string;
      providerLabel?: string;
      execution?: "local" | "remote";
      resolvedModel: string;
      providerProfile?: string;
      thinkingMode?: string;
      avgFirstTokenLatencyMs: number;
      avgLatencyMs: number;
      avgTokenThroughputTps: number;
      avgScore?: number | null;
      passRate?: number | null;
      okRuns: number;
      skippedRuns?: number;
      skipSummary?: string | null;
      runs: number;
      samples: Array<{
        firstTokenLatencyMs: number | null;
        latencyMs: number;
        completionTokens: number;
        tokenThroughputTps: number | null;
        ok: boolean;
        warning?: string | null;
        workloadId?: string | null;
        itemId?: string | null;
      }>;
    }>;
  }>;
  releaseEvidence: AgentBenchmarkReleaseEvidence[];
  benchmarkReleaseEvidenceSummary?: BenchmarkReleaseEvidenceSummary;
  providerHealthDesk: AgentProviderHealthDeskItem[];
  providerOpsEvidenceSummary?: ProviderOpsEvidenceSummary;
  adminCompatibilityUsage?: {
    generatedAt: string;
    totalHits: number;
    runtimeHits: number;
    smokeHits: number;
    legacyUnclassifiedHits: number;
    routeCount: number;
    routes: Array<{
      key: string;
      legacyPath: string;
      canonicalPath: string;
      method: string;
      hitCount: number;
      evidenceVersion?: number;
      runtimeHitCount?: number;
      smokeHitCount?: number;
      legacyUnclassifiedHitCount?: number;
      firstSeenAt: string;
      lastSeenAt: string;
      lastUserAgent?: string;
      lastEvidenceSource?: "runtime" | "route-smoke";
    }>;
  };
  adminCompatibilitySunset?: AdminCompatibilitySunsetEvidence;
  adminCompatibilityDeletionManifest?: AdminCompatibilityDeletionManifest;
  benchmarkTrends: Array<{
    targetId: string;
    targetLabel: string;
    providerProfile: string;
    thinkingMode: string;
    resolvedModel?: string;
    points: Array<{
      timestamp: string;
      contextWindow: number;
      avgFirstTokenLatencyMs: number;
      avgLatencyMs: number;
      avgTokenThroughputTps: number;
      successRate: number;
    }>;
  }>;
  benchmarkHeatmap: Array<{
    providerProfile: string;
    cells: Array<{
      thinkingMode: string;
      sampleCount: number;
      avgFirstTokenLatencyMs: number;
      avgLatencyMs: number;
      avgTokenThroughputTps: number;
      avgSuccessRate: number;
    }>;
  }>;
  comparison: Array<{
    targetId: string;
    targetLabel: string;
    providerLabel: string;
    execution: "local" | "remote";
    totalRequests: number;
    totalTokens: number;
    failedRequests: number;
    activeForTarget: number;
    latestCheckOk: boolean | null;
    avgLatencyMs: number;
    avgFirstTokenLatencyMs: number;
    avgTokenThroughputTps: number;
    firstTokenLatencyPercentiles: MetricPercentiles;
    totalLatencyPercentiles: MetricPercentiles;
    tokenThroughputPercentiles: MetricPercentiles;
  }>;
  windowMinutes: number;
  summary: {
    totalRequests: number;
    okRequests: number;
    failedRequests: number;
    activeRequests: number;
    activeForTarget: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    latestCheckOk: boolean | null;
    telemetryAvailable: boolean;
    avgLatencyMs: number;
    avgFirstTokenLatencyMs: number;
    avgTokenThroughputTps: number;
    latencyPercentiles: MetricPercentiles;
    firstTokenLatencyPercentiles: MetricPercentiles;
    tokenThroughputPercentiles: MetricPercentiles;
  };
  series: {
    requests: Array<{ timestamp: string; value: number }>;
    totalTokens: Array<{ timestamp: string; value: number }>;
    promptTokens: Array<{ timestamp: string; value: number }>;
    completionTokens: Array<{ timestamp: string; value: number }>;
    firstTokenLatency: Array<{ timestamp: string; value: number }>;
    totalLatency: Array<{ timestamp: string; value: number }>;
    appOverhead: Array<{ timestamp: string; value: number }>;
    tokenThroughput: Array<{ timestamp: string; value: number }>;
    checks: Array<{ timestamp: string; value: number }>;
    telemetry: Array<{
      timestamp: string;
      activeRequests: number;
      activeForTarget: number;
      queueDepth: number;
      memoryUsedPct: number | null;
      diskUsedPct: number | null;
      batteryPercent: number | null;
      gpuProxyPct: number | null;
      energyProxyPct: number | null;
    }>;
  };
  modelBreakdown: Array<{
    model: string;
    requests: number;
    totalTokens: number;
    errors: number;
    avgLatencyMs: number;
    avgFirstTokenLatencyMs: number;
    avgTokenThroughputTps: number;
    latencyPercentiles: MetricPercentiles;
    firstTokenLatencyPercentiles: MetricPercentiles;
    tokenThroughputPercentiles: MetricPercentiles;
  }>;
  contextWindowBreakdown: Array<{
    contextWindow: number | null;
    requests: number;
    totalTokens: number;
    avgLatencyMs: number;
    avgFirstTokenLatencyMs: number;
    avgTokenThroughputTps: number;
    latencyPercentiles: MetricPercentiles;
    firstTokenLatencyPercentiles: MetricPercentiles;
    tokenThroughputPercentiles: MetricPercentiles;
  }>;
  recentChats: Array<{
    id: string;
    completedAt: string;
    targetLabel: string;
    resolvedModel: string;
    contextWindow?: number;
    latencyMs: number;
    ok: boolean;
    usage: { totalTokens: number };
    warning?: string;
  }>;
  recentChecks: Array<{
    id: string;
    checkedAt: string;
    targetLabel: string;
    ok: boolean;
    stages: Array<{ id: string; ok: boolean }>;
  }>;
  latestTelemetry: {
    memoryTotalBytes?: number;
    memoryUsedBytes?: number;
    diskAvailableBytes?: number;
    batteryPercent?: number | null;
    onAcPower?: boolean | null;
    gpuProxyPct?: number | null;
    queueDepth?: number;
    runtimeBusy?: boolean;
  } | null;
  paths: {
    dataDir: string;
    chatLogFile: string;
    connectionCheckFile: string;
    telemetryFile: string;
    benchmarkFile: string;
    benchmarkBaselineFile?: string;
    benchmarkPromptSetFile?: string;
  };
};
