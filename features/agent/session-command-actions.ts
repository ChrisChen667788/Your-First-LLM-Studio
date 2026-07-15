"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { getDefaultSystemPromptForLocale, type AppLocale } from "@/lib/i18n";
import type {
  AgentConnectionCheckResponse,
  AgentProviderProfile,
  AgentThinkingMode,
} from "@/lib/agent/types";
import { downloadAgentSessionExport, type AgentSessionExportFormat } from "./session-export";
import {
  MAX_STORED_SESSIONS,
  sortSessions,
  type AgentSessionExportScope,
  type AgentTurn,
  type StoredAgentSession,
} from "./session-model";
import { writeLocalAgentSessions } from "./session-persistence";

export function useAgentSessionCommandActions(input: {
  locale: AppLocale;
  sessionId: string;
  savedSessions: StoredAgentSession[];
  exportableSessions: StoredAgentSession[];
  sessionExportScope: AgentSessionExportScope;
  sessionTargetFilter: string;
  sessionSearch: string;
  renamePrompt: string;
  deleteConfirmation: string;
  restoreSession: (session: StoredAgentSession) => void;
  setSavedSessions: Dispatch<SetStateAction<StoredAgentSession[]>>;
  setTranscriptPinnedToBottom: Dispatch<SetStateAction<boolean>>;
  setSessionId: Dispatch<SetStateAction<string>>;
  setTurns: Dispatch<SetStateAction<AgentTurn[]>>;
  setInput: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  setRuntimeLogExcerpt: Dispatch<SetStateAction<string>>;
  setToolDecisionBusyKey: Dispatch<SetStateAction<string>>;
  setToolDecisionStatusByToken: Dispatch<
    SetStateAction<Record<string, "approved" | "rejected">>
  >;
  setConnectionChecksByTargetId: Dispatch<
    SetStateAction<Record<string, AgentConnectionCheckResponse>>
  >;
  setSystemPrompt: Dispatch<SetStateAction<string>>;
  setProviderProfile: Dispatch<SetStateAction<AgentProviderProfile>>;
  setThinkingMode: Dispatch<SetStateAction<AgentThinkingMode>>;
}) {
  const updateSessions = useCallback(
    (updater: (current: StoredAgentSession[]) => StoredAgentSession[]) => {
      input.setSavedSessions((current) => {
        const next = sortSessions(updater(current)).slice(
          0,
          MAX_STORED_SESSIONS,
        );
        writeLocalAgentSessions(next);
        return next;
      });
    },
    [input.setSavedSessions],
  );

  const startNewSession = useCallback(() => {
    input.setTranscriptPinnedToBottom(true);
    input.setSessionId(crypto.randomUUID());
    input.setTurns([]);
    input.setInput("");
    input.setError("");
    input.setRuntimeLogExcerpt("");
    input.setToolDecisionBusyKey("");
    input.setToolDecisionStatusByToken({});
    input.setConnectionChecksByTargetId({});
    input.setSystemPrompt(getDefaultSystemPromptForLocale(input.locale));
    input.setProviderProfile("balanced");
    input.setThinkingMode("standard");
  }, [input]);

  const renameSession = useCallback(
    (targetSessionId: string) => {
      const session = input.savedSessions.find(
        (item) => item.id === targetSessionId,
      );
      if (!session) return;
      const nextTitle = window
        .prompt(input.renamePrompt, session.title)
        ?.trim();
      if (!nextTitle) return;
      updateSessions((current) =>
        current.map((item) =>
          item.id === targetSessionId
            ? { ...item, title: nextTitle, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    },
    [input.renamePrompt, input.savedSessions, updateSessions],
  );

  const togglePinSession = useCallback(
    (targetSessionId: string) => {
      updateSessions((current) =>
        current.map((item) =>
          item.id === targetSessionId
            ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    },
    [updateSessions],
  );

  const deleteSession = useCallback(
    (targetSessionId: string) => {
      const session = input.savedSessions.find(
        (item) => item.id === targetSessionId,
      );
      if (!session || !window.confirm(input.deleteConfirmation)) return;
      const nextSessions = writeLocalAgentSessions(
        input.savedSessions.filter((item) => item.id !== targetSessionId),
      );
      input.setSavedSessions(nextSessions);
      if (targetSessionId !== input.sessionId) return;
      if (nextSessions.length) input.restoreSession(nextSessions[0]);
      else startNewSession();
    },
    [input, startNewSession],
  );

  const bulkClearSessions = useCallback(
    (mode: "all" | "unpinned") => {
      const nextSessions =
        mode === "all"
          ? []
          : input.savedSessions.filter((session) => session.pinned);
      const persistedSessions = writeLocalAgentSessions(nextSessions);
      input.setSavedSessions(persistedSessions);
      if (persistedSessions.some((session) => session.id === input.sessionId)) {
        return;
      }
      if (persistedSessions.length) input.restoreSession(persistedSessions[0]);
      else startNewSession();
    },
    [input, startNewSession],
  );

  const exportSessions = useCallback(
    (format: AgentSessionExportFormat) => {
      downloadAgentSessionExport({
        sessions: input.exportableSessions,
        format,
        options: {
          scope: input.sessionExportScope,
          sessionTargetFilter: input.sessionTargetFilter,
          sessionSearch: input.sessionSearch,
        },
      });
    },
    [
      input.exportableSessions,
      input.sessionExportScope,
      input.sessionSearch,
      input.sessionTargetFilter,
    ],
  );

  return {
    startNewSession,
    renameSession,
    togglePinSession,
    deleteSession,
    bulkClearSessions,
    exportSessions,
  };
}
