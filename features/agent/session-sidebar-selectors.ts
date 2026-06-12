"use client";

import { useMemo } from "react";
import {
  filterSessionsForExport,
  type AgentSessionExportScope,
  type StoredAgentSession,
} from "@/features/agent/session-model";
import type { AgentTarget } from "@/lib/agent/types";

export function useAgentSessionSidebarSelectors({
  savedSessions,
  sessionId,
  agentTargets,
  sessionSearch,
  sessionTargetFilter,
  sessionExportScope,
  allTargetsLabel,
}: {
  savedSessions: StoredAgentSession[];
  sessionId: string;
  agentTargets: AgentTarget[];
  sessionSearch: string;
  sessionTargetFilter: string;
  sessionExportScope: AgentSessionExportScope;
  allTargetsLabel: string;
}) {
  const sessionTargetOptions = useMemo(
    () =>
      Array.from(
        new Set(savedSessions.map((session) => session.selectedTargetId)),
      )
        .map((targetId) => ({
          id: targetId,
          label:
            agentTargets.find((target) => target.id === targetId)?.label ||
            targetId,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [agentTargets, savedSessions],
  );

  const currentSession = useMemo(
    () => savedSessions.find((session) => session.id === sessionId) || null,
    [savedSessions, sessionId],
  );

  const filteredHistorySessions = useMemo(() => {
    const normalizedSearch = sessionSearch.trim().toLowerCase();
    return savedSessions
      .filter((session) => session.id !== sessionId)
      .filter((session) =>
        sessionTargetFilter === "all"
          ? true
          : session.selectedTargetId === sessionTargetFilter,
      )
      .filter((session) =>
        normalizedSearch
          ? session.title.toLowerCase().includes(normalizedSearch) ||
            session.selectedTargetId.toLowerCase().includes(normalizedSearch)
          : true,
      );
  }, [savedSessions, sessionId, sessionSearch, sessionTargetFilter]);

  const exportableSessions = useMemo(
    () =>
      filterSessionsForExport(savedSessions, {
        scope: sessionExportScope,
        sessionTargetFilter,
        sessionSearch,
      }),
    [savedSessions, sessionExportScope, sessionTargetFilter, sessionSearch],
  );

  const sessionGroups = useMemo(() => {
    const groups = new Map<string, StoredAgentSession[]>();
    for (const session of filteredHistorySessions) {
      const key = session.selectedTargetId;
      const current = groups.get(key) || [];
      current.push(session);
      groups.set(key, current);
    }
    return [...groups.entries()].map(([targetId, sessionsInGroup]) => ({
      targetId,
      targetLabel:
        agentTargets.find((target) => target.id === targetId)?.label ||
        targetId,
      sessions: sessionsInGroup,
    }));
  }, [agentTargets, filteredHistorySessions]);

  const activeSessionTargetLabel = useMemo(
    () =>
      sessionTargetFilter === "all"
        ? allTargetsLabel
        : sessionTargetOptions.find((option) => option.id === sessionTargetFilter)
            ?.label || sessionTargetFilter,
    [allTargetsLabel, sessionTargetFilter, sessionTargetOptions],
  );

  return {
    sessionTargetOptions,
    currentSession,
    filteredHistorySessions,
    exportableSessions,
    sessionGroups,
    activeSessionTargetLabel,
  };
}
