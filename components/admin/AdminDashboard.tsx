"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminCompatibilitySunsetPanel } from "@/components/admin/AdminCompatibilitySunsetPanel";
import { AdminTimelinePanel } from "@/components/admin/AdminTimelinePanel";
import { AdminFeatureHandoffPanel } from "@/features/admin/AdminFeatureHandoffPanel";
import { getAdminDashboardCopy } from "@/features/admin/dashboard-copy";
import type { AdminDashboardResponse as DashboardResponse } from "@/features/admin/dashboard-contract";
import { AdminRuntimeMetricsGrid } from "@/features/admin/AdminRuntimeMetricsGrid";
import { AdminRuntimeLogPanel } from "@/features/admin/AdminRuntimeLogPanel";
import { AdminRuntimeTracePanel } from "@/features/admin/AdminRuntimeTracePanel";
import { AdminRuntimeModelStatePanel } from "@/features/admin/AdminRuntimeModelStatePanel";
import { AdminRecentOperationsPanel } from "@/features/admin/AdminRecentOperationsPanel";
import {
  useAdminDashboardFilterState,
} from "@/features/admin/dashboard-filter-state";
import { buildAdminDashboardQuery } from "@/features/admin/dashboard-query";
import { useAdminBenchmarkInteractions } from "@/features/admin/benchmark-interactions";
import {
  getDefaultAdminBenchmarkTargetIds as getDefaultBenchmarkTargetIds,
  summarizeAdminBenchmarkRunNote as summarizeBenchmarkRunNote,
} from "@/features/admin/benchmark-presenters";
import { useAdminBenchmarkProgressState } from "@/features/admin/benchmark-progress-state";
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
import { buildAdminRuntimeTargetViewModel } from "@/features/admin/runtime-target-view-model";
import { selectAdminRuntimeRecoveryEvidence } from "@/features/admin/runtime-recovery-evidence";
import { useAdminRuntimeController } from "@/features/admin/runtime-controller";
import { useAdminRuntimeGuardrailController } from "@/features/admin/runtime-guardrail-controller";
import { AdminBenchmarkHandoffPanel } from "@/features/benchmark/AdminBenchmarkHandoffPanel";
import { AdminBenchmarkReleaseEvidencePanel } from "@/features/benchmark/AdminBenchmarkReleaseEvidencePanel";
import { AdminBenchmarkHistoryEntryHeader } from "@/features/benchmark/AdminBenchmarkHistoryEntryHeader";
import { AdminBenchmarkRunNotePanel } from "@/features/benchmark/AdminBenchmarkRunNotePanel";
import { AdminBenchmarkResultGroups } from "@/features/benchmark/AdminBenchmarkResultGroups";
import { AdminBenchmarkCoverageGovernancePanel } from "@/features/benchmark/AdminBenchmarkCoverageGovernancePanel";
import { WorkspaceGovernancePanel } from "@/features/governance/WorkspaceGovernancePanel";
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
import type {
  AgentTarget
} from "@/lib/agent/types";
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
  const {
    runtimeStatuses,
    runtimeMetricHistory,
    runtimeActionPending,
    runtimeLogExcerpts,
    runtimeLogSummaries,
    runtimeLogQueries,
    setRuntimeLogQueries,
    runtimeLogLimits,
    setRuntimeLogLimits,
    runtimeMessages,
    runtimeLastSwitchMs,
    runtimeLastSwitchAt,
    prewarmAllPending,
    prewarmAllMessage,
    loadRuntimeStatus,
    loadAllRuntimeStatuses,
    handleRuntimePrewarm,
    handleRuntimeAction,
    handlePrewarmAllRuntimes,
    handleRuntimeLogSearch,
  } = useAdminRuntimeController(localTargets);
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

  const uiText = useMemo(() => getAdminDashboardCopy(locale), [locale]);

  useEffect(() => {
    setCompareTargetIds((current) => (current.includes(selectedTargetId) ? current : [...current, selectedTargetId]));
  }, [selectedTargetId]);

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

  const {
    benchmarkCopyState,
    benchmarkEvidencePendingRunId,
    handleCopyBenchmarkRunNote,
    openBenchmarkReportMarkdown,
    toggleBenchmarkReleaseEvidence,
  } = useAdminBenchmarkInteractions({
    benchmarkTargetIds,
    benchmarkHeatmapWindowMinutes,
    loadDashboard,
    setError,
  });

  const {
    draft: runtimeGuardrailDraft,
    setDraft: setRuntimeGuardrailDraft,
    defaults: runtimeGuardrailDefaults,
    pending: runtimeGuardrailPending,
    message: runtimeGuardrailMessage,
    policyFile: runtimeGuardrailPolicyFile,
    load: loadRuntimeGuardrailPolicy,
    save: saveRuntimeGuardrailPolicy,
    reset: resetRuntimeGuardrailPolicy,
  } = useAdminRuntimeGuardrailController({
    refreshRuntimeStatuses: loadAllRuntimeStatuses,
    refreshDashboard: loadDashboard,
  });

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

  useEffect(() => {
    void loadAllRuntimeStatuses();
  }, []);

  useEffect(() => {
    void loadRuntimeGuardrailPolicy();
  }, [loadRuntimeGuardrailPolicy]);

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
            <WorkspaceGovernancePanel locale={locale} />

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
