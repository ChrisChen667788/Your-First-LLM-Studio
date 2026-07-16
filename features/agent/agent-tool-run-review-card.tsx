"use client";

import type { AgentToolRun } from "@/lib/agent/types";
import {
  parseToolOutput,
  readArrayField,
  readBooleanField,
  readStringField,
} from "@/features/compare/review";
import { readAgentToolFileEvidence } from "@/features/agent/tool-file-evidence";

type ToolRunDecisionState = "approved" | "rejected";

type AgentToolRunReviewText = {
  approve: string;
  approving: string;
  confirmationApproved: string;
  confirmationRejected: string;
  confirmationRequired: string;
  contentPreview: string;
  diffPreview: string;
  expires: string;
  initialFailure: string;
  reject: string;
  rejecting: string;
  rejectArtifacts: string;
  repairAttempt: string;
  repairPatch: string;
  resumeAgent: string;
  standardError: string;
  standardOutput: string;
  step: string;
  token: string;
  unverified: string;
  verification: string;
  verified: string;
};

type AgentToolRunReviewCardProps = {
  locale: string;
  uiText: AgentToolRunReviewText;
  turnId: string;
  turnTargetId: string;
  turnIndex: number;
  toolRun: AgentToolRun;
  toolRunIndex: number;
  pending: boolean;
  toolDecisionBusyKey: string;
  toolDecisionStatusByToken: Record<string, ToolRunDecisionState>;
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

function readVerificationField(source: Record<string, unknown> | null) {
  const value = source?.verification;
  return Array.isArray(value) ? value : [];
}

function readNumberField(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === "number" ? value : null;
}

export function AgentToolRunReviewCard({
  locale,
  uiText,
  turnId,
  turnTargetId,
  turnIndex,
  toolRun,
  toolRunIndex,
  pending,
  toolDecisionBusyKey,
  toolDecisionStatusByToken,
  onToolDecision,
  onResumeAgent,
}: AgentToolRunReviewCardProps) {
  const parsedOutput = parseToolOutput(toolRun.output);
  const fileEvidence = readAgentToolFileEvidence(toolRun.name, parsedOutput);
  const status = readStringField(parsedOutput, "status");
  const policyLevel = readStringField(parsedOutput, "policyLevel");
  const diffPreview = readStringField(parsedOutput, "diffPreview");
  const contentPreview = readStringField(parsedOutput, "contentPreview");
  const stdout = readStringField(parsedOutput, "stdout");
  const stderr = readStringField(parsedOutput, "stderr");
  const errorText = readStringField(parsedOutput, "error");
  const message = readStringField(parsedOutput, "message");
  const confirmationToken = readStringField(parsedOutput, "confirmationToken");
  const repairPatch = readStringField(parsedOutput, "repairPatch");
  const verified = readBooleanField(parsedOutput, "verified");
  const expiresAt = readNumberField(parsedOutput, "expiresAt");
  const verification = readVerificationField(parsedOutput);
  const rejectArtifacts = readArrayField(parsedOutput, "rejectArtifacts");
  const initialFailure = parsedOutput?.initialFailure;
  const repairAttempt = parsedOutput?.repairAttempt;
  const decisionState = confirmationToken
    ? toolDecisionStatusByToken[confirmationToken]
    : undefined;
  const decisionBusy =
    toolDecisionBusyKey === `${turnId}:${toolRunIndex}:approve` ||
    toolDecisionBusyKey === `${turnId}:${toolRunIndex}:reject`;
  const confirmationUsed = readBooleanField(parsedOutput, "confirmationUsed");
  const policyReason = readStringField(parsedOutput, "policyReason");
  const isEnglish = locale.startsWith("en");

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">
            tool::{toolRun.name}
          </p>
          {status ? (
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-50">
              {status}
            </span>
          ) : null}
          {policyLevel ? (
            <span className="rounded-full bg-slate-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200">
              {policyLevel}
            </span>
          ) : null}
          {verified !== null ? (
            <span
              className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${
                verified
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-rose-400/15 text-rose-200"
              }`}
            >
              {verified ? uiText.verified : uiText.unverified}
            </span>
          ) : null}
          {decisionState ? (
            <span
              className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${
                decisionState === "approved"
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-rose-400/15 text-rose-200"
              }`}
            >
              {decisionState}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] uppercase tracking-[0.24em] text-amber-200/70">
          {uiText.step} {toolRunIndex + 1}
        </span>
      </div>

      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-amber-100">
        {JSON.stringify(toolRun.input, null, 2)}
      </pre>

      {diffPreview ? (
        <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">
            {uiText.diffPreview}
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-cyan-50">
            {diffPreview}
          </pre>
        </div>
      ) : null}

      {policyReason ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
            Policy
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-200">
            {policyReason}
          </p>
        </div>
      ) : null}

      {confirmationToken ? (
        <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-400/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-violet-300">
            {uiText.confirmationRequired}
          </p>
          <p className="mt-2 break-all text-xs leading-6 text-violet-100">
            {uiText.token}: {confirmationToken}
          </p>
          {expiresAt ? (
            <p className="mt-2 text-xs leading-6 text-violet-200/80">
              {uiText.expires}: {new Date(expiresAt).toLocaleString()}
            </p>
          ) : null}
          {message ? (
            <p className="mt-2 text-xs leading-6 text-violet-100">{message}</p>
          ) : null}
          {!decisionState ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(decisionBusy) || pending}
                onClick={() =>
                  void onToolDecision(
                    turnId,
                    turnTargetId,
                    toolRunIndex,
                    toolRun.name,
                    toolRun.input,
                    confirmationToken,
                    "approve",
                  )
                }
                className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {toolDecisionBusyKey === `${turnId}:${toolRunIndex}:approve`
                  ? uiText.approving
                  : uiText.approve}
              </button>
              <button
                type="button"
                disabled={Boolean(decisionBusy) || pending}
                onClick={() =>
                  void onToolDecision(
                    turnId,
                    turnTargetId,
                    toolRunIndex,
                    toolRun.name,
                    toolRun.input,
                    confirmationToken,
                    "reject",
                  )
                }
                className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
              >
                {toolDecisionBusyKey === `${turnId}:${toolRunIndex}:reject`
                  ? uiText.rejecting
                  : uiText.reject}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-6 text-violet-200/80">
              {decisionState === "approved"
                ? uiText.confirmationApproved
                : uiText.confirmationRejected}
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {confirmationUsed ? (
          <button
            type="button"
            disabled={pending || Boolean(toolDecisionBusyKey)}
            onClick={() =>
              void onResumeAgent(turnIndex, turnId, turnTargetId, toolRun, {
                approvalContext: true,
              })
            }
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
          >
            {uiText.resumeAgent}
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending || Boolean(toolDecisionBusyKey)}
          onClick={() =>
            void onResumeAgent(turnIndex, turnId, turnTargetId, toolRun, {
              approvalContext: false,
            })
          }
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
        >
          {isEnglish ? "Replay from here" : "从该步骤继续"}
        </button>
      </div>

      {contentPreview ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
            {uiText.contentPreview}
          </p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
            {contentPreview}
          </pre>
        </div>
      ) : null}

      {fileEvidence ? (
        <div className="mt-3 border border-cyan-300/20 bg-cyan-300/10 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
              {isEnglish ? "File evidence" : "文件证据"}
            </p>
            <code className="border border-cyan-300/20 bg-black/20 px-2 py-1 text-[11px] text-cyan-50">
              {fileEvidence.citation}
            </code>
          </div>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-cyan-50">
            {fileEvidence.numberedContent}
          </pre>
        </div>
      ) : null}

      {verification.length ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
            {uiText.verification}
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
            {JSON.stringify(verification, null, 2)}
          </pre>
        </div>
      ) : null}

      {repairPatch ? (
        <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-sky-300">
            {uiText.repairPatch}
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-sky-50">
            {repairPatch}
          </pre>
        </div>
      ) : null}

      {rejectArtifacts.length ? (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">
            {uiText.rejectArtifacts}
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-amber-50">
            {JSON.stringify(rejectArtifacts, null, 2)}
          </pre>
        </div>
      ) : null}

      {initialFailure && typeof initialFailure === "object" ? (
        <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-rose-300">
            {uiText.initialFailure}
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-rose-100">
            {JSON.stringify(initialFailure, null, 2)}
          </pre>
        </div>
      ) : null}

      {repairAttempt && typeof repairAttempt === "object" ? (
        <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-rose-300">
            {uiText.repairAttempt}
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-rose-100">
            {JSON.stringify(repairAttempt, null, 2)}
          </pre>
        </div>
      ) : null}

      {stdout ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
            {uiText.standardOutput}
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
            {stdout}
          </pre>
        </div>
      ) : null}

      {stderr ? (
        <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-rose-300">
            {uiText.standardError}
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-rose-100">
            {stderr}
          </pre>
        </div>
      ) : null}

      {errorText ? (
        <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-3 text-xs leading-6 text-rose-100">
          {errorText}
        </div>
      ) : null}

      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs leading-6 text-slate-200">
        {toolRun.output}
      </pre>
    </div>
  );
}
