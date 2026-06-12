"use client";

import type {
  FormEventHandler,
  KeyboardEventHandler,
  Ref,
} from "react";
import type { getDictionary } from "@/lib/i18n";
import type {
  AgentRuntimeStatus,
  AgentTarget,
} from "@/lib/agent/types";
import type { AgentRuntimeActionPending } from "./runtime-shell-state";
import { describeRuntimeAlias } from "./runtime-formatters";

type AgentDictionary = ReturnType<typeof getDictionary>;

type ComposerRuntimePhase = {
  label: string;
  className: string;
};

type AgentComposerFormText = {
  activeLabel: string;
  contextWindow: string;
  enableRetrieval: string;
  enterHint: string;
  prewarmAllModels: string;
  prewarmModel: string;
  prewarming: string;
  prewarmingAll: string;
  queueLabel: string;
  runtimeCurrentLoaded: string;
  runtimeDowngradeHint: string;
  runtimeLoadingElapsed: string;
  runtimeLoadingError: string;
  runtimeReady: string;
  runtimeSerializing: string;
  runtimeSwitchingNow: string;
  runtimeUnavailable: string;
  submit: string;
  submitting: string;
};

type AgentComposerFormProps = {
  locale: string;
  dictionary: AgentDictionary;
  uiText: AgentComposerFormText;
  composerRef: Ref<HTMLTextAreaElement>;
  input: string;
  placeholder: string;
  pending: boolean;
  error: string;
  turnsLength: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  contextWindow: number;
  contextWindowOptions: number[];
  agentTargets: AgentTarget[];
  selectedTarget: AgentTarget;
  runtimeStatus: AgentRuntimeStatus | null;
  runtimePhase: ComposerRuntimePhase;
  loadedAliasForSelectedTarget: string | null;
  gatewayLoadedOtherAlias: string | null;
  runtimeGuardrailBlocked: boolean;
  runtimeGuardrailCaution: boolean;
  prewarmAllPending: boolean;
  prewarmPending: boolean;
  prewarmMessage: string;
  runtimeActionPending: AgentRuntimeActionPending;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onInputChange: (value: string) => void;
  onEnableToolsChange: (enabled: boolean) => void;
  onEnableRetrievalChange: (enabled: boolean) => void;
  onContextWindowChange: (value: number) => void;
  onExportTurns: (format: "markdown" | "json") => void;
  onStartNewSession: () => void;
  onPrewarmAll: () => void | Promise<void>;
  onPrewarm: () => void | Promise<void>;
};

export function AgentComposerForm({
  locale,
  dictionary,
  uiText,
  composerRef,
  input,
  placeholder,
  pending,
  error,
  turnsLength,
  enableTools,
  enableRetrieval,
  contextWindow,
  contextWindowOptions,
  agentTargets,
  selectedTarget,
  runtimeStatus,
  runtimePhase,
  loadedAliasForSelectedTarget,
  gatewayLoadedOtherAlias,
  runtimeGuardrailBlocked,
  runtimeGuardrailCaution,
  prewarmAllPending,
  prewarmPending,
  prewarmMessage,
  runtimeActionPending,
  onSubmit,
  onComposerKeyDown,
  onInputChange,
  onEnableToolsChange,
  onEnableRetrievalChange,
  onContextWindowChange,
  onExportTurns,
  onStartNewSession,
  onPrewarmAll,
  onPrewarm,
}: AgentComposerFormProps) {
  const runtimeActionBusy = Boolean(runtimeActionPending);

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-white/10 bg-slate-950/90 px-5 py-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={enableTools}
              onChange={(event) => onEnableToolsChange(event.target.checked)}
              className="rounded border-white/20 bg-slate-950"
            />
            {dictionary.agent.enableToolLoop}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={enableRetrieval}
              onChange={(event) =>
                onEnableRetrievalChange(event.target.checked)
              }
              className="rounded border-white/20 bg-slate-950"
            />
            {uiText.enableRetrieval}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>{uiText.contextWindow}</span>
            <select
              value={contextWindow}
              onChange={(event) =>
                onContextWindowChange(Number(event.target.value))
              }
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-100 outline-none"
            >
              {contextWindowOptions.map((value) => (
                <option key={value} value={value}>
                  {value >= 1024 ? `${Math.round(value / 1024)}K` : value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!turnsLength}
            onClick={() => onExportTurns("markdown")}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dictionary.agent.exportMarkdown}
          </button>
          <button
            type="button"
            disabled={!turnsLength}
            onClick={() => onExportTurns("json")}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dictionary.agent.exportJson}
          </button>
          <button
            type="button"
            onClick={onStartNewSession}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            {dictionary.agent.clearSession}
          </button>
        </div>
      </div>

      <textarea
        ref={composerRef}
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={onComposerKeyDown}
        rows={5}
        placeholder={placeholder}
        className="min-h-[150px] w-full resize-y rounded-3xl border border-white/10 bg-black/25 px-4 py-4 font-mono text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-black/35"
      />
      <p className="mt-2 text-xs text-slate-500">{uiText.enterHint}</p>

      {selectedTarget.execution === "local" && runtimeStatus ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${runtimePhase.className}`}
              >
                {runtimePhase.label}
              </span>
              {typeof runtimeStatus.queueDepth === "number" ? (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                  {uiText.queueLabel} {runtimeStatus.queueDepth}
                </span>
              ) : null}
              {typeof runtimeStatus.activeRequests === "number" ? (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                  {uiText.activeLabel} {runtimeStatus.activeRequests}
                </span>
              ) : null}
              {loadedAliasForSelectedTarget ? (
                <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-300">
                  {describeRuntimeAlias(
                    loadedAliasForSelectedTarget,
                    agentTargets,
                  )}
                </span>
              ) : null}
              {gatewayLoadedOtherAlias ? (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                  {uiText.runtimeCurrentLoaded}{" "}
                  {describeRuntimeAlias(gatewayLoadedOtherAlias, agentTargets)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={
                  prewarmAllPending ||
                  prewarmPending ||
                  pending ||
                  runtimeActionBusy ||
                  runtimeGuardrailBlocked
                }
                onClick={onPrewarmAll}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
              >
                {prewarmAllPending
                  ? uiText.prewarmingAll
                  : uiText.prewarmAllModels}
              </button>
              <button
                type="button"
                disabled={
                  prewarmAllPending ||
                  prewarmPending ||
                  pending ||
                  runtimeActionBusy ||
                  runtimeGuardrailBlocked
                }
                onClick={onPrewarm}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
              >
                {prewarmPending ? uiText.prewarming : uiText.prewarmModel}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            {runtimeStatus.phaseDetail ||
              (runtimeStatus.available
                ? runtimeStatus.busy
                  ? uiText.runtimeSerializing
                  : uiText.runtimeReady
                : runtimeStatus.message || uiText.runtimeUnavailable)}
          </p>
          {runtimeStatus.loadingAlias ? (
            <div className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-6 text-amber-100">
              <p>
                {uiText.runtimeSwitchingNow}:{" "}
                {describeRuntimeAlias(runtimeStatus.loadingAlias, agentTargets)}
                {typeof runtimeStatus.loadingElapsedMs === "number"
                  ? ` · ${uiText.runtimeLoadingElapsed} ${Math.max(1, Math.round(runtimeStatus.loadingElapsedMs / 1000))}s`
                  : ""}
              </p>
              {selectedTarget.id === "local-qwen3-4b-4bit" ||
              selectedTarget.id === "local-qwen35-4b-4bit" ? (
                <p className="mt-1 text-amber-50/90">
                  {uiText.runtimeDowngradeHint}
                </p>
              ) : null}
            </div>
          ) : null}
          {runtimeStatus.loadingError ? (
            <div className="mt-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-6 text-rose-100">
              {uiText.runtimeLoadingError}: {runtimeStatus.loadingError}
            </div>
          ) : null}
          {runtimeStatus.resourceGuardrailSummary ? (
            <div
              className={`mt-2 rounded-2xl border px-3 py-2 text-xs leading-6 ${
                runtimeGuardrailBlocked
                  ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                  : runtimeGuardrailCaution
                    ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              }`}
            >
              <p>
                {runtimeGuardrailBlocked
                  ? locale.startsWith("en")
                    ? "High-risk load"
                    : "高风险加载"
                  : runtimeGuardrailCaution
                    ? locale.startsWith("en")
                      ? "Memory caution"
                      : "内存风险提醒"
                    : locale.startsWith("en")
                      ? "Load budget looks healthy"
                      : "加载预算健康"}
                : {runtimeStatus.resourceGuardrailSummary}
              </p>
              {typeof runtimeStatus.estimatedPeakMemoryMb === "number" &&
              typeof runtimeStatus.systemTotalMemoryMb === "number" ? (
                <p className="mt-1">
                  {locale.startsWith("en") ? "Estimated peak" : "预估峰值"}{" "}
                  {Math.round(runtimeStatus.estimatedPeakMemoryMb / 1024)} GB /{" "}
                  {Math.round(runtimeStatus.systemTotalMemoryMb / 1024)} GB
                </p>
              ) : null}
              {runtimeStatus.resourceGuardrailRecommendations?.length ? (
                <ul className="mt-1 space-y-1 text-[11px] text-current/90">
                  {runtimeStatus.resourceGuardrailRecommendations
                    .slice(0, 3)
                    .map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {prewarmMessage ? (
            <p className="mt-1 text-xs leading-6 text-cyan-200">
              {prewarmMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
          {dictionary.common.endpoint} {selectedTarget.baseUrlEnv} ·{" "}
          {dictionary.common.model} {selectedTarget.modelEnv}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        >
          {pending ? uiText.submitting : uiText.submit}
        </button>
      </div>
    </form>
  );
}
