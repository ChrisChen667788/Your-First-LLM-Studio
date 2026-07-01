"use client";

import { useState, type ReactNode } from "react";
import type { getDictionary } from "@/lib/i18n";
import type {
  AgentConnectionCheckResponse,
  AgentRuntimeAction,
  AgentRuntimeStatus,
  AgentTarget,
  AgentWorkbenchMode,
} from "@/lib/agent/types";
import type { AgentTurn } from "./session-model";
import type { AgentRuntimeActionPending } from "./runtime-shell-state";
import {
  buildRuntimeStageItems,
  describeRuntimeAlias,
  describeRuntimePhase,
  formatRuntimeDuration,
  formatRuntimeTimestamp,
} from "./runtime-formatters";
import { AgentProviderSelfCheckPanel } from "./agent-provider-self-check-panel";

type AgentDictionary = ReturnType<typeof getDictionary>;
type RuntimePhase = ReturnType<typeof describeRuntimePhase>;
type RuntimeStageItem = ReturnType<typeof buildRuntimeStageItems>[number];

type RuntimeStatusRailText = {
  runtimeSerializing: string;
  runtimeReady: string;
  runtimeUnavailable: string;
  runtimeCurrentLoaded: string;
  runtimeSwitchingNow: string;
  runtimeLastSwitchLoad: string;
  runtimeLastSwitchAt: string;
  runtimeLoadingElapsed: string;
  runtimeLoadingError: string;
  queueLabel: string;
  activeLabel: string;
  prewarmingAll: string;
  prewarmAllModels: string;
  prewarming: string;
  prewarmModel: string;
  releasingModel: string;
  releaseModel: string;
  restartingGateway: string;
  restartGateway: string;
  thinkingModeStandard: string;
  thinkingModeThinking: string;
  supervisor: string;
  gatewayProcess: string;
  logExcerpt: string;
  loadingRuntimeLog: string;
  viewRuntimeLog: string;
  fallbackLaunchHint: string;
};

type RailDetailsSectionProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function RailDetailsSection({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: RailDetailsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      open={isOpen}
      onToggle={(event) =>
        setIsOpen((event.currentTarget as HTMLDetailsElement).open)
      }
      className="group rounded-2xl border border-white/10 bg-black/25 open:border-cyan-400/20 open:bg-white/[0.05]"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-1.5 text-[13px] leading-6 text-slate-300">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-slate-300">
              {badge}
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-slate-400 transition group-open:-rotate-180">
            ↓
          </span>
        </div>
      </summary>
      <div className="border-t border-white/10 px-4 py-3">{children}</div>
    </details>
  );
}

type RuntimeStatusRailProps = {
  locale: string;
  dictionary: AgentDictionary;
  uiText: RuntimeStatusRailText;
  workbenchMode: AgentWorkbenchMode;
  runtimeRailCollapsed: boolean;
  onToggleRuntimeRail: () => void;
  agentTargets: AgentTarget[];
  selectedTarget: AgentTarget;
  selectedTargetId: string;
  runtimeStatus: AgentRuntimeStatus | null;
  runtimePhase: RuntimePhase;
  runtimeStageItems: RuntimeStageItem[];
  lastTurn?: AgentTurn;
  loadedAliasForSelectedTarget: string | null;
  gatewayLoadedOtherAlias: string | null;
  selectedTargetLastSwitchMs: number | null;
  selectedTargetLastSwitchAt: string | null;
  runtimeGuardrailBlocked: boolean;
  runtimeGuardrailCaution: boolean;
  pending: boolean;
  prewarmAllPending: boolean;
  prewarmPending: boolean;
  prewarmMessage: string;
  runtimeActionPending: AgentRuntimeActionPending;
  runtimeLogExcerpt: string;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  supportsConnectionCheck: boolean;
  connectionCheckPending: boolean;
  connectionCheckError: string;
  connectionCheck: AgentConnectionCheckResponse | null;
  onConnectionCheck: () => void | Promise<void>;
  onPrewarmAll: () => void | Promise<void>;
  onPrewarm: () => void | Promise<void>;
  onRuntimeAction: (action: AgentRuntimeAction) => void | Promise<void>;
};

export function RuntimeStatusRail({
  locale,
  dictionary,
  uiText,
  workbenchMode,
  runtimeRailCollapsed,
  onToggleRuntimeRail,
  agentTargets,
  selectedTarget,
  selectedTargetId,
  runtimeStatus,
  runtimePhase,
  runtimeStageItems,
  lastTurn,
  loadedAliasForSelectedTarget,
  gatewayLoadedOtherAlias,
  selectedTargetLastSwitchMs,
  selectedTargetLastSwitchAt,
  runtimeGuardrailBlocked,
  runtimeGuardrailCaution,
  pending,
  prewarmAllPending,
  prewarmPending,
  prewarmMessage,
  runtimeActionPending,
  runtimeLogExcerpt,
  systemPrompt,
  onSystemPromptChange,
  supportsConnectionCheck,
  connectionCheckPending,
  connectionCheckError,
  connectionCheck,
  onConnectionCheck,
  onPrewarmAll,
  onPrewarm,
  onRuntimeAction,
}: RuntimeStatusRailProps) {
  const runtimeActionBusy = Boolean(runtimeActionPending);

  return (
    <aside
      className={`bg-white/[0.03] ${
        workbenchMode === "compare"
          ? "hidden 2xl:block 2xl:max-h-[calc(100vh-15rem)] 2xl:overflow-y-auto"
          : "2xl:max-h-[calc(100vh-15rem)] 2xl:overflow-y-auto"
      }`}
    >
      <div className="border-b border-white/10 px-5 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              {dictionary.nav.agent}
            </p>
            <h3 className="mt-1.5 text-base font-semibold text-white">
              {dictionary.agent.localRuntime} /{" "}
              {locale.startsWith("en") ? "Status rail" : "状态侧栏"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {locale.startsWith("en")
                ? "Keep the right rail high-signal: a compact status strip first, then expand model, process, and compare details only when needed."
                : "右侧只保留高信号状态条；模型、进程和 compare 细节按需展开，避免一整列长条同权堆叠。"}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleRuntimeRail}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 xl:hidden"
            aria-expanded={!runtimeRailCollapsed}
          >
            {runtimeRailCollapsed
              ? locale.startsWith("en")
                ? "Show"
                : "展开"
              : locale.startsWith("en")
                ? "Hide"
                : "收起"}
          </button>
        </div>
      </div>

      <div
        className={`${runtimeRailCollapsed ? "hidden xl:block" : "block"} space-y-3 px-5 py-4`}
      >
        <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(12,18,35,0.96),rgba(4,8,22,0.9))] px-4 py-4 shadow-[0_24px_80px_-44px_rgba(34,211,238,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {selectedTarget.execution === "local"
                  ? dictionary.agent.localRuntime
                  : locale.startsWith("en")
                    ? "Remote target"
                    : "远端目标"}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-slate-200">
                {selectedTarget.execution === "local"
                  ? runtimeStatus?.phaseDetail ||
                    (runtimeStatus?.available
                      ? runtimeStatus.busy
                        ? uiText.runtimeSerializing
                        : uiText.runtimeReady
                      : runtimeStatus?.message || uiText.runtimeUnavailable)
                  : `${runtimeStatus?.resolvedModel || lastTurn?.resolvedModel || selectedTarget.modelDefault} · ${selectedTarget.label}`}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${
                selectedTarget.execution === "local"
                  ? runtimePhase.className
                  : "bg-violet-400/15 text-violet-200"
              }`}
            >
              {selectedTarget.execution === "local"
                ? runtimePhase.label
                : locale.startsWith("en")
                  ? "Remote"
                  : "远端"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {typeof runtimeStatus?.queueDepth === "number" ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                {uiText.queueLabel} {runtimeStatus.queueDepth}
              </span>
            ) : null}
            {typeof runtimeStatus?.activeRequests === "number" ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                {uiText.activeLabel} {runtimeStatus.activeRequests}
              </span>
            ) : null}
            {loadedAliasForSelectedTarget ? (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-200">
                {describeRuntimeAlias(loadedAliasForSelectedTarget, agentTargets)}
              </span>
            ) : null}
            {gatewayLoadedOtherAlias ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                {uiText.runtimeCurrentLoaded}{" "}
                {describeRuntimeAlias(gatewayLoadedOtherAlias, agentTargets)}
              </span>
            ) : null}
            {runtimeStatus?.loadingAlias ? (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-amber-200">
                {uiText.runtimeSwitchingNow}:{" "}
                {describeRuntimeAlias(runtimeStatus.loadingAlias, agentTargets)}
              </span>
            ) : null}
            {selectedTarget.execution === "remote" ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                {lastTurn?.resolvedBaseUrl || selectedTarget.baseUrlDefault}
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {dictionary.common.model}
              </p>
              <p className="mt-1 break-all text-[13px] leading-6 text-slate-200">
                {runtimeStatus?.resolvedModel ||
                  lastTurn?.resolvedModel ||
                  selectedTarget.modelDefault}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {selectedTarget.execution === "local"
                  ? uiText.runtimeLastSwitchLoad
                  : dictionary.common.endpoint}
              </p>
              <p className="mt-1 break-all text-[13px] leading-6 text-slate-200">
                {selectedTarget.execution === "local"
                  ? formatRuntimeDuration(selectedTargetLastSwitchMs)
                  : lastTurn?.resolvedBaseUrl || selectedTarget.baseUrlDefault}
              </p>
            </div>
          </div>

          {selectedTarget.execution === "local" ? (
            <div className="mt-3 flex flex-wrap gap-2">
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
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
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
              <button
                type="button"
                disabled={
                  prewarmAllPending ||
                  prewarmPending ||
                  pending ||
                  runtimeActionBusy
                }
                onClick={() => void onRuntimeAction("release")}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
              >
                {runtimeActionPending === "release"
                  ? uiText.releasingModel
                  : uiText.releaseModel}
              </button>
              <button
                type="button"
                disabled={
                  prewarmAllPending ||
                  prewarmPending ||
                  pending ||
                  runtimeActionBusy
                }
                onClick={() => void onRuntimeAction("restart")}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
              >
                {runtimeActionPending === "restart"
                  ? uiText.restartingGateway
                  : uiText.restartGateway}
              </button>
            </div>
          ) : null}

          {runtimeStatus?.loadingError ? (
            <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-6 text-rose-100">
              {uiText.runtimeLoadingError}: {runtimeStatus.loadingError}
            </div>
          ) : null}
          {runtimeStatus?.resourceGuardrailSummary ? (
            <div
              className={`mt-3 rounded-2xl border px-3 py-2 text-xs leading-6 ${
                runtimeGuardrailBlocked
                  ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                  : runtimeGuardrailCaution
                    ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              }`}
            >
              <p>{runtimeStatus.resourceGuardrailSummary}</p>
              {typeof runtimeStatus.estimatedPeakMemoryMb === "number" &&
              typeof runtimeStatus.systemTotalMemoryMb === "number" ? (
                <p className="mt-1">
                  {locale.startsWith("en") ? "Estimated peak" : "预估峰值"}{" "}
                  {Math.round(runtimeStatus.estimatedPeakMemoryMb / 1024)} GB /{" "}
                  {Math.round(runtimeStatus.systemTotalMemoryMb / 1024)} GB
                </p>
              ) : null}
            </div>
          ) : null}

          {prewarmMessage ? (
            <p className="mt-3 text-xs leading-6 text-cyan-200">
              {prewarmMessage}
            </p>
          ) : null}
        </div>

        <RailDetailsSection
          title={dictionary.agent.resolvedModel}
          badge={
            selectedTarget.execution === "local"
              ? dictionary.common.local
              : "remote"
          }
          defaultOpen={true}
        >
          <div className="space-y-3 text-sm text-slate-300">
            <div>
              <p className="text-slate-500">{dictionary.common.model}</p>
              <p className="mt-1 break-all text-[13px] leading-6 text-slate-200">
                {runtimeStatus?.resolvedModel ||
                  lastTurn?.resolvedModel ||
                  selectedTarget.modelDefault}
              </p>
            </div>
            {selectedTarget.execution === "remote" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-slate-500">
                    {uiText.thinkingModeStandard}
                  </p>
                  <p className="mt-1 break-all text-[13px] leading-6 text-slate-200">
                    {runtimeStatus?.standardResolvedModel ||
                      selectedTarget.modelDefault}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">
                    {uiText.thinkingModeThinking}
                  </p>
                  <p className="mt-1 break-all text-[13px] leading-6 text-slate-200">
                    {runtimeStatus?.thinkingResolvedModel ||
                      selectedTarget.thinkingModelDefault ||
                      selectedTarget.modelDefault}
                  </p>
                </div>
              </div>
            ) : null}
            <div>
              <p className="text-slate-500">{dictionary.common.endpoint}</p>
              <p className="mt-1 break-all text-[13px] leading-6 text-slate-200">
                {lastTurn?.resolvedBaseUrl || selectedTarget.baseUrlDefault}
              </p>
            </div>
            {connectionCheck?.docsUrl ? (
              <div>
                <a
                  href={connectionCheck.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-cyan-300 underline decoration-cyan-300/40 underline-offset-4"
                >
                  {dictionary.agent.openDocs}
                </a>
              </div>
            ) : null}
            <div>
              <p className="text-slate-500">
                {dictionary.agent.historySavedAt}
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-400">
                data/agent-observability
              </p>
            </div>
          </div>
        </RailDetailsSection>

        {selectedTarget.execution === "local" ? (
          <RailDetailsSection
            title={dictionary.agent.localRuntime}
            subtitle={
              locale.startsWith("en")
                ? "Expand for process ids, runtime stage, switch history, load errors, and the current log excerpt."
                : "展开后看进程号、运行阶段、切换历史、加载错误和当前日志摘录。"
            }
            badge={runtimePhase.label}
          >
            {runtimeStatus ? (
              <div className="space-y-3 text-sm text-slate-200">
                <div>
                  <p className="text-slate-500">
                    {locale.startsWith("en") ? "Runtime stage" : "运行阶段"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {runtimeStageItems.map((step) => (
                      <span
                        key={`runtime-stage:${step.key}`}
                        className={`rounded-full border px-2 py-[3px] text-[10px] uppercase tracking-[0.2em] ${
                          step.active
                            ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                            : step.completed
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                              : "border-white/10 bg-white/[0.04] text-slate-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">{uiText.supervisor}</p>
                    <p className="mt-1 break-all text-white">
                      {runtimeStatus.supervisorPid ??
                        dictionary.common.unknown}{" "}
                      ·{" "}
                      {runtimeStatus.supervisorAlive
                        ? dictionary.common.ok
                        : dictionary.common.failed}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">{uiText.gatewayProcess}</p>
                    <p className="mt-1 break-all text-white">
                      {runtimeStatus.gatewayPid ?? dictionary.common.unknown} ·{" "}
                      {runtimeStatus.gatewayAlive
                        ? dictionary.common.ok
                        : dictionary.common.failed}
                    </p>
                  </div>
                  {runtimeStatus.pythonRuntime ? (
                    <div className="sm:col-span-2">
                      <p className="text-slate-500">
                        {locale.startsWith("en") ? "Python runtime" : "Python 运行时"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-white">
                        <span className="break-all font-mono">
                          {runtimeStatus.pythonRuntime.executable ||
                            dictionary.common.unknown}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] ${
                            runtimeStatus.pythonRuntime.source === "missing"
                              ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
                              : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                          }`}
                        >
                          {runtimeStatus.pythonRuntime.source}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {runtimeStatus.pythonRuntime.reason}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-slate-500">
                      {uiText.runtimeCurrentLoaded}
                    </p>
                    <p className="mt-1 break-all text-white">
                      {describeRuntimeAlias(
                        runtimeStatus.loadedAlias,
                        agentTargets,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">
                      {uiText.runtimeLastSwitchLoad}
                    </p>
                    <p className="mt-1 break-all text-white">
                      {formatRuntimeDuration(selectedTargetLastSwitchMs)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-slate-500">
                      {uiText.runtimeLastSwitchAt}
                    </p>
                    <p className="mt-1 break-all text-white">
                      {formatRuntimeTimestamp(
                        selectedTargetLastSwitchAt,
                        locale,
                      )}
                    </p>
                  </div>
                </div>
                {runtimeStatus.loadingAlias || runtimeStatus.loadingError ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {runtimeStatus.loadingAlias ? (
                      <div>
                        <p className="text-slate-500">
                          {uiText.runtimeSwitchingNow}
                        </p>
                        <p className="mt-1 break-all text-white">
                          {describeRuntimeAlias(
                            runtimeStatus.loadingAlias,
                            agentTargets,
                          )}
                          {typeof runtimeStatus.loadingElapsedMs === "number"
                            ? ` · ${uiText.runtimeLoadingElapsed} ${Math.max(1, Math.round(runtimeStatus.loadingElapsedMs / 1000))}s`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                    {runtimeStatus.loadingError ? (
                      <div>
                        <p className="text-slate-500">
                          {uiText.runtimeLoadingError}
                        </p>
                        <p className="mt-1 break-all text-rose-200">
                          {runtimeStatus.loadingError}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {runtimeLogExcerpt ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-slate-500">{uiText.logExcerpt}</p>
                      <button
                        type="button"
                        disabled={
                          prewarmAllPending ||
                          prewarmPending ||
                          pending ||
                          runtimeActionBusy
                        }
                        onClick={() => void onRuntimeAction("read_log")}
                        className="rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
                      >
                        {runtimeActionPending === "read_log"
                          ? uiText.loadingRuntimeLog
                          : uiText.viewRuntimeLog}
                      </button>
                    </div>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 font-mono text-xs leading-6 text-slate-300">
                      {runtimeLogExcerpt}
                    </pre>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={
                      prewarmAllPending ||
                      prewarmPending ||
                      pending ||
                      runtimeActionBusy
                    }
                    onClick={() => void onRuntimeAction("read_log")}
                    className="rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
                  >
                    {runtimeActionPending === "read_log"
                      ? uiText.loadingRuntimeLog
                      : uiText.viewRuntimeLog}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-400">
                {dictionary.agent.checking}
              </p>
            )}
          </RailDetailsSection>
        ) : null}

        {workbenchMode === "compare" ? (
          <>
            <RailDetailsSection
              title={dictionary.agent.promptFrame}
              subtitle={
                locale.startsWith("en")
                  ? "Only expand when you need to adjust the compare prompt frame from the side."
                  : "需要从侧边改 compare 提示框架时再展开，不让它默认常驻占位。"
              }
            >
              <textarea
                value={systemPrompt}
                onChange={(event) => onSystemPromptChange(event.target.value)}
                rows={12}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 font-mono text-xs leading-6 text-slate-200 outline-none transition focus:border-cyan-400/40"
              />
            </RailDetailsSection>

            <RailDetailsSection
              title={dictionary.agent.launchHints}
              subtitle={
                locale.startsWith("en")
                  ? "Deployment and fallback hints stay tucked away until you need operational context."
                  : "部署与 fallback 提示折叠收纳，需要运维上下文时再展开。"
              }
              badge={
                selectedTarget.execution === "local"
                  ? dictionary.common.local
                  : "remote"
              }
            >
              <div className="space-y-2">
                {(selectedTarget.launchHints || [uiText.fallbackLaunchHint]).map(
                  (hint) => (
                    <pre
                      key={hint}
                      className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 font-mono text-xs leading-6 text-slate-200"
                    >
                      {hint}
                    </pre>
                  ),
                )}
              </div>
            </RailDetailsSection>

            <RailDetailsSection
              title={dictionary.agent.providerSelfCheck}
              subtitle={
                locale.startsWith("en")
                  ? "Run connection checks and inspect stage-by-stage latency without keeping the whole report visible."
                  : "把连接自检和分阶段耗时折叠起来，需要时再展开查看，不让整份报告一直占据右栏。"
              }
              badge={
                connectionCheck
                  ? connectionCheck.ok
                    ? dictionary.common.ok
                    : dictionary.common.failed
                  : locale.startsWith("en")
                    ? "Idle"
                    : "未运行"
              }
            >
              <AgentProviderSelfCheckPanel
                dictionary={dictionary}
                selectedTarget={selectedTarget}
                selectedTargetId={selectedTargetId}
                runtimeStatus={runtimeStatus}
                lastTurn={lastTurn}
                supportsConnectionCheck={supportsConnectionCheck}
                connectionCheckPending={connectionCheckPending}
                connectionCheckError={connectionCheckError}
                connectionCheck={connectionCheck}
                pending={pending}
                onConnectionCheck={onConnectionCheck}
                surface="inline"
                showIdleSummary={false}
              />
            </RailDetailsSection>
          </>
        ) : null}
      </div>
    </aside>
  );
}
