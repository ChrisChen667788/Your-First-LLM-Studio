"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { StoredAgentSession } from "@/features/agent/session-model";
import {
  buildAgentSessionSnapshotState,
  fetchServerAgentSessionSnapshot,
  readLocalAgentSessionState,
  writeLocalAgentPreferences,
  writeLocalAgentSessions,
  type AgentSessionSnapshotPayload,
} from "@/features/agent/session-persistence";
import { normalizeStoredWorkbenchPreferences } from "@/features/agent/workbench-preferences";
import type {
  AgentWorkbenchSessionConflict,
  AgentWorkbenchStoredPreferences,
} from "@/lib/agent/types";

const RUNTIME_SWITCH_HISTORY_STORAGE_KEY =
  "local-agent-runtime-switch-history-v1";

type RuntimeSwitchHistoryEntry = {
  loadMs: number | null;
  switchedAt: string | null;
};

function readRuntimeSwitchHistory() {
  if (typeof window === "undefined") return null;
  const rawRuntimeHistory = window.localStorage.getItem(
    RUNTIME_SWITCH_HISTORY_STORAGE_KEY,
  );
  if (!rawRuntimeHistory) return null;
  const parsedRuntimeHistory = JSON.parse(rawRuntimeHistory) as Record<
    string,
    { loadMs?: number | null; switchedAt?: string | null }
  >;
  if (!parsedRuntimeHistory || typeof parsedRuntimeHistory !== "object") {
    return null;
  }
  const nextLoadMs: Record<string, number | null> = {};
  const nextSwitchedAt: Record<string, string | null> = {};
  for (const [targetId, entry] of Object.entries(parsedRuntimeHistory)) {
    nextLoadMs[targetId] =
      typeof entry?.loadMs === "number" && Number.isFinite(entry.loadMs)
        ? entry.loadMs
        : null;
    nextSwitchedAt[targetId] =
      typeof entry?.switchedAt === "string" ? entry.switchedAt : null;
  }
  return { nextLoadMs, nextSwitchedAt };
}

export function writeRuntimeSwitchHistory({
  runtimeLastSwitchMsByTarget,
  runtimeLastSwitchAtByTarget,
}: {
  runtimeLastSwitchMsByTarget: Record<string, number | null>;
  runtimeLastSwitchAtByTarget: Record<string, string | null>;
}) {
  if (typeof window === "undefined") return;
  const targetIds = new Set([
    ...Object.keys(runtimeLastSwitchMsByTarget),
    ...Object.keys(runtimeLastSwitchAtByTarget),
  ]);
  const payload: Record<string, RuntimeSwitchHistoryEntry> = {};
  targetIds.forEach((targetId) => {
    payload[targetId] = {
      loadMs: runtimeLastSwitchMsByTarget[targetId] ?? null,
      switchedAt: runtimeLastSwitchAtByTarget[targetId] ?? null,
    };
  });
  window.localStorage.setItem(
    RUNTIME_SWITCH_HISTORY_STORAGE_KEY,
    JSON.stringify(payload),
  );
}

export function useAgentSessionHydration({
  savedSessions,
  setSavedSessions,
  applyHydratedWorkbenchPreferences,
  restoreSession,
  setServerSessionSyncState,
  setServerSnapshotUpdatedAt,
  setSessionSyncConflict,
  setRuntimeLastSwitchMsByTarget,
  setRuntimeLastSwitchAtByTarget,
  setPreferencesReady,
}: {
  savedSessions: StoredAgentSession[];
  setSavedSessions: Dispatch<SetStateAction<StoredAgentSession[]>>;
  applyHydratedWorkbenchPreferences: (
    preferences: AgentWorkbenchStoredPreferences | null,
  ) => void;
  restoreSession: (session: StoredAgentSession) => void;
  setServerSessionSyncState: (value: "" | "syncing" | "synced" | "error") => void;
  setServerSnapshotUpdatedAt: (value: string | null) => void;
  setSessionSyncConflict: (
    value: AgentWorkbenchSessionConflict | null,
  ) => void;
  setRuntimeLastSwitchMsByTarget: (
    value: Record<string, number | null>,
  ) => void;
  setRuntimeLastSwitchAtByTarget: (
    value: Record<string, string | null>,
  ) => void;
  setPreferencesReady: (value: boolean) => void;
}) {
  const hydrateWorkbenchStateRef = useRef(false);

  const applyServerSessionSnapshot = useCallback(
    (
      payload: AgentSessionSnapshotPayload,
      localSessions: StoredAgentSession[] = savedSessions,
    ) => {
      const {
        mergedSessions,
        preferredPreferences,
        activeSessionId,
        updatedAt,
      } = buildAgentSessionSnapshotState(payload, {
        localSessions,
        normalizePreferences: normalizeStoredWorkbenchPreferences,
      });
      setSavedSessions(mergedSessions);
      writeLocalAgentSessions(mergedSessions);
      if (preferredPreferences) {
        writeLocalAgentPreferences(preferredPreferences);
      }
      setServerSnapshotUpdatedAt(updatedAt);
      setSessionSyncConflict(null);
      applyHydratedWorkbenchPreferences(preferredPreferences);
      if (mergedSessions.length) {
        const preferredSession = activeSessionId
          ? mergedSessions.find((session) => session.id === activeSessionId)
          : null;
        restoreSession(preferredSession || mergedSessions[0]);
      }
    },
    [
      applyHydratedWorkbenchPreferences,
      restoreSession,
      savedSessions,
      setSavedSessions,
      setServerSnapshotUpdatedAt,
      setSessionSyncConflict,
    ],
  );

  useEffect(() => {
    if (hydrateWorkbenchStateRef.current) return;
    hydrateWorkbenchStateRef.current = true;
    let cancelled = false;

    async function hydrateWorkbenchState() {
      try {
        const {
          sessions: localSessions,
          preferences: localPreferences,
        } = readLocalAgentSessionState(normalizeStoredWorkbenchPreferences);
        let mergedSessions = localSessions;
        let activeSessionId: string | null = null;
        let preferredPreferences = localPreferences;

        if (!cancelled && localSessions.length) {
          setSavedSessions(localSessions);
        }

        try {
          const payload = await fetchServerAgentSessionSnapshot();
          const snapshotState = buildAgentSessionSnapshotState(payload, {
            localSessions,
            localPreferences,
            normalizePreferences: normalizeStoredWorkbenchPreferences,
          });
          mergedSessions = snapshotState.mergedSessions;
          preferredPreferences = snapshotState.preferredPreferences;
          activeSessionId = snapshotState.activeSessionId;
          if (!cancelled) {
            setServerSnapshotUpdatedAt(snapshotState.updatedAt);
            setSessionSyncConflict(null);
            setSavedSessions(mergedSessions);
            writeLocalAgentSessions(mergedSessions);
            if (preferredPreferences) {
              writeLocalAgentPreferences(preferredPreferences);
            }
            setServerSessionSyncState("synced");
          }
        } catch {
          if (!cancelled) {
            setServerSessionSyncState(
              localSessions.length || localPreferences ? "error" : "",
            );
          }
        }

        if (!cancelled) {
          applyHydratedWorkbenchPreferences(preferredPreferences);
        }

        if (mergedSessions.length && !cancelled) {
          const preferredSession = activeSessionId
            ? mergedSessions.find((session) => session.id === activeSessionId)
            : null;
          restoreSession(preferredSession || mergedSessions[0]);
        }

        const runtimeHistory = readRuntimeSwitchHistory();
        if (runtimeHistory && !cancelled) {
          setRuntimeLastSwitchMsByTarget(runtimeHistory.nextLoadMs);
          setRuntimeLastSwitchAtByTarget(runtimeHistory.nextSwitchedAt);
        }
      } catch {
        // Ignore invalid local state and fall back to defaults.
      } finally {
        if (!cancelled) {
          setPreferencesReady(true);
        }
      }
    }

    void hydrateWorkbenchState();
    return () => {
      cancelled = true;
    };
  }, [
    applyHydratedWorkbenchPreferences,
    restoreSession,
    setPreferencesReady,
    setRuntimeLastSwitchAtByTarget,
    setRuntimeLastSwitchMsByTarget,
    setSavedSessions,
    setServerSessionSyncState,
    setServerSnapshotUpdatedAt,
    setSessionSyncConflict,
  ]);

  const handleReloadServerSessionSnapshot = useCallback(async () => {
    try {
      const payload = await fetchServerAgentSessionSnapshot();
      applyServerSessionSnapshot(payload, []);
      setServerSessionSyncState("synced");
    } catch {
      setServerSessionSyncState("error");
    }
  }, [applyServerSessionSnapshot, setServerSessionSyncState]);

  return {
    applyServerSessionSnapshot,
    handleReloadServerSessionSnapshot,
  };
}
