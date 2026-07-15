"use client";

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AgentFineTuneDataset,
  AgentFineTuneAdapterExportPlan,
  AgentFineTuneAdapterVariantDiff,
  AgentFineTuneOperation,
  AgentFineTuneSummary,
} from "@/lib/agent/types";
import type { FineTuneAssetJobActions } from "@/features/finetune/job-actions";
import { FineTuneAdapterCard } from "./FineTuneAdapterCard";
import { FineTuneReportsPanel } from "./FineTuneReportsPanel";

type DatasetWatchDraft = {
  upstreamQuery: string;
  refreshCadenceHours: number;
};

type LifecycleStatusFilter =
  | "all"
  | "ready"
  | "checkpointing"
  | "incomplete"
  | "attached";
type LifecycleDiffFilter = "all" | AgentFineTuneAdapterVariantDiff["conclusion"];
type LifecycleExportFilter = "all" | AgentFineTuneAdapterExportPlan["exportFormat"];

type FineTuneAssetsPanelProps = {
  summary: AgentFineTuneSummary | null;
  text: Record<string, string>;
  actionPending: Record<string, boolean>;
  operations: AgentFineTuneOperation[];
  getDatasetWatchDraft: (dataset: AgentFineTuneDataset) => DatasetWatchDraft;
  setDatasetWatchDrafts: Dispatch<SetStateAction<Record<string, DatasetWatchDraft>>>;
  assetActions: FineTuneAssetJobActions;
  copyValue: (value: string, message?: string) => void | Promise<void>;
  formatDateTime: (value?: string) => string;
  formatQualityScore: (score?: number | null) => string;
  formatSampleCount: (count?: number | null) => string;
  onAttachAdapterRuntime: (adapterId: string) => void | Promise<void>;
  onDetachAdapterRuntime: (adapterId: string) => void | Promise<void>;
  onRunAdapterBenchmarkHandoff: (adapterId: string) => void | Promise<void>;
  onRunAdapterCompareHandoff: (adapterId: string) => void | Promise<void>;
  onRunAdapterProofLoop: (adapterId: string) => void | Promise<void>;
  onRecordLifecycleExportPlan: (adapterId: string) => void | Promise<void>;
  onRunLifecycleRollbackProof: (adapterId: string) => void | Promise<void>;
};

export function FineTuneAssetsPanel({
  summary,
  text,
  actionPending,
  operations,
  getDatasetWatchDraft,
  setDatasetWatchDrafts,
  assetActions,
  copyValue,
  formatDateTime,
  formatQualityScore,
  formatSampleCount,
  onAttachAdapterRuntime,
  onDetachAdapterRuntime,
  onRunAdapterBenchmarkHandoff,
  onRunAdapterCompareHandoff,
  onRunAdapterProofLoop,
  onRecordLifecycleExportPlan,
  onRunLifecycleRollbackProof,
}: FineTuneAssetsPanelProps) {
  const localTargets = summary?.localTargets || [];
  const datasets = summary?.datasets || [];
  const adapters = summary?.adapters || [];
  const readyAdapters = adapters.filter((adapter) => adapter.status === "ready");
  const adaptersWithBestCheckpoint = readyAdapters.filter(
    (adapter) => adapter.bestCheckpoint,
  );
  const missingBestCheckpointCount =
    readyAdapters.length - adaptersWithBestCheckpoint.length;
  const bestCheckpointCoverage = readyAdapters.length
    ? Math.round((adaptersWithBestCheckpoint.length / readyAdapters.length) * 100)
    : 0;
  const lifecycle = summary?.lifecycle;
  const [lifecycleStatusFilter, setLifecycleStatusFilter] =
    useState<LifecycleStatusFilter>("all");
  const [lifecycleDiffFilter, setLifecycleDiffFilter] =
    useState<LifecycleDiffFilter>("all");
  const [lifecycleExportFilter, setLifecycleExportFilter] =
    useState<LifecycleExportFilter>("all");
  const [selectedLifecycleVariantId, setSelectedLifecycleVariantId] =
    useState<string | null>(null);

  const lifecycleExportPlansByAdapterId = useMemo(() => {
    const grouped = new Map<string, AgentFineTuneAdapterExportPlan[]>();
    (lifecycle?.exportPlans || []).forEach((plan) => {
      const current = grouped.get(plan.adapterId) || [];
      current.push(plan);
      grouped.set(plan.adapterId, current);
    });
    return grouped;
  }, [lifecycle?.exportPlans]);
  const lifecycleExportFormatOptions = useMemo(
    () =>
      Array.from(
        new Set((lifecycle?.exportPlans || []).map((plan) => plan.exportFormat)),
      ).sort(),
    [lifecycle?.exportPlans],
  );
  const lifecycleStatusOptions: Array<{
    id: LifecycleStatusFilter;
    label: string;
  }> = [
    { id: "all", label: text.lifecycleStatusAll },
    { id: "ready", label: text.lifecycleStatusReady },
    { id: "checkpointing", label: text.lifecycleStatusCheckpointing },
    { id: "incomplete", label: text.lifecycleStatusIncomplete },
    { id: "attached", label: text.lifecycleStatusAttached },
  ];
  const lifecycleDiffOptions: Array<{
    id: LifecycleDiffFilter;
    label: string;
  }> = [
    { id: "all", label: text.lifecycleDiffAll },
    { id: "improved", label: text.lifecycleDiffImproved },
    { id: "regressed", label: text.lifecycleDiffRegressed },
    { id: "stable", label: text.lifecycleDiffStable },
    { id: "mixed", label: text.lifecycleDiffMixed },
    { id: "insufficient-data", label: text.lifecycleDiffInsufficient },
  ];
  const filteredLifecycleVariants = useMemo(
    () =>
      (lifecycle?.variants || []).filter((variant) => {
        const statusMatches =
          lifecycleStatusFilter === "all"
            ? true
            : lifecycleStatusFilter === "attached"
              ? Boolean(variant.attachedTargetId)
              : variant.status === lifecycleStatusFilter;
        const diffMatches =
          lifecycleDiffFilter === "all"
            ? true
            : variant.diff.conclusion === lifecycleDiffFilter;
        const exportMatches =
          lifecycleExportFilter === "all"
            ? true
            : (lifecycleExportPlansByAdapterId.get(variant.adapterId) || []).some(
                (plan) => plan.exportFormat === lifecycleExportFilter,
              );
        return statusMatches && diffMatches && exportMatches;
      }),
    [
      lifecycle?.variants,
      lifecycleDiffFilter,
      lifecycleExportFilter,
      lifecycleExportPlansByAdapterId,
      lifecycleStatusFilter,
    ],
  );
  const selectedLifecycleVariant =
    filteredLifecycleVariants.find(
      (variant) => variant.id === selectedLifecycleVariantId,
    ) ||
    filteredLifecycleVariants[0] ||
    null;
  const selectedLifecycleExportPlans = selectedLifecycleVariant
    ? lifecycleExportPlansByAdapterId.get(selectedLifecycleVariant.adapterId) || []
    : [];
  const selectedLifecycleRollbackProofs = selectedLifecycleVariant
    ? (lifecycle?.rollbackProofs || []).filter(
        (proof) => proof.adapterId === selectedLifecycleVariant.adapterId,
      )
    : [];
  const formatLifecycleDelta = (value?: number | null) =>
    typeof value === "number" && Number.isFinite(value)
      ? value > 0
        ? `+${value.toFixed(4).replace(/\.?0+$/, "")}`
        : value.toFixed(4).replace(/\.?0+$/, "")
      : "--";

  return (
    <>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            {text.localTargets}
          </p>
          <span className="text-xs text-slate-500">{localTargets.length}</span>
        </div>
        <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                {text.lifecycleRegistry}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {text.lifecycleRegistryHint}
              </p>
              <p className="mt-2 truncate text-[11px] text-slate-500">
                {lifecycle?.registryPath || "--"}
              </p>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-3">
              {[
                {
                  label: text.lifecycleVariants,
                  value: lifecycle?.totals.variants || 0,
                },
                {
                  label: text.lifecycleDiffs,
                  value: lifecycle?.totals.variantDiffs || 0,
                },
                {
                  label: text.lifecycleExportPlans,
                  value: lifecycle?.totals.exportPlans || 0,
                },
                {
                  label: text.lifecycleRollbackProofs,
                  value: lifecycle?.totals.rollbackProofs || 0,
                },
                {
                  label: text.lifecycleActions,
                  value: lifecycle?.totals.lifecycleActions || 0,
                },
              ].map((item) => (
                <span
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                >
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-lg font-semibold text-white">
                    {item.value}
                  </span>
                </span>
              ))}
            </div>
          </div>
          {lifecycle?.rollbackProofs.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {lifecycle.rollbackProofs.slice(0, 3).map((proof) => (
                <span
                  key={proof.id}
                  className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-50"
                  title={proof.summary}
                >
                  {proof.adapterName} · {proof.status}
                </span>
              ))}
            </div>
          ) : null}
          {lifecycle ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                      {text.lifecycleVariantList}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      {filteredLifecycleVariants.length} /{" "}
                      {lifecycle.variants.length}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lifecycleStatusOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLifecycleStatusFilter(option.id)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                          lifecycleStatusFilter === option.id
                            ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-50"
                            : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lifecycleDiffOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLifecycleDiffFilter(option.id)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                          lifecycleDiffFilter === option.id
                            ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-50"
                            : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      {
                        id: "all" as LifecycleExportFilter,
                        label: text.lifecycleExportAll,
                      },
                      ...lifecycleExportFormatOptions.map((format) => ({
                        id: format,
                        label: format,
                      })),
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLifecycleExportFilter(option.id)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                          lifecycleExportFilter === option.id
                            ? "border-violet-300/50 bg-violet-300/15 text-violet-50"
                            : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {filteredLifecycleVariants.length ? (
                      filteredLifecycleVariants.slice(0, 8).map((variant) => {
                        const variantPlans =
                          lifecycleExportPlansByAdapterId.get(variant.adapterId) ||
                          [];
                        const isSelected =
                          selectedLifecycleVariant?.id === variant.id;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() =>
                              setSelectedLifecycleVariantId(variant.id)
                            }
                            className={`min-w-0 rounded-2xl border px-3 py-2 text-left transition ${
                              isSelected
                                ? "border-cyan-300/45 bg-cyan-300/[0.09]"
                                : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"
                            }`}
                          >
                            <span className="block truncate text-xs font-semibold text-white">
                              {variant.adapterName}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                              <span>{variant.status}</span>
                              {variant.attachedTargetId ? (
                                <span className="text-cyan-200">
                                  {text.lifecycleStatusAttached}
                                </span>
                              ) : null}
                              <span>{variant.diff.conclusion}</span>
                              <span>
                                {variantPlans.length}{" "}
                                {text.lifecycleExportPlans}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 text-xs text-slate-500">
                        {text.lifecycleNoVariants}
                      </p>
                    )}
                  </div>
                </div>
                <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3 xl:w-[360px]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {text.lifecycleVariantDetail}
                  </p>
                  {selectedLifecycleVariant ? (
                    <div className="mt-3 space-y-3 text-xs text-slate-300">
                      <div>
                        <p className="truncate text-sm font-semibold text-white">
                          {selectedLifecycleVariant.adapterName}
                        </p>
                        <p className="mt-1 break-all text-[11px] text-slate-500">
                          {selectedLifecycleVariant.adapterId}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <span className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            {text.lifecycleDiffConclusion}
                          </span>
                          <span className="mt-1 block font-semibold text-cyan-100">
                            {selectedLifecycleVariant.diff.conclusion}
                          </span>
                        </span>
                        <span className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            {text.lifecycleUpdatedAt}
                          </span>
                          <span className="mt-1 block font-semibold text-slate-100">
                            {formatDateTime(selectedLifecycleVariant.updatedAt)}
                          </span>
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <span className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-emerald-100/70">
                            {text.lifecycleCheckpointDelta}
                          </span>
                          <span className="mt-1 block font-semibold text-emerald-50">
                            {formatLifecycleDelta(
                              selectedLifecycleVariant.diff.checkpointDelta,
                            )}
                          </span>
                        </span>
                        <span className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-amber-100/70">
                            {text.lifecycleMetricDelta}
                          </span>
                          <span className="mt-1 block font-semibold text-amber-50">
                            {formatLifecycleDelta(
                              selectedLifecycleVariant.diff.bestMetricDelta,
                            )}
                          </span>
                        </span>
                        <span className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.06] px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-violet-100/70">
                            {text.lifecycleExportDelta}
                          </span>
                          <span className="mt-1 block font-semibold text-violet-50">
                            {formatLifecycleDelta(
                              selectedLifecycleVariant.diff.exportDelta,
                            )}
                          </span>
                        </span>
                      </div>
                      <div className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[11px] leading-5 text-slate-400">
                        <p>
                          {text.lifecycleVariantGroup}:{" "}
                          <span className="break-all text-slate-200">
                            {selectedLifecycleVariant.variantGroup}
                          </span>
                        </p>
                        <p>
                          {text.lifecycleBaseTarget}:{" "}
                          <span className="text-slate-200">
                            {selectedLifecycleVariant.baseTargetLabel ||
                              selectedLifecycleVariant.baseTargetId ||
                              "--"}
                          </span>
                        </p>
                        <p>
                          {text.lifecycleBestCheckpoint}:{" "}
                          <span className="text-slate-200">
                            {selectedLifecycleVariant.bestCheckpoint
                              ? `${selectedLifecycleVariant.bestCheckpoint.metric} @ ${selectedLifecycleVariant.bestCheckpoint.step}${
                                  typeof selectedLifecycleVariant.bestCheckpoint
                                    .value === "number"
                                    ? ` · ${selectedLifecycleVariant.bestCheckpoint.value.toFixed(4).replace(/\.?0+$/, "")}`
                                    : ""
                                }`
                              : "--"}
                          </span>
                        </p>
                        <p>
                          {text.lifecycleAttachedTarget}:{" "}
                          <span className="text-slate-200">
                            {selectedLifecycleVariant.attachedTargetId || "--"}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[11px] leading-5 text-slate-400">
                        <p className="font-semibold text-slate-200">
                          {text.lifecycleExportFormats}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedLifecycleExportPlans.length ? (
                            selectedLifecycleExportPlans.map((plan) => (
                              <span
                                key={plan.id}
                                className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300"
                              >
                                {plan.exportFormat} · {plan.quantization} ·{" "}
                                {plan.status}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">--</span>
                          )}
                        </div>
                        <p className="mt-2">
                          {text.lifecycleRollbackProofCount}:{" "}
                          <span className="text-slate-200">
                            {selectedLifecycleRollbackProofs.length}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">
                      {text.lifecycleNoVariants}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          {localTargets.length ? (
            localTargets.map((target) => (
              <div
                key={target.id}
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs leading-6 text-slate-300"
              >
                <p className="font-semibold text-white">{target.label}</p>
                <p className="mt-1 text-slate-400">{target.modelDefault}</p>
                <p>
                  {target.parameterScale || "--"} ·{" "}
                  {target.quantizationLabel || "--"}
                </p>
                <p>
                  {target.recommendedContextWindow
                    ? `${Math.round(target.recommendedContextWindow / 1024)}K`
                    : "--"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {target.sourceUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        void assetActions.openTargetSource(target.id)
                      }
                      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      {actionPending[`target-source:${target.id}`]
                        ? text.loading
                        : text.openSource}
                    </button>
                  ) : null}
                  {target.sourcePath ? (
                    <button
                      type="button"
                      onClick={() => void copyValue(target.sourcePath || "")}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
                    >
                      {text.copyPath}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">{text.empty}</p>
          )}
        </div>

        <FineTuneReportsPanel
          operations={operations}
          text={text}
          formatDateTime={formatDateTime}
          copyValue={copyValue}
        />
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">{text.datasets}</p>
          <span className="text-xs text-slate-500">{datasets.length}</span>
        </div>
        <div className="mt-3 space-y-3">
          {datasets.length ? (
            datasets.map((dataset) => {
              const draft = getDatasetWatchDraft(dataset);
              return (
                <div
                  key={dataset.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs leading-6 text-slate-300"
                >
                  <p className="font-semibold text-white">{dataset.label}</p>
                  <p className="mt-1 text-slate-400">
                    {dataset.format} · {dataset.sampleCount} samples
                  </p>
                  {dataset.quality ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <span className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-3 py-2">
                        {text.qualityScore}:{" "}
                        <span className="font-semibold text-cyan-100">
                          {formatQualityScore(dataset.quality.score)}
                        </span>
                      </span>
                      <span className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2">
                        {text.licenseRisk}:{" "}
                        <span className="font-semibold text-amber-100">
                          {dataset.quality.licenseRisk}
                        </span>
                      </span>
                      <span className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-2">
                        {text.recommendedSteps}:{" "}
                        <span className="font-semibold text-emerald-100">
                          {dataset.quality.recommendedSteps
                            ? `${dataset.quality.recommendedSteps.min}-${dataset.quality.recommendedSteps.max}`
                            : "--"}
                        </span>
                      </span>
                      <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:col-span-3">
                        {text.convertedRows}:{" "}
                        <span className="text-slate-200">
                          {dataset.quality.convertedRows ?? "--"} /{" "}
                          {dataset.quality.downloadedRows ?? "--"}
                        </span>
                        <span className="ml-2 text-slate-500">
                          dup {dataset.quality.duplicateRows ?? 0} · pii{" "}
                          {dataset.quality.piiRiskRows ?? 0}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {dataset.qualityWarnings?.length ? (
                    <ul className="mt-2 space-y-1 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] px-3 py-2 text-[11px] leading-5 text-amber-100">
                      {dataset.qualityWarnings.map((warning) => (
                        <li key={warning}>- {warning}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p>{dataset.sourcePath || "--"}</p>
                  <p>{formatDateTime(dataset.updatedAt)}</p>
                  {dataset.sourcePath ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void assetActions.openDatasetSource(dataset.id)
                        }
                        className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                      >
                        {actionPending[`dataset-open:${dataset.id}`]
                          ? text.loading
                          : text.openDir}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyValue(dataset.sourcePath || "")}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
                      >
                        {text.copyPath}
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <input
                      value={draft.upstreamQuery}
                      onChange={(event) =>
                        setDatasetWatchDrafts((current) => ({
                          ...current,
                          [dataset.id]: {
                            upstreamQuery: event.target.value,
                            refreshCadenceHours:
                              current[dataset.id]?.refreshCadenceHours ||
                              draft.refreshCadenceHours,
                          },
                        }))
                      }
                      placeholder={text.upstreamQuery}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none"
                    />
                    <input
                      value={draft.refreshCadenceHours}
                      onChange={(event) =>
                        setDatasetWatchDrafts((current) => ({
                          ...current,
                          [dataset.id]: {
                            upstreamQuery:
                              current[dataset.id]?.upstreamQuery ||
                              draft.upstreamQuery,
                            refreshCadenceHours:
                              Number(event.target.value) ||
                              draft.refreshCadenceHours,
                          },
                        }))
                      }
                      placeholder={text.refreshCadence}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void assetActions.saveDatasetWatch(dataset.id, draft)
                        }
                        className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-[11px] font-semibold text-violet-100 transition hover:bg-violet-400/15"
                      >
                        {text.datasetWatchSave}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void assetActions.checkUpstreamDatasets(
                            dataset.id,
                            draft,
                          )
                        }
                        className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                      >
                        {text.datasetWatchCheck}
                      </button>
                    </div>
                    <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                      <p>Last check · {formatDateTime(dataset.lastUpstreamCheckedAt)}</p>
                      <p>Next check · {formatDateTime(dataset.nextUpstreamCheckAt)}</p>
                    </div>
                    {dataset.latestUpstreamCandidates?.length ? (
                      <div className="mt-3 space-y-2">
                        {dataset.latestUpstreamCandidates
                          .slice(0, 3)
                          .map((candidate) => (
                            <div
                              key={candidate.id}
                              className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="min-w-0 font-semibold text-white">
                                  {candidate.label}
                                </p>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                                  {candidate.source}
                                </span>
                              </div>
                              <p className="mt-1 break-all text-[11px] text-slate-500">
                                {candidate.repoId}
                              </p>
                              <p className="mt-2 text-[11px] leading-5 text-slate-300">
                                {candidate.summary}
                              </p>
                              <div className="mt-2 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                                <span className="rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-2">
                                  {text.upstreamRows}:{" "}
                                  <span className="text-slate-200">
                                    {formatSampleCount(candidate.sampleCount)}
                                  </span>
                                </span>
                                <span className="rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-2">
                                  {text.lastUpdated}:{" "}
                                  <span className="text-slate-200">
                                    {formatDateTime(candidate.updatedAt)}
                                  </span>
                                </span>
                              </div>
                              {candidate.tags.length ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {candidate.tags.slice(0, 5).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <p className="mt-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-2.5 py-2 text-[11px] leading-5 text-amber-100/85">
                                {text.candidateImportNote}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void assetActions.copyDatasetCandidateImportPlan(
                                      dataset,
                                      candidate,
                                    )
                                  }
                                  className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
                                >
                                  {text.copyImportPlan}
                                </button>
                                <a
                                  href={candidate.repoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-100 transition hover:bg-white/10"
                                >
                                  {text.sourcePage}
                                </a>
                                {candidate.docsUrl ? (
                                  <a
                                    href={candidate.docsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-100 transition hover:bg-white/10"
                                  >
                                    {text.docsPage}
                                  </a>
                                ) : null}
                                {candidate.paperUrl ? (
                                  <a
                                    href={candidate.paperUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-100 transition hover:bg-white/10"
                                  >
                                    {text.paperPage}
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">{text.empty}</p>
          )}
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">{text.adapters}</p>
          <span className="text-xs text-slate-500">{adapters.length}</span>
        </div>
        <div className="mt-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                {text.bestCheckpointCoverage}: {bestCheckpointCoverage}%
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-100/80">
                {text.missingBestCheckpoints}: {missingBestCheckpointCount} /{" "}
                {readyAdapters.length}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">
                {text.bestCheckpointBackfillHint}
              </p>
            </div>
            <button
              type="button"
              disabled={
                missingBestCheckpointCount <= 0 ||
                Boolean(actionPending["adapter-best-checkpoints"])
              }
              onClick={() => void assetActions.backfillBestCheckpoints()}
              className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-semibold text-emerald-50 transition enabled:hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {actionPending["adapter-best-checkpoints"]
                ? text.loading
                : text.backfillBestCheckpoints}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {adapters.length ? (
            adapters.map((adapter) => (
              <FineTuneAdapterCard
                key={adapter.id}
                adapter={adapter}
                text={text}
                actionPending={actionPending}
                formatDateTime={formatDateTime}
                onAttachRuntime={onAttachAdapterRuntime}
                onDetachRuntime={onDetachAdapterRuntime}
                onSendToBenchmark={onRunAdapterBenchmarkHandoff}
                onSendToCompare={onRunAdapterCompareHandoff}
                onRunProofLoop={onRunAdapterProofLoop}
                onRecordLifecycleExportPlan={onRecordLifecycleExportPlan}
                onRunLifecycleRollbackProof={onRunLifecycleRollbackProof}
                onOpenDir={(adapterId) =>
                  void assetActions.openAdapterOutput(adapterId)
                }
                onCopyPath={(outputDir) => void copyValue(outputDir)}
                onOpenSource={(adapterId) =>
                  void assetActions.openAdapterSource(adapterId)
                }
              />
            ))
          ) : (
            <p className="text-sm text-slate-500">{text.empty}</p>
          )}
        </div>
      </div>
    </>
  );
}
