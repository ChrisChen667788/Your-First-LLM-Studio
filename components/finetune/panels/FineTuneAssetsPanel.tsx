"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  AgentFineTuneDataset,
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
}: FineTuneAssetsPanelProps) {
  const localTargets = summary?.localTargets || [];
  const datasets = summary?.datasets || [];
  const adapters = summary?.adapters || [];

  return (
    <>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            {text.localTargets}
          </p>
          <span className="text-xs text-slate-500">{localTargets.length}</span>
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
