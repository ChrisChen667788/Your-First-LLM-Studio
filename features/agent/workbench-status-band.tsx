import type { getDictionary } from "@/lib/i18n";
import type {
  AgentRuntimeStatus,
  AgentTarget,
  AgentWorkbenchMode,
} from "@/lib/agent/types";
import {
  describeRuntimeAlias,
  formatRuntimeDuration,
  formatRuntimeTimestamp,
} from "./runtime-formatters";

type AgentDictionary = ReturnType<typeof getDictionary>;

export type AgentWorkbenchStatusBandProps = {
  locale: string;
  dictionary: AgentDictionary;
  text: {
    selectedTargetLabel: string;
    executionMode: string;
    contextWindow: string;
    toolLoopState: string;
    enableRetrieval: string;
    enabled: string;
    disabled: string;
    loadedAlias: string;
    runtimeCurrentLoaded: string;
    runtimeBusy: string;
    runtimeIdle: string;
    runtimeOffline: string;
    queueLabel: string;
    runtimeSwitchingNow: string;
    runtimeLoadingElapsed: string;
    runtimeLastSwitchLoad: string;
    runtimeLastSwitchAt: string;
    runtimeLoadingError: string;
    prewarmModel: string;
  };
  mode: AgentWorkbenchMode;
  target: AgentTarget;
  targets: AgentTarget[];
  contextWindowLabel: string;
  enableTools: boolean;
  enableRetrieval: boolean;
  loadedAlias: string | null;
  gatewayLoadedOtherAlias: string | null;
  compareLaneCount: number;
  runtimeStatus: AgentRuntimeStatus | null;
  selectedTargetLastSwitchMs: number | null;
  selectedTargetLastSwitchAt: string | null;
  prewarmMessage: string;
};

export function AgentWorkbenchStatusBand({
  locale,
  dictionary,
  text,
  mode,
  target,
  targets,
  contextWindowLabel,
  enableTools,
  enableRetrieval,
  loadedAlias,
  gatewayLoadedOtherAlias,
  compareLaneCount,
  runtimeStatus,
  selectedTargetLastSwitchMs,
  selectedTargetLastSwitchAt,
  prewarmMessage,
}: AgentWorkbenchStatusBandProps) {
  const isEnglish = locale.startsWith("en");
  return (
    <div className="border-b border-white/10 bg-black/20 px-5 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip>{isEnglish ? "Mode" : "模式"}: {mode === "chat" ? "Chat" : "Compare"}</StatusChip>
        <StatusChip tone="cyan">{text.selectedTargetLabel}: {target.label}</StatusChip>
        <StatusChip>{text.executionMode}: {target.execution === "local" ? dictionary.common.local : dictionary.common.remote}</StatusChip>
        <StatusChip>{text.contextWindow}: {contextWindowLabel}</StatusChip>
        <StatusChip>{text.toolLoopState}: {enableTools ? text.enabled : text.disabled}</StatusChip>
        <StatusChip>{text.enableRetrieval}: {enableRetrieval ? text.enabled : text.disabled}</StatusChip>
        <StatusChip>{text.loadedAlias}: {loadedAlias || "—"}</StatusChip>
        {mode === "compare" ? (
          <StatusChip tone="violet">{isEnglish ? "Compare lanes" : "对比 Lane"}: {compareLaneCount}</StatusChip>
        ) : null}
        {gatewayLoadedOtherAlias ? (
          <StatusChip>{text.runtimeCurrentLoaded}: {describeRuntimeAlias(gatewayLoadedOtherAlias, targets)}</StatusChip>
        ) : null}
        {target.execution === "local" && runtimeStatus ? (
          <>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] ${
              runtimeStatus.available
                ? runtimeStatus.busy
                  ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                  : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                : "border-rose-400/20 bg-rose-400/10 text-rose-100"
            }`}>
              {runtimeStatus.available
                ? runtimeStatus.busy
                  ? text.runtimeBusy
                  : text.runtimeIdle
                : text.runtimeOffline}
            </span>
            <StatusChip>{text.queueLabel}: {runtimeStatus.queueDepth ?? 0}</StatusChip>
            {runtimeStatus.loadingAlias ? (
              <StatusChip tone="amber">
                {text.runtimeSwitchingNow}: {describeRuntimeAlias(runtimeStatus.loadingAlias, targets)}
                {typeof runtimeStatus.loadingElapsedMs === "number"
                  ? ` · ${text.runtimeLoadingElapsed} ${Math.max(1, Math.round(runtimeStatus.loadingElapsedMs / 1000))}s`
                  : ""}
              </StatusChip>
            ) : null}
            <StatusChip>{text.runtimeLastSwitchLoad}: {formatRuntimeDuration(selectedTargetLastSwitchMs)}</StatusChip>
            <StatusChip>{text.runtimeLastSwitchAt}: {formatRuntimeTimestamp(selectedTargetLastSwitchAt, locale)}</StatusChip>
            {runtimeStatus.loadingError ? (
              <StatusChip tone="rose">{text.runtimeLoadingError}</StatusChip>
            ) : null}
          </>
        ) : null}
        {prewarmMessage ? (
          <StatusChip tone="cyan">{text.prewarmModel}: {prewarmMessage}</StatusChip>
        ) : null}
      </div>
    </div>
  );
}

function StatusChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "cyan" | "violet" | "amber" | "rose";
}) {
  const className = {
    neutral: "border-white/8 bg-white/[0.04] text-slate-300",
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-100",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-100",
  }[tone];
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] ${className}`}>
      {children}
    </span>
  );
}
