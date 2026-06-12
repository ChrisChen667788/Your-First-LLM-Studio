"use client";

import type { ComponentProps, Dispatch, SetStateAction } from "react";
import type { getDictionary } from "@/lib/i18n";
import type {
  AgentConnectionCheckStage,
  AgentGroundedVerification,
  AgentToolRun,
} from "@/lib/agent/types";
import type { AgentTurn } from "./session-model";
import type { AgentReplayTargetMode } from "./copy-replay-state";
import type { OpenAgentWorkspaceFileOptions } from "./workspace-file-actions";
import type {
  AgentWorkspaceFileFocusState,
  AgentWorkspaceFileView,
} from "./workspace-file-preview-panel";
import { AgentToolReviewPanel } from "./agent-tool-review-panel";
import { AgentToolRunReviewCard } from "./agent-tool-run-review-card";
import {
  buildReplayComparison,
  buildReplayComparisonSummaryText,
  collectToolReviewItems,
} from "@/features/compare/review";

type AgentDictionary = ReturnType<typeof getDictionary>;
type AgentToolRunReviewText = ComponentProps<
  typeof AgentToolRunReviewCard
>["uiText"];
type AgentTranscriptTurnText = AgentToolRunReviewText &
  Record<string, string | undefined>;

type AgentTranscriptTurnCardProps = {
  locale: string;
  dictionary: AgentDictionary;
  uiText: AgentTranscriptTurnText;
  turn: AgentTurn;
  turnIndex: number;
  pending: boolean;
  replayTargetMode: AgentReplayTargetMode;
  expandedTraceTurnId: string;
  expandedCitationKey: string;
  expandedReviewFileKey: string;
  workspaceFileViews: Record<string, AgentWorkspaceFileView>;
  openWorkspaceFilePath: string;
  focusedWorkspaceFilePath: string;
  workspaceFileFocusState: AgentWorkspaceFileFocusState | null;
  copyState: string;
  toolDecisionBusyKey: string;
  toolDecisionStatusByToken: Record<string, "approved" | "rejected">;
  setReplayTargetMode: (mode: AgentReplayTargetMode) => void;
  setExpandedTraceTurnId: Dispatch<SetStateAction<string>>;
  setExpandedCitationKey: Dispatch<SetStateAction<string>>;
  setExpandedReviewFileKey: Dispatch<SetStateAction<string>>;
  onPrepareReplayTurn: (turn: AgentTurn) => void;
  onReplayTurn: (
    turnIndex: number,
    turn: AgentTurn,
    options: { includeHistory: boolean },
  ) => void | Promise<void>;
  onCopy: (content: string, key: string) => void | Promise<void>;
  onOpenWorkspaceFile: (
    relativePath: string,
    options?: OpenAgentWorkspaceFileOptions,
  ) => void | Promise<void>;
  onStepWorkspaceFileAnchor: (direction: -1 | 1) => void;
  onToolDecision: (
    turnId: string,
    turnTargetId: string,
    toolRunIndex: number,
    toolName: string,
    toolInput: Record<string, unknown>,
    confirmationToken: string,
    action: "approve" | "reject",
  ) => void | Promise<void>;
  onResumeAgent: (
    turnIndex: number,
    turnId: string,
    turnTargetId: string,
    sourceToolRun: AgentToolRun,
    options?: { approvalContext?: boolean },
  ) => void | Promise<void>;
};

function formatCacheMode(mode: AgentTurn["cacheMode"] | undefined) {
  switch (mode) {
    case "exact":
      return "exact";
    case "semantic":
      return "semantic";
    default:
      return "";
  }
}

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

function formatGroundedVerdictLabel(
  verification: AgentGroundedVerification | undefined,
  labels: {
    grounded: string;
    weaklyGrounded: string;
    unsupported: string;
    notApplicable: string;
  },
) {
  switch (verification?.verdict) {
    case "grounded":
      return labels.grounded;
    case "weakly-grounded":
      return labels.weaklyGrounded;
    case "unsupported":
      return labels.unsupported;
    case "not-applicable":
    default:
      return labels.notApplicable;
  }
}

function formatGroundedFallbackReason(
  reason: AgentGroundedVerification["fallbackReason"] | undefined,
  labels: {
    noEvidence: string;
    lowConfidence: string;
    missingCitations: string;
    unsupportedClaims: string;
  },
) {
  switch (reason) {
    case "no-evidence":
      return labels.noEvidence;
    case "low-confidence":
      return labels.lowConfidence;
    case "missing-citations":
      return labels.missingCitations;
    case "unsupported-claims":
      return labels.unsupportedClaims;
    default:
      return "";
  }
}

function formatGroundedNote(
  note: string,
  labels: {
    retrievalDisabled: string;
    noEvidence: string;
    unsupportedCitations: string;
    missingCitations: string;
    lowConfidence: string;
    weakOverlap: string;
  },
) {
  switch (note) {
    case "retrieval-disabled":
      return labels.retrievalDisabled;
    case "no-evidence":
      return labels.noEvidence;
    case "unsupported-citations":
      return labels.unsupportedCitations;
    case "missing-citations":
      return labels.missingCitations;
    case "low-confidence":
      return labels.lowConfidence;
    case "weak-overlap":
      return labels.weakOverlap;
    default:
      return note;
  }
}

function formatLocalFallbackReason(
  reason: string | undefined,
  labels: {
    loading: string;
    health: string;
    empty: string;
    failure: string;
    simple: string;
  },
) {
  switch (reason) {
    case "primary-local-still-loading":
      return labels.loading;
    case "primary-local-health-warning":
      return labels.health;
    case "empty-visible-answer":
      return labels.empty;
    case "primary-local-failure":
      return labels.failure;
    case "simple-local-route":
      return labels.simple;
    default:
      return reason || "";
  }
}

function getConnectionStageBadgeClass(ok: boolean) {
  return ok
    ? "bg-emerald-400/15 text-emerald-200"
    : "bg-rose-400/15 text-rose-200";
}

export function AgentTranscriptTurnCard({
  locale,
  dictionary,
  uiText,
  turn,
  turnIndex,
  pending,
  replayTargetMode,
  expandedTraceTurnId,
  expandedCitationKey,
  expandedReviewFileKey,
  workspaceFileViews,
  openWorkspaceFilePath,
  focusedWorkspaceFilePath,
  workspaceFileFocusState,
  copyState,
  toolDecisionBusyKey,
  toolDecisionStatusByToken,
  setReplayTargetMode,
  setExpandedTraceTurnId,
  setExpandedCitationKey,
  setExpandedReviewFileKey,
  onPrepareReplayTurn,
  onReplayTurn,
  onCopy,
  onOpenWorkspaceFile,
  onStepWorkspaceFileAnchor,
  onToolDecision,
  onResumeAgent,
}: AgentTranscriptTurnCardProps) {
  const isEnglish = locale.startsWith("en");
  const reviewItems = collectToolReviewItems(turn);
  const traceOpen = expandedTraceTurnId === turn.id;
  const replayComparison = buildReplayComparison(turn, locale);

  return (
    <article className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300">
            {turn.targetLabel}
          </span>
          <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-cyan-300">
            {turn.providerLabel}
          </span>
          {turn.providerProfile ? (
            <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-violet-200">
              {turn.providerProfile}
            </span>
          ) : null}
          {turn.thinkingMode ? (
            <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-amber-200">
              {turn.thinkingMode}
            </span>
          ) : null}
          {turn.thinkingFallbackToStandard ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-amber-100">
              {uiText.fallbackBadge}
            </span>
          ) : null}
          {turn.localFallbackUsed ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-emerald-100">
              {uiText.localFallbackUsed}
            </span>
          ) : null}
          {turn.cacheHit ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-emerald-100">
              cache{turn.cacheMode ? `:${formatCacheMode(turn.cacheMode)}` : ""}
            </span>
          ) : null}
          {turn.retrieval ? (
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-emerald-200">
              {uiText.retrievalHits}: {turn.retrieval.hitCount}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-1 py-1">
            <button
              type="button"
              onClick={() => setReplayTargetMode("original")}
              className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] transition ${
                replayTargetMode === "original"
                  ? "bg-cyan-400/15 text-cyan-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isEnglish ? "Original target" : "保留原目标"}
            </button>
            <button
              type="button"
              onClick={() => setReplayTargetMode("current")}
              className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] transition ${
                replayTargetMode === "current"
                  ? "bg-cyan-400/15 text-cyan-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isEnglish ? "Current target" : "切换目标回放"}
            </button>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onPrepareReplayTurn(turn)}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEnglish ? "Load replay" : "载入回放"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onReplayTurn(turnIndex, turn, { includeHistory: true })}
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEnglish ? "Context replay" : "上下文回放"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onReplayTurn(turnIndex, turn, { includeHistory: false })}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isEnglish ? "Clean replay" : "干净回放"}
          </button>
          <button
            type="button"
            onClick={() =>
              setExpandedTraceTurnId((current) =>
                current === turn.id ? "" : turn.id,
              )
            }
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
          >
            {traceOpen
              ? isEnglish
                ? "Hide trace"
                : "收起轨迹"
              : isEnglish
                ? "Show trace"
                : "查看轨迹"}
          </button>
          <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            {turn.resolvedModel}
          </span>
        </div>
      </div>

      {traceOpen ? (
        <div className="rounded-2xl border border-sky-400/15 bg-sky-400/5 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
              {isEnglish ? "Tool steps" : "工具步骤"} {turn.toolRuns.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
              {isEnglish ? "Plan steps" : "规划步骤"}{" "}
              {turn.plannerSteps?.length || 0}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
              {isEnglish ? "Patch reviews" : "变更审阅"} {reviewItems.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
              {isEnglish ? "Retrieval hits" : "检索命中"}{" "}
              {turn.retrieval?.hitCount || 0}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-xs leading-6 text-slate-200">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {isEnglish ? "Replay source" : "回放来源"}
              </p>
              <p className="mt-2">
                {turn.targetLabel} · {turn.providerLabel}
              </p>
              <p>
                {turn.providerProfile || "--"} · {turn.thinkingMode || "--"}
              </p>
              <p>{turn.resolvedModel}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-xs leading-6 text-slate-200">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {isEnglish ? "Execution notes" : "执行摘要"}
              </p>
              <p className="mt-2">
                {turn.warning
                  ? turn.warning
                  : isEnglish
                    ? "No extra warning on this turn."
                    : "该轮没有额外告警。"}
              </p>
            </div>
          </div>
          <AgentToolReviewPanel
            locale={locale}
            reviewItems={reviewItems}
            expandedReviewFileKey={expandedReviewFileKey}
            workspaceFileViews={workspaceFileViews}
            openWorkspaceFilePath={openWorkspaceFilePath}
            focusedWorkspaceFilePath={focusedWorkspaceFilePath}
            workspaceFileFocusState={workspaceFileFocusState}
            copyState={copyState}
            copiedLabel={dictionary.common.copied}
            onCopy={onCopy}
            onToggleReviewFile={(reviewFileKey) =>
              setExpandedReviewFileKey((current) =>
                current === reviewFileKey ? "" : reviewFileKey,
              )
            }
            onOpenWorkspaceFile={onOpenWorkspaceFile}
            onStepWorkspaceFileAnchor={onStepWorkspaceFileAnchor}
          />
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            {dictionary.agent.user}
          </p>
          <button
            type="button"
            onClick={() =>
              void onCopy(turn.displayPrompt || turn.prompt, `${turn.id}:user`)
            }
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
          >
            {copyState === `${turn.id}:user`
              ? dictionary.common.copied
              : dictionary.common.copy}
          </button>
        </div>
        <pre className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-100">{`> ${turn.displayPrompt || turn.prompt}`}</pre>
      </div>

      {turn.toolRuns.length ? (
        <div className="space-y-3">
          {turn.toolRuns.map((toolRun, index) => (
            <AgentToolRunReviewCard
              key={`${turn.id}-tool-${index}`}
              locale={locale}
              uiText={uiText}
              turnId={turn.id}
              turnTargetId={turn.targetId}
              turnIndex={turnIndex}
              toolRun={toolRun}
              toolRunIndex={index}
              pending={pending}
              toolDecisionBusyKey={toolDecisionBusyKey}
              toolDecisionStatusByToken={toolDecisionStatusByToken}
              onToolDecision={onToolDecision}
              onResumeAgent={onResumeAgent}
            />
          ))}
        </div>
      ) : null}

      {turn.warning ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-sm leading-6 text-amber-100">
          {turn.warning}
        </div>
      ) : null}

      {replayComparison ? (
        <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-violet-100">
                {isEnglish ? "Replay compare" : "回放对比"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                {replayComparison.replayModeLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                {replayComparison.targetModeLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                void onCopy(
                  buildReplayComparisonSummaryText(replayComparison, locale),
                  `${turn.id}:replay-compare`,
                )
              }
              className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-violet-100 transition hover:bg-violet-400/20"
            >
              {copyState === `${turn.id}:replay-compare`
                ? dictionary.common.copied
                : isEnglish
                  ? "Copy diff summary"
                  : "复制差异摘要"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-6 text-slate-200">
            {replayComparison.sourceLabel}
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-300">
            {isEnglish ? "Response delta" : "响应长度变化"}:{" "}
            {replayComparison.responseDelta > 0 ? "+" : ""}
            {replayComparison.responseDelta}
          </p>
          <p className="mt-2 text-xs leading-6 text-violet-100">
            {replayComparison.summary}
          </p>
          {replayComparison.keyDiffs.length ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {isEnglish ? "Top 3 key differences" : "前 3 处关键差异"}
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-6 text-slate-200">
                {replayComparison.keyDiffs.map((diff, index) => (
                  <li key={`${turn.id}:replay-diff:${index}`}>- {diff}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {isEnglish ? "Original" : "原轮"}
              </p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                {(turn.replaySource?.response || "").trim().slice(0, 240) ||
                  (isEnglish ? "No original response." : "没有原轮响应。")}
                {(turn.replaySource?.response || "").trim().length > 240
                  ? "..."
                  : ""}
              </pre>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {isEnglish ? "Replay" : "回放"}
              </p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                {turn.response.trim().slice(0, 240) ||
                  (isEnglish ? "No replay response." : "没有回放响应。")}
                {turn.response.trim().length > 240 ? "..." : ""}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {turn.plannerSteps?.length ? (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">
            plan
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-6 text-slate-200">
            {turn.plannerSteps.map((step, index) => (
              <li key={`${turn.id}:plan:${index}`}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {turn.memorySummary ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
            memory
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
            {turn.memorySummary}
          </pre>
        </div>
      ) : null}

      {turn.retrieval ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200">
              {uiText.retrievalGrounding}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-emerald-100">
                {uiText.retrievalHits}: {turn.retrieval.hitCount}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                {turn.retrieval.strategy === "hybrid-rerank"
                  ? isEnglish
                    ? "Hybrid rerank"
                    : "二阶段检索"
                  : isEnglish
                    ? "Lexical"
                    : "词法检索"}
              </span>
              {typeof turn.retrieval.candidateCount === "number" ? (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                  {isEnglish ? "Candidates" : "候选"}:{" "}
                  {turn.retrieval.candidateCount}
                </span>
              ) : null}
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                {turn.retrieval.bypassGrounding
                  ? isEnglish
                    ? "General answer"
                    : "常识直答"
                  : isEnglish
                    ? "Evidence-backed"
                    : "证据回答"}
              </span>
            </div>
          </div>
          {turn.retrieval.lowConfidence ? (
            <p className="mt-2 text-xs leading-6 text-amber-100">
              {uiText.retrievalLowConfidence}
            </p>
          ) : null}
          {turn.retrieval.bypassGrounding ? (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-6 text-slate-200">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                {isEnglish ? "General answer mode" : "常识直答模式"}
              </span>
              <p className="mt-2">
                {turn.retrieval.bypassReason === "general-question-no-evidence"
                  ? isEnglish
                    ? "No local evidence was required for this question, so the answer could rely on general knowledge."
                    : "这个问题不依赖本地知识证据，因此允许直接按常识回答。"
                  : isEnglish
                    ? "Retrieval confidence was too low, so the answer stayed conservative and separated evidence from general guidance."
                    : "检索信心偏低，因此回答会把本地证据与一般性建议分开表达。"}
              </p>
            </div>
          ) : null}
          {turn.retrieval.results.length ? (
            <div className="mt-3 space-y-2.5">
              {turn.retrieval.results
                .slice(
                  0,
                  Math.max(
                    2,
                    turn.retrieval.results.findIndex(
                      (result) =>
                        `${turn.id}:${result.chunkId}` === expandedCitationKey,
                    ) + 1,
                  ),
                )
                .map((result) => (
                  <button
                    key={`${turn.id}:${result.chunkId}`}
                    id={`citation:${turn.id}:${result.chunkId}`}
                    type="button"
                    onClick={() =>
                      setExpandedCitationKey((current) =>
                        current === `${turn.id}:${result.chunkId}`
                          ? ""
                          : `${turn.id}:${result.chunkId}`,
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-left transition hover:border-white/20 hover:bg-slate-950/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-white">
                        {result.citationLabel} {result.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          {result.score.toFixed(1)}
                        </span>
                        {result.scoring ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                            R {result.scoring.rerank.toFixed(0)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {result.sectionPath.length
                        ? result.sectionPath.join(" > ")
                        : "--"}
                      {result.source ? ` · ${result.source}` : ""}
                    </p>
                    {result.matchedTerms?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.matchedTerms.slice(0, 5).map((term) => (
                          <span
                            key={`${result.chunkId}:${term}`}
                            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-100"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs leading-6 text-slate-200">
                      {expandedCitationKey === `${turn.id}:${result.chunkId}`
                        ? result.evidencePreview || result.content
                        : (result.evidencePreview || result.content).length >
                            220
                          ? `${(result.evidencePreview || result.content).slice(0, 220)}...`
                          : result.evidencePreview || result.content}
                    </p>
                    {expandedCitationKey === `${turn.id}:${result.chunkId}` &&
                    result.evidenceSpans?.length ? (
                      <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                        {result.evidenceSpans.map((span) => (
                          <div key={`${result.chunkId}:${span.label}`}>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                              {span.label}
                            </p>
                            <p className="mt-1 text-xs leading-6 text-slate-200">
                              {span.preview}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-[11px] text-cyan-300">
                      {expandedCitationKey === `${turn.id}:${result.chunkId}`
                        ? isEnglish
                          ? "Click again to collapse"
                          : "再次点击可收起"
                        : isEnglish
                          ? "Click to inspect full citation"
                          : "点击查看完整引用"}
                    </p>
                  </button>
                ))}
              {turn.retrieval.results.length > 2 ? (
                <p className="px-1 text-xs leading-6 text-slate-400">
                  +{turn.retrieval.results.length - 2} 条额外证据已命中
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-6 text-slate-400">
              {uiText.retrievalNoEvidence}
            </p>
          )}
          {turn.retrieval.stageNotes?.length ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {isEnglish ? "Retrieval stages" : "检索阶段"}
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-6 text-slate-300">
                {turn.retrieval.stageNotes.map((note) => (
                  <li key={`${turn.id}:${note}`}>- {note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {turn.verification ? (
        <div
          className={`rounded-2xl border px-3 py-3 ${
            turn.verification.verdict === "grounded"
              ? "border-emerald-400/20 bg-emerald-400/5"
              : turn.verification.verdict === "weakly-grounded"
                ? "border-amber-400/20 bg-amber-400/10"
                : "border-rose-400/20 bg-rose-400/10"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-200">
              {uiText.groundedVerification}
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${
                turn.verification.verdict === "grounded"
                  ? "bg-emerald-400/15 text-emerald-100"
                  : turn.verification.verdict === "weakly-grounded"
                    ? "bg-amber-400/15 text-amber-100"
                    : "bg-rose-400/15 text-rose-100"
              }`}
            >
              {formatGroundedVerdictLabel(turn.verification, {
                grounded: uiText.groundedVerdictGrounded ?? "Grounded",
                weaklyGrounded: uiText.groundedVerdictWeak ?? "Weak",
                unsupported: uiText.groundedVerdictUnsupported ?? "Unsupported",
                notApplicable: uiText.groundedVerdictNotApplicable ?? "N/A",
              })}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-xs leading-6 text-slate-200">
            <p>
              {uiText.groundedLexicalScore}:{" "}
              {turn.verification.lexicalGroundingScore.toFixed(3)}
            </p>
            <div>
              <p>{uiText.groundedCitations}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {turn.verification.citedLabels.length ? (
                  turn.verification.citedLabels.map((label) => {
                    const matchedResult = turn.retrieval?.results.find(
                      (result) => result.citationLabel === label,
                    );
                    return (
                      <button
                        key={`${turn.id}:cited:${label}`}
                        type="button"
                        onClick={() => {
                          if (!matchedResult) return;
                          const nextKey = `${turn.id}:${matchedResult.chunkId}`;
                          setExpandedCitationKey(nextKey);
                          window.requestAnimationFrame(() => {
                            document
                              .getElementById(
                                `citation:${turn.id}:${matchedResult.chunkId}`,
                              )
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "nearest",
                              });
                          });
                        }}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-100 transition hover:bg-white/[0.08]"
                      >
                        {label}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-slate-500">--</span>
                )}
              </div>
            </div>
            {turn.verification.unsupportedLabels.length ? (
              <p>
                {uiText.groundedUnsupportedCitations}:{" "}
                {turn.verification.unsupportedLabels.join(", ")}
              </p>
            ) : null}
            {turn.verification.fallbackApplied ? (
              <p className="text-amber-100">
                {uiText.groundedFallbackApplied}
                {turn.verification.fallbackReason
                  ? ` · ${uiText.groundedFallbackReason}: ${formatGroundedFallbackReason(
                      turn.verification.fallbackReason,
                      {
                        noEvidence:
                          uiText.groundedReasonNoEvidence ?? "No evidence",
                        lowConfidence:
                          uiText.groundedReasonLowConfidence ??
                          "Low confidence",
                        missingCitations:
                          uiText.groundedReasonMissingCitations ??
                          "Missing citations",
                        unsupportedClaims:
                          uiText.groundedReasonUnsupportedClaims ??
                          "Unsupported claims",
                      },
                    )}`
                  : ""}
              </p>
            ) : null}
          </div>
          {turn.verification.notes.length ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {uiText.groundedNotes}
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-6 text-slate-200">
                {turn.verification.notes.slice(0, 2).map((note, noteIndex) => (
                  <li key={`${turn.id}:verification-note:${noteIndex}`}>
                    -{" "}
                    {formatGroundedNote(note, {
                      retrievalDisabled:
                        uiText.groundedNoteRetrievalDisabled ??
                        "Retrieval disabled",
                      noEvidence: uiText.groundedNoteNoEvidence ?? "No evidence",
                      unsupportedCitations:
                        uiText.groundedNoteUnsupportedCitations ??
                        "Unsupported citations",
                      missingCitations:
                        uiText.groundedNoteMissingCitations ??
                        "Missing citations",
                      lowConfidence:
                        uiText.groundedNoteLowConfidence ?? "Low confidence",
                      weakOverlap: uiText.groundedNoteWeakOverlap ?? "Weak overlap",
                    })}
                  </li>
                ))}
                {turn.verification.notes.length > 2 ? (
                  <li className="text-slate-500">
                    +{turn.verification.notes.length - 2} 条补充说明
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {turn.thinkingFallbackToStandard ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-sm leading-6 text-amber-100">
          {uiText.thinkingModelFallback} {turn.resolvedModel}
        </div>
      ) : null}

      {turn.localFallbackUsed ? (
        <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-3 text-sm leading-6 text-emerald-50">
          <p>
            {uiText.localFallbackUsed}
            {turn.localFallbackTargetLabel
              ? ` · ${uiText.localFallbackTarget}: ${turn.localFallbackTargetLabel}`
              : ""}
          </p>
          {turn.localFallbackReason ? (
            <p className="mt-1 text-emerald-100/90">
              {uiText.localFallbackReason}:{" "}
              {formatLocalFallbackReason(turn.localFallbackReason, {
                loading: uiText.localFallbackReasonLoading ?? "Loading",
                health: uiText.localFallbackReasonHealth ?? "Health warning",
                empty: uiText.localFallbackReasonEmpty ?? "Empty response",
                failure: uiText.localFallbackReasonFailure ?? "Request failed",
                simple: uiText.localFallbackReasonSimple ?? "Simple route",
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {turn.connectionCheck ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${
                turn.connectionCheck.ok
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-amber-400/15 text-amber-200"
              }`}
            >
              {dictionary.agent.connectionRecord}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
              {new Date(turn.connectionCheck.checkedAt).toLocaleString()}
            </span>
          </div>
          <div className="mt-3 grid gap-3">
            {turn.connectionCheck.stages.map((stage) => (
              <div
                key={`${turn.id}-${stage.id}`}
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${getConnectionStageBadgeClass(stage.ok)}`}
                    >
                      {formatConnectionStageLabel(stage.id)}
                    </span>
                    {typeof stage.httpStatus === "number" ? (
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                        http {stage.httpStatus}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    {stage.latencyMs} ms
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {stage.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">
            {dictionary.agent.assistant}
          </p>
          <button
            type="button"
            onClick={() => void onCopy(turn.response, `${turn.id}:assistant`)}
            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20"
          >
            {copyState === `${turn.id}:assistant`
              ? dictionary.common.copied
              : dictionary.common.copy}
          </button>
        </div>
        <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-100">
          {turn.response}
        </pre>
      </div>
    </article>
  );
}
