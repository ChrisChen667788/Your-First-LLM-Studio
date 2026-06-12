"use client";

import type { getDictionary } from "@/lib/i18n";
import type {
  AgentConnectionCheckResponse,
  AgentConnectionCheckStage,
  AgentRuntimeStatus,
  AgentTarget,
} from "@/lib/agent/types";
import type { AgentTurn } from "./session-model";

type AgentDictionary = ReturnType<typeof getDictionary>;

type AgentProviderSelfCheckPanelProps = {
  dictionary: AgentDictionary;
  selectedTarget: AgentTarget;
  selectedTargetId: string;
  runtimeStatus: AgentRuntimeStatus | null;
  lastTurn?: AgentTurn;
  supportsConnectionCheck: boolean;
  connectionCheckPending: boolean;
  connectionCheckError: string;
  connectionCheck: AgentConnectionCheckResponse | null;
  pending: boolean;
  onConnectionCheck: () => void | Promise<void>;
  surface?: "card" | "inline";
  description?: string;
  showIdleSummary?: boolean;
};

function formatConnectionStageLabel(stageId: AgentConnectionCheckStage["id"]) {
  switch (stageId) {
    case "models":
      return "models";
    case "chat":
      return "chat";
    case "tool_calls":
      return "tool calls";
    default:
      return stageId;
  }
}

function getConnectionStageBadgeClass(ok: boolean) {
  return ok
    ? "bg-emerald-400/15 text-emerald-200"
    : "bg-rose-400/15 text-rose-200";
}

function AgentProviderSelfCheckActions({
  dictionary,
  selectedTargetId,
  supportsConnectionCheck,
  connectionCheckPending,
  pending,
  onConnectionCheck,
}: Pick<
  AgentProviderSelfCheckPanelProps,
  | "dictionary"
  | "selectedTargetId"
  | "supportsConnectionCheck"
  | "connectionCheckPending"
  | "pending"
  | "onConnectionCheck"
>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!supportsConnectionCheck || connectionCheckPending || pending}
        onClick={onConnectionCheck}
        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
      >
        {connectionCheckPending
          ? dictionary.agent.checking
          : dictionary.agent.runCheck}
      </button>
      <a
        href={`/api/agent/check-history/export?targetId=${encodeURIComponent(
          selectedTargetId,
        )}&format=markdown`}
        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
      >
        {dictionary.agent.exportMarkdown}
      </a>
      <a
        href={`/api/agent/check-history/export?targetId=${encodeURIComponent(
          selectedTargetId,
        )}&format=json`}
        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
      >
        {dictionary.agent.exportJson}
      </a>
    </div>
  );
}

export function AgentProviderSelfCheckPanel({
  dictionary,
  selectedTarget,
  selectedTargetId,
  runtimeStatus,
  lastTurn,
  supportsConnectionCheck,
  connectionCheckPending,
  connectionCheckError,
  connectionCheck,
  pending,
  onConnectionCheck,
  surface = "card",
  description,
  showIdleSummary = true,
}: AgentProviderSelfCheckPanelProps) {
  const shouldShowSummary = Boolean(connectionCheck) || showIdleSummary;
  const resolvedModel =
    connectionCheck?.resolvedModel ||
    runtimeStatus?.resolvedModel ||
    lastTurn?.resolvedModel ||
    selectedTarget.modelDefault;
  const resolvedBaseUrl =
    connectionCheck?.resolvedBaseUrl ||
    lastTurn?.resolvedBaseUrl ||
    selectedTarget.baseUrlDefault;

  const body = (
    <div className={surface === "card" ? "mt-3 space-y-3" : "space-y-3"}>
      {surface === "inline" ? (
        <AgentProviderSelfCheckActions
          dictionary={dictionary}
          selectedTargetId={selectedTargetId}
          supportsConnectionCheck={supportsConnectionCheck}
          connectionCheckPending={connectionCheckPending}
          pending={pending}
          onConnectionCheck={onConnectionCheck}
        />
      ) : null}

      {!supportsConnectionCheck ? (
        <p className="text-sm leading-6 text-slate-400">
          {dictionary.agent.checkOnlyRemote}
        </p>
      ) : null}

      {connectionCheckError ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-3 text-sm text-rose-100">
          {connectionCheckError}
        </div>
      ) : null}

      {connectionCheck ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] ${
              connectionCheck.ok
                ? "bg-emerald-400/15 text-emerald-200"
                : "bg-amber-400/15 text-amber-200"
            }`}
          >
            {connectionCheck.ok
              ? dictionary.agent.allChecksPassed
              : dictionary.agent.checkAttention}
          </span>
          <span className="rounded-full bg-white/[0.04] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-slate-300">
            {new Date(connectionCheck.checkedAt).toLocaleTimeString()}
          </span>
        </div>
      ) : null}

      {shouldShowSummary ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs leading-6 text-slate-300">
          <p>
            {dictionary.common.model}: {resolvedModel}
          </p>
          <p className="break-all">
            {dictionary.common.endpoint}: {resolvedBaseUrl}
          </p>
          <p className="mt-2 text-slate-500">
            {dictionary.agent.historySavedAt}:{" "}
            <span className="text-slate-300">data/agent-observability</span>
          </p>
          {connectionCheck?.docsUrl ? (
            <a
              href={connectionCheck.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-cyan-300 underline decoration-cyan-300/40 underline-offset-4"
            >
              {dictionary.agent.openDocs}
            </a>
          ) : null}
        </div>
      ) : null}

      {connectionCheck ? (
        <div className="grid gap-2">
          {connectionCheck.stages.map((stage) => (
            <div
              key={stage.id}
              className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] ${getConnectionStageBadgeClass(
                      stage.ok,
                    )}`}
                  >
                    {formatConnectionStageLabel(stage.id)}
                  </span>
                  {typeof stage.httpStatus === "number" ? (
                    <span className="rounded-full bg-white/[0.04] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      http {stage.httpStatus}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {stage.latencyMs} ms
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-6 text-slate-300">
                {stage.summary}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (surface === "inline") {
    return body;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {dictionary.agent.providerSelfCheck}
          </p>
          {description ? (
            <p className="mt-1.5 text-sm leading-6 text-slate-300">
              {description}
            </p>
          ) : null}
        </div>
        <AgentProviderSelfCheckActions
          dictionary={dictionary}
          selectedTargetId={selectedTargetId}
          supportsConnectionCheck={supportsConnectionCheck}
          connectionCheckPending={connectionCheckPending}
          pending={pending}
          onConnectionCheck={onConnectionCheck}
        />
      </div>
      {body}
    </div>
  );
}
