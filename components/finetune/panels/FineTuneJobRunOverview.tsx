import type { AgentFineTuneJob } from "@/lib/agent/types";

type FineTuneJobStatusMeta = {
  label: string;
  dot: string;
  badge: string;
  bar: string;
};

type FineTuneJobRunOverviewProps = {
  job: AgentFineTuneJob;
  text: Record<string, string>;
  statusMeta: FineTuneJobStatusMeta;
  progressPercent: number;
  currentStep: number;
  totalSteps: number;
  formatDateTime: (value?: string) => string;
  formatNumber: (value?: number | null, digits?: number) => string;
};

export function FineTuneJobRunOverview({
  job,
  text,
  statusMeta,
  progressPercent,
  currentStep,
  totalSteps,
  formatDateTime,
  formatNumber,
}: FineTuneJobRunOverviewProps) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
            <p className="min-w-0 break-words font-semibold text-white">
              {job.adapterName}
            </p>
          </div>
          <p className="mt-1 break-all text-slate-400">
            {job.baseModelRef || "--"}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${statusMeta.badge}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              {text.progress}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {progressPercent}%{" "}
              {totalSteps ? `· ${currentStep}/${totalSteps}` : ""}
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <p>
              {text.currentLoss}: {formatNumber(job.progress?.latestTrainLoss)}
            </p>
            <p>
              {text.benchmarkSuite}: {job.benchmarkSuiteId || "--"}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${statusMeta.bar} transition-all duration-500`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <p>
          {text.startedAt}: {formatDateTime(job.startedAt || job.createdAt)}
        </p>
        <p>
          {text.completedAt}: {formatDateTime(job.completedAt)}
        </p>
        <p>
          {text.heartbeat}: {formatDateTime(job.workerHeartbeatAt)}
        </p>
      </div>
    </>
  );
}
