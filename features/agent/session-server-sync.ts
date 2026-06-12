"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  createSessionTitle,
  MAX_STORED_SESSIONS,
  sortSessions,
  type AgentTurn,
  type StoredAgentSession,
} from "@/features/agent/session-model";
import {
  putServerAgentSessionSnapshot,
  resolveAgentSessionSyncOutcome,
  SERVER_SESSION_SYNC_DEBOUNCE_MS,
  writeLocalAgentPreferences,
  writeLocalAgentSessions,
} from "@/features/agent/session-persistence";
import { buildStoredWorkbenchPreferences } from "@/features/agent/workbench-preferences";
import type { CompareSessionPreferencePort } from "@/features/compare/session-preference-port";
import type {
  AgentConnectionCheckResponse,
  AgentProviderProfile,
  AgentThinkingMode,
  AgentWorkbenchMode,
  AgentWorkbenchSessionConflict,
} from "@/lib/agent/types";

type AgentSessionSyncPreferenceState = {
  selectedTargetId: string;
  workbenchMode: AgentWorkbenchMode;
  compareSessionPreferencePort: Pick<CompareSessionPreferencePort, "snapshot">;
  enableTools: boolean;
  enableRetrieval: boolean;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
};

type AgentSessionSyncActiveSessionState = {
  sessionId: string;
  input: string;
  systemPrompt: string;
  turns: AgentTurn[];
  connectionChecksByTargetId: Record<string, AgentConnectionCheckResponse>;
};

function buildCurrentPreferences(state: AgentSessionSyncPreferenceState) {
  return buildStoredWorkbenchPreferences({
    selectedTargetId: state.selectedTargetId,
    workbenchMode: state.workbenchMode,
    comparePreferences: state.compareSessionPreferencePort.snapshot,
    enableTools: state.enableTools,
    enableRetrieval: state.enableRetrieval,
    contextWindow: state.contextWindow,
    providerProfile: state.providerProfile,
    thinkingMode: state.thinkingMode,
  });
}

export function useAgentSessionServerSync({
  preferencesReady,
  preferenceState,
  activeSessionState,
  savedSessions,
  setSavedSessions,
  serverSnapshotUpdatedAt,
  setServerSnapshotUpdatedAt,
  setServerSessionSyncState,
  setSessionSyncConflict,
  newSessionTitle,
}: {
  preferencesReady: boolean;
  preferenceState: AgentSessionSyncPreferenceState;
  activeSessionState: AgentSessionSyncActiveSessionState;
  savedSessions: StoredAgentSession[];
  setSavedSessions: Dispatch<SetStateAction<StoredAgentSession[]>>;
  serverSnapshotUpdatedAt: string | null;
  setServerSnapshotUpdatedAt: (value: string | null) => void;
  setServerSessionSyncState: (value: "" | "syncing" | "synced" | "error") => void;
  setSessionSyncConflict: (
    value: AgentWorkbenchSessionConflict | null,
  ) => void;
  newSessionTitle: string;
}) {
  const sessionSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!preferencesReady) return;
    writeLocalAgentPreferences(buildCurrentPreferences(preferenceState));
  }, [preferencesReady, preferenceState]);

  useEffect(() => {
    if (!preferencesReady) return;
    const hasSessionContent =
      activeSessionState.turns.length > 0 ||
      Boolean(activeSessionState.input.trim()) ||
      Object.keys(activeSessionState.connectionChecksByTargetId).length > 0;

    setSavedSessions((current) => {
      const existingSession =
        current.find((session) => session.id === activeSessionState.sessionId) ||
        null;
      if (
        !hasSessionContent &&
        !current.some((session) => session.id === activeSessionState.sessionId)
      ) {
        return current;
      }
      const nextSession: StoredAgentSession = {
        id: activeSessionState.sessionId,
        title:
          existingSession?.title ||
          createSessionTitle(
            activeSessionState.turns,
            activeSessionState.input.trim() || newSessionTitle,
          ),
        updatedAt: new Date().toISOString(),
        pinned: existingSession?.pinned || false,
        selectedTargetId: preferenceState.selectedTargetId,
        enableTools: preferenceState.enableTools,
        enableRetrieval: preferenceState.enableRetrieval,
        contextWindow: preferenceState.contextWindow,
        providerProfile: preferenceState.providerProfile,
        thinkingMode: preferenceState.thinkingMode,
        input: activeSessionState.input,
        systemPrompt: activeSessionState.systemPrompt,
        turns: activeSessionState.turns,
        connectionChecksByTargetId:
          activeSessionState.connectionChecksByTargetId,
      };
      const merged = sortSessions([
        nextSession,
        ...current.filter(
          (session) => session.id !== activeSessionState.sessionId,
        ),
      ]).slice(0, MAX_STORED_SESSIONS);
      writeLocalAgentSessions(merged);
      return merged;
    });
  }, [
    activeSessionState,
    newSessionTitle,
    preferenceState,
    preferencesReady,
    setSavedSessions,
  ]);

  useEffect(() => {
    if (!preferencesReady) return;
    if (sessionSyncTimeoutRef.current) {
      clearTimeout(sessionSyncTimeoutRef.current);
    }
    sessionSyncTimeoutRef.current = setTimeout(async () => {
      setServerSessionSyncState("syncing");
      try {
        const syncResult = await putServerAgentSessionSnapshot({
          activeSessionId: activeSessionState.sessionId,
          baseUpdatedAt: serverSnapshotUpdatedAt,
          force: false,
          preferences: buildCurrentPreferences(preferenceState),
          sessions: savedSessions,
        });
        const syncOutcome = resolveAgentSessionSyncOutcome(syncResult, {
          conflictUpdatedAtFallback: serverSnapshotUpdatedAt,
          syncedUpdatedAtFallback: new Date().toISOString(),
        });
        if (syncOutcome.status === "conflict") {
          setSessionSyncConflict(syncOutcome.conflict);
          setServerSnapshotUpdatedAt(syncOutcome.updatedAt);
          setServerSessionSyncState("error");
          return;
        }
        if (syncOutcome.status === "error") {
          throw new Error(syncOutcome.error);
        }
        setSessionSyncConflict(null);
        setServerSnapshotUpdatedAt(syncOutcome.updatedAt);
        setServerSessionSyncState("synced");
      } catch {
        setServerSessionSyncState("error");
      }
    }, SERVER_SESSION_SYNC_DEBOUNCE_MS);

    return () => {
      if (sessionSyncTimeoutRef.current) {
        clearTimeout(sessionSyncTimeoutRef.current);
        sessionSyncTimeoutRef.current = null;
      }
    };
  }, [
    activeSessionState.sessionId,
    preferenceState,
    preferencesReady,
    savedSessions,
    serverSnapshotUpdatedAt,
    setServerSessionSyncState,
    setServerSnapshotUpdatedAt,
    setSessionSyncConflict,
  ]);

  const handleForceOverwriteServerSessionSnapshot = useCallback(async () => {
    try {
      const syncResult = await putServerAgentSessionSnapshot({
        activeSessionId: activeSessionState.sessionId,
        baseUpdatedAt: serverSnapshotUpdatedAt,
        force: true,
        preferences: buildCurrentPreferences(preferenceState),
        sessions: savedSessions,
      });
      const syncOutcome = resolveAgentSessionSyncOutcome(syncResult, {
        conflictUpdatedAtFallback: serverSnapshotUpdatedAt,
        syncedUpdatedAtFallback: new Date().toISOString(),
      });
      if (syncOutcome.status === "conflict") {
        setSessionSyncConflict(syncOutcome.conflict);
        setServerSnapshotUpdatedAt(syncOutcome.updatedAt);
        setServerSessionSyncState("error");
        return;
      }
      if (syncOutcome.status === "error") {
        throw new Error(syncOutcome.error);
      }
      setSessionSyncConflict(null);
      setServerSnapshotUpdatedAt(syncOutcome.updatedAt);
      setServerSessionSyncState("synced");
    } catch {
      setServerSessionSyncState("error");
    }
  }, [
    activeSessionState.sessionId,
    preferenceState,
    savedSessions,
    serverSnapshotUpdatedAt,
    setServerSessionSyncState,
    setServerSnapshotUpdatedAt,
    setSessionSyncConflict,
  ]);

  return {
    handleForceOverwriteServerSessionSnapshot,
  };
}
