import type {
  AgentCompareLaneProgress,
  AgentCompareLaneTimelineEntry,
  AgentRuntimeStatus,
  AgentTarget,
} from "@/lib/agent/types";
import { formatTimelineTime } from "./compare-utils";

type CompareLanePreviewPanelProps = {
  locale: string;
  copy: Record<string, string>;
  compareTargets: AgentTarget[];
  maxCompareLanes: number;
  hasEnoughTargets: boolean;
  selectedTargetId: string;
  compareContextValidated: string;
  compareRuntimeByTargetId: Record<string, AgentRuntimeStatus>;
  compareProgressByTargetId: Record<string, AgentCompareLaneProgress>;
  compareRecoveryConfirmTargetId: string;
  compareRecoveryPendingTargetId: string;
  compareRecoveryCooldownByTargetId: Record<string, number>;
  benchmarkPending: boolean;
  onRetryLocalRecovery: (targetId: string) => void;
};

export function CompareLanePreviewPanel({
  locale,
  copy,
  compareTargets,
  maxCompareLanes,
  hasEnoughTargets,
  selectedTargetId,
  compareContextValidated,
  compareRuntimeByTargetId,
  compareProgressByTargetId,
  compareRecoveryConfirmTargetId,
  compareRecoveryPendingTargetId,
  compareRecoveryCooldownByTargetId,
  benchmarkPending,
  onRetryLocalRecovery,
}: CompareLanePreviewPanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {copy.lanePreview}
          </p>
          {copy.lanePreviewHint ? (
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {copy.lanePreviewHint}
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100">
          {compareTargets.length}/{maxCompareLanes}
        </span>
      </div>
      {!hasEnoughTargets ? (
        <div className="mt-4 rounded-2xl border border-dashed border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm leading-6 text-amber-100">
          {copy.needMoreTargets}
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        {compareTargets.map((target) => {
          const runtime = compareRuntimeByTargetId[target.id];
          const compareProgress = compareProgressByTargetId[target.id];
          const compareTimeline = compareProgress?.timeline || [];
          const loadingSeconds =
            typeof runtime?.loadingElapsedMs === "number"
              ? Math.round(runtime.loadingElapsedMs / 1000)
              : null;
          const compareLoadingSeconds =
            typeof compareProgress?.loadingElapsedMs === "number"
              ? Math.max(1, Math.round(compareProgress.loadingElapsedMs / 1000))
              : null;
          const compareRecoveryBudgetSeconds =
            typeof compareProgress?.recoveryThresholdMs === "number"
              ? Math.max(
                  1,
                  Math.round(compareProgress.recoveryThresholdMs / 1000),
                )
              : null;
          const recoveryConfirmPending =
            compareRecoveryConfirmTargetId === target.id;
          const recoveryCoolingDown =
            (compareRecoveryCooldownByTargetId[target.id] || 0) > Date.now();
          const runtimeSummary = runtime?.phaseDetail || runtime?.phase || "—";
          const compareSummary =
            compareProgress?.detail ||
            compareProgress?.phase ||
            copy.compareIdleStatus;
          return (
            <article
              key={target.id}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
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
                    {target.id === selectedTargetId ? (
                      <span className="rounded-full bg-cyan-400/10 px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                        {copy.currentTarget}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {target.providerLabel} · {target.recommendedContext}
                  </p>
                  {target.execution === "local" ? (
                    <p className="mt-1 line-clamp-1 text-[11px] text-emerald-200/80">
                      {compareContextValidated}
                    </p>
                  ) : null}
                </div>
                <span className="justify-self-start rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300 sm:justify-self-end">
                  {hasEnoughTargets ? copy.laneReady : copy.lanePending}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] leading-5">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-slate-300">
                  <span className="text-slate-500">
                    {locale.startsWith("en") ? "Runtime" : "运行时"} ·{" "}
                  </span>
                  <span className="text-slate-100">{runtimeSummary}</span>
                  {loadingSeconds !== null ? (
                    <span className="text-slate-500"> · {loadingSeconds}s</span>
                  ) : null}
                </span>
                <span className="max-w-full truncate rounded-full border border-cyan-400/15 bg-cyan-400/5 px-2.5 py-1 text-cyan-50">
                  <span className="text-cyan-100">
                    {copy.compareRuntimePhase}
                  </span>
                  <span className="text-cyan-50/80"> · {compareSummary}</span>
                </span>
                {compareTimeline.length ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-slate-400">
                    {copy.compareRecoveryTimeline} · {compareTimeline.length}
                  </span>
                ) : null}
              </div>

              <details
                className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs leading-6 text-slate-300"
                open={Boolean(
                  compareTimeline.length && compareProgress?.phase !== "completed",
                )}
              >
                <summary className="cursor-pointer list-none">
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-100">
                      <span>{copy.compareDrawer}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-[2px] text-[10px] text-slate-400">
                        {compareTimeline.length}
                      </span>
                    </span>
                    {target.execution === "local" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          onRetryLocalRecovery(target.id);
                        }}
                        disabled={
                          compareRecoveryPendingTargetId === target.id ||
                          benchmarkPending ||
                          recoveryCoolingDown
                        }
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          recoveryConfirmPending
                            ? "border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15"
                            : "border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
                        }`}
                      >
                        {compareRecoveryPendingTargetId === target.id
                          ? copy.compareManualRecoveryPending
                          : recoveryCoolingDown
                            ? copy.compareManualRecoveryCooldown
                            : recoveryConfirmPending
                              ? copy.compareManualRecoveryConfirm
                              : copy.compareManualRecovery}
                      </button>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-400">
                        {locale.startsWith("en")
                          ? "Provider retry policy"
                          : "远端重试策略"}
                      </span>
                    )}
                  </span>
                </summary>
                <div className="mt-3">
                  {recoveryConfirmPending ? (
                    <p className="mb-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] leading-5 text-amber-100/85">
                      {copy.compareManualRecoveryConfirmHint}
                    </p>
                  ) : null}
                  {recoveryCoolingDown ? (
                    <p className="mb-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] leading-5 text-slate-400">
                      {copy.compareManualRecoveryCooldownHint}
                    </p>
                  ) : null}
                  <div className="grid gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
                    {compareLoadingSeconds !== null ? (
                      <p>
                        {copy.compareLoadingFor}: {compareLoadingSeconds}s
                      </p>
                    ) : null}
                    {compareRecoveryBudgetSeconds !== null ? (
                      <p>
                        {copy.compareRecoveryBudget}:{" "}
                        {compareRecoveryBudgetSeconds}s
                      </p>
                    ) : null}
                    {compareProgress?.recoveryAction ? (
                      <p>
                        {copy.compareLatestRecovery}:{" "}
                        {compareProgress.recoveryAction}
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {copy.compareRecoveryTimeline}
                  </p>
                  {compareTimeline.length ? (
                    <div className="mt-2 max-h-36 space-y-2 overflow-auto pr-1">
                      {compareTimeline.map(
                        (
                          entry: AgentCompareLaneTimelineEntry,
                          index,
                        ) => (
                          <div
                            key={`${target.id}:${entry.at}:${index}`}
                            className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                          >
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                              {formatTimelineTime(locale, entry.at)} ·{" "}
                              {entry.phase}
                            </p>
                            <p className="mt-1 text-slate-200">
                              {entry.detail}
                            </p>
                            {typeof entry.recoveryTriggerElapsedMs ===
                            "number" ? (
                              <p className="mt-1 text-slate-400">
                                {copy.compareLoadingFor}:{" "}
                                {Math.max(
                                  1,
                                  Math.round(
                                    entry.recoveryTriggerElapsedMs / 1000,
                                  ),
                                )}
                                s
                              </p>
                            ) : null}
                            {entry.recoveryAction ? (
                              <p className="mt-1 text-slate-400">
                                {entry.recoveryAction}
                              </p>
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-400">
                      {copy.compareNoTimeline}
                    </p>
                  )}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
