import type {
  AgentFineTuneAdapterArtifact,
  AgentFineTuneJob,
} from "@/lib/agent/types";

type FineTuneJobNextStepCardProps = {
  job: AgentFineTuneJob;
  adapter?: AgentFineTuneAdapterArtifact;
  canUseAdapterActions: boolean;
  jobNextStepCopy: string;
  text: Record<string, string>;
  actionPending: Record<string, boolean>;
  onAttachAdapterRuntime: (adapterId: string) => void;
  onRunAdapterCompareHandoff: (adapterId: string) => void;
  onRunAdapterBenchmarkHandoff: (adapterId: string) => void;
  onExportMarkdownReport: (jobId: string) => void;
};

export function FineTuneJobNextStepCard({
  job,
  adapter,
  canUseAdapterActions,
  jobNextStepCopy,
  text,
  actionPending,
  onAttachAdapterRuntime,
  onRunAdapterCompareHandoff,
  onRunAdapterBenchmarkHandoff,
  onExportMarkdownReport,
}: FineTuneJobNextStepCardProps) {
  return (
    <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-3 text-[11px] leading-5 text-cyan-50/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-50/55">
            {text.jobNextStep}
          </p>
          <p className="mt-1 max-w-3xl text-cyan-50/80">{jobNextStepCopy}</p>
        </div>
        {job.status === "completed" ? (
          <span className="rounded-full border border-cyan-200/15 bg-cyan-200/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-50">
            {adapter?.adapterName || text.jobAdapterPending}
          </span>
        ) : null}
      </div>
      {job.status === "completed" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canUseAdapterActions && adapter ? (
            <>
              <button
                type="button"
                disabled={Boolean(actionPending[`adapter-attach:${adapter.id}`])}
                onClick={() => onAttachAdapterRuntime(adapter.id)}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition enabled:hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionPending[`adapter-attach:${adapter.id}`]
                  ? text.loading
                  : text.attachRuntime}
              </button>
              <button
                type="button"
                disabled={Boolean(actionPending[`adapter-compare:${adapter.id}`])}
                onClick={() => onRunAdapterCompareHandoff(adapter.id)}
                className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-[11px] font-semibold text-violet-100 transition enabled:hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionPending[`adapter-compare:${adapter.id}`]
                  ? text.loading
                  : text.sendToCompare}
              </button>
              <button
                type="button"
                disabled={Boolean(
                  actionPending[`adapter-benchmark:${adapter.id}`],
                )}
                onClick={() => onRunAdapterBenchmarkHandoff(adapter.id)}
                className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition enabled:hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionPending[`adapter-benchmark:${adapter.id}`]
                  ? text.loading
                  : text.sendToBenchmark}
              </button>
            </>
          ) : (
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100">
              {text.jobAdapterPending}
            </span>
          )}
          <button
            type="button"
            onClick={() => onExportMarkdownReport(job.id)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
          >
            {text.exportMarkdownReport}
          </button>
        </div>
      ) : null}
    </div>
  );
}
