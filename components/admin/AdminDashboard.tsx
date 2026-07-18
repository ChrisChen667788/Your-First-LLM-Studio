"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminCompatibilitySunsetPanel } from "@/components/admin/AdminCompatibilitySunsetPanel";
import { AdminTimelinePanel } from "@/components/admin/AdminTimelinePanel";
import { AdminFeatureHandoffPanel } from "@/features/admin/AdminFeatureHandoffPanel";
import { AdminRuntimeMetricsGrid } from "@/features/admin/AdminRuntimeMetricsGrid";
import { AdminRuntimeLogPanel } from "@/features/admin/AdminRuntimeLogPanel";
import { AdminRuntimeTracePanel } from "@/features/admin/AdminRuntimeTracePanel";
import { AdminRuntimeModelStatePanel } from "@/features/admin/AdminRuntimeModelStatePanel";
import { AdminRecentOperationsPanel } from "@/features/admin/AdminRecentOperationsPanel";
import {
  useAdminDashboardFilterState,
} from "@/features/admin/dashboard-filter-state";
import { buildAdminDashboardQuery } from "@/features/admin/dashboard-query";
import { openAdminBenchmarkReport } from "@/features/admin/benchmark-report-application";
import { useAdminBenchmarkProgressState } from "@/features/admin/benchmark-progress-state";
import { useAdminRuntimeSwitchHistory } from "@/features/admin/runtime-switch-history";
import {
  MultiSeriesCard as AdminMultiSeriesCard,
  SeriesCard as AdminSeriesCard,
  formatBytes as formatAdminBytes,
  formatCompactNumber as formatAdminCompactNumber,
  formatPercent as formatAdminPercent,
} from "@/features/admin/telemetry-components";
import { buildAdminOperationsReadModel } from "@/features/admin/dashboard-read-model";
import {
  describeAdminRuntimeAlias,
  formatAdminRuntimeDuration,
  formatAdminRuntimeTimestamp,
} from "@/features/admin/runtime-formatters";
import {
  buildAdminRuntimeTargetViewModel,
  type AdminRuntimeMetricSample as RuntimeMetricSample,
} from "@/features/admin/runtime-target-view-model";
import { selectAdminRuntimeRecoveryEvidence } from "@/features/admin/runtime-recovery-evidence";
import {
  executeAdminRuntimeAction,
  fetchAdminRuntimeStatus,
  fetchRuntimeGuardrailPolicy,
  prewarmAdminRuntime,
  prewarmAllAdminRuntimes,
  updateRuntimeGuardrailPolicy,
  type RuntimeGuardrailStrategy,
} from "@/features/admin/runtime-operations";
import { AdminBenchmarkHandoffPanel } from "@/features/benchmark/AdminBenchmarkHandoffPanel";
import { AdminBenchmarkReleaseEvidencePanel } from "@/features/benchmark/AdminBenchmarkReleaseEvidencePanel";
import { AdminBenchmarkHistoryEntryHeader } from "@/features/benchmark/AdminBenchmarkHistoryEntryHeader";
import { AdminBenchmarkRunNotePanel } from "@/features/benchmark/AdminBenchmarkRunNotePanel";
import { AdminBenchmarkResultGroups } from "@/features/benchmark/AdminBenchmarkResultGroups";
import { AdminBenchmarkCoverageGovernancePanel } from "@/features/benchmark/AdminBenchmarkCoverageGovernancePanel";
import { AdminBenchmarkHeatmapPanel } from "@/features/benchmark/AdminBenchmarkHeatmapPanel";
import {
  AdminBenchmarkHistoryPanel,
} from "@/features/benchmark/AdminBenchmarkHistoryPanel";
import { ProviderOpsAdminShell } from "@/features/providers/ProviderOpsAdminShell";
import { AdminProviderComparisonPanel } from "@/features/providers/AdminProviderComparisonPanel";
import { agentTargets as builtinAgentTargets } from "@/lib/agent/catalog";
import { useLocale } from "@/components/layout/LocaleProvider";
import { StudioIdentityBand } from "@/components/layout/StudioPageShell";
import { sanitizeDisplayPath } from "@/lib/agent/path-display";
import type { BenchmarkReleaseEvidenceSummary } from "@/features/benchmark/contracts";
import type { AdminCompatibilitySunsetEvidence } from "@/features/admin/compatibility-sunset";
import type { AdminCompatibilityDeletionManifest } from "@/features/admin/compatibility-deletion-manifest";
import type { ProviderOpsEvidenceSummary } from "@/features/providers/contracts";
import type {
  AgentBenchmarkReleaseEvidence,
  AgentMetricPercentiles,
  AgentProviderHealthDeskItem,
  AgentRuntimeLogSummary,
  AgentRuntimeStatus,
  AgentTarget
} from "@/lib/agent/types";

type MetricPercentiles = AgentMetricPercentiles;
const MAX_RUNTIME_METRIC_SAMPLES = 24;


function getDefaultBenchmarkTargetIds(targetIds: string[]) {
  const preferred = ["local-qwen3-0.6b", "local-qwen35-4b-4bit"].filter((id) => targetIds.includes(id));
  return preferred.length ? preferred : targetIds;
}

function summarizeBenchmarkRunNote(value: string, maxLength = 220) {
  const normalized = value
    .split("\n")
    .map((line) => line.replace(/^[#>\-\*\d\.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

type DashboardResponse = {
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

type RuntimeActionKind = "refresh" | "prewarm" | "release" | "restart" | "read_log";

export function AdminDashboard() {
  const { dictionary, locale } = useLocale();
  const [availableTargets, setAvailableTargets] = useState<AgentTarget[]>(builtinAgentTargets);
  const agentTargets = availableTargets;
  const benchmarkTargets = useMemo(() => agentTargets, [agentTargets]);
  const localTargets = useMemo(() => agentTargets.filter((target) => target.execution === "local"), [agentTargets]);
  const {
    selectedTargetId, setSelectedTargetId,
    providerFilter, setProviderFilter,
    providerProfileFilter, setProviderProfileFilter,
    benchmarkThinkingModeFilter, setBenchmarkThinkingModeFilter,
    benchmarkHistorySourceFilter, setBenchmarkHistorySourceFilter,
    modelFilter, setModelFilter,
    contextWindowFilter, setContextWindowFilter,
    compareTargetIds, setCompareTargetIds,
    benchmarkTargetIds, setBenchmarkTargetIds,
    benchmarkHeatmapMetric, setBenchmarkHeatmapMetric,
    benchmarkHeatmapWindowMinutes, setBenchmarkHeatmapWindowMinutes,
    benchmarkHeatmapPromptScope, setBenchmarkHeatmapPromptScope,
    benchmarkHeatmapSampleStatus, setBenchmarkHeatmapSampleStatus,
    windowMinutes, setWindowMinutes,
    autoRefresh, setAutoRefresh,
  } = useAdminDashboardFilterState({
    defaultBenchmarkTargetIds: getDefaultBenchmarkTargetIds(
      localTargets.map((target) => target.id),
    ),
  });
  const [runtimeStatuses, setRuntimeStatuses] = useState<Record<string, AgentRuntimeStatus | null>>({});
  const [runtimeMetricHistory, setRuntimeMetricHistory] = useState<Record<string, RuntimeMetricSample[]>>({});
  const [runtimeActionPending, setRuntimeActionPending] = useState<Record<string, RuntimeActionKind | "">>({});
  const [runtimeLogExcerpts, setRuntimeLogExcerpts] = useState<Record<string, string>>({});

  const [runtimeLogSummaries, setRuntimeLogSummaries] = useState<Record<string, AgentRuntimeLogSummary | null>>({});
  const [runtimeLogQueries, setRuntimeLogQueries] = useState<Record<string, string>>({});
  const [runtimeLogLimits, setRuntimeLogLimits] = useState<Record<string, number>>({});
  const [runtimeMessages, setRuntimeMessages] = useState<Record<string, string>>({});
  const {
    runtimeLastSwitchMs,
    setRuntimeLastSwitchMs,
    runtimeLastSwitchAt,
    setRuntimeLastSwitchAt,
  } = useAdminRuntimeSwitchHistory();
  const [runtimeGuardrailDraft, setRuntimeGuardrailDraft] = useState<RuntimeGuardrailStrategy>({
    cautionPeakRatio: 0.68,
    blockedPeakRatio: 0.82,
    cautionFreeMb: 6144,
    blockedFreeMb: 2048
  });
  const [runtimeGuardrailDefaults, setRuntimeGuardrailDefaults] = useState<RuntimeGuardrailStrategy>({
    cautionPeakRatio: 0.68,
    blockedPeakRatio: 0.82,
    cautionFreeMb: 6144,
    blockedFreeMb: 2048
  });
  const [runtimeGuardrailPending, setRuntimeGuardrailPending] = useState(false);
  const [runtimeGuardrailMessage, setRuntimeGuardrailMessage] = useState("");
  const [runtimeGuardrailPolicyFile, setRuntimeGuardrailPolicyFile] = useState("");
  const [prewarmAllPending, setPrewarmAllPending] = useState(false);
  const [prewarmAllMessage, setPrewarmAllMessage] = useState("");
  const [benchmarkCopyState, setBenchmarkCopyState] = useState<{ key: string; tone: "success" | "error" } | null>(null);
  const [benchmarkEvidencePendingRunId, setBenchmarkEvidencePendingRunId] = useState("");
  const benchmarkCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const {
    benchmarkProgress,
  } = useAdminBenchmarkProgressState({
    onCompleted: loadDashboard,
    onError: (message) => setError((current) => current || message),
  });
  const [compatibilityArchivePending, setCompatibilityArchivePending] =
    useState(false);
  const [compatibilityArchiveMessage, setCompatibilityArchiveMessage] =
    useState("");

  function recordRuntimeMetricSample(targetId: string, status: AgentRuntimeStatus) {
    const sample: RuntimeMetricSample = {
      timestamp: new Date().toISOString(),
      gatewayCpuPct: typeof status.gatewayCpuPct === "number" ? status.gatewayCpuPct : null,
      gatewayResidentMemoryMb:
        typeof status.gatewayResidentMemoryMb === "number" ? status.gatewayResidentMemoryMb : null,
      gatewayGpuPct: typeof status.gatewayGpuPct === "number" ? status.gatewayGpuPct : null,
      gatewayGpuMemoryMb: typeof status.gatewayGpuMemoryMb === "number" ? status.gatewayGpuMemoryMb : null,
      gatewayEnergySignalPct:
        typeof status.gatewayEnergySignalPct === "number" ? status.gatewayEnergySignalPct : null,
      gatewayDiskUsedPct: typeof status.gatewayDiskUsedPct === "number" ? status.gatewayDiskUsedPct : null,
      modelStorageFootprintMb:
        typeof status.modelStorageFootprintMb === "number" ? status.modelStorageFootprintMb : null
    };
    setRuntimeMetricHistory((current) => {
      const nextSamples = [...(current[targetId] || []), sample].slice(-MAX_RUNTIME_METRIC_SAMPLES);
      return {
        ...current,
        [targetId]: nextSamples
      };
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAvailableTargets() {
      try {
        const response = await fetch("/api/agent/targets", { cache: "no-store" });
        const payload = (await response.json()) as { targets?: AgentTarget[] };
        if (!response.ok || cancelled || !Array.isArray(payload.targets) || !payload.targets.length) return;
        setAvailableTargets(payload.targets);
      } catch {
        // keep builtin targets when sync fails
      }
    }

    void loadAvailableTargets();
    const timer = window.setInterval(() => {
      void loadAvailableTargets();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!agentTargets.length) return;
    if (!agentTargets.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(agentTargets[0].id);
    }
    setCompareTargetIds((current) => {
      const valid = current.filter((targetId) => agentTargets.some((target) => target.id === targetId));
      return valid.length ? valid : [agentTargets[0].id];
    });
    setBenchmarkTargetIds((current) => {
      const valid = current.filter((targetId) => agentTargets.some((target) => target.id === targetId));
      return valid.length ? valid : getDefaultBenchmarkTargetIds(localTargets.map((target) => target.id));
    });
  }, [agentTargets, localTargets, selectedTargetId]);

  const uiText = useMemo(() => {
    switch (locale) {
      case "zh-TW":
        return {
          concurrencyTrend: "並發趨勢",
          storageTrend: "儲存使用率",
          energyTrend: "能耗代理趨勢",
          latencyMs: "耗時 (ms)",
          tokens: "Token",
          status: "狀態",
          acPower: "交流電",
          batteryPower: "電池",
          provider: "提供方",
          providerProfile: "档位",
          modelFilter: "模型篩選",
          contextWindowFilter: "上下文體量",
          defaultContextWindow: "預設",
          contextWindowBreakdown: "上下文體量分布",
          benchmarkTitle: "模型 Benchmark",
          benchmarkPrompt: "基準提示詞",
          benchmarkPromptMode: "提示詞模式",
          benchmarkPromptModeCustom: "自訂提示詞",
          benchmarkPromptModeFixedSet: "固定 Prompt 集",
          benchmarkPromptModeDataset: "Dataset 模式",
          benchmarkPromptModeSuite: "正式評測集",
          benchmarkPromptModeOfficial: "官方口徑對照",
          benchmarkPromptSet: "Prompt 集",
          benchmarkDataset: "Dataset",
          benchmarkDatasetSampleLimit: "Dataset 取樣數",
          benchmarkDatasetSource: "Dataset 來源",
          benchmarkDatasetTaskCategory: "任務類型",
          benchmarkDatasetScoring: "評分方式",
          benchmarkSuite: "評測集",
          benchmarkComparisonObjective: "對照目標",
          benchmarkSuiteWorkloads: "評測工作負載",
          benchmarkSuiteTier: "評測層級",
          benchmarkFormalReport: "正式 Benchmark 報告工作負載",
          benchmarkPromptSetSummary: "固定 Prompt 集摘要",
          benchmarkPromptSetManage: "管理 Prompt 集",
          benchmarkPromptSetCreate: "新增 Prompt 集",
          benchmarkPromptSetUpdate: "更新 Prompt 集",
          benchmarkPromptSetEditCurrent: "编辑当前 Prompt 集",
          benchmarkPromptSetDeleteCurrent: "删除当前 Prompt 集",
          benchmarkPromptSetLabel: "Prompt 集名称",
          benchmarkPromptSetDescription: "说明",
          benchmarkPromptSetPrompts: "Prompt 列表（每行一条）",
          benchmarkPromptSetNoData: "当前没有 Prompt 集。",
          benchmarkPromptSetSaved: "Prompt 集已保存。",
          benchmarkPromptSetDeleted: "Prompt 集已删除。",
          benchmarkBaselinePanel: "回歸基線面板",
          benchmarkBaselineDefault: "預設基線",
          benchmarkBaselineSetDefault: "設為預設",
          benchmarkBaselineUseForComparison: "設為目前對比",
          benchmarkBaselineComparisonTarget: "目前對比基線",
          benchmarkBaselineRename: "重新命名",
          benchmarkBaselineDelete: "刪除",
          benchmarkBaselineNoData: "目前沒有符合條件的基線。",
          benchmarkHeatmapWindow: "熱力圖時間窗口",
          benchmarkHeatmapPromptScope: "熱力圖 Prompt 範圍",
          benchmarkHeatmapSampleStatus: "熱力圖樣本狀態",
          benchmarkHeatmapAllPrompts: "全部 Prompt",
          benchmarkHeatmapFixedPromptsOnly: "僅固定 Prompt 集",
          benchmarkRuns: "採樣次數",
          benchmarkTargets: "測試目標",
          benchmarkProviderProfile: "Benchmark 檔位",
          benchmarkThinkingMode: "Benchmark 思考模式",
          benchmarkThinkingModeFilter: "Benchmark 思考模式過濾",
          benchmarkBatchProfiles: "遠端批次對照",
          benchmarkBatchProfilesHint: "對遠端目標一次跑 speed / balanced / tool-first / thinking 四組對照。",
          benchmarkBatchScope: "批次範圍",
          benchmarkBatchScopeHint: "完整套件適合正式深度對比；對比子集更適合快速看不同 profile 的差異。",
          benchmarkBatchScopeFull: "完整套件",
          benchmarkBatchScopeSubset: "對比子集",
          benchmarkProgress: "Benchmark 進度",
          benchmarkProgressEta: "預計剩餘",
          benchmarkProgressElapsed: "已執行",
          benchmarkProgressCurrent: "最近完成",
          benchmarkProgressCompleted: "已完成樣本",
          benchmarkHeatmap: "Benchmark 交叉熱力圖",
          benchmarkHeatmapMetric: "熱力圖指標",
          saveBaseline: "儲存 Baseline",
          savingBaseline: "儲存中...",
          baselineSaved: "Baseline 已儲存。",
          latestBaseline: "最新 Baseline",
          benchmarkBaselineDelta: "Baseline 差值",
          benchmarkNoBaselineComparison: "目前沒有可比對的 Baseline 結果。",
          compareLastRun: "對比上次結果",
          benchmarkThinkingStandard: "標準",
          benchmarkThinkingThinking: "Thinking / 滿血版",
          benchmarkScore: "質量分數",
          benchmarkPassRate: "通過率",
          runBenchmark: "執行 Benchmark",
          benchmarking: "Benchmark 中...",
          benchmarkNoData: "尚未執行本地 Benchmark",
          benchmarkHistory: "Benchmark 歷史",
          benchmarkTrendTitle: "Benchmark 趨勢",
          benchmarkSuccessRate: "成功率",
          exportMarkdown: "導出 Markdown",
          exportJson: "導出 JSON",
          exportRegressionReport: "导出回归报告",
          percentiles: "分位數",
          exportWindow: "導出時間窗口",
          sampleFilter: "樣本篩選",
          allSamples: "全部樣本",
          successSamples: "成功樣本",
          failedSamples: "失敗樣本",
          historyFilter: "歷史記錄篩選",
          allHistory: "全部記錄",
          successHistory: "僅成功記錄",
          failedHistory: "僅失敗記錄",
          compareView: "對比視圖",
          compareTargets: "對比目標",
          firstTokenLatency: "首字延時",
          totalLatency: "總耗時",
          tokenThroughput: "Token 吞吐",
          tokensPerSecond: "Token/秒",
          latencySplit: "上游首字 vs 應用總耗時",
          appOverhead: "應用層額外耗時",
          runtimeOps: "本地執行時運維",
          runtimeOpsHint: "直接查看本地模型網關狀態，並執行預熱、釋放、重啟與日誌讀取。",
          runtimeRefresh: "刷新執行時",
          runtimeRefreshing: "刷新中...",
          runtimePrewarmAll: "全部預熱",
          runtimePrewarm: "預熱模型",
          runtimeRelease: "釋放模型",
          runtimeRestart: "重啟網關",
          runtimeReadLog: "查看日誌",
          loadedAlias: "已載入別名",
          runtimeCurrentLoaded: "當前已載入",
          runtimeSwitchingNow: "正在切模",
          runtimeLastSwitchLoad: "最近切換耗時",
          runtimeLastSwitchAt: "最近切模時間",
          queueLabel: "佇列",
          activeLabel: "活躍",
          runtimeSupervisor: "Supervisor",
          runtimeGateway: "Gateway",
          runtimeRestartCount: "重啟次數",
          runtimeLastStart: "上次啟動",
          runtimeLastExit: "上次退出",
          runtimeLastExitCode: "退出碼",
          runtimeLastEvent: "最新事件",
          runtimeEnsureReason: "最近啟動原因",
          runtimeLog: "網關日誌",
          runtimeNoLog: "目前沒有已載入的日誌內容。",
          runtimeLogPath: "日誌路徑",
          runtimeGuardrailPolicy: "載入保護策略",
          runtimeGuardrailHint: "把本地模型載入風險閾值做成後台可調策略，供風險 badge、單模型預熱與全部預熱共用。",
          runtimeGuardrailSave: "保存策略",
          runtimeGuardrailReset: "恢復默認值",
          runtimeGuardrailCautionPeakRatio: "謹慎峰值比例",
          runtimeGuardrailBlockedPeakRatio: "阻止峰值比例",
          runtimeGuardrailCautionFreeMb: "謹慎剩餘記憶體 MB",
          runtimeGuardrailBlockedFreeMb: "阻止剩餘記憶體 MB",
          runtimeGuardrailPolicyFile: "策略檔"
        };
      case "ko":
        return {
          concurrencyTrend: "동시성 추세",
          storageTrend: "저장소 사용률",
          energyTrend: "에너지 프록시 추세",
          latencyMs: "지연 (ms)",
          tokens: "Token",
          status: "상태",
          acPower: "AC 전원",
          batteryPower: "배터리",
          provider: "제공자",
          providerProfile: "프로필",
          modelFilter: "모델 필터",
          contextWindowFilter: "컨텍스트 크기",
          defaultContextWindow: "기본값",
          contextWindowBreakdown: "컨텍스트 크기 분포",
          benchmarkTitle: "모델 Benchmark",
          benchmarkPrompt: "벤치마크 프롬프트",
          benchmarkPromptMode: "프롬프트 모드",
          benchmarkPromptModeCustom: "사용자 정의 프롬프트",
          benchmarkPromptModeFixedSet: "고정 프롬프트 세트",
          benchmarkPromptModeDataset: "Dataset 모드",
          benchmarkPromptModeSuite: "정식 평가 세트",
          benchmarkPromptModeOfficial: "공식 비교 모드",
          benchmarkPromptSet: "프롬프트 세트",
          benchmarkDataset: "Dataset",
          benchmarkDatasetSampleLimit: "Dataset 샘플 수",
          benchmarkDatasetSource: "Dataset 출처",
          benchmarkDatasetTaskCategory: "작업 유형",
          benchmarkDatasetScoring: "평가 방식",
          benchmarkSuite: "평가 세트",
          benchmarkComparisonObjective: "비교 목표",
          benchmarkSuiteWorkloads: "평가 워크로드",
          benchmarkSuiteTier: "평가 계층",
          benchmarkFormalReport: "정식 Benchmark 보고서 워크로드",
          benchmarkPromptSetSummary: "고정 프롬프트 세트 요약",
          benchmarkPromptSetManage: "프롬프트 세트 관리",
          benchmarkPromptSetCreate: "프롬프트 세트 추가",
          benchmarkPromptSetUpdate: "프롬프트 세트 업데이트",
          benchmarkPromptSetEditCurrent: "현재 프롬프트 세트 편집",
          benchmarkPromptSetDeleteCurrent: "현재 프롬프트 세트 삭제",
          benchmarkPromptSetLabel: "프롬프트 세트 이름",
          benchmarkPromptSetDescription: "설명",
          benchmarkPromptSetPrompts: "프롬프트 목록(한 줄에 하나씩)",
          benchmarkPromptSetNoData: "프롬프트 세트가 없습니다.",
          benchmarkPromptSetSaved: "프롬프트 세트를 저장했습니다.",
          benchmarkPromptSetDeleted: "프롬프트 세트를 삭제했습니다.",
          benchmarkBaselinePanel: "회귀 베이스라인 패널",
          benchmarkBaselineDefault: "기본 베이스라인",
          benchmarkBaselineSetDefault: "기본값으로 설정",
          benchmarkBaselineUseForComparison: "현재 비교 대상으로 사용",
          benchmarkBaselineComparisonTarget: "현재 비교 베이스라인",
          benchmarkBaselineRename: "이름 변경",
          benchmarkBaselineDelete: "삭제",
          benchmarkBaselineNoData: "조건에 맞는 베이스라인이 없습니다.",
          benchmarkHeatmapWindow: "히트맵 시간 창",
          benchmarkHeatmapPromptScope: "히트맵 프롬프트 범위",
          benchmarkHeatmapSampleStatus: "히트맵 샘플 상태",
          benchmarkHeatmapAllPrompts: "모든 프롬프트",
          benchmarkHeatmapFixedPromptsOnly: "고정 프롬프트 세트만",
          benchmarkRuns: "샘플 수",
          benchmarkTargets: "대상",
          benchmarkProviderProfile: "Benchmark 프로필",
          benchmarkThinkingMode: "Benchmark 사고 모드",
          benchmarkThinkingModeFilter: "Benchmark 사고 모드 필터",
          benchmarkBatchProfiles: "원격 일괄 비교",
          benchmarkBatchProfilesHint: "원격 대상에 대해 speed / balanced / tool-first / thinking 네 조합을 한 번에 실행합니다.",
          benchmarkBatchScope: "배치 범위",
          benchmarkBatchScopeHint: "전체 세트는 정식 심층 비교용, 비교 서브셋은 profile 차이를 빠르게 보는 용도입니다.",
          benchmarkBatchScopeFull: "전체 세트",
          benchmarkBatchScopeSubset: "비교 서브셋",
          benchmarkProgress: "Benchmark 진행률",
          benchmarkProgressEta: "예상 남은 시간",
          benchmarkProgressElapsed: "경과 시간",
          benchmarkProgressCurrent: "최근 완료",
          benchmarkProgressCompleted: "완료 샘플",
          benchmarkHeatmap: "Benchmark 교차 히트맵",
          benchmarkHeatmapMetric: "히트맵 지표",
          saveBaseline: "베이스라인 저장",
          savingBaseline: "저장 중...",
          baselineSaved: "베이스라인을 저장했습니다.",
          latestBaseline: "최신 베이스라인",
          benchmarkBaselineDelta: "Baseline 차이",
          benchmarkNoBaselineComparison: "비교 가능한 Baseline 결과가 없습니다.",
          compareLastRun: "직전 결과 비교",
          benchmarkThinkingStandard: "표준",
          benchmarkThinkingThinking: "Thinking / 풀 버전",
          benchmarkScore: "품질 점수",
          benchmarkPassRate: "통과율",
          runBenchmark: "Benchmark 실행",
          benchmarking: "Benchmark 실행 중...",
          benchmarkNoData: "아직 로컬 Benchmark 결과가 없습니다.",
          benchmarkHistory: "Benchmark 기록",
          benchmarkTrendTitle: "Benchmark 추세",
          benchmarkSuccessRate: "성공률",
          exportMarkdown: "Markdown 내보내기",
          exportJson: "JSON 내보내기",
          exportRegressionReport: "회귀 보고서 내보내기",
          percentiles: "분위수",
          exportWindow: "내보내기 시간 창",
          sampleFilter: "샘플 필터",
          allSamples: "전체 샘플",
          successSamples: "성공 샘플",
          failedSamples: "실패 샘플",
          historyFilter: "기록 필터",
          allHistory: "전체 기록",
          successHistory: "성공 기록만",
          failedHistory: "실패 기록만",
          compareView: "비교 보기",
          compareTargets: "비교 대상",
          firstTokenLatency: "첫 토큰 지연",
          totalLatency: "총 지연",
          tokenThroughput: "Token 처리량",
          tokensPerSecond: "Token/초",
          latencySplit: "업스트림 첫 토큰 vs 앱 총 지연",
          appOverhead: "앱 추가 지연",
          runtimeOps: "로컬 런타임 운용",
          runtimeOpsHint: "로컬 모델 게이트웨이 상태를 보고 예열, 해제, 재시작, 로그 확인을 수행합니다.",
          runtimeRefresh: "런타임 새로고침",
          runtimeRefreshing: "새로고침 중...",
          runtimePrewarmAll: "전체 예열",
          runtimePrewarm: "모델 예열",
          runtimeRelease: "모델 해제",
          runtimeRestart: "게이트웨이 재시작",
          runtimeReadLog: "로그 보기",
          loadedAlias: "로드된 별칭",
          runtimeCurrentLoaded: "현재 로드됨",
          runtimeSwitchingNow: "전환 중",
          runtimeLastSwitchLoad: "최근 전환 시간",
          runtimeLastSwitchAt: "최근 전환 시각",
          queueLabel: "대기열",
          activeLabel: "활성",
          runtimeSupervisor: "Supervisor",
          runtimeGateway: "Gateway",
          runtimeRestartCount: "재시작 횟수",
          runtimeLastStart: "마지막 시작",
          runtimeLastExit: "마지막 종료",
          runtimeLastExitCode: "종료 코드",
          runtimeLastEvent: "최근 이벤트",
          runtimeEnsureReason: "최근 ensure 사유",
          runtimeLog: "게이트웨이 로그",
          runtimeNoLog: "불러온 로그가 없습니다.",
          runtimeLogPath: "로그 경로",
          runtimeGuardrailPolicy: "로드 가드레일 정책",
          runtimeGuardrailHint: "로컬 모델 로드 임계값을 시각적으로 조정하고, 위험 배지와 예열 경로에 공통으로 적용합니다.",
          runtimeGuardrailSave: "정책 저장",
          runtimeGuardrailReset: "기본값 복원",
          runtimeGuardrailCautionPeakRatio: "주의 peak ratio",
          runtimeGuardrailBlockedPeakRatio: "차단 peak ratio",
          runtimeGuardrailCautionFreeMb: "주의 free MB",
          runtimeGuardrailBlockedFreeMb: "차단 free MB",
          runtimeGuardrailPolicyFile: "정책 파일"
        };
      case "ja":
        return {
          concurrencyTrend: "同時実行推移",
          storageTrend: "ストレージ使用率",
          energyTrend: "エネルギー代理推移",
          latencyMs: "遅延 (ms)",
          tokens: "Token",
          status: "状態",
          acPower: "AC 電源",
          batteryPower: "バッテリー",
          provider: "提供元",
          providerProfile: "プロファイル",
          modelFilter: "モデル絞り込み",
          contextWindowFilter: "コンテキスト量",
          defaultContextWindow: "既定値",
          contextWindowBreakdown: "コンテキスト量分布",
          benchmarkTitle: "モデル Benchmark",
          benchmarkPrompt: "ベンチマーク用プロンプト",
          benchmarkPromptMode: "プロンプトモード",
          benchmarkPromptModeCustom: "カスタムプロンプト",
          benchmarkPromptModeFixedSet: "固定プロンプトセット",
          benchmarkPromptModeDataset: "Dataset モード",
          benchmarkPromptModeSuite: "正式評価セット",
          benchmarkPromptModeOfficial: "公式比較モード",
          benchmarkPromptSet: "プロンプトセット",
          benchmarkDataset: "Dataset",
          benchmarkDatasetSampleLimit: "Dataset サンプル数",
          benchmarkDatasetSource: "Dataset 出典",
          benchmarkDatasetTaskCategory: "タスク種別",
          benchmarkDatasetScoring: "評価方式",
          benchmarkSuite: "評価セット",
          benchmarkComparisonObjective: "比較目的",
          benchmarkSuiteWorkloads: "評価ワークロード",
          benchmarkSuiteTier: "評価階層",
          benchmarkFormalReport: "正式 Benchmark レポート負荷",
          benchmarkPromptSetSummary: "固定プロンプトセット概要",
          benchmarkPromptSetManage: "プロンプトセット管理",
          benchmarkPromptSetCreate: "プロンプトセットを追加",
          benchmarkPromptSetUpdate: "プロンプトセットを更新",
          benchmarkPromptSetEditCurrent: "現在のプロンプトセットを編集",
          benchmarkPromptSetDeleteCurrent: "現在のプロンプトセットを削除",
          benchmarkPromptSetLabel: "プロンプトセット名",
          benchmarkPromptSetDescription: "説明",
          benchmarkPromptSetPrompts: "プロンプト一覧（1行1件）",
          benchmarkPromptSetNoData: "プロンプトセットがありません。",
          benchmarkPromptSetSaved: "プロンプトセットを保存しました。",
          benchmarkPromptSetDeleted: "プロンプトセットを削除しました。",
          benchmarkBaselinePanel: "回帰ベースラインパネル",
          benchmarkBaselineDefault: "既定ベースライン",
          benchmarkBaselineSetDefault: "既定に設定",
          benchmarkBaselineUseForComparison: "現在の比較対象に設定",
          benchmarkBaselineComparisonTarget: "現在の比較ベースライン",
          benchmarkBaselineRename: "名前変更",
          benchmarkBaselineDelete: "削除",
          benchmarkBaselineNoData: "条件に一致するベースラインがありません。",
          benchmarkHeatmapWindow: "ヒートマップ時間窓",
          benchmarkHeatmapPromptScope: "ヒートマップ Prompt 範囲",
          benchmarkHeatmapSampleStatus: "ヒートマップのサンプル状態",
          benchmarkHeatmapAllPrompts: "すべての Prompt",
          benchmarkHeatmapFixedPromptsOnly: "固定 Prompt セットのみ",
          benchmarkRuns: "サンプル回数",
          benchmarkTargets: "対象",
          benchmarkProviderProfile: "Benchmark プロファイル",
          benchmarkThinkingMode: "Benchmark Thinking モード",
          benchmarkThinkingModeFilter: "Benchmark Thinking モードフィルター",
          benchmarkBatchProfiles: "リモート一括比較",
          benchmarkBatchProfilesHint: "リモート対象に対して speed / balanced / tool-first / thinking の4通りをまとめて実行します。",
          benchmarkBatchScope: "バッチ範囲",
          benchmarkBatchScopeHint: "完全セットは正式な深掘り比較用、比較サブセットは profile 差分の高速確認用です。",
          benchmarkBatchScopeFull: "完全セット",
          benchmarkBatchScopeSubset: "比較サブセット",
          benchmarkProgress: "Benchmark 進捗",
          benchmarkProgressEta: "残り見込み",
          benchmarkProgressElapsed: "経過時間",
          benchmarkProgressCurrent: "直近完了",
          benchmarkProgressCompleted: "完了サンプル",
          benchmarkHeatmap: "Benchmark 交差ヒートマップ",
          benchmarkHeatmapMetric: "ヒートマップ指標",
          saveBaseline: "Baseline を保存",
          savingBaseline: "保存中...",
          baselineSaved: "Baseline を保存しました。",
          latestBaseline: "最新 Baseline",
          benchmarkBaselineDelta: "Baseline 差分",
          benchmarkNoBaselineComparison: "比較可能な Baseline 結果がありません。",
          compareLastRun: "前回結果との差分",
          benchmarkThinkingStandard: "標準",
          benchmarkThinkingThinking: "Thinking / フル版",
          benchmarkScore: "品質スコア",
          benchmarkPassRate: "通過率",
          runBenchmark: "Benchmark 実行",
          benchmarking: "Benchmark 実行中...",
          benchmarkNoData: "ローカル Benchmark の結果はまだありません。",
          benchmarkHistory: "Benchmark 履歴",
          benchmarkTrendTitle: "Benchmark 推移",
          benchmarkSuccessRate: "成功率",
          exportMarkdown: "Markdown を出力",
          exportJson: "JSON を出力",
          exportRegressionReport: "回帰レポートを出力",
          percentiles: "パーセンタイル",
          exportWindow: "出力時間ウィンドウ",
          sampleFilter: "サンプルフィルター",
          allSamples: "全サンプル",
          successSamples: "成功サンプル",
          failedSamples: "失敗サンプル",
          historyFilter: "履歴フィルター",
          allHistory: "全履歴",
          successHistory: "成功履歴のみ",
          failedHistory: "失敗履歴のみ",
          compareView: "比較ビュー",
          compareTargets: "比較対象",
          firstTokenLatency: "初回トークン遅延",
          totalLatency: "総遅延",
          tokenThroughput: "Token スループット",
          tokensPerSecond: "Token/秒",
          latencySplit: "上流の初回トークン vs アプリ総遅延",
          appOverhead: "アプリ追加遅延",
          runtimeOps: "ローカル実行環境運用",
          runtimeOpsHint: "ローカルモデルゲートウェイの状態を確認し、予熱・解放・再起動・ログ確認を行います。",
          runtimeRefresh: "実行環境を更新",
          runtimeRefreshing: "更新中...",
          runtimePrewarmAll: "すべて予熱",
          runtimePrewarm: "モデルを予熱",
          runtimeRelease: "モデルを解放",
          runtimeRestart: "ゲートウェイ再起動",
          runtimeReadLog: "ログを表示",
          loadedAlias: "読み込み済み別名",
          runtimeCurrentLoaded: "現在読み込み済み",
          runtimeSwitchingNow: "切り替え中",
          runtimeLastSwitchLoad: "直近切替時間",
          runtimeLastSwitchAt: "直近切替時刻",
          queueLabel: "キュー",
          activeLabel: "アクティブ",
          runtimeSupervisor: "Supervisor",
          runtimeGateway: "Gateway",
          runtimeRestartCount: "再起動回数",
          runtimeLastStart: "最終起動",
          runtimeLastExit: "最終終了",
          runtimeLastExitCode: "終了コード",
          runtimeLastEvent: "最新イベント",
          runtimeEnsureReason: "直近の起動理由",
          runtimeLog: "ゲートウェイログ",
          runtimeNoLog: "読み込まれたログはありません。",
          runtimeLogPath: "ログパス",
          runtimeGuardrailPolicy: "ロードガードレールポリシー",
          runtimeGuardrailHint: "ローカルモデルのロード閾値を視覚的に調整し、リスク表示と予熱経路で共通利用します。",
          runtimeGuardrailSave: "ポリシーを保存",
          runtimeGuardrailReset: "既定値に戻す",
          runtimeGuardrailCautionPeakRatio: "注意ピーク比率",
          runtimeGuardrailBlockedPeakRatio: "ブロックピーク比率",
          runtimeGuardrailCautionFreeMb: "注意 free MB",
          runtimeGuardrailBlockedFreeMb: "ブロック free MB",
          runtimeGuardrailPolicyFile: "ポリシーファイル"
        };
      case "en":
        return {
          concurrencyTrend: "Concurrency trend",
          storageTrend: "Storage usage",
          energyTrend: "Energy proxy trend",
          latencyMs: "Latency (ms)",
          tokens: "Tokens",
          status: "Status",
          acPower: "AC Power",
          batteryPower: "Battery",
          provider: "Provider",
          providerProfile: "Profile",
          modelFilter: "Model filter",
          contextWindowFilter: "Context window",
          defaultContextWindow: "Default",
          contextWindowBreakdown: "Context window breakdown",
          benchmarkTitle: "Model benchmark",
          benchmarkPrompt: "Benchmark prompt",
          benchmarkPromptMode: "Prompt mode",
          benchmarkPromptModeCustom: "Custom prompt",
          benchmarkPromptModeFixedSet: "Fixed prompt set",
          benchmarkPromptModeDataset: "Dataset mode",
          benchmarkPromptModeSuite: "Formal suite",
          benchmarkPromptModeOfficial: "Official comparison mode",
          benchmarkPromptSet: "Prompt set",
          benchmarkDataset: "Dataset",
          benchmarkDatasetSampleLimit: "Dataset samples",
          benchmarkDatasetSource: "Dataset source",
          benchmarkDatasetTaskCategory: "Task category",
          benchmarkDatasetScoring: "Scoring",
          benchmarkSuite: "Evaluation suite",
          benchmarkComparisonObjective: "Comparison objective",
          benchmarkSuiteWorkloads: "Suite workloads",
          benchmarkSuiteTier: "Suite tier",
          benchmarkFormalReport: "Formal benchmark workload",
          benchmarkPromptSetSummary: "Fixed prompt set summary",
          benchmarkPromptSetManage: "Manage prompt sets",
          benchmarkPromptSetCreate: "Create prompt set",
          benchmarkPromptSetUpdate: "Update prompt set",
          benchmarkPromptSetEditCurrent: "Edit current prompt set",
          benchmarkPromptSetDeleteCurrent: "Delete current prompt set",
          benchmarkPromptSetLabel: "Prompt set label",
          benchmarkPromptSetDescription: "Description",
          benchmarkPromptSetPrompts: "Prompt list (one per line)",
          benchmarkPromptSetNoData: "No prompt sets yet.",
          benchmarkPromptSetSaved: "Prompt set saved.",
          benchmarkPromptSetDeleted: "Prompt set deleted.",
          benchmarkBaselinePanel: "Regression baseline panel",
          benchmarkBaselineDefault: "Default baseline",
          benchmarkBaselineSetDefault: "Set default",
          benchmarkBaselineUseForComparison: "Use for comparison",
          benchmarkBaselineComparisonTarget: "Current comparison baseline",
          benchmarkBaselineRename: "Rename",
          benchmarkBaselineDelete: "Delete",
          benchmarkBaselineNoData: "No matching baselines yet.",
          benchmarkHeatmapWindow: "Heatmap window",
          benchmarkHeatmapPromptScope: "Heatmap prompt scope",
          benchmarkHeatmapSampleStatus: "Heatmap sample status",
          benchmarkHeatmapAllPrompts: "All prompts",
          benchmarkHeatmapFixedPromptsOnly: "Fixed prompt sets only",
          benchmarkRuns: "Runs",
          benchmarkTargets: "Targets",
          benchmarkProviderProfile: "Benchmark profile",
          benchmarkThinkingMode: "Benchmark thinking mode",
          benchmarkThinkingModeFilter: "Benchmark thinking filter",
          benchmarkBatchProfiles: "Remote batch compare",
          benchmarkBatchProfilesHint: "Run speed / balanced / tool-first / thinking in one batch for remote targets.",
          benchmarkBatchScope: "Batch scope",
          benchmarkBatchScopeHint: "Use full suite for formal deep comparisons, or comparison subset to quickly contrast remote profiles.",
          benchmarkBatchScopeFull: "Full suite",
          benchmarkBatchScopeSubset: "Comparison subset",
          benchmarkProgress: "Benchmark progress",
          benchmarkProgressEta: "ETA",
          benchmarkProgressElapsed: "Elapsed",
          benchmarkProgressCurrent: "Last completed",
          benchmarkProgressCompleted: "Completed samples",
          benchmarkHeatmap: "Benchmark cross heatmap",
          benchmarkHeatmapMetric: "Heatmap metric",
          saveBaseline: "Save baseline",
          savingBaseline: "Saving...",
          baselineSaved: "Baseline saved.",
          latestBaseline: "Latest baseline",
          benchmarkBaselineDelta: "Baseline delta",
          benchmarkNoBaselineComparison: "No comparable baseline results yet.",
          compareLastRun: "Compare with previous run",
          benchmarkThinkingStandard: "Standard",
          benchmarkThinkingThinking: "Thinking / full model",
          benchmarkScore: "Quality score",
          benchmarkPassRate: "Pass rate",
          runBenchmark: "Run benchmark",
          benchmarking: "Benchmarking...",
          benchmarkNoData: "No local benchmark results yet.",
          benchmarkHistory: "Benchmark history",
          benchmarkTrendTitle: "Benchmark trends",
          benchmarkSuccessRate: "Success rate",
          exportMarkdown: "Export Markdown",
          exportJson: "Export JSON",
          exportRegressionReport: "Export regression report",
          percentiles: "Percentiles",
          exportWindow: "Export window",
          sampleFilter: "Sample filter",
          allSamples: "All samples",
          successSamples: "Successful samples",
          failedSamples: "Failed samples",
          historyFilter: "History filter",
          allHistory: "All history",
          successHistory: "Successful history only",
          failedHistory: "Failed history only",
          compareView: "Comparison view",
          compareTargets: "Comparison targets",
          firstTokenLatency: "First-token latency",
          totalLatency: "Total latency",
          tokenThroughput: "Token throughput",
          tokensPerSecond: "tokens/s",
          latencySplit: "Upstream first token vs app total latency",
          appOverhead: "App overhead",
          runtimeOps: "Local runtime ops",
          runtimeOpsHint: "Inspect the local gateway and run prewarm, release, restart, and log actions.",
          runtimeRefresh: "Refresh runtime",
          runtimeRefreshing: "Refreshing...",
          runtimePrewarmAll: "Prewarm all",
          runtimePrewarm: "Prewarm model",
          runtimeRelease: "Release model",
          runtimeRestart: "Restart gateway",
          runtimeReadLog: "View log",
          loadedAlias: "Loaded alias",
          runtimeCurrentLoaded: "Currently loaded",
          runtimeSwitchingNow: "Switching now",
          runtimeLastSwitchLoad: "Last switch time",
          runtimeLastSwitchAt: "Last switch at",
          queueLabel: "Queue",
          activeLabel: "Active",
          runtimeSupervisor: "Supervisor",
          runtimeGateway: "Gateway",
          runtimeRestartCount: "Restart count",
          runtimeLastStart: "Last start",
          runtimeLastExit: "Last exit",
          runtimeLastExitCode: "Exit code",
          runtimeLastEvent: "Latest event",
          runtimeEnsureReason: "Last ensure reason",
          runtimeLog: "Gateway log",
          runtimeNoLog: "No log excerpt loaded.",
          runtimeLogPath: "Log path",
          runtimeGuardrailPolicy: "Load guardrail policy",
          runtimeGuardrailHint: "Tune local model load thresholds here so risk badges, single-model prewarm, and prewarm-all all use the same policy.",
          runtimeGuardrailSave: "Save policy",
          runtimeGuardrailReset: "Reset defaults",
          runtimeGuardrailCautionPeakRatio: "Caution peak ratio",
          runtimeGuardrailBlockedPeakRatio: "Blocked peak ratio",
          runtimeGuardrailCautionFreeMb: "Caution free MB",
          runtimeGuardrailBlockedFreeMb: "Blocked free MB",
          runtimeGuardrailPolicyFile: "Policy file"
        };
      case "zh-CN":
      default:
        return {
          concurrencyTrend: "并发趋势",
          storageTrend: "存储使用率",
          energyTrend: "能耗代理趋势",
          latencyMs: "耗时 (ms)",
          tokens: "Token",
          status: "状态",
          acPower: "交流电",
          batteryPower: "电池",
          provider: "提供方",
          providerProfile: "档位",
          modelFilter: "模型筛选",
          contextWindowFilter: "上下文体量",
          defaultContextWindow: "默认",
          contextWindowBreakdown: "上下文体量分布",
          benchmarkTitle: "模型 Benchmark",
          benchmarkPrompt: "基准提示词",
          benchmarkPromptMode: "提示词模式",
          benchmarkPromptModeCustom: "自定义提示词",
          benchmarkPromptModeFixedSet: "固定 Prompt 集",
          benchmarkPromptModeDataset: "Dataset 模式",
          benchmarkPromptModeSuite: "正式评测集",
          benchmarkPromptModeOfficial: "官方口径对照",
          benchmarkPromptSet: "Prompt 集",
          benchmarkDataset: "Dataset",
          benchmarkDatasetSampleLimit: "Dataset 采样数",
          benchmarkDatasetSource: "Dataset 来源",
          benchmarkDatasetTaskCategory: "任务类型",
          benchmarkDatasetScoring: "评分方式",
          benchmarkSuite: "评测集",
          benchmarkComparisonObjective: "对照目标",
          benchmarkSuiteWorkloads: "评测工作负载",
          benchmarkSuiteTier: "评测层级",
          benchmarkFormalReport: "正式 Benchmark 报告工作负载",
          benchmarkPromptSetSummary: "固定 Prompt 集摘要",
          benchmarkPromptSetManage: "管理 Prompt 集",
          benchmarkPromptSetCreate: "新增 Prompt 集",
          benchmarkPromptSetUpdate: "更新 Prompt 集",
          benchmarkPromptSetEditCurrent: "编辑当前 Prompt 集",
          benchmarkPromptSetDeleteCurrent: "删除当前 Prompt 集",
          benchmarkPromptSetLabel: "Prompt 集名称",
          benchmarkPromptSetDescription: "说明",
          benchmarkPromptSetPrompts: "Prompt 列表（每行一条）",
          benchmarkPromptSetNoData: "当前没有 Prompt 集。",
          benchmarkPromptSetSaved: "Prompt 集已保存。",
          benchmarkPromptSetDeleted: "Prompt 集已删除。",
          benchmarkBaselinePanel: "回归基线面板",
          benchmarkBaselineDefault: "默认基线",
          benchmarkBaselineSetDefault: "设为默认",
          benchmarkBaselineUseForComparison: "设为当前对比",
          benchmarkBaselineComparisonTarget: "当前对比基线",
          benchmarkBaselineRename: "重命名",
          benchmarkBaselineDelete: "删除",
          benchmarkBaselineNoData: "当前没有符合条件的基线。",
          benchmarkHeatmapWindow: "热力图时间窗口",
          benchmarkHeatmapPromptScope: "热力图 Prompt 范围",
          benchmarkHeatmapSampleStatus: "热力图样本状态",
          benchmarkHeatmapAllPrompts: "全部 Prompt",
          benchmarkHeatmapFixedPromptsOnly: "仅固定 Prompt 集",
          benchmarkRuns: "采样次数",
          benchmarkTargets: "测试目标",
          benchmarkProviderProfile: "Benchmark 档位",
          benchmarkThinkingMode: "Benchmark 思考模式",
          benchmarkThinkingModeFilter: "Benchmark 思考模式筛选",
          benchmarkBatchProfiles: "远端批量对照",
          benchmarkBatchProfilesHint: "对远端目标一次跑 speed / balanced / tool-first / thinking 四组对照。",
          benchmarkBatchScope: "批量范围",
          benchmarkBatchScopeHint: "完整套件适合正式深度对比；对比子集更适合快速看不同 profile 的差异。",
          benchmarkBatchScopeFull: "完整套件",
          benchmarkBatchScopeSubset: "对比子集",
          benchmarkProgress: "Benchmark 进度",
          benchmarkProgressEta: "预计剩余",
          benchmarkProgressElapsed: "已执行",
          benchmarkProgressCurrent: "最近完成",
          benchmarkProgressCompleted: "已完成样本",
          benchmarkHeatmap: "Benchmark 交叉热力图",
          benchmarkHeatmapMetric: "热力图指标",
          saveBaseline: "保存 Baseline",
          savingBaseline: "保存中...",
          baselineSaved: "Baseline 已保存。",
          latestBaseline: "最新 Baseline",
          benchmarkBaselineDelta: "Baseline 差值",
          benchmarkNoBaselineComparison: "当前没有可对比的 Baseline 结果。",
          compareLastRun: "对比上次结果",
          benchmarkThinkingStandard: "标准",
          benchmarkThinkingThinking: "Thinking / 满血版",
          benchmarkScore: "质量分数",
          benchmarkPassRate: "通过率",
          runBenchmark: "执行 Benchmark",
          benchmarking: "Benchmark 中...",
          benchmarkNoData: "还没有本地 Benchmark 结果",
          benchmarkHistory: "Benchmark 历史",
          benchmarkTrendTitle: "Benchmark 趋势",
          benchmarkSuccessRate: "成功率",
          exportMarkdown: "导出 Markdown",
          exportJson: "导出 JSON",
          exportRegressionReport: "导出回归报告",
          percentiles: "分位数",
          exportWindow: "导出时间窗口",
          sampleFilter: "样本筛选",
          allSamples: "全部样本",
          successSamples: "成功样本",
          failedSamples: "失败样本",
          historyFilter: "历史记录筛选",
          allHistory: "全部记录",
          successHistory: "仅成功记录",
          failedHistory: "仅失败记录",
          compareView: "对比视图",
          compareTargets: "对比目标",
          firstTokenLatency: "首字延时",
          totalLatency: "总耗时",
          tokenThroughput: "Token 吞吐",
          tokensPerSecond: "Token/秒",
          latencySplit: "上游首字 vs 应用总耗时",
          appOverhead: "应用层额外耗时",
          runtimeOps: "本地运行时运维",
          runtimeOpsHint: "直接查看本地模型网关状态，并执行预热、释放、重启与日志读取。",
          runtimeRefresh: "刷新运行时",
          runtimeRefreshing: "刷新中...",
          runtimePrewarmAll: "全部预热",
          runtimePrewarm: "预热模型",
          runtimeRelease: "释放模型",
          runtimeRestart: "重启网关",
          runtimeReadLog: "查看日志",
          loadedAlias: "已加载别名",
          runtimeCurrentLoaded: "当前已加载",
          runtimeSwitchingNow: "正在切模",
          runtimeLastSwitchLoad: "最近切换耗时",
          runtimeLastSwitchAt: "最近切模时间",
          queueLabel: "队列",
          activeLabel: "活跃",
          runtimeSupervisor: "Supervisor",
          runtimeGateway: "Gateway",
          runtimeRestartCount: "重启次数",
          runtimeLastStart: "上次启动",
          runtimeLastExit: "上次退出",
          runtimeLastExitCode: "退出码",
          runtimeLastEvent: "最新事件",
          runtimeEnsureReason: "最近启动原因",
          runtimeLog: "网关日志",
          runtimeNoLog: "当前没有已加载的日志内容。",
          runtimeLogPath: "日志路径",
          runtimeGuardrailPolicy: "加载保护策略",
          runtimeGuardrailHint: "把本地模型加载阈值做成后台可调策略，让风险 badge、单模型预热和全部预热都沿用同一口径。",
          runtimeGuardrailSave: "保存策略",
          runtimeGuardrailReset: "恢复默认值",
          runtimeGuardrailCautionPeakRatio: "谨慎峰值比例",
          runtimeGuardrailBlockedPeakRatio: "阻止峰值比例",
          runtimeGuardrailCautionFreeMb: "谨慎剩余内存 MB",
          runtimeGuardrailBlockedFreeMb: "阻止剩余内存 MB",
          runtimeGuardrailPolicyFile: "策略文件"
        };
    }
  }, [locale]);

  useEffect(() => {
    return () => {
      if (benchmarkCopyTimeoutRef.current) {
        clearTimeout(benchmarkCopyTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyBenchmarkRunNote(value: string, key: string) {
    const fallbackCopy = (text: string) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopy(value);
      }
      setBenchmarkCopyState({ key, tone: "success" });
    } catch {
      try {
        fallbackCopy(value);
        setBenchmarkCopyState({ key, tone: "success" });
      } catch {
        setBenchmarkCopyState({ key, tone: "error" });
      }
    }

    if (benchmarkCopyTimeoutRef.current) {
      clearTimeout(benchmarkCopyTimeoutRef.current);
    }
    benchmarkCopyTimeoutRef.current = setTimeout(() => {
      setBenchmarkCopyState((current) => (current?.key === key ? null : current));
    }, 2200);
  }

  useEffect(() => {
    setCompareTargetIds((current) => (current.includes(selectedTargetId) ? current : [...current, selectedTargetId]));
  }, [selectedTargetId]);

  async function loadRuntimeStatus(targetId: string) {
    setRuntimeActionPending((current) => ({ ...current, [targetId]: "refresh" }));
    try {
      const payload = await fetchAdminRuntimeStatus(targetId);
      setRuntimeStatuses((current) => ({
        ...current,
        [targetId]: payload
      }));
      recordRuntimeMetricSample(targetId, payload);
      if (payload.message) {
        setRuntimeMessages((current) => ({
          ...current,
          [targetId]: payload.message || ""
        }));
      }
    } finally {
      setRuntimeActionPending((current) => ({ ...current, [targetId]: "" }));
    }
  }

  async function loadAllRuntimeStatuses() {
    await Promise.all(
      localTargets.map(async (target) => {
        try {
          await loadRuntimeStatus(target.id);
        } catch (runtimeError) {
          setRuntimeStatuses((current) => ({
            ...current,
            [target.id]: {
              targetId: target.id,
              targetLabel: target.label,
              execution: "local",
              available: false,
              message: runtimeError instanceof Error ? runtimeError.message : "Failed to load runtime status."
            }
          }));
        }
      })
    );
  }

  async function handleRuntimePrewarm(targetId: string) {
    setRuntimeActionPending((current) => ({ ...current, [targetId]: "prewarm" }));
    try {
      const payload = await prewarmAdminRuntime(targetId);
      setRuntimeMessages((current) => ({
        ...current,
        [targetId]: payload.message
      }));
      if (payload.status === "ready" && typeof payload.loadMs === "number") {
        const switchedAt = new Date().toISOString();
        setRuntimeLastSwitchMs((current) => ({
          ...current,
          [targetId]: payload.loadMs ?? null
        }));
        setRuntimeLastSwitchAt((current) => ({
          ...current,
          [targetId]: switchedAt
        }));
      }
      await loadRuntimeStatus(targetId);
    } catch (runtimeError) {
      setRuntimeMessages((current) => ({
        ...current,
        [targetId]: runtimeError instanceof Error ? runtimeError.message : "Prewarm failed."
      }));
    } finally {
      setRuntimeActionPending((current) => ({ ...current, [targetId]: "" }));
    }
  }

  async function handleRuntimeAction(
    targetId: string,
    action: Exclude<RuntimeActionKind, "refresh" | "prewarm">,
    options?: { query?: string; limit?: number }
  ) {
    setRuntimeActionPending((current) => ({ ...current, [targetId]: action }));
    try {
      const payload = await executeAdminRuntimeAction({
        targetId,
        action,
        query: options?.query,
        limit: options?.limit
      });
      if (payload.logExcerpt) {
        setRuntimeLogExcerpts((current) => ({
          ...current,
          [targetId]: payload.logExcerpt || ""
        }));
      }
      if (payload.logSummary) {
        setRuntimeLogSummaries((current) => ({
          ...current,
          [targetId]: payload.logSummary || null
        }));
      }
      if (payload.runtime) {
        setRuntimeStatuses((current) => ({
          ...current,
          [targetId]: payload.runtime || null
        }));
      }
      setRuntimeMessages((current) => ({
        ...current,
        [targetId]: payload.message
      }));
      await loadRuntimeStatus(targetId);
    } catch (runtimeError) {
      setRuntimeMessages((current) => ({
        ...current,
        [targetId]: runtimeError instanceof Error ? runtimeError.message : "Runtime action failed."
      }));
    } finally {
      setRuntimeActionPending((current) => ({ ...current, [targetId]: "" }));
    }
  }

  async function handlePrewarmAllRuntimes() {
    setPrewarmAllPending(true);
    try {
      const payload = await prewarmAllAdminRuntimes();
      const detail = payload.results
        .map((entry) => {
          const statusLabel =
            entry.status === "loading"
              ? "loading"
              : entry.status === "queued"
                ? "queued"
                : entry.status === "skipped"
                  ? "skipped"
                : entry.status === "failed"
                  ? "failed"
                  : "ready";
          return `${entry.targetLabel}: ${statusLabel}`;
        })
        .join(" · ");
      setPrewarmAllMessage(`${payload.message}${detail ? ` ${detail}` : ""}`);
      setRuntimeLastSwitchMs((current) => {
        const next = { ...current };
        payload.results.forEach((entry) => {
          if (entry.status === "ready" && typeof entry.loadMs === "number") {
            next[entry.targetId] = entry.loadMs;
          }
        });
        return next;
      });
      setRuntimeLastSwitchAt((current) => {
        const next = { ...current };
        payload.results.forEach((entry) => {
          if (entry.status === "ready" && typeof entry.loadMs === "number") {
            next[entry.targetId] = new Date().toISOString();
          }
        });
        return next;
      });
      await loadAllRuntimeStatuses();
    } catch (runtimeError) {
      setPrewarmAllMessage(runtimeError instanceof Error ? runtimeError.message : "Prewarm-all failed.");
    } finally {
      setPrewarmAllPending(false);
    }
  }

  const loadRuntimeGuardrailPolicy = useCallback(async () => {
    try {
      const payload = await fetchRuntimeGuardrailPolicy();
      setRuntimeGuardrailDraft(payload.strategy);
      setRuntimeGuardrailDefaults(payload.defaults || payload.strategy);
      setRuntimeGuardrailPolicyFile(payload.policyFile || "");
    } catch (runtimeError) {
      setRuntimeGuardrailMessage(
        runtimeError instanceof Error ? runtimeError.message : "Failed to load runtime guardrail policy."
      );
    }
  }, []);

  const saveRuntimeGuardrailPolicy = useCallback(async () => {
    setRuntimeGuardrailPending(true);
    setRuntimeGuardrailMessage("");
    try {
      const payload = await updateRuntimeGuardrailPolicy("save", runtimeGuardrailDraft);
      setRuntimeGuardrailDraft(payload.strategy);
      setRuntimeGuardrailDefaults(payload.defaults || payload.strategy);
      setRuntimeGuardrailPolicyFile(payload.policyFile || "");
      setRuntimeGuardrailMessage(payload.message || "Runtime guardrail policy saved.");
      await Promise.all([loadAllRuntimeStatuses(), loadDashboard()]);
    } catch (runtimeError) {
      setRuntimeGuardrailMessage(
        runtimeError instanceof Error ? runtimeError.message : "Failed to save runtime guardrail policy."
      );
    } finally {
      setRuntimeGuardrailPending(false);
    }
  }, [loadAllRuntimeStatuses, loadDashboard, runtimeGuardrailDraft]);

  const resetRuntimeGuardrailPolicy = useCallback(async () => {
    setRuntimeGuardrailPending(true);
    setRuntimeGuardrailMessage("");
    try {
      const payload = await updateRuntimeGuardrailPolicy("reset");
      setRuntimeGuardrailDraft(payload.strategy);
      setRuntimeGuardrailDefaults(payload.defaults || payload.strategy);
      setRuntimeGuardrailPolicyFile(payload.policyFile || "");
      setRuntimeGuardrailMessage(payload.message || "Runtime guardrail policy reset.");
      await Promise.all([loadAllRuntimeStatuses(), loadDashboard()]);
    } catch (runtimeError) {
      setRuntimeGuardrailMessage(
        runtimeError instanceof Error ? runtimeError.message : "Failed to reset runtime guardrail policy."
      );
    } finally {
      setRuntimeGuardrailPending(false);
    }
  }, [loadAllRuntimeStatuses, loadDashboard]);

  async function handleRuntimeLogSearch(targetId: string) {
    await handleRuntimeAction(targetId, "read_log", {
      query: runtimeLogQueries[targetId] || "",
      limit: runtimeLogLimits[targetId] || 120
    });
  }

  async function loadDashboard() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        buildAdminDashboardQuery({
          selectedTargetId,
          windowMinutes,
          providerFilter,
          providerProfileFilter,
          benchmarkThinkingModeFilter,
          benchmarkHistorySourceFilter,
          benchmarkHeatmapPromptScope,
          benchmarkHeatmapSampleStatus,
          benchmarkHeatmapWindowMinutes,
          modelFilter,
          contextWindowFilter,
          compareTargetIds,
          benchmarkTargetIds,
        }),
        {
          cache: "no-store"
        }
      );
      const payload = (await response.json()) as DashboardResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Dashboard request failed.");
      }
      setData(payload);
    } catch (dashboardError) {
      setError(dashboardError instanceof Error ? dashboardError.message : "Dashboard request failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleArchiveHistoricalCompatibilityUsage() {
    setCompatibilityArchivePending(true);
    setCompatibilityArchiveMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/compatibility-usage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "archive-historical-unclassified",
          clear: true,
          reason:
            "Admin dashboard archive flow after verifying source-tagged runtime compatibility hits are zero.",
        }),
      });
      const payload = (await response.json()) as {
        archived?: boolean;
        cleared?: boolean;
        archive?: { legacyUnclassifiedHitsArchived?: number } | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to archive compatibility usage.");
      }
      const archivedHits = payload.archive?.legacyUnclassifiedHitsArchived || 0;
      setCompatibilityArchiveMessage(
        payload.archived
          ? `Archived ${archivedHits} historical hit${archivedHits === 1 ? "" : "s"}.`
          : "No historical hits required archiving.",
      );
      await loadDashboard();
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Failed to archive compatibility usage.",
      );
    } finally {
      setCompatibilityArchivePending(false);
    }
  }

  function openBenchmarkReportMarkdown(
    entry?:
      | DashboardResponse["benchmarkHistory"][number]
      | DashboardResponse["releaseEvidence"][number]
      | null
  ) {
    openAdminBenchmarkReport({
      entry,
      fallbackTargetIds: benchmarkTargetIds,
      windowMinutes: benchmarkHeatmapWindowMinutes,
    });
  }

  async function toggleBenchmarkReleaseEvidence(entry: { runId?: string; suiteLabel?: string; datasetLabel?: string; promptSetLabel?: string; prompt: string }, pinned: boolean) {
    if (!entry.runId) return;
    setBenchmarkEvidencePendingRunId(entry.runId);
    setError("");
    try {
      const response = await fetch(
        pinned
          ? `/api/admin/benchmark/evidence?runId=${encodeURIComponent(entry.runId)}`
          : "/api/admin/benchmark/evidence",
        pinned
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                runId: entry.runId,
                title: entry.suiteLabel || entry.datasetLabel || entry.promptSetLabel || entry.prompt
              })
            }
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update release evidence.");
      }
      await loadDashboard();
    } catch (evidenceError) {
      setError(
        evidenceError instanceof Error ? evidenceError.message : "Failed to update release evidence."
      );
    } finally {
      setBenchmarkEvidencePendingRunId("");
    }
  }

  useEffect(() => {
    void loadAllRuntimeStatuses();
  }, []);

  useEffect(() => {
    void loadRuntimeGuardrailPolicy();
  }, [loadRuntimeGuardrailPolicy]);

  useEffect(() => {
    setRuntimeMetricHistory((current) => {
      const allowedTargetIds = new Set(localTargets.map((target) => target.id));
      const nextEntries = Object.entries(current).filter(([targetId]) => allowedTargetIds.has(targetId));
      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
  }, [localTargets]);

  useEffect(() => {
    void loadDashboard();
  }, [selectedTargetId, windowMinutes, providerFilter, providerProfileFilter, benchmarkThinkingModeFilter, benchmarkHistorySourceFilter, benchmarkHeatmapPromptScope, benchmarkHeatmapSampleStatus, benchmarkHeatmapWindowMinutes, modelFilter, contextWindowFilter, compareTargetIds.join(","), benchmarkTargetIds.join(",")]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void loadDashboard();
      void loadAllRuntimeStatuses();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, selectedTargetId, windowMinutes, providerFilter, providerProfileFilter, benchmarkThinkingModeFilter, benchmarkHistorySourceFilter, benchmarkHeatmapPromptScope, benchmarkHeatmapSampleStatus, benchmarkHeatmapWindowMinutes, modelFilter, contextWindowFilter, compareTargetIds.join(","), benchmarkTargetIds.join(",")]);

  const {
    latestTelemetry,
    providerHealthDeskRows,
    requestValues,
    tokenValues,
    memoryValues,
    batteryValues,
    gpuValues,
    storageValues,
    energyValues,
    concurrencyValues,
    firstTokenLatencyValues,
    totalLatencyValues,
    appOverheadValues,
    tokenThroughputValues,
  } = useMemo(() => buildAdminOperationsReadModel(data), [data]);
  const pinnedEvidenceRunIds = useMemo(
    () => new Set((data?.releaseEvidence || []).map((entry) => entry.runId)),
    [data?.releaseEvidence]
  );
  const benchmarkTrendLines = useMemo(
    () =>
      (data?.benchmarkTrends || []).map((entry, index) => ({
        label:
          entry.providerProfile === "default" && entry.thinkingMode === "standard"
            ? `${entry.targetLabel}${entry.resolvedModel ? ` · ${entry.resolvedModel}` : ""}`
            : `${entry.targetLabel} · ${entry.providerProfile}${entry.thinkingMode === "thinking" ? " · thinking" : ""}${entry.resolvedModel ? ` · ${entry.resolvedModel}` : ""}`,
        tone: (["cyan", "emerald", "amber", "violet"] as const)[index % 4],
        firstTokenValues: entry.points.map((point) => point.avgFirstTokenLatencyMs),
        totalLatencyValues: entry.points.map((point) => point.avgLatencyMs),
        throughputValues: entry.points.map((point) => point.avgTokenThroughputTps),
        latestFirstTokenLatencyMs: entry.points.length ? entry.points[entry.points.length - 1].avgFirstTokenLatencyMs : null,
        latestTotalLatencyMs: entry.points.length ? entry.points[entry.points.length - 1].avgLatencyMs : null,
        latestThroughputTps: entry.points.length ? entry.points[entry.points.length - 1].avgTokenThroughputTps : null
      })),
    [data]
  );
  return (
    <section className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-3 py-4 text-slate-100 sm:px-5 xl:px-6 2xl:px-8">
      <div className="mx-auto flex w-full max-w-[1960px] flex-col gap-4">
        <StudioIdentityBand
          accent="cyan"
          className="order-20 mb-0"
          eyebrow={dictionary.nav.dashboard}
          title={dictionary.admin.title}
          description={dictionary.admin.subtitle}
          side={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedTargetId}
                onChange={(event) => setSelectedTargetId(event.target.value)}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                {agentTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
              <select
                value={windowMinutes}
                onChange={(event) => setWindowMinutes(Number(event.target.value))}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                {[30, 60, 180, 720].map((value) => (
                  <option key={value} value={value}>
                    {dictionary.admin.window}: {value}m
                  </option>
                ))}
              </select>
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="all">{uiText.provider}: all</option>
                {(data?.availableProviders || []).map((value) => (
                  <option key={value} value={value}>
                    {uiText.provider}: {value}
                  </option>
                ))}
              </select>
              <select
                value={providerProfileFilter}
                onChange={(event) => setProviderProfileFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="all">{uiText.providerProfile}: all</option>
                {(data?.availableProviderProfiles || []).map((value) => (
                  <option key={value} value={value}>
                    {uiText.providerProfile}: {value}
                  </option>
                ))}
              </select>
              <select
                value={benchmarkThinkingModeFilter}
                onChange={(event) => setBenchmarkThinkingModeFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="all">{uiText.benchmarkThinkingModeFilter}: all</option>
                {(data?.availableBenchmarkThinkingModes || []).map((value) => (
                  <option key={value} value={value}>
                    {uiText.benchmarkThinkingModeFilter}: {value}
                  </option>
                ))}
              </select>
              <select
                value={modelFilter}
                onChange={(event) => setModelFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="all">{uiText.modelFilter}: all</option>
                {(data?.availableModels || []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                value={contextWindowFilter}
                onChange={(event) => setContextWindowFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="all">{uiText.contextWindowFilter}: all</option>
                {(data?.availableContextWindows || []).map((value) => (
                  <option key={value} value={String(value)}>
                    {value >= 1024 ? `${Math.round(value / 1024)}K` : value}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />
                {dictionary.admin.autoRefresh}
              </label>
              <button
                type="button"
                onClick={() => {
                  void loadDashboard();
                  void loadAllRuntimeStatuses();
                }}
                className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                {pending ? "..." : dictionary.admin.refresh}
              </button>
            </div>
          }
        />

        {error ? (
          <div className="order-21 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="order-22 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">{dictionary.admin.totalRequests}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{data?.summary.totalRequests ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">{dictionary.admin.activeRequests}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{data?.summary.activeForTarget ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">{dictionary.admin.totalTokens}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatAdminCompactNumber(data?.summary.totalTokens ?? 0)}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">{dictionary.admin.failedRequests}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{data?.summary.failedRequests ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">{dictionary.admin.latestCheck}</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {data?.summary.latestCheckOk === null
                ? "--"
                : data?.summary.latestCheckOk
                  ? (dictionary.common.ok || "OK")
                  : (dictionary.common.failed || "Failed")}
            </p>
          </div>
        </div>

        <div className="order-23 grid gap-4 xl:grid-cols-3">
          <AdminSeriesCard title={dictionary.admin.requestTrend} values={requestValues} tone="cyan" />
          <AdminSeriesCard title={dictionary.admin.tokenTrend} values={tokenValues} tone="amber" />
          <AdminSeriesCard title={uiText.concurrencyTrend} values={concurrencyValues} tone="violet" />
        </div>

        <div className="order-24 grid gap-4 xl:grid-cols-3">
          <AdminSeriesCard title={uiText.firstTokenLatency} values={firstTokenLatencyValues} tone="emerald" />
          <AdminSeriesCard title={uiText.totalLatency} values={totalLatencyValues} tone="amber" />
          <AdminSeriesCard title={uiText.tokenThroughput} values={tokenThroughputValues} tone="cyan" />
        </div>

        <div className="order-25">
          <AdminMultiSeriesCard
            title={uiText.latencySplit}
            lines={[
              { label: uiText.firstTokenLatency, values: firstTokenLatencyValues, tone: "emerald" },
              { label: uiText.totalLatency, values: totalLatencyValues, tone: "amber" },
              { label: uiText.appOverhead, values: appOverheadValues, tone: "violet" }
            ]}
          />
        </div>

        <AdminProviderComparisonPanel
          targets={agentTargets}
          selectedTargetIds={compareTargetIds}
          setSelectedTargetIds={setCompareTargetIds}
          rows={data?.comparison || []}
          labels={{
            title: uiText.compareView,
            targets: uiText.compareTargets,
            provider: uiText.provider,
            totalRequests: dictionary.admin.totalRequests,
            totalTokens: dictionary.admin.totalTokens,
            failedRequests: dictionary.admin.failedRequests,
            activeRequests: dictionary.admin.activeRequests,
            firstTokenLatency: uiText.firstTokenLatency,
            totalLatency: uiText.totalLatency,
            tokenThroughput: uiText.tokenThroughput,
            tokensPerSecond: uiText.tokensPerSecond,
            percentiles: uiText.percentiles,
            noData: dictionary.admin.noData,
          }}
        />


        <div className="order-1 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex flex-col gap-4">
            <AdminBenchmarkHandoffPanel
              locale={locale}
              progress={benchmarkProgress}
              latestRunId={data?.benchmarkHistory[0]?.runId}
              latestGeneratedAt={data?.benchmarkHistory[0]?.generatedAt}
              historyCount={data?.benchmarkHistory.length || 0}
              releaseEvidenceCount={data?.releaseEvidence.length || 0}
            />
            <AdminBenchmarkCoverageGovernancePanel locale={locale} />

            <AdminCompatibilitySunsetPanel
              locale={locale}
              usage={data?.adminCompatibilityUsage}
              sunset={data?.adminCompatibilitySunset}
              deletionManifest={data?.adminCompatibilityDeletionManifest}
              archivePending={compatibilityArchivePending}
              archiveMessage={compatibilityArchiveMessage}
              onArchiveHistoricalUsage={handleArchiveHistoricalCompatibilityUsage}
            />

            <ProviderOpsAdminShell
              locale={locale}
              summary={data?.providerOpsEvidenceSummary}
              entries={providerHealthDeskRows}
              labels={{
                model: dictionary.common.model,
                firstTokenLatency: uiText.firstTokenLatency,
                totalLatency: uiText.totalLatency,
                noData: dictionary.admin.noData,
              }}
              onRefresh={loadDashboard}
            />

            <AdminBenchmarkReleaseEvidencePanel
              locale={locale}
              entries={data?.releaseEvidence || []}
              summary={data?.benchmarkReleaseEvidenceSummary}
              pendingRunId={benchmarkEvidencePendingRunId}
              contextWindowLabel={uiText.contextWindowFilter}
              onOpenMarkdown={openBenchmarkReportMarkdown}
              onRemovePin={(entry) => toggleBenchmarkReleaseEvidence(entry, true)}
            />


            <AdminBenchmarkHistoryPanel
              locale={locale}
              title={uiText.benchmarkHistory}
              trendTitle={uiText.benchmarkTrendTitle}
              count={data?.benchmarkHistory.length || 0}
              sourceFilter={benchmarkHistorySourceFilter}
              onSourceFilterChange={setBenchmarkHistorySourceFilter}
            >
                {data?.benchmarkHistory.length ? (
                  data.benchmarkHistory.map((entry) => (
                    <article key={entry.id} className="rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3.5">
                      <AdminBenchmarkHistoryEntryHeader
                        locale={locale}
                        entry={entry}
                        labels={{
                          local: dictionary.common.local,
                          remote: dictionary.common.remote,
                          suite: uiText.benchmarkSuite,
                          dataset: uiText.benchmarkDataset,
                          promptSet: uiText.benchmarkPromptSet,
                          prompt: uiText.benchmarkPrompt,
                          contextWindow: uiText.contextWindowFilter,
                          runs: uiText.benchmarkRuns,
                          providerProfile: uiText.providerProfile,
                          thinkingMode: uiText.benchmarkThinkingMode,
                        }}
                        pinned={Boolean(
                          entry.runId && pinnedEvidenceRunIds.has(entry.runId),
                        )}
                        pending={
                          benchmarkEvidencePendingRunId === entry.runId
                        }
                        onOpenReport={() => openBenchmarkReportMarkdown(entry)}
                        onTogglePin={() =>
                          toggleBenchmarkReleaseEvidence(
                            entry,
                            entry.runId
                              ? pinnedEvidenceRunIds.has(entry.runId)
                              : false,
                          )
                        }
                      />
                      <div className="mt-3 space-y-3">
                        {entry.benchmarkMode === "suite" ? (
                          <div className="space-y-1 text-xs text-slate-500">
                            <p>{uiText.benchmarkSuite}: {entry.suiteLabel || "--"} · n={entry.suiteWorkloadCount || 0}</p>
                            {entry.profileBatchScope ? <p>scope={entry.profileBatchScope}</p> : null}
                            <p>{uiText.benchmarkPrompt}: {entry.prompt}</p>
                          </div>
                        ) : entry.benchmarkMode === "dataset" ? (
                          <div className="space-y-1 text-xs text-slate-500">
                            <p>{uiText.benchmarkDataset}: {entry.datasetLabel || "--"} · n={entry.datasetSampleCount || 0}</p>
                            <p>{uiText.benchmarkDatasetSource}: {entry.datasetSourceLabel || "--"}</p>
                          </div>
                        ) : entry.promptSetLabel ? (
                          <p className="text-xs text-slate-500">
                            {uiText.benchmarkPromptSet}: {entry.promptSetLabel} · n={entry.promptSetPromptCount || 0}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">{uiText.benchmarkPrompt}: {entry.prompt}</p>
                        )}
                        {entry.runNote ? (
                          <AdminBenchmarkRunNotePanel
                            locale={locale}
                            entryId={entry.id}
                            runNote={entry.runNote}
                            summary={summarizeBenchmarkRunNote(entry.runNote)}
                            copyState={benchmarkCopyState}
                            onCopy={handleCopyBenchmarkRunNote}
                          />
                        ) : null}
                        <AdminBenchmarkResultGroups
                          entryId={entry.id}
                          results={entry.results}
                          fallbackProviderProfile={entry.providerProfile}
                          fallbackThinkingMode={entry.thinkingMode}
                          labels={{
                            local: dictionary.common.local,
                            remote: dictionary.common.remote,
                            model: dictionary.common.model,
                            firstTokenLatency: uiText.firstTokenLatency,
                            totalLatency: uiText.totalLatency,
                            tokenThroughput: uiText.tokenThroughput,
                            tokensPerSecond: uiText.tokensPerSecond,
                            score: uiText.benchmarkScore,
                            passRate: uiText.benchmarkPassRate,
                          }}
                        />
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{uiText.benchmarkNoData}</p>
                )}
            </AdminBenchmarkHistoryPanel>

            <AdminBenchmarkHeatmapPanel
              locale={locale}
              rows={data?.benchmarkHeatmap || []}
              targets={benchmarkTargets}
              selectedTargetIds={benchmarkTargetIds}
              targetVersions={data?.benchmarkTargetVersions || []}
              metric={benchmarkHeatmapMetric}
              setMetric={setBenchmarkHeatmapMetric}
              windowMinutes={benchmarkHeatmapWindowMinutes}
              setWindowMinutes={setBenchmarkHeatmapWindowMinutes}
              promptScope={benchmarkHeatmapPromptScope}
              setPromptScope={setBenchmarkHeatmapPromptScope}
              sampleStatus={benchmarkHeatmapSampleStatus}
              setSampleStatus={setBenchmarkHeatmapSampleStatus}
              labels={{
                title: uiText.benchmarkHeatmap,
                providerProfile: uiText.providerProfile,
                thinkingMode: uiText.benchmarkThinkingMode,
                window: uiText.benchmarkHeatmapWindow,
                promptScope: uiText.benchmarkHeatmapPromptScope,
                allPrompts: uiText.benchmarkHeatmapAllPrompts,
                fixedPrompts: uiText.benchmarkHeatmapFixedPromptsOnly,
                sampleStatus: uiText.benchmarkHeatmapSampleStatus,
                allSamples: uiText.allSamples,
                successSamples: uiText.successSamples,
                failedSamples: uiText.failedSamples,
                metric: uiText.benchmarkHeatmapMetric,
                firstToken: uiText.firstTokenLatency,
                totalLatency: uiText.totalLatency,
                throughput: uiText.tokenThroughput,
                successRate: uiText.benchmarkSuccessRate,
                tokensPerSecond: uiText.tokensPerSecond,
              }}
            />
          </div>
        </div>

        <div className="order-30">
          <AdminFeatureHandoffPanel locale={locale} route="/retrieval" feature="retrieval" />
        </div>
        <div className="order-29">
          <AdminFeatureHandoffPanel locale={locale} route="/models" feature="models" />
        </div>

        <div className="order-30">
          <AdminFeatureHandoffPanel locale={locale} route="/fine-tune" feature="fine-tune" />
        </div>

        <div className="order-31">
          <AdminTimelinePanel locale={locale} />
        </div>

        {data?.summary.telemetryAvailable ? (
          <div className="order-32 grid gap-4 xl:grid-cols-3">
            <AdminSeriesCard title={dictionary.admin.memory} values={memoryValues} tone="emerald" />
            <AdminSeriesCard title={uiText.storageTrend} values={storageValues} tone="cyan" />
            <AdminSeriesCard title={dictionary.admin.battery} values={batteryValues} tone="amber" />
            <AdminSeriesCard title={dictionary.admin.gpuProxy} values={gpuValues} tone="violet" />
            <AdminSeriesCard title={uiText.energyTrend} values={energyValues} tone="amber" />
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-300">{dictionary.admin.localTelemetry}</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div>
                  <p className="text-slate-500">{dictionary.admin.memory}</p>
                  <p className="mt-1 text-white">
                    {formatAdminBytes(latestTelemetry?.memoryUsedBytes)} / {formatAdminBytes(latestTelemetry?.memoryTotalBytes)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{dictionary.admin.storage}</p>
                  <p className="mt-1 text-white">{formatAdminBytes(latestTelemetry?.diskAvailableBytes)}</p>
                </div>
                <div>
                  <p className="text-slate-500">{dictionary.admin.battery}</p>
                  <p className="mt-1 text-white">
                    {formatAdminPercent(latestTelemetry?.batteryPercent)} ·{" "}
                    {latestTelemetry?.onAcPower ? uiText.acPower : uiText.batteryPower}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{dictionary.admin.queue}</p>
                  <p className="mt-1 text-white">
                    {latestTelemetry?.queueDepth ?? 0} · {latestTelemetry?.runtimeBusy ? dictionary.common.active : dictionary.agent.runtimeIdle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="order-27 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm text-slate-300">{uiText.runtimeOps}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{uiText.runtimeOpsHint}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadAllRuntimeStatuses()}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                {uiText.runtimeRefresh}
              </button>
              <button
                type="button"
                disabled={prewarmAllPending}
                onClick={() => void handlePrewarmAllRuntimes()}
                className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
              >
                {prewarmAllPending ? uiText.runtimeRefreshing : uiText.runtimePrewarmAll}
              </button>
            </div>
          </div>
          {prewarmAllMessage ? (
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              {prewarmAllMessage}
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{uiText.runtimeGuardrailPolicy}</p>
                <p className="mt-2 text-xs leading-6 text-slate-400">{uiText.runtimeGuardrailHint}</p>
                {runtimeGuardrailPolicyFile ? (
                  <p className="mt-2 break-all text-[11px] text-slate-500">
                    {uiText.runtimeGuardrailPolicyFile}: {sanitizeDisplayPath(runtimeGuardrailPolicyFile)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={runtimeGuardrailPending}
                  onClick={() => void saveRuntimeGuardrailPolicy()}
                  className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                >
                  {runtimeGuardrailPending ? uiText.runtimeRefreshing : uiText.runtimeGuardrailSave}
                </button>
                <button
                  type="button"
                  disabled={runtimeGuardrailPending}
                  onClick={() => void resetRuntimeGuardrailPolicy()}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {uiText.runtimeGuardrailReset}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
                <span className="block uppercase tracking-[0.18em]">{uiText.runtimeGuardrailCautionPeakRatio}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="0.99"
                  value={runtimeGuardrailDraft.cautionPeakRatio}
                  onChange={(event) =>
                    setRuntimeGuardrailDraft((current) => ({
                      ...current,
                      cautionPeakRatio: Number(event.target.value) || current.cautionPeakRatio
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
                <span className="block uppercase tracking-[0.18em]">{uiText.runtimeGuardrailBlockedPeakRatio}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="0.99"
                  value={runtimeGuardrailDraft.blockedPeakRatio}
                  onChange={(event) =>
                    setRuntimeGuardrailDraft((current) => ({
                      ...current,
                      blockedPeakRatio: Number(event.target.value) || current.blockedPeakRatio
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
                <span className="block uppercase tracking-[0.18em]">{uiText.runtimeGuardrailCautionFreeMb}</span>
                <input
                  type="number"
                  step="256"
                  min="512"
                  value={runtimeGuardrailDraft.cautionFreeMb}
                  onChange={(event) =>
                    setRuntimeGuardrailDraft((current) => ({
                      ...current,
                      cautionFreeMb: Number(event.target.value) || current.cautionFreeMb
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
                <span className="block uppercase tracking-[0.18em]">{uiText.runtimeGuardrailBlockedFreeMb}</span>
                <input
                  type="number"
                  step="256"
                  min="256"
                  value={runtimeGuardrailDraft.blockedFreeMb}
                  onChange={(event) =>
                    setRuntimeGuardrailDraft((current) => ({
                      ...current,
                      blockedFreeMb: Number(event.target.value) || current.blockedFreeMb
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                default caution peak {runtimeGuardrailDefaults.cautionPeakRatio.toFixed(2)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                default blocked peak {runtimeGuardrailDefaults.blockedPeakRatio.toFixed(2)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                default caution free {Math.round(runtimeGuardrailDefaults.cautionFreeMb)} MB
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                default blocked free {Math.round(runtimeGuardrailDefaults.blockedFreeMb)} MB
              </span>
            </div>
            {runtimeGuardrailMessage ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {runtimeGuardrailMessage}
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {localTargets.map((target) => {
              const {
                runtime,
                cpuHistory,
                rssHistory,
                gpuHistory,
                gpuMemoryHistory,
                energyHistory,
                diskUsedHistory,
                action,
                runtimeMessage,
                logExcerpt,
                logSummary,
                runtimePhase,
                runtimeLogQuery,
                runtimeLogLimit,
                loadedAliasForTarget,
                gatewayLoadedOtherAlias,
                liveCostTargetLabel,
                recommendedContextBadge,
                benchmarkContextHelper,
                lastSwitchMsForTarget,
                lastSwitchAtForTarget,
                recoveryEvidence,
                runtimeIsIdle,
                overviewCards,
              } = buildAdminRuntimeTargetViewModel({
                target,
                runtime: runtimeStatuses[target.id],
                metricHistory: runtimeMetricHistory[target.id] || [],
                localTargets,
                locale,
                action: runtimeActionPending[target.id] || "",
                runtimeMessage:
                  runtimeMessages[target.id] ||
                  runtimeStatuses[target.id]?.message ||
                  "",
                logExcerpt: runtimeLogExcerpts[target.id] || "",
                logSummary: runtimeLogSummaries[target.id],
                runtimeLogQuery: runtimeLogQueries[target.id] || "",
                runtimeLogLimit: runtimeLogLimits[target.id] || 120,
                lastSwitchMs: runtimeLastSwitchMs[target.id] ?? null,
                lastSwitchAt: runtimeLastSwitchAt[target.id] ?? null,
                recoveryEvidence: selectAdminRuntimeRecoveryEvidence(
                  benchmarkProgress,
                  target.id,
                ),
                text: {
                  supervisor: uiText.runtimeSupervisor,
                  gateway: uiText.runtimeGateway,
                  restartCount: uiText.runtimeRestartCount,
                  lastExitCode: uiText.runtimeLastExitCode,
                  lastStart: uiText.runtimeLastStart,
                  lastExit: uiText.runtimeLastExit,
                  ok: dictionary.common.ok,
                  failed: dictionary.common.failed,
                  unknown: dictionary.common.unknown,
                },
              });
              return (
                <article key={target.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-white">{target.label}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] ${runtimePhase.className}`}>
                          {runtimePhase.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {uiText.loadedAlias}: {loadedAliasForTarget ? describeAdminRuntimeAlias(loadedAliasForTarget, localTargets) : "—"}
                      </p>
                      {gatewayLoadedOtherAlias ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {uiText.runtimeCurrentLoaded}: {describeAdminRuntimeAlias(gatewayLoadedOtherAlias, localTargets)}
                        </p>
                      ) : null}
                      {runtime?.loadingAlias ? (
                        <p className="mt-1 text-xs text-amber-200">
                          {uiText.runtimeSwitchingNow}: {describeAdminRuntimeAlias(runtime.loadingAlias, localTargets)}
                          {typeof runtime.loadingElapsedMs === "number"
                            ? ` · ${Math.max(1, Math.round(runtime.loadingElapsedMs / 1000))}s`
                            : ""}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {uiText.runtimeLastSwitchLoad}: {formatAdminRuntimeDuration(lastSwitchMsForTarget)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {uiText.runtimeLastSwitchAt}: {formatAdminRuntimeTimestamp(lastSwitchAtForTarget, locale)}
                      </p>
                      {recoveryEvidence ? (
                        <div className="mt-3 border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold uppercase tracking-[0.16em]">
                              {locale.startsWith("en") ? "Latest recovery" : "最近恢复动作"}
                            </span>
                            <span className="text-amber-100/70">
                              {formatAdminRuntimeTimestamp(recoveryEvidence.occurredAt, locale)}
                            </span>
                          </div>
                          <p className="mt-1">{recoveryEvidence.action}</p>
                          <p className="mt-1 text-[11px] text-amber-100/60">
                            {recoveryEvidence.phase} · {recoveryEvidence.runId}
                          </p>
                        </div>
                      ) : null}
                      {runtime?.loadingError ? (
                        <p className="mt-1 break-all text-xs text-rose-200">Loading error: {runtime.loadingError}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {uiText.queueLabel}: {runtime?.queueDepth ?? 0} · {uiText.activeLabel}: {runtime?.activeRequests ?? 0}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {target.parameterScale ? (
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                            {locale.startsWith("en") ? "Scale" : "参数规模"} · {target.parameterScale}
                          </span>
                        ) : null}
                        {target.quantizationLabel ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                            {locale.startsWith("en") ? "Quant" : "量化"} · {target.quantizationLabel}
                          </span>
                        ) : null}
                        {recommendedContextBadge ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                            {locale.startsWith("en") ? "Rec context" : "建议上下文"} · {recommendedContextBadge}
                          </span>
                        ) : null}
                        {benchmarkContextHelper ? (
                          <span className="ui-chip-wrap rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-100">
                            {benchmarkContextHelper}
                          </span>
                        ) : null}
                        {target.sourceLabel ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                            {target.sourceLabel}
                          </span>
                        ) : null}
                      </div>
                      {target.sourceRepoId ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {locale.startsWith("en") ? "Repo id" : "模型仓库"}: {target.sourceRepoId}
                        </p>
                      ) : null}
                      {target.sourcePath ? (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {locale.startsWith("en") ? "Source path" : "来源路径"}: {sanitizeDisplayPath(target.sourcePath)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {locale.startsWith("en")
                          ? liveCostTargetLabel
                            ? `Live hardware cost currently reflects ${liveCostTargetLabel}.`
                            : "Load a local model to inspect live hardware cost."
                          : liveCostTargetLabel
                            ? `当前实时硬件开销反映的是 ${liveCostTargetLabel}。`
                            : "先加载一个本地模型，才能看到实时硬件开销。"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <AdminRuntimeMetricsGrid
                      locale={locale}
                      runtime={runtime}
                      liveCostTargetLabel={liveCostTargetLabel}
                      overviewCards={overviewCards}
                      cpuHistory={cpuHistory}
                      rssHistory={rssHistory}
                      gpuHistory={gpuHistory}
                      gpuMemoryHistory={gpuMemoryHistory}
                      energyHistory={energyHistory}
                      diskUsedHistory={diskUsedHistory}
                    />

                    <div className="space-y-4">
                      <AdminRuntimeTracePanel
                        runtime={runtime}
                        message={runtimeMessage}
                        emptyLabel={uiText.runtimeNoLog}
                      />

                      <AdminRuntimeModelStatePanel
                        locale={locale}
                        runtime={runtime}
                        targets={localTargets}
                        action={action}
                        runtimeMessage={runtimeMessage}
                        loadedAlias={loadedAliasForTarget}
                        gatewayLoadedOtherAlias={gatewayLoadedOtherAlias}
                        lastSwitchMs={lastSwitchMsForTarget}
                        lastSwitchAt={lastSwitchAtForTarget}
                        text={{
                          idle: dictionary.agent.runtimeIdle,
                          unknown: dictionary.common.unknown,
                          loadedAlias: uiText.loadedAlias,
                          currentLoaded: uiText.runtimeCurrentLoaded,
                          lastSwitchLoad: uiText.runtimeLastSwitchLoad,
                          lastSwitchAt: uiText.runtimeLastSwitchAt,
                          switchingNow: uiText.runtimeSwitchingNow,
                          lastEvent: uiText.runtimeLastEvent,
                          ensureReason: uiText.runtimeEnsureReason,
                          logPath: uiText.runtimeLogPath,
                          noLog: uiText.runtimeNoLog,
                          refreshing: uiText.runtimeRefreshing,
                          refresh: uiText.runtimeRefresh,
                          prewarm: uiText.runtimePrewarm,
                          release: uiText.runtimeRelease,
                          restart: uiText.runtimeRestart,
                          readLog: uiText.runtimeReadLog,
                        }}
                        onRefresh={() => loadRuntimeStatus(target.id)}
                        onPrewarm={() => handleRuntimePrewarm(target.id)}
                        onAction={(nextAction) =>
                          handleRuntimeAction(target.id, nextAction)
                        }
                      />

                      <AdminRuntimeLogPanel
                        locale={locale}
                        action={action}
                        query={runtimeLogQuery}
                        limit={runtimeLogLimit}
                        summary={logSummary}
                        excerpt={logExcerpt}
                        text={{
                          title: uiText.runtimeLog,
                          refreshing: uiText.runtimeRefreshing,
                          readLog: uiText.runtimeReadLog,
                          noLog: uiText.runtimeNoLog,
                        }}
                        onQueryChange={(value) =>
                          setRuntimeLogQueries((current) => ({
                            ...current,
                            [target.id]: value,
                          }))
                        }
                        onLimitChange={(value) =>
                          setRuntimeLogLimits((current) => ({
                            ...current,
                            [target.id]: value,
                          }))
                        }
                        onSearch={() => handleRuntimeLogSearch(target.id)}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <AdminRecentOperationsPanel
          data={data}
          labels={{
            recentHistory: dictionary.admin.recentHistory,
            latest: dictionary.common.latest,
            model: dictionary.common.model,
            contextWindow: uiText.contextWindowFilter,
            defaultContextWindow: uiText.defaultContextWindow,
            latencyMs: uiText.latencyMs,
            tokens: uiText.tokens,
            status: uiText.status,
            ok: dictionary.common.ok,
            failed: dictionary.common.failed,
            noData: dictionary.admin.noData,
            firstTokenLatency: uiText.firstTokenLatency,
            totalLatency: uiText.totalLatency,
            tokenThroughput: uiText.tokenThroughput,
            tokensPerSecond: uiText.tokensPerSecond,
            percentiles: uiText.percentiles,
            modelBreakdown: dictionary.admin.modelBreakdown,
            contextWindowBreakdown: uiText.contextWindowBreakdown,
            recentChecks: dictionary.admin.recentChecks,
            savedFiles: dictionary.admin.savedFiles,
          }}
        />
      </div>
    </section>
  );
}
