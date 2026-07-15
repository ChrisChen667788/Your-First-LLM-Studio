"use client";

import { useState } from "react";
import type { BenchmarkHistorySourceFilter } from "@/features/benchmark/AdminBenchmarkHistoryPanel";

export type AdminBenchmarkHeatmapMetricKey =
  | "first-token"
  | "total-latency"
  | "throughput"
  | "success-rate";

export function useAdminDashboardFilterState(input: {
  defaultBenchmarkTargetIds: string[];
}) {
  const [selectedTargetId, setSelectedTargetId] = useState("anthropic-claude");
  const [providerFilter, setProviderFilter] = useState("all");
  const [providerProfileFilter, setProviderProfileFilter] = useState("all");
  const [benchmarkThinkingModeFilter, setBenchmarkThinkingModeFilter] = useState("all");
  const [benchmarkHistorySourceFilter, setBenchmarkHistorySourceFilter] =
    useState<BenchmarkHistorySourceFilter>("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [contextWindowFilter, setContextWindowFilter] = useState("all");
  const [compareTargetIds, setCompareTargetIds] = useState<string[]>(["anthropic-claude"]);
  const [benchmarkTargetIds, setBenchmarkTargetIds] = useState<string[]>(
    input.defaultBenchmarkTargetIds,
  );
  const [benchmarkHeatmapMetric, setBenchmarkHeatmapMetric] =
    useState<AdminBenchmarkHeatmapMetricKey>("total-latency");
  const [benchmarkHeatmapWindowMinutes, setBenchmarkHeatmapWindowMinutes] = useState(720);
  const [benchmarkHeatmapPromptScope, setBenchmarkHeatmapPromptScope] =
    useState<"all" | "fixed-only">("all");
  const [benchmarkHeatmapSampleStatus, setBenchmarkHeatmapSampleStatus] =
    useState<"all" | "success" | "failed">("all");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [autoRefresh, setAutoRefresh] = useState(true);

  return {
    selectedTargetId,
    setSelectedTargetId,
    providerFilter,
    setProviderFilter,
    providerProfileFilter,
    setProviderProfileFilter,
    benchmarkThinkingModeFilter,
    setBenchmarkThinkingModeFilter,
    benchmarkHistorySourceFilter,
    setBenchmarkHistorySourceFilter,
    modelFilter,
    setModelFilter,
    contextWindowFilter,
    setContextWindowFilter,
    compareTargetIds,
    setCompareTargetIds,
    benchmarkTargetIds,
    setBenchmarkTargetIds,
    benchmarkHeatmapMetric,
    setBenchmarkHeatmapMetric,
    benchmarkHeatmapWindowMinutes,
    setBenchmarkHeatmapWindowMinutes,
    benchmarkHeatmapPromptScope,
    setBenchmarkHeatmapPromptScope,
    benchmarkHeatmapSampleStatus,
    setBenchmarkHeatmapSampleStatus,
    windowMinutes,
    setWindowMinutes,
    autoRefresh,
    setAutoRefresh,
  };
}
