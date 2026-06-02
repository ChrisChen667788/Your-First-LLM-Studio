import type { AgentFineTuneJob } from "@/lib/agent/types";

type FineTuneJobActionsCardProps = {
  job: AgentFineTuneJob;
  text: Record<string, string>;
  canStart: boolean;
  hasSourceUrl: boolean;
  actionPending: Record<string, boolean>;
  onStartJob: (jobId: string) => void;
  onRerunJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onOpenOutput: (jobId: string) => void;
  onOpenBundle: (jobId: string) => void;
  onCopyOutputDir: (outputDir: string) => void;
  onOpenSource: (jobId: string) => void;
  onExportMarkdownReport: (jobId: string, copyContent: boolean) => void;
  onExportManifestJson: (jobId: string) => void;
  onExportMetricsCsv: (jobId: string) => void;
};

export function FineTuneJobActionsCard({
  job,
  text,
  canStart,
  hasSourceUrl,
  actionPending,
  onStartJob,
  onRerunJob,
  onCancelJob,
  onOpenOutput,
  onOpenBundle,
  onCopyOutputDir,
  onOpenSource,
  onExportMarkdownReport,
  onExportManifestJson,
  onExportMetricsCsv,
}: FineTuneJobActionsCardProps) {
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canStart}
          onClick={() => onStartJob(job.id)}
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition enabled:hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 fill-current">
            <path d="M3 1.8v8.4L9.8 6 3 1.8Z" />
          </svg>
          {text.startJob}
        </button>
        {job.status === "failed" || job.status === "cancelled" ? (
          <button
            type="button"
            onClick={() => onRerunJob(job.id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-300/15"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 fill-current">
              <path d="M6 1.2a4.8 4.8 0 1 1-4.28 2.62l.97.52A3.7 3.7 0 1 0 6 2.3H4.55V1.2H6Zm-2.9.05v3.4H.4l2.7-3.4Z" />
            </svg>
            {text.rerunJob}
          </button>
        ) : null}
        <button
          type="button"
          disabled={job.status !== "queued" && job.status !== "running"}
          onClick={() => onCancelJob(job.id)}
          className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 transition enabled:hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {text.cancelJob}
        </button>
        <button
          type="button"
          onClick={() => onOpenOutput(job.id)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {actionPending[`job-output:${job.id}`] ? text.loading : text.openDir}
        </button>
        <button
          type="button"
          onClick={() => onOpenBundle(job.id)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {actionPending[`job-bundle:${job.id}`]
            ? text.loading
            : text.openBundle}
        </button>
        <button
          type="button"
          onClick={() => onCopyOutputDir(job.outputDir)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {text.copyPath}
        </button>
        <button
          type="button"
          disabled={!hasSourceUrl}
          onClick={() => onOpenSource(job.id)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {actionPending[`job-source:${job.id}`]
            ? text.loading
            : text.openSource}
        </button>
        <button
          type="button"
          onClick={() => onExportMarkdownReport(job.id, true)}
          className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
        >
          {text.exportMarkdownReport}
        </button>
        <a
          href={`/api/admin/finetune?action=preview-report&id=${encodeURIComponent(job.id)}&reportFormat=markdown`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
        >
          {text.previewReport}
        </a>
        <a
          href={`/api/admin/finetune?action=download-bundle&id=${encodeURIComponent(job.id)}`}
          download
          title={text.completeBundleHint}
          className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-[11px] font-semibold text-violet-100 transition hover:bg-violet-300/15"
        >
          {text.downloadFullBundle}
        </a>
        <button
          type="button"
          onClick={() => onExportManifestJson(job.id)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {text.exportManifestJson}
        </button>
        <button
          type="button"
          onClick={() => onExportMetricsCsv(job.id)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {text.exportMetricsCsv}
        </button>
      </div>
      <p className="mt-2 rounded-2xl border border-violet-200/15 bg-violet-300/[0.06] px-3 py-2 text-[11px] leading-5 text-violet-50/75">
        {text.completeBundleHint}
      </p>
    </>
  );
}
