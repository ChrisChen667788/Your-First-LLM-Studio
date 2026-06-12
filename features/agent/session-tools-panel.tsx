"use client";

import { createSessionTitle } from "./session-model";
import type {
  AgentSessionExportScope,
  AgentTurn,
  StoredAgentSession,
} from "./session-model";
import type { AgentWorkbenchSessionConflict } from "@/lib/agent/types";

type AgentSessionTargetOption = {
  id: string;
  label: string;
};

type AgentSessionGroup = {
  targetId: string;
  targetLabel: string;
  sessions: StoredAgentSession[];
};

type AgentSessionToolsText = {
  allTargets: string;
  clearAllSessions: string;
  clearUnpinnedSessions: string;
  currentSession: string;
  deleteSession: string;
  exportPinnedSessions: string;
  exportSessionsJson: string;
  exportSessionsMarkdown: string;
  exportVisibleSessions: string;
  newSession: string;
  noSessions: string;
  pinSession: string;
  pinned: string;
  renameSession: string;
  restoreSession: string;
  sessionExportScope: string;
  sessions: string;
  sessionSaved: string;
  sessionSearch: string;
  sessionTargetFilter: string;
  targetGroup: string;
  unpinSession: string;
};

type AgentSessionToolsPanelProps = {
  locale: string;
  uiText: AgentSessionToolsText;
  turns: AgentTurn[];
  savedSessions: StoredAgentSession[];
  currentSession: StoredAgentSession | null;
  sessionSyncLabel: string;
  sessionSyncConflict: AgentWorkbenchSessionConflict | null;
  sessionSearch: string;
  sessionTargetFilter: string;
  sessionTargetOptions: AgentSessionTargetOption[];
  sessionExportScope: AgentSessionExportScope;
  exportableSessions: StoredAgentSession[];
  sessionGroups: AgentSessionGroup[];
  activeSessionTargetLabel: string;
  onSessionSearchChange: (value: string) => void;
  onSessionTargetFilterChange: (value: string) => void;
  onSessionExportScopeChange: (value: AgentSessionExportScope) => void;
  onRestoreSession: (session: StoredAgentSession) => void;
  onRenameSession: (sessionId: string) => void;
  onTogglePinSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onReloadServerSessionSnapshot: () => void | Promise<void>;
  onForceOverwriteServerSessionSnapshot: () => void | Promise<void>;
  onExportSessions: (format: "markdown" | "json") => void;
  onBulkClearSessions: (mode: "all" | "unpinned") => void;
  onStartNewSession: () => void;
};

export function AgentSessionToolsPanel({
  locale,
  uiText,
  turns,
  savedSessions,
  currentSession,
  sessionSyncLabel,
  sessionSyncConflict,
  sessionSearch,
  sessionTargetFilter,
  sessionTargetOptions,
  sessionExportScope,
  exportableSessions,
  sessionGroups,
  activeSessionTargetLabel,
  onSessionSearchChange,
  onSessionTargetFilterChange,
  onSessionExportScopeChange,
  onRestoreSession,
  onRenameSession,
  onTogglePinSession,
  onDeleteSession,
  onReloadServerSessionSnapshot,
  onForceOverwriteServerSessionSnapshot,
  onExportSessions,
  onBulkClearSessions,
  onStartNewSession,
}: AgentSessionToolsPanelProps) {
  const isEnglish = locale.startsWith("en");

  return (
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
            {uiText.sessions}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {uiText.sessionSaved}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
            {savedSessions.length}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200">
            {uiText.newSession}
          </span>
        </div>
      </summary>
      <div className="mt-4 space-y-2">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">
              {uiText.currentSession}
            </p>
            {currentSession?.pinned ? (
              <span className="rounded-full bg-cyan-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                {uiText.pinned}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-medium text-white">
            {currentSession?.title ||
              createSessionTitle(turns, uiText.newSession)}
          </p>
          <p className="mt-1 text-xs text-cyan-100/80">
            {uiText.sessionSaved} ·{" "}
            {currentSession?.updatedAt
              ? new Date(currentSession.updatedAt).toLocaleString()
              : "--"}
          </p>
          <p className="mt-1 text-[11px] text-cyan-100/70">
            {sessionSyncLabel}
          </p>
          {sessionSyncConflict ? (
            <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-[11px] text-amber-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-100">
                    {isEnglish
                      ? "Server snapshot is newer than this tab"
                      : "服务端快照比当前标签页更新"}
                  </p>
                  <p className="mt-1 leading-5 text-amber-100/85">
                    {sessionSyncConflict.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-amber-100/80">
                    <span className="rounded-full border border-amber-300/20 bg-black/20 px-2 py-1">
                      {isEnglish ? "Local sessions" : "本地会话"} ·{" "}
                      {sessionSyncConflict.localSessionCount}
                    </span>
                    <span className="rounded-full border border-amber-300/20 bg-black/20 px-2 py-1">
                      {isEnglish ? "Server sessions" : "服务端会话"} ·{" "}
                      {sessionSyncConflict.serverSessionCount}
                    </span>
                    <span className="rounded-full border border-amber-300/20 bg-black/20 px-2 py-1 normal-case tracking-normal">
                      {isEnglish ? "Server updated" : "服务端更新时间"} ·{" "}
                      {new Date(
                        sessionSyncConflict.serverUpdatedAt,
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onReloadServerSessionSnapshot()}
                    className="rounded-full border border-amber-300/30 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-amber-50 transition hover:bg-black/30"
                  >
                    {isEnglish ? "Reload server copy" : "加载服务端副本"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onForceOverwriteServerSessionSnapshot()}
                    className="rounded-full border border-amber-300/30 bg-amber-200/15 px-3 py-1.5 text-[11px] font-semibold text-amber-50 transition hover:bg-amber-200/25"
                  >
                    {isEnglish
                      ? "Overwrite server with local"
                      : "用本地覆盖服务端"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {currentSession ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onRenameSession(currentSession.id)}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/15"
              >
                {uiText.renameSession}
              </button>
              <button
                type="button"
                onClick={() => onTogglePinSession(currentSession.id)}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/15"
              >
                {currentSession.pinned ? uiText.unpinSession : uiText.pinSession}
              </button>
              <button
                type="button"
                onClick={() => onDeleteSession(currentSession.id)}
                className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/20"
              >
                {uiText.deleteSession}
              </button>
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                {uiText.sessionTargetFilter} · {activeSessionTargetLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                {uiText.sessionExportScope} ·{" "}
                {sessionExportScope === "visible"
                  ? uiText.exportVisibleSessions
                  : uiText.exportPinnedSessions}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              {uiText.sessions} · {exportableSessions.length}/
              {savedSessions.length}
            </span>
          </div>
          <input
            value={sessionSearch}
            onChange={(event) => onSessionSearchChange(event.target.value)}
            placeholder={uiText.sessionSearch}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <select
            value={sessionTargetFilter}
            onChange={(event) => onSessionTargetFilterChange(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option value="all">
              {uiText.sessionTargetFilter} · {uiText.allTargets}
            </option>
            {sessionTargetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {uiText.sessionTargetFilter} · {option.label}
              </option>
            ))}
          </select>
          <select
            value={sessionExportScope}
            onChange={(event) =>
              onSessionExportScopeChange(
                event.target.value as AgentSessionExportScope,
              )
            }
            className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option value="visible">
              {uiText.sessionExportScope} · {uiText.exportVisibleSessions}
            </option>
            <option value="pinned">
              {uiText.sessionExportScope} · {uiText.exportPinnedSessions}
            </option>
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onExportSessions("markdown")}
              disabled={!exportableSessions.length}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
            >
              {uiText.exportSessionsMarkdown}
            </button>
            <button
              type="button"
              onClick={() => onExportSessions("json")}
              disabled={!exportableSessions.length}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
            >
              {uiText.exportSessionsJson}
            </button>
            <button
              type="button"
              onClick={() => onBulkClearSessions("unpinned")}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
            >
              {uiText.clearUnpinnedSessions}
            </button>
            <button
              type="button"
              onClick={() => onBulkClearSessions("all")}
              className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/20"
            >
              {uiText.clearAllSessions}
            </button>
          </div>
        </div>
        <div className="max-h-[42vh] overflow-y-auto overscroll-contain pr-1">
          <div className="space-y-3">
            {sessionGroups.length ? (
              sessionGroups.map((group) => (
                <div key={group.targetId} className="space-y-2">
                  <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    {uiText.targetGroup} · {group.targetLabel}
                  </p>
                  {group.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">
                            {session.title}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {new Date(session.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        {session.pinned ? (
                          <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                            {uiText.pinned}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onRestoreSession(session)}
                          className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                        >
                          {uiText.restoreSession}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRenameSession(session.id)}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                        >
                          {uiText.renameSession}
                        </button>
                        <button
                          type="button"
                          onClick={() => onTogglePinSession(session.id)}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
                        >
                          {session.pinned
                            ? uiText.unpinSession
                            : uiText.pinSession}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSession(session.id)}
                          className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/20"
                        >
                          {uiText.deleteSession}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-400">
                {uiText.noSessions}
              </p>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onStartNewSession}
        className="mt-4 w-full rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10"
      >
        {uiText.newSession}
      </button>
    </details>
  );
}
