import type {
  ReactNode,
} from "react";
import type {
  AgentCompareLaneResult,
  AgentCompareResponse,
  AgentCompareReviewSummaryDetail,
  AgentCompareReviewSummaryTone,
} from "@/lib/agent/types";
import { formatContextWindowLabel } from "./compare-utils";

export type CompareReviewRow = {
  lane: AgentCompareLaneResult;
  overlap: number;
  lengthDelta: number;
  schemaStatus: string;
  isBase: boolean;
};

type CompareReviewLayoutCopy = {
  primaryResult: string;
  secondaryDiffs: string;
  secondaryDiffsHint: string;
  openDrawer: string;
  drawerNotes: string;
};

export type CompareReviewDrawerProps = {
  locale: string;
  copy: Record<string, string>;
  copyState: string;
  comparePending: boolean;
  compareResult: AgentCompareResponse | null;
  compareReviewSummaryTone: AgentCompareReviewSummaryTone;
  compareReviewSummaryDetail: AgentCompareReviewSummaryDetail;
  primaryReviewRow: CompareReviewRow | null;
  secondaryReviewRows: CompareReviewRow[];
  reviewLayoutCopy: CompareReviewLayoutCopy;
  onRerunLane: (targetId: string) => void;
  onSetBaseLane: (targetId: string) => void;
  onCopy: (text: string, key: string) => void;
  onExportLaneMarkdown: (targetId: string) => void;
  onPreviewLaneMarkdown: (targetId: string) => void;
  onCopyLaneMarkdown: (targetId: string) => void;
  onCopyLaneReviewSummary: (targetId: string) => void;
  onCompareReviewSummaryToneChange: (
    value: AgentCompareReviewSummaryTone,
  ) => void;
  onCompareReviewSummaryDetailChange: (
    value: AgentCompareReviewSummaryDetail,
  ) => void;
};

export function CompareReviewDrawer({
  locale,
  copy,
  copyState,
  comparePending,
  compareResult,
  compareReviewSummaryTone,
  compareReviewSummaryDetail,
  primaryReviewRow,
  secondaryReviewRows,
  reviewLayoutCopy,
  onRerunLane,
  onSetBaseLane,
  onCopy,
  onExportLaneMarkdown,
  onPreviewLaneMarkdown,
  onCopyLaneMarkdown,
  onCopyLaneReviewSummary,
  onCompareReviewSummaryToneChange,
  onCompareReviewSummaryDetailChange,
}: CompareReviewDrawerProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {copy.resultReview}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {copy.resultReviewHint}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              {copy.reviewSummaryTone}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">
              {copy.reviewSummaryToneHint}
            </p>
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              {(
                [
                  ["issue", copy.reviewSummaryToneIssue],
                  ["pr", copy.reviewSummaryTonePr],
                  ["chat", copy.reviewSummaryToneChat],
                ] as Array<[AgentCompareReviewSummaryTone, string]>
              ).map(([tone, label]) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => onCompareReviewSummaryToneChange(tone)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                    compareReviewSummaryTone === tone
                      ? "bg-cyan-400/15 text-cyan-50"
                      : "text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              {copy.reviewSummaryDetail}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">
              {copy.reviewSummaryDetailHint}
            </p>
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              {(
                [
                  ["compact", copy.reviewSummaryDetailCompact],
                  ["strict-review", copy.reviewSummaryDetailStrict],
                  ["friendly-report", copy.reviewSummaryDetailFriendly],
                ] as Array<[AgentCompareReviewSummaryDetail, string]>
              ).map(([detail, label]) => (
                <button
                  key={detail}
                  type="button"
                  onClick={() => onCompareReviewSummaryDetailChange(detail)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                    compareReviewSummaryDetail === detail
                      ? "bg-violet-400/15 text-violet-50"
                      : "text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {compareResult ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {copy.latestRun}
              </p>
              <p className="mt-1 text-xs text-white">
                {new Date(compareResult.generatedAt).toLocaleString()}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {!compareResult ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-slate-400">
          {copy.noResults}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {primaryReviewRow ? (
            <article className="rounded-[26px] border border-cyan-400/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.88))] px-4 py-4 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                    {reviewLayoutCopy.primaryResult}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-white">
                      {primaryReviewRow.lane.targetLabel}
                    </p>
                    <span className="rounded-full bg-cyan-400/10 px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                      {copy.baseLaneTag}
                    </span>
                    <span
                      className={`rounded-full px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] ${
                        primaryReviewRow.lane.ok
                          ? "bg-emerald-400/10 text-emerald-200"
                          : "bg-rose-400/10 text-rose-200"
                      }`}
                    >
                      {primaryReviewRow.lane.ok
                        ? copy.laneOk
                        : copy.laneFailed}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    {primaryReviewRow.lane.providerLabel} ·{" "}
                    {primaryReviewRow.lane.resolvedModel}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRerunLane(primaryReviewRow.lane.targetId)}
                    disabled={comparePending}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {copy.rerunLane}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onCopy(
                        primaryReviewRow.lane.content ||
                          primaryReviewRow.lane.warning ||
                          "",
                        `compare:${primaryReviewRow.lane.targetId}`,
                      )
                    }
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {copyState === `compare:${primaryReviewRow.lane.targetId}`
                      ? copy.copied
                      : copy.copyOutput}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onExportLaneMarkdown(primaryReviewRow.lane.targetId)
                    }
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {copy.exportLane}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewLaneMarkdown(primaryReviewRow.lane.targetId)
                    }
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {copy.previewLane}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <pre className="min-h-[220px] max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-xs leading-6 text-slate-100">
                  {primaryReviewRow.lane.content ||
                    primaryReviewRow.lane.warning ||
                    "—"}
                </pre>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReviewMetric label={copy.actualContext}>
                      {formatContextWindowLabel(primaryReviewRow.lane.contextWindow)}
                    </ReviewMetric>
                    <ReviewMetric label={locale.startsWith("en") ? "Latency" : "耗时"}>
                      {primaryReviewRow.lane.latencyMs.toFixed(1)} ms
                    </ReviewMetric>
                    <ReviewMetric label={copy.overlap}>
                      {(primaryReviewRow.overlap * 100).toFixed(0)}%
                    </ReviewMetric>
                    <ReviewMetric label={copy.schema}>
                      {primaryReviewRow.schemaStatus}
                    </ReviewMetric>
                  </div>
                  {primaryReviewRow.lane.usage ? (
                    <UsageChips copy={copy} usage={primaryReviewRow.lane.usage} />
                  ) : null}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {copy.fairnessFingerprint}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-slate-300">
                      {compareResult.fairnessFingerprint}
                    </p>
                  </div>
                  {primaryReviewRow.lane.warning ? (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-xs leading-6 text-amber-100">
                      <span className="font-semibold">{copy.warning}: </span>
                      {primaryReviewRow.lane.warning}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ) : null}

          {secondaryReviewRows.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    {reviewLayoutCopy.secondaryDiffs}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {reviewLayoutCopy.secondaryDiffsHint}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300">
                  {secondaryReviewRows.length}
                </span>
              </div>
              <div className="mt-4 grid gap-3 2xl:grid-cols-2">
                {secondaryReviewRows.map(
                  ({ lane, overlap, lengthDelta, schemaStatus }) => (
                    <details
                      key={`${compareResult.runId}:${lane.targetId}`}
                      className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-4"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-white">
                                {lane.targetLabel}
                              </p>
                              <span
                                className={`rounded-full px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] ${
                                  lane.ok
                                    ? "bg-emerald-400/10 text-emerald-200"
                                    : "bg-rose-400/10 text-rose-200"
                                }`}
                              >
                                {lane.ok ? copy.laneOk : copy.laneFailed}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-6 text-slate-400">
                              {lane.providerLabel} · {lane.resolvedModel}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200">
                            {reviewLayoutCopy.openDrawer}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-2 text-xs leading-6 text-slate-300 sm:grid-cols-2">
                          <p>
                            {copy.overlap}: {(overlap * 100).toFixed(0)}%
                          </p>
                          <p>
                            {copy.lengthDelta}:{" "}
                            {lengthDelta >= 0 ? `+${lengthDelta}` : `${lengthDelta}`}
                          </p>
                          <p>
                            {copy.schema}: {schemaStatus}
                          </p>
                          <p>
                            {locale.startsWith("en") ? "Latency" : "耗时"}:{" "}
                            {lane.latencyMs.toFixed(1)} ms
                          </p>
                        </div>
                      </summary>

                      <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onRerunLane(lane.targetId)}
                            disabled={comparePending}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {copy.rerunLane}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSetBaseLane(lane.targetId)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            {copy.setBaseLane}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onCopy(
                                lane.content || lane.warning || "",
                                `compare:${lane.targetId}`,
                              )
                            }
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            {copyState === `compare:${lane.targetId}`
                              ? copy.copied
                              : copy.copyOutput}
                          </button>
                          <button
                            type="button"
                            onClick={() => onExportLaneMarkdown(lane.targetId)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            {copy.exportLane}
                          </button>
                          <button
                            type="button"
                            onClick={() => onPreviewLaneMarkdown(lane.targetId)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            {copy.previewLane}
                          </button>
                          <button
                            type="button"
                            onClick={() => onCopyLaneMarkdown(lane.targetId)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            {copyState ===
                            `compare:lane-markdown:${lane.targetId}`
                              ? copy.copied
                              : copy.copyLaneMarkdown}
                          </button>
                          <button
                            type="button"
                            onClick={() => onCopyLaneReviewSummary(lane.targetId)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            {copyState ===
                            `compare:lane-summary:${lane.targetId}`
                              ? copy.copied
                              : copy.copyLaneReviewSummary}
                          </button>
                        </div>

                        {lane.warning ? (
                          <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-xs leading-6 text-amber-100">
                            <span className="font-semibold">
                              {copy.warning}:{" "}
                            </span>
                            {lane.warning}
                          </div>
                        ) : null}

                        {lane.usage ? (
                          <UsageChips copy={copy} usage={lane.usage} subdued />
                        ) : null}

                        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          {reviewLayoutCopy.drawerNotes}
                        </p>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs leading-6 text-slate-200">
                          {lane.content || lane.warning || "—"}
                        </pre>
                      </div>
                    </details>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ReviewMetric({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-white">{children}</p>
    </div>
  );
}

function UsageChips({
  copy,
  usage,
  subdued = false,
}: {
  copy: Record<string, string>;
  usage: NonNullable<AgentCompareLaneResult["usage"]>;
  subdued?: boolean;
}) {
  const textClass = subdued ? "text-slate-400" : "text-slate-300";
  return (
    <div className={`mt-3 flex flex-wrap gap-2 text-[11px] ${textClass}`}>
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
        {copy.usage}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
        {copy.promptTokens} {usage.promptTokens}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
        {copy.completionTokens} {usage.completionTokens}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
        {copy.totalTokens} {usage.totalTokens}
      </span>
    </div>
  );
}
