import type { AgentTarget } from "@/lib/agent/types";

export type CompareLaneMatrixProps = {
  copy: Record<string, string>;
  targets: AgentTarget[];
  selectedTargetId: string;
  compareTargetIds: string[];
  compareContextValidated: string;
  maxCompareLanes: number;
  onToggleCompareTarget: (targetId: string) => void;
};

export function CompareLaneMatrix({
  copy,
  targets,
  selectedTargetId,
  compareTargetIds,
  compareContextValidated,
  maxCompareLanes,
  onToggleCompareTarget,
}: CompareLaneMatrixProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {copy.targets}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {copy.targetsHint}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="ui-chip-wrap rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-100">
          {copy.targetMatrixCurrent}:{" "}
          {targets.find((target) => target.id === selectedTargetId)?.label ||
            "—"}
        </span>
        <span className="ui-chip-wrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-200">
          {copy.targetMatrixCapacity}: {compareTargetIds.length}/
          {maxCompareLanes}
        </span>
      </div>
      <div className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/60">
        <div className="min-w-0 lg:min-w-[780px]">
          <div className="hidden grid-cols-[36px_minmax(220px,1.35fr)_minmax(170px,0.62fr)_108px] items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-500 lg:grid">
            <span />
            <span>{copy.targetMatrixTarget}</span>
            <span>{copy.targetMatrixContext}</span>
            <span>{copy.targetMatrixStatus}</span>
          </div>
          <div className="divide-y divide-white/10">
            {targets.map((target) => {
              const checked = compareTargetIds.includes(target.id);
              const pinned = target.id === selectedTargetId;
              return (
                <label
                  key={target.id}
                  className={`grid cursor-pointer gap-3 px-4 py-4 transition lg:grid-cols-[36px_minmax(220px,1.35fr)_minmax(170px,0.62fr)_108px] lg:items-center ${
                    checked
                      ? "bg-cyan-400/10"
                      : "bg-slate-950/70 hover:bg-white/[0.05]"
                  } ${pinned ? "ring-inset ring-1 ring-cyan-300/20" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pinned}
                    onChange={() => onToggleCompareTarget(target.id)}
                    className="mt-1 rounded border-white/20 bg-slate-950 lg:mt-0 disabled:cursor-not-allowed"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="line-clamp-1 text-sm font-medium text-white">
                        {target.label}
                      </p>
                      <span
                        className={`rounded-full px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] ${
                          target.execution === "local"
                            ? "bg-emerald-400/10 text-emerald-200"
                            : "bg-violet-400/10 text-violet-200"
                        }`}
                      >
                        {target.execution === "local" ? copy.local : copy.remote}
                      </span>
                      {pinned ? (
                        <span className="rounded-full bg-cyan-400/10 px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                          {copy.currentTarget}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-400">
                      {target.description}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {target.providerLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 lg:hidden">
                      {copy.targetMatrixContext}
                    </p>
                    <p className="mt-1 lg:mt-0">{target.recommendedContext}</p>
                    {target.execution === "local" ? (
                      <p className="mt-1 text-[11px] leading-5 text-emerald-200/85">
                        {compareContextValidated}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center lg:justify-end">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-200">
                      {checked ? copy.laneReady : copy.lanePending}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
