"use client";

import type { BenchmarkReleaseEvidenceSummary } from "./contracts";
import {
  benchmarkReportMatchSourceClass,
  formatBenchmarkReportMatchSource,
} from "./release-evidence-formatters";
import type { AgentBenchmarkReleaseEvidence } from "@/lib/agent/types";

type AdminBenchmarkReleaseEvidencePanelProps = {
  locale: string;
  entries: AgentBenchmarkReleaseEvidence[];
  summary?: BenchmarkReleaseEvidenceSummary;
  pendingRunId: string;
  contextWindowLabel: string;
  onOpenMarkdown: (entry: AgentBenchmarkReleaseEvidence) => void;
  onRemovePin: (entry: AgentBenchmarkReleaseEvidence) => void | Promise<void>;
};

export function AdminBenchmarkReleaseEvidencePanel({
  locale,
  entries,
  summary,
  pendingRunId,
  contextWindowLabel,
  onOpenMarkdown,
  onRemovePin,
}: AdminBenchmarkReleaseEvidencePanelProps) {
  const en = locale.startsWith("en");
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-slate-300">{en ? "Release evidence" : "发布证据"}</p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            {en
              ? "Pinned benchmark runs stay attached to release review and source notes."
              : "固定的 benchmark run 会持续关联发布审阅和来源摘要。"}
          </p>
        </div>
        <span className="text-[11px] text-slate-500">{entries.length}</span>
      </div>
      {summary ? (
        <div className="mt-3 rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">{en ? "Release note summary" : "发布说明摘要"}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {en ? "Pinned evidence is grouped into release-ready source notes." : "已固定证据自动分组为可进入发布说明的来源摘要。"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:min-w-[440px]">
              {[
                [en ? "Matched" : "已匹配", `${summary.totals.matchedRunCount}/${summary.totals.evidenceCount}`],
                [en ? "Groups" : "分组", String(summary.totals.groupCount)],
                [en ? "Success" : "成功率", `${summary.totals.successRatePct}%`],
                [en ? "Review" : "需复核", `${summary.totals.failedRuns}/${summary.totals.skippedRuns}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            {summary.releaseNoteDraft.slice(0, 4).map((line) => (
              <p key={line} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300">{line}</p>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {entries.length ? entries.map((entry) => (
          <article key={`release-evidence:${entry.id}`} className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-white">{entry.title || entry.suiteLabel || entry.datasetLabel || entry.promptSetLabel || entry.prompt}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${benchmarkReportMatchSourceClass(entry.matchSource)}`}>
                    {formatBenchmarkReportMatchSource(locale, entry.matchSource)}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <p>{en ? "Pinned at" : "固定于"}: {new Date(entry.pinnedAt).toLocaleString()}</p>
                  <p>{en ? "Run generated at" : "run 生成于"}: {new Date(entry.generatedAt).toLocaleString()}</p>
                  <p>runId: <span className="font-mono text-slate-300">{entry.runId}</span></p>
                </div>
              </div>
              <div className="grid gap-3 text-xs text-slate-400 sm:grid-cols-2 xl:min-w-[300px] xl:grid-cols-3">
                <div><p className="uppercase tracking-[0.2em] text-slate-500">{en ? "Mode" : "模式"}</p><p className="mt-2 text-sm text-white">{entry.benchmarkMode || "--"}</p></div>
                <div><p className="uppercase tracking-[0.2em] text-slate-500">{contextWindowLabel}</p><p className="mt-2 text-sm text-white">{entry.contextWindow >= 1024 ? `${Math.round(entry.contextWindow / 1024)}K` : entry.contextWindow}</p></div>
                <div><p className="uppercase tracking-[0.2em] text-slate-500">{en ? "Results" : "结果数"}</p><p className="mt-2 text-sm text-white">{entry.results.length}</p></div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onOpenMarkdown(entry)} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100 transition hover:bg-amber-300/20">{en ? "Open markdown" : "打开 Markdown"}</button>
              <button type="button" disabled={pendingRunId === entry.runId} onClick={() => void onRemovePin(entry)} className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-40">{en ? "Remove pin" : "取消固定"}</button>
            </div>
          </article>
        )) : (
          <p className="text-sm text-slate-500">{en ? "Nothing is pinned yet." : "还没有固定的发布证据。"}</p>
        )}
      </div>
    </section>
  );
}
