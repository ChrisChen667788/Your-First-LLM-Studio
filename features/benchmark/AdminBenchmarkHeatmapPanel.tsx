"use client";

import { useMemo } from "react";
import type { AdminBenchmarkHeatmapMetricKey } from "@/features/admin/dashboard-filter-state";
import {
  buildDirectionalHeatmapCellClass,
  getHeatmapRecommendation,
} from "./analysis-formatters";

type HeatmapRow = {
  providerProfile: string;
  cells: Array<{
    thinkingMode: string;
    sampleCount: number;
    avgFirstTokenLatencyMs: number;
    avgLatencyMs: number;
    avgTokenThroughputTps: number;
    avgSuccessRate: number;
  }>;
};

type HeatmapTarget = {
  id: string;
  label: string;
  modelDefault: string;
  thinkingModelDefault?: string;
};

function formatTargetModelVersion(modelDefault: string, thinkingModelDefault?: string) {
  return thinkingModelDefault && thinkingModelDefault !== modelDefault
    ? `${modelDefault} · Thinking ${thinkingModelDefault}`
    : modelDefault;
}

export function AdminBenchmarkHeatmapPanel({
  locale,
  rows,
  targets,
  selectedTargetIds,
  targetVersions,
  metric,
  setMetric,
  windowMinutes,
  setWindowMinutes,
  promptScope,
  setPromptScope,
  sampleStatus,
  setSampleStatus,
  labels,
}: {
  locale: string;
  rows: HeatmapRow[];
  targets: HeatmapTarget[];
  selectedTargetIds: string[];
  targetVersions: Array<{
    targetId: string;
    standardResolvedModel: string;
    thinkingResolvedModel?: string | null;
  }>;
  metric: AdminBenchmarkHeatmapMetricKey;
  setMetric: (value: AdminBenchmarkHeatmapMetricKey) => void;
  windowMinutes: number;
  setWindowMinutes: (value: number) => void;
  promptScope: "all" | "fixed-only";
  setPromptScope: (value: "all" | "fixed-only") => void;
  sampleStatus: "all" | "success" | "failed";
  setSampleStatus: (value: "all" | "success" | "failed") => void;
  labels: Record<string, string>;
}) {
  const values = rows
    .flatMap((row) => row.cells.map((cell) => metricValue(cell, metric)))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const higherIsBetter = metric === "throughput" || metric === "success-rate";
  const selectedTargets = useMemo(
    () => targets.filter((target) => selectedTargetIds.includes(target.id)),
    [selectedTargetIds, targets],
  );
  const versionMap = useMemo(
    () => new Map(targetVersions.map((entry) => [entry.targetId, entry])),
    [targetVersions],
  );
  const scopeSummary = buildScopeSummary(locale, selectedTargets, versionMap);
  const noSamples = locale.startsWith("en") ? "No samples yet" : "暂无样本";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-400">{labels.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500">{labels.providerProfile} × {labels.thinkingMode}</span>
          <select value={windowMinutes} onChange={(event) => setWindowMinutes(Number(event.target.value))} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-100 outline-none">
            {[60, 180, 720, 1440].map((value) => <option key={value} value={value}>{labels.window}: {value}m</option>)}
          </select>
          <select value={promptScope} onChange={(event) => setPromptScope(event.target.value as "all" | "fixed-only")} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-100 outline-none">
            <option value="all">{labels.promptScope}: {labels.allPrompts}</option>
            <option value="fixed-only">{labels.promptScope}: {labels.fixedPrompts}</option>
          </select>
          <select value={sampleStatus} onChange={(event) => setSampleStatus(event.target.value as "all" | "success" | "failed")} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-100 outline-none">
            <option value="all">{labels.sampleStatus}: {labels.allSamples}</option>
            <option value="success">{labels.sampleStatus}: {labels.successSamples}</option>
            <option value="failed">{labels.sampleStatus}: {labels.failedSamples}</option>
          </select>
          <select value={metric} onChange={(event) => setMetric(event.target.value as AdminBenchmarkHeatmapMetricKey)} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-slate-100 outline-none">
            <option value="first-token">{labels.metric}: {labels.firstToken}</option>
            <option value="total-latency">{labels.metric}: {labels.totalLatency}</option>
            <option value="throughput">{labels.metric}: {labels.throughput}</option>
            <option value="success-rate">{labels.metric}: {labels.successRate}</option>
          </select>
        </div>
      </div>
      <div className="mt-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <p className="text-xs font-medium text-slate-100">{scopeSummary}</p>
        <p className="mt-1 text-xs leading-6 text-slate-500">{locale.startsWith("en") ? "This heatmap compares strategy combinations for the selected targets, not a single-model leaderboard." : "这个热力图比较所选目标在不同策略组合下的表现，不是单一模型能力榜单。"}</p>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-400"><tr><th className="px-3 py-2">{labels.providerProfile}</th><th className="px-3 py-2">standard</th><th className="px-3 py-2">thinking</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.providerProfile} className="border-t border-white/10">
                <td className="px-3 py-2 text-slate-100">{row.providerProfile}</td>
                {row.cells.map((cell) => {
                  const hasSamples = cell.sampleCount > 0;
                  const value = metricValue(cell, metric);
                  return (
                    <td key={`${row.providerProfile}:${cell.thinkingMode}`} className="px-3 py-2">
                      <div className={`rounded-xl border border-white/10 px-3 py-3 ${hasSamples ? buildDirectionalHeatmapCellClass(value, min, max, higherIsBetter) : "bg-slate-950/70"}`}>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-200">{cell.thinkingMode}</div>
                        <div className="mt-2 text-sm font-semibold text-white">{hasSamples ? formatMetric(cell, metric, labels.tokensPerSecond) : noSamples}</div>
                        <div className="mt-2 text-xs leading-6 text-slate-100">
                          <div>{labels.firstToken}: {hasSamples ? `${cell.avgFirstTokenLatencyMs.toFixed(1)} ms` : noSamples}</div>
                          <div>{labels.totalLatency}: {hasSamples ? `${cell.avgLatencyMs.toFixed(1)} ms` : noSamples}</div>
                          <div>{labels.throughput}: {hasSamples ? `${cell.avgTokenThroughputTps.toFixed(2)} ${labels.tokensPerSecond}` : noSamples}</div>
                          <div>{labels.successRate}: {hasSamples ? `${cell.avgSuccessRate.toFixed(1)}%` : noSamples}</div>
                          <div>{locale.startsWith("en") ? "Recommended use" : "推荐用途"}: {getHeatmapRecommendation(row.providerProfile, cell.thinkingMode, hasSamples, locale)}</div>
                          <div>{hasSamples ? `n=${cell.sampleCount}` : noSamples}</div>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function metricValue(cell: HeatmapRow["cells"][number], metric: AdminBenchmarkHeatmapMetricKey) {
  if (metric === "first-token") return cell.avgFirstTokenLatencyMs;
  if (metric === "throughput") return cell.avgTokenThroughputTps;
  if (metric === "success-rate") return cell.avgSuccessRate;
  return cell.avgLatencyMs;
}

function formatMetric(cell: HeatmapRow["cells"][number], metric: AdminBenchmarkHeatmapMetricKey, tokensPerSecond: string) {
  if (metric === "first-token") return `${cell.avgFirstTokenLatencyMs.toFixed(1)} ms`;
  if (metric === "throughput") return `${cell.avgTokenThroughputTps.toFixed(2)} ${tokensPerSecond}`;
  if (metric === "success-rate") return `${cell.avgSuccessRate.toFixed(1)}%`;
  return `${cell.avgLatencyMs.toFixed(1)} ms`;
}

function buildScopeSummary(
  locale: string,
  targets: HeatmapTarget[],
  versions: Map<string, { standardResolvedModel: string; thinkingResolvedModel?: string | null }>,
) {
  const en = locale.startsWith("en");
  if (!targets.length) return en ? "No benchmark target selected." : "当前没有选中 benchmark 目标。";
  if (targets.length === 1) {
    const target = targets[0];
    const version = versions.get(target.id);
    const versionLabel = version
      ? formatTargetModelVersion(version.standardResolvedModel, version.thinkingResolvedModel || undefined)
      : formatTargetModelVersion(target.modelDefault, target.thinkingModelDefault);
    return en ? `Current target: ${target.label} · ${versionLabel}` : `当前评测对象：${target.label} · ${versionLabel}`;
  }
  const preview = targets.slice(0, 3).map((target) => target.label).join(" / ");
  const extra = targets.length > 3 ? ` +${targets.length - 3}` : "";
  return en ? `Current scope: ${targets.length} targets aggregated · ${preview}${extra}` : `当前评测对象：${targets.length} 个 target 聚合 · ${preview}${extra}`;
}
