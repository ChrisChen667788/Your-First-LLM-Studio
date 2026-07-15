"use client";

import type { AgentBenchmarkReleaseEvidence } from "@/lib/agent/types";
import {
  getFailureSummaryHeadline,
  getFailureSummaryNarrative,
  summarizeBenchmarkFailures,
  type BenchmarkFailureResult,
} from "./failure-analysis";
import {
  benchmarkReportMatchSourceClass,
  formatBenchmarkReportMatchSource,
} from "./release-evidence-formatters";

type HistoryEntryHeader = {
  id: string;
  runId?: string;
  matchSource?: AgentBenchmarkReleaseEvidence["matchSource"];
  generatedAt: string;
  prompt: string;
  benchmarkMode?: "prompt" | "dataset" | "suite";
  promptSetLabel?: string;
  datasetLabel?: string;
  suiteLabel?: string;
  contextWindow: number;
  runs: number;
  providerProfile?: string;
  thinkingMode?: string;
  results: BenchmarkFailureResult[];
};

export function AdminBenchmarkHistoryEntryHeader({
  locale,
  entry,
  labels,
  pinned,
  pending,
  onOpenReport,
  onTogglePin,
}: {
  locale: string;
  entry: HistoryEntryHeader;
  labels: {
    local: string;
    remote: string;
    suite: string;
    dataset: string;
    promptSet: string;
    prompt: string;
    contextWindow: string;
    runs: string;
    providerProfile: string;
    thinkingMode: string;
  };
  pinned: boolean;
  pending: boolean;
  onOpenReport: () => void;
  onTogglePin: () => void | Promise<void>;
}) {
  const isEnglish = locale.startsWith("en");
  const profiles = Array.from(
    new Set(
      entry.results.map(
        (result) => result.providerProfile || entry.providerProfile || "default",
      ),
    ),
  );
  const thinkingModes = Array.from(
    new Set(
      entry.results.map(
        (result) => result.thinkingMode || entry.thinkingMode || "standard",
      ),
    ),
  );
  const localCount = entry.results.filter(
    (result) => (result as { execution?: string }).execution !== "remote",
  ).length;
  const remoteCount = entry.results.length - localCount;
  const executionSummary = [
    localCount ? `${labels.local} ${localCount}` : "",
    remoteCount ? `${labels.remote} ${remoteCount}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const failureSummary = summarizeBenchmarkFailures(
    entry.results,
    entry.providerProfile,
    entry.thinkingMode,
  );
  const sourceLabel =
    entry.benchmarkMode === "suite"
      ? `${labels.suite}: ${entry.suiteLabel || "--"}`
      : entry.benchmarkMode === "dataset"
        ? `${labels.dataset}: ${entry.datasetLabel || "--"}`
        : entry.promptSetLabel
          ? `${labels.promptSet}: ${entry.promptSetLabel}`
          : `${labels.prompt}: ${entry.prompt}`;

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-white">
          {new Date(entry.generatedAt).toLocaleString()}
        </p>
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <p>{sourceLabel}</p>
          <p>
            {labels.contextWindow}: {entry.contextWindow >= 1024 ? `${Math.round(entry.contextWindow / 1024)}K` : entry.contextWindow}
            {" · "}{labels.runs}: {entry.runs}
            {" · "}{labels.providerProfile}: {profiles.length === 1 ? profiles[0] : "mixed"}
            {" · "}{labels.thinkingMode}: {thinkingModes.length === 1 ? thinkingModes[0] : "mixed"}
            {executionSummary ? ` · ${executionSummary}` : ""}
          </p>
        </div>
        {failureSummary ? (
          <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-xs text-amber-50/80">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="font-medium text-amber-100">{getFailureSummaryHeadline(failureSummary, locale)}</div>
              <div>{getFailureSummaryNarrative(failureSummary, locale)}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {failureSummary.groups.slice(0, 4).map((group) => (
                <span key={`${entry.id}:failure:${group.label}`} className="rounded-full border border-amber-300/20 bg-black/20 px-2.5 py-1 text-[11px] text-amber-100" title={group.detail}>
                  {group.label} · {group.count}
                </span>
              ))}
            </div>
            {failureSummary.examples[0] ? (
              <div className="mt-2 text-[11px] text-amber-50/70">
                {isEnglish ? "Example" : "例如"}: {failureSummary.examples[0].targetLabel} · {failureSummary.examples[0].providerProfile} · {failureSummary.examples[0].thinkingMode} · {failureSummary.examples[0].workloadId} · {failureSummary.examples[0].classified.label}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] ${benchmarkReportMatchSourceClass(entry.matchSource)}`}>
          {formatBenchmarkReportMatchSource(locale, entry.matchSource)}
        </span>
        <span className="text-[11px] text-slate-500">{entry.results.length} results</span>
        <button type="button" onClick={onOpenReport} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10">
          {isEnglish ? "Report" : "报告"}
        </button>
        <button type="button" disabled={!entry.runId || pending} onClick={() => void onTogglePin()} className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400">
          {pinned ? (isEnglish ? "Pinned" : "已固定") : isEnglish ? "Pin" : "固定"}
        </button>
      </div>
    </div>
  );
}
