"use client";

import type {
  AgentFineTuneJob,
  AgentFineTuneReportExport,
  AgentFineTuneRunComparisonSummary,
} from "@/lib/agent/types";

type FineTuneText = Record<string, string>;
type FineTuneRunDeltaConclusion = NonNullable<
  NonNullable<AgentFineTuneRunComparisonSummary["deltaToPrevious"]>
>["conclusion"];

type FineTuneLatestReportCardProps = {
  job: AgentFineTuneJob;
  latestReport?: AgentFineTuneReportExport | null;
  text: FineTuneText;
  isEnglish: boolean;
  actionPending: Record<string, boolean>;
  copyValue: (value: string, message?: string) => void | Promise<void>;
  onOpenReports: (jobId: string) => void | Promise<void>;
  getRunDeltaConclusionLabel: (
    value: FineTuneRunDeltaConclusion | undefined,
    isEnglish: boolean,
  ) => string;
  formatSignedNumber: (value?: number | null, digits?: number) => string;
  formatSignedDurationMs: (value?: number | null) => string;
  formatSignedInteger: (value?: number | null) => string;
};

export function FineTuneLatestReportCard({
  job,
  latestReport,
  text,
  isEnglish,
  actionPending,
  copyValue,
  onOpenReports,
  getRunDeltaConclusionLabel,
  formatSignedNumber,
  formatSignedDurationMs,
  formatSignedInteger,
}: FineTuneLatestReportCardProps) {
  if (!latestReport) return null;

  return (
    <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-3 text-[11px] leading-5 text-emerald-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-emerald-100">
            {text.latestReport} · {latestReport.format}
          </p>
          <p className="mt-1 break-all text-emerald-50/75">
            {text.reportPath}: {latestReport.filePath}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/finetune?action=preview-report&id=${encodeURIComponent(job.id)}&reportFormat=${latestReport.format}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-50 transition hover:bg-emerald-200/15"
          >
            {text.previewReport}
          </a>
          <a
            href={`/api/finetune?action=download-bundle&id=${encodeURIComponent(job.id)}`}
            download
            title={text.completeBundleHint}
            className="rounded-full border border-violet-200/25 bg-violet-200/10 px-2.5 py-1 text-[10px] font-semibold text-violet-50 transition hover:bg-violet-200/15"
          >
            {text.downloadFullBundle}
          </a>
          <button
            type="button"
            onClick={() => void copyValue(latestReport.filePath, text.copied)}
            className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-50 transition hover:bg-emerald-200/15"
          >
            {text.copyReportPath}
          </button>
          <button
            type="button"
            onClick={() => void onOpenReports(job.id)}
            className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-50 transition hover:bg-emerald-200/15"
          >
            {actionPending[`job-reports:${job.id}`]
              ? text.loading
              : text.openReports}
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-emerald-50/70">
        <span className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2 py-0.5">
          {text.reportPoints}: {latestReport.metricsSummary.pointCount}
        </span>
        <span className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2 py-0.5">
          {text.reportLatestStep}:{" "}
          {latestReport.metricsSummary.latestStep ?? "--"}
        </span>
      </div>
      {latestReport.runComparison ? (
        <div className="mt-3 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.06] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-50/70">
              {text.runComparison}
            </p>
            <span className="rounded-full border border-cyan-200/15 bg-cyan-200/10 px-2 py-0.5 text-[10px] text-cyan-50/70">
              {latestReport.runComparison.adapterName}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-cyan-200/15 bg-black/15 px-2 py-2">
              <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-50/50">
                {text.runsCompared}
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">
                {latestReport.runComparison.runCount}
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200/15 bg-black/15 px-2 py-2">
              <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-50/50">
                {text.bestValLoss}
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">
                {typeof latestReport.runComparison.bestValidationLoss ===
                "number"
                  ? latestReport.runComparison.bestValidationLoss.toFixed(4)
                  : "--"}
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200/15 bg-black/15 px-2 py-2">
              <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-50/50">
                {text.latestValLoss}
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">
                {typeof latestReport.runComparison.latestValidationLoss ===
                "number"
                  ? latestReport.runComparison.latestValidationLoss.toFixed(4)
                  : "--"}
              </p>
            </div>
          </div>
          {latestReport.runComparison.deltaToPrevious ? (
            <div className="mt-3 rounded-xl border border-cyan-200/15 bg-black/20 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-50/50">
                  {text.runDelta}
                </p>
                <span className="rounded-full border border-cyan-200/15 bg-cyan-200/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-50">
                  {text.deltaConclusion}:{" "}
                  {getRunDeltaConclusionLabel(
                    latestReport.runComparison.deltaToPrevious.conclusion,
                    isEnglish,
                  )}
                </span>
              </div>
              <p className="mt-2 break-all text-[10px] text-cyan-50/60">
                {text.previousRun}:{" "}
                {latestReport.runComparison.deltaToPrevious.previousJobId}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-5">
                {[
                  {
                    label: text.trainDelta,
                    value: formatSignedNumber(
                      latestReport.runComparison.deltaToPrevious
                        .trainLatestDelta,
                      4,
                    ),
                  },
                  {
                    label: text.validDelta,
                    value: formatSignedNumber(
                      latestReport.runComparison.deltaToPrevious
                        .validLatestDelta,
                      4,
                    ),
                  },
                  {
                    label: text.bestValidDelta,
                    value: formatSignedNumber(
                      latestReport.runComparison.deltaToPrevious.validBestDelta,
                      4,
                    ),
                  },
                  {
                    label: text.durationDelta,
                    value: formatSignedDurationMs(
                      latestReport.runComparison.deltaToPrevious
                        .durationMsDelta,
                    ),
                  },
                  {
                    label: text.stepDelta,
                    value: formatSignedInteger(
                      latestReport.runComparison.deltaToPrevious
                        .latestStepDelta,
                    ),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-cyan-200/10 bg-cyan-200/[0.04] px-2 py-1.5"
                  >
                    <p className="text-[8px] uppercase tracking-[0.14em] text-cyan-50/45">
                      {item.label}
                    </p>
                    <p className="mt-1 font-semibold text-cyan-50">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {latestReport.evidence ? (
        <div className="mt-3 rounded-2xl border border-emerald-200/15 bg-black/15 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-50/70">
              {text.evidenceSummary}
            </p>
            <span className="rounded-full border border-emerald-200/15 bg-emerald-200/10 px-2 py-0.5 text-[10px] text-emerald-50/70">
              {latestReport.evidence.compareEvents.length ||
              latestReport.evidence.benchmarkRuns.length
                ? text.evidenceReady
                : text.evidenceMissing}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {[
              {
                label: text.evidenceTimeline,
                value: latestReport.evidence.timelineEvents.length,
              },
              {
                label: text.evidenceCompare,
                value: latestReport.evidence.compareEvents.length,
              },
              {
                label: text.evidenceBenchmark,
                value: latestReport.evidence.benchmarkEvents.length,
              },
              {
                label: text.evidenceBenchmarkRuns,
                value: latestReport.evidence.benchmarkRuns.length,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-emerald-200/15 bg-emerald-200/[0.06] px-2 py-2"
              >
                <p className="text-[9px] uppercase tracking-[0.16em] text-emerald-50/50">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-50">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
