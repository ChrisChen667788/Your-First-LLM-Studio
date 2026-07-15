"use client";

import { useLocale } from "@/components/layout/LocaleProvider";
import { sanitizeDisplayPath } from "@/lib/agent/path-display";
import type { AppLocale } from "@/lib/i18n";
import type {
  AgentProviderProfile,
  AgentRuntimeStatus,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";
import type { AgentTurn } from "./session-model";

type AgentTargetProfilePanelProps = {
  locale: AppLocale;
  target: AgentTarget;
  runtimeStatus: AgentRuntimeStatus | null;
  lastChatTurn?: AgentTurn | null;
  contextWindow: number;
  contextWindowOptions: number[];
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  enableRetrieval: boolean;
  onContextWindowChange: (value: number) => void;
  onProviderProfileChange: (value: AgentProviderProfile) => void;
  onThinkingModeChange: (value: AgentThinkingMode) => void;
  text: {
    contextWindow: string;
    providerProfile: string;
    providerProfileSpeed: string;
    providerProfileBalanced: string;
    providerProfileToolFirst: string;
    autoSpeedHint: string;
    thinkingMode: string;
    thinkingModeStandard: string;
    thinkingModeThinking: string;
    actualResolvedModel: string;
    actualProviderProfile: string;
    actualThinkingMode: string;
    thinkingModelFallback: string;
    enableRetrieval: string;
    enabled: string;
    disabled: string;
    retrievalHint: string;
  };
};

export function AgentTargetProfilePanel({
  locale,
  target,
  runtimeStatus,
  lastChatTurn,
  contextWindow,
  contextWindowOptions,
  providerProfile,
  thinkingMode,
  enableRetrieval,
  onContextWindowChange,
  onProviderProfileChange,
  onThinkingModeChange,
  text,
}: AgentTargetProfilePanelProps) {
  const { dictionary } = useLocale();
  const en = locale.startsWith("en");
  const remote = target.execution === "remote";
  return (
    <section className="rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{dictionary.agent.selectedProfile}</p>
      <div className="mt-2.5 space-y-2.5 text-sm text-slate-300">
        <div><p className="text-slate-500">{dictionary.agent.context}</p><p className="mt-1 text-[13px] leading-6 text-white">{target.recommendedContext}</p></div>
        <div>
          <p className="text-slate-500">{text.contextWindow}</p>
          <select value={contextWindow} onChange={(event) => onContextWindowChange(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none">
            {contextWindowOptions.map((value) => <option key={value} value={value}>{value >= 1024 ? `${Math.round(value / 1024)}K` : value}</option>)}
          </select>
        </div>
        {remote ? (
          <div>
            <p className="text-slate-500">{text.providerProfile}</p>
            <select value={providerProfile} onChange={(event) => onProviderProfileChange(event.target.value as AgentProviderProfile)} disabled={thinkingMode === "thinking"} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none">
              <option value="speed">{text.providerProfileSpeed}</option><option value="balanced">{text.providerProfileBalanced}</option><option value="tool-first">{text.providerProfileToolFirst}</option>
            </select>
            {thinkingMode !== "thinking" ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{text.autoSpeedHint}</p> : null}
          </div>
        ) : null}
        {remote ? (
          <div>
            <p className="text-slate-500">{text.thinkingMode}</p>
            <select value={thinkingMode} onChange={(event) => onThinkingModeChange(event.target.value as AgentThinkingMode)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"><option value="standard">{text.thinkingModeStandard}</option><option value="thinking">{text.thinkingModeThinking}</option></select>
          </div>
        ) : null}
        {remote ? (
          <div>
            <p className="text-slate-500">{text.actualResolvedModel}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">live</span><span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[12px] leading-5 text-white">{runtimeStatus?.resolvedModel || lastChatTurn?.resolvedModel || target.modelDefault}</span></div>
            <p className="mt-2.5 text-slate-500">{text.actualProviderProfile}</p><p className="mt-1 break-all text-[13px] leading-6 text-white">{lastChatTurn?.providerProfile || (thinkingMode === "thinking" ? "tool-first" : providerProfile)}</p>
            <p className="mt-2.5 text-slate-500">{text.actualThinkingMode}</p><p className="mt-1 break-all text-[13px] leading-6 text-white">{lastChatTurn?.thinkingMode || thinkingMode}</p>
            <p className="mt-2.5 text-slate-500">{text.thinkingModeStandard}</p><div className="mt-1.5"><span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[12px] leading-5 text-white">{runtimeStatus?.standardResolvedModel || target.modelDefault}</span></div>
            <p className="mt-2.5 text-slate-500">{text.thinkingModeThinking}</p><div className="mt-1.5"><span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[12px] leading-5 text-white">{runtimeStatus?.thinkingResolvedModel || target.thinkingModelDefault || target.modelDefault}</span></div>
            {lastChatTurn?.thinkingFallbackToStandard || (thinkingMode === "thinking" && runtimeStatus?.thinkingModelConfigured === false) ? <p className="mt-1.5 text-xs leading-5 text-amber-200">{text.thinkingModelFallback} {runtimeStatus?.resolvedModel || lastChatTurn?.resolvedModel || target.modelDefault}</p> : null}
          </div>
        ) : null}
        <div><p className="text-slate-500">{dictionary.agent.memory}</p><p className="mt-1 text-[13px] leading-6">{target.memoryProfile}</p></div>
        {target.execution === "local" && (target.parameterScale || target.quantizationLabel || target.sourceLabel || target.sourceRepoId || target.sourcePath || typeof target.recommendedContextWindow === "number") ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{en ? "Local model metadata" : "本地模型元数据"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {target.parameterScale ? <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">{en ? "Scale" : "参数规模"} · {target.parameterScale}</span> : null}
              {target.quantizationLabel ? <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">{en ? "Quant" : "量化"} · {target.quantizationLabel}</span> : null}
              {typeof target.recommendedContextWindow === "number" ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">{en ? "Rec context" : "建议上下文"} · {Math.round(target.recommendedContextWindow / 1024)}K</span> : null}
              {target.sourceLabel ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">{target.sourceLabel}</span> : null}
            </div>
            {target.sourceRepoId ? <p className="mt-3 break-all text-[12px] leading-6 text-slate-300">{en ? "Repo id" : "模型仓库"}: {target.sourceRepoId}</p> : null}
            {target.sourcePath ? <p className="mt-1 break-all text-[12px] leading-6 text-slate-400">{en ? "Source path" : "来源路径"}: {sanitizeDisplayPath(target.sourcePath)}</p> : null}
          </div>
        ) : null}
        <div><p className="text-slate-500">{dictionary.agent.toolMode}</p><p className="mt-1 text-[13px] leading-6">{target.supportsTools ? dictionary.agent.toolsAvailable : dictionary.agent.toolsUnavailable}</p></div>
        <div><p className="text-slate-500">{text.enableRetrieval}</p><p className="mt-1 text-[13px] leading-6 text-slate-300">{enableRetrieval ? text.enabled : text.disabled}</p><p className="mt-1.5 text-xs leading-5 text-slate-500">{text.retrievalHint}</p></div>
      </div>
    </section>
  );
}
