import type { AgentFineTuneJob } from "@/lib/agent/types";

type FineTuneJobGroupHeaderProps = {
  groupKey: string;
  label: string;
  jobs: AgentFineTuneJob[];
  latestJob?: AgentFineTuneJob;
  collapsed: boolean;
  pending: boolean;
  text: Record<string, string>;
  onToggle: () => void;
  onRerunLatestFailed: (jobId: string) => void;
};

export function FineTuneJobGroupHeader({
  groupKey,
  label,
  jobs,
  latestJob,
  collapsed,
  pending,
  text,
  onToggle,
  onRerunLatestFailed,
}: FineTuneJobGroupHeaderProps) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <button
        type="button"
        onClick={onToggle}
        className="min-w-0 flex-1 text-left"
        aria-expanded={!collapsed}
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {label}
          </span>
          <span className="mt-1 block text-[11px] text-slate-500">
            {text.jobGroupLatestRun}: {latestJob?.adapterName || "--"}
            {groupKey === "needs-review" ? ` · ${text.jobGroupRerunHint}` : ""}
          </span>
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-2">
        {groupKey === "needs-review" && latestJob ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onRerunLatestFailed(latestJob.id)}
            className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100 transition enabled:hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {text.rerunLatestFailed}
          </button>
        ) : null}
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-400">
          {jobs.length}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
          {collapsed ? text.jobGroupCollapsed : text.jobGroupExpanded}
        </span>
      </span>
    </div>
  );
}
