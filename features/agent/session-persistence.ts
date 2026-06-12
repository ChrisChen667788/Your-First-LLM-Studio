"use client";

import {
  mergeStoredSessions,
  normalizeStoredSessions,
  SESSIONS_STORAGE_KEY,
  sortSessions,
  type StoredAgentSession,
} from "@/features/agent/session-model";
import type {
  AgentWorkbenchSessionConflict,
  AgentWorkbenchSessionSnapshot,
  AgentWorkbenchSessionVersion,
  AgentWorkbenchStoredPreferences,
} from "@/lib/agent/types";

export const SERVER_SESSION_SYNC_DEBOUNCE_MS = 900;
const PREFERENCES_STORAGE_KEY = "agent-workbench:preferences:v1";

export type AgentSessionSnapshotPayload = AgentWorkbenchSessionSnapshot & {
  versions?: AgentWorkbenchSessionVersion[];
  path?: string;
};

type PutAgentSessionSnapshotResponse =
  | {
      ok: true;
      count: number;
      updatedAt: string;
      versions?: AgentWorkbenchSessionVersion[];
      path?: string;
    }
  | {
      ok?: false;
      error?: string;
      conflict?: AgentWorkbenchSessionConflict;
      updatedAt?: string;
      sessions?: unknown[];
      preferences?: AgentWorkbenchStoredPreferences | null;
      activeSessionId?: string | null;
      versions?: AgentWorkbenchSessionVersion[];
    };

export function readLocalAgentSessions() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
    return normalizeStoredSessions(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function writeLocalAgentSessions(sessions: StoredAgentSession[]) {
  const next = sortSessions(sessions);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function readLocalAgentPreferences(
  normalizePreferences: (
    input: unknown,
  ) => AgentWorkbenchStoredPreferences | null,
) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

export function writeLocalAgentPreferences(
  preferences: AgentWorkbenchStoredPreferences,
) {
  if (typeof window === "undefined") return preferences;
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  return preferences;
}

export function readLocalAgentSessionState(
  normalizePreferences: (
    input: unknown,
  ) => AgentWorkbenchStoredPreferences | null,
) {
  return {
    sessions: readLocalAgentSessions(),
    preferences: readLocalAgentPreferences(normalizePreferences),
  };
}

export async function fetchServerAgentSessionSnapshot() {
  const response = await fetch("/api/agent/sessions", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load server session snapshot.");
  }
  return (await response.json()) as AgentSessionSnapshotPayload;
}

export async function putServerAgentSessionSnapshot(input: {
  sessions: StoredAgentSession[];
  preferences: AgentWorkbenchStoredPreferences | null;
  activeSessionId: string | null;
  baseUpdatedAt: string | null;
  force: boolean;
}) {
  const response = await fetch("/api/agent/sessions", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as PutAgentSessionSnapshotResponse;
  return {
    response,
    payload,
  };
}

export function buildAgentSessionSnapshotState(
  payload: AgentSessionSnapshotPayload,
  {
    localSessions = [],
    localPreferences = null,
    normalizePreferences,
  }: {
    localSessions?: StoredAgentSession[];
    localPreferences?: AgentWorkbenchStoredPreferences | null;
    normalizePreferences: (
      input: unknown,
    ) => AgentWorkbenchStoredPreferences | null;
  },
) {
  const remoteSessions = normalizeStoredSessions(payload.sessions);
  const remotePreferences = normalizePreferences(payload.preferences || null);
  const mergedSessions = mergeStoredSessions(localSessions, remoteSessions);
  const preferredPreferences =
    remotePreferences && localPreferences
      ? remotePreferences.updatedAt >= localPreferences.updatedAt
        ? remotePreferences
        : localPreferences
      : remotePreferences || localPreferences || null;

  return {
    mergedSessions,
    preferredPreferences,
    activeSessionId:
      typeof payload.activeSessionId === "string"
        ? payload.activeSessionId
        : null,
    updatedAt:
      typeof payload.updatedAt === "string"
        ? payload.updatedAt
        : new Date(0).toISOString(),
  };
}

export function resolveAgentSessionSyncOutcome(
  result: {
    response: Response;
    payload: PutAgentSessionSnapshotResponse;
  },
  {
    conflictUpdatedAtFallback,
    syncedUpdatedAtFallback,
  }: {
    conflictUpdatedAtFallback: string | null;
    syncedUpdatedAtFallback: string;
  },
) {
  if (!result.response.ok) {
    if ("conflict" in result.payload && result.payload.conflict) {
      return {
        status: "conflict" as const,
        conflict: result.payload.conflict,
        updatedAt:
          typeof result.payload.updatedAt === "string"
            ? result.payload.updatedAt
            : conflictUpdatedAtFallback,
      };
    }
    return {
      status: "error" as const,
      error:
        "error" in result.payload && typeof result.payload.error === "string"
          ? result.payload.error
          : "Failed to sync sessions.",
    };
  }

  return {
    status: "synced" as const,
    updatedAt:
      "updatedAt" in result.payload && typeof result.payload.updatedAt === "string"
        ? result.payload.updatedAt
        : syncedUpdatedAtFallback,
  };
}
