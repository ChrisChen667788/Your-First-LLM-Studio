import { existsSync, mkdirSync, readFileSync, appendFileSync } from "fs";
import crypto from "crypto";
import {
  migrateJsonFileDurably,
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataDir, getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import type {
  AgentWorkbenchSessionConflict,
  AgentWorkbenchSessionSnapshot,
  AgentWorkbenchSessionVersion,
  AgentWorkbenchStoredPreferences
} from "@/lib/agent/types";

const WORKBENCH_SCHEMA_VERSION = "0.3.0";
const SESSION_SNAPSHOT_FILE = getLocalAgentDataPath("agent-sessions.json");
const SESSION_HISTORY_FILE = getLocalAgentDataPath("agent-sessions-history.jsonl");

function emptySnapshot(): AgentWorkbenchSessionSnapshot {
  return normalizeSnapshot({
    updatedAt: new Date(0).toISOString(),
    activeSessionId: null,
    preferences: null,
    sessions: [],
  });
}

function isSessionSnapshot(value: unknown): value is AgentWorkbenchSessionSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgentWorkbenchSessionSnapshot>;
  return (
    candidate.schemaVersion === WORKBENCH_SCHEMA_VERSION &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.sessions)
  );
}

function ensureSessionDir() {
  mkdirSync(getLocalAgentDataDir(), { recursive: true });
}

function migrateLegacySessionSnapshot() {
  migrateJsonFileDurably(
    SESSION_SNAPSHOT_FILE,
    emptySnapshot,
    (value) => {
      if (!value || typeof value !== "object") return null;
      const candidate = value as Partial<AgentWorkbenchSessionSnapshot> & {
        sessions?: unknown;
        preferences?: unknown;
      };
      if (
        typeof candidate.updatedAt !== "string" ||
        !Array.isArray(candidate.sessions)
      ) {
        return null;
      }
      return normalizeSnapshot(candidate);
    },
    isSessionSnapshot,
  );
}

function normalizeSnapshot(value: Partial<AgentWorkbenchSessionSnapshot> & {
  sessions?: unknown;
  preferences?: unknown;
}): AgentWorkbenchSessionSnapshot {
  const sessions = Array.isArray(value.sessions) ? value.sessions : [];
  const preferences =
    value.preferences && typeof value.preferences === "object"
      ? (value.preferences as AgentWorkbenchStoredPreferences)
      : null;
  return {
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    updatedAt:
      typeof value.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : new Date(0).toISOString(),
    activeSessionId:
      typeof value.activeSessionId === "string"
        ? value.activeSessionId
        : value.activeSessionId === null
          ? null
          : undefined,
    preferences,
    sessions
  };
}

function summarizeSnapshot(snapshot: {
  sessions: unknown[];
  activeSessionId?: string | null;
  preferences?: AgentWorkbenchStoredPreferences | null;
}) {
  const sessionCount = Array.isArray(snapshot.sessions) ? snapshot.sessions.length : 0;
  const mode = snapshot.preferences?.workbenchMode || "chat";
  return `${sessionCount} session${sessionCount === 1 ? "" : "s"} · ${mode} · active ${snapshot.activeSessionId || "none"}`;
}

function stableSignature(snapshot: {
  sessions: unknown[];
  activeSessionId?: string | null;
  preferences?: AgentWorkbenchStoredPreferences | null;
}) {
  return JSON.stringify({
    activeSessionId: snapshot.activeSessionId ?? null,
    preferences: snapshot.preferences || null,
    sessions: Array.isArray(snapshot.sessions) ? snapshot.sessions : []
  });
}

export function getSessionSnapshotFilePath() {
  ensureSessionDir();
  return SESSION_SNAPSHOT_FILE;
}

export function readSessionSnapshot() {
  migrateLegacySessionSnapshot();
  return normalizeSnapshot(
    readJsonFileDurably(SESSION_SNAPSHOT_FILE, emptySnapshot, isSessionSnapshot),
  );
}

export function readSessionVersions(limit = 20) {
  if (!existsSync(SESSION_HISTORY_FILE)) return [] as AgentWorkbenchSessionVersion[];
  const rows = readFileSync(SESSION_HISTORY_FILE, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as AgentWorkbenchSessionVersion];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return rows.slice(0, limit);
}

function appendSessionVersion(entry: AgentWorkbenchSessionVersion) {
  ensureSessionDir();
  appendFileSync(SESSION_HISTORY_FILE, `${JSON.stringify(entry)}\n`, "utf8");
}

export function getSessionServerState(limit = 20) {
  return {
    path: SESSION_SNAPSHOT_FILE,
    snapshot: readSessionSnapshot(),
    versions: readSessionVersions(limit)
  };
}

export function syncSessionSnapshot(input: {
  sessions?: unknown[];
  preferences?: AgentWorkbenchStoredPreferences | null;
  activeSessionId?: string | null;
  baseUpdatedAt?: string | null;
  force?: boolean;
}) {
  migrateLegacySessionSnapshot();
  const normalized = {
    sessions: Array.isArray(input.sessions) ? input.sessions : [],
    preferences:
      input.preferences && typeof input.preferences === "object"
        ? input.preferences
        : null,
    activeSessionId:
      typeof input.activeSessionId === "string"
        ? input.activeSessionId
        : input.activeSessionId === null
          ? null
          : undefined
  };

  const baseUpdatedAt =
    typeof input.baseUpdatedAt === "string" && input.baseUpdatedAt.trim()
      ? input.baseUpdatedAt
      : null;
  const outcome: {
    serverHasAdvanced: boolean;
    conflict?: AgentWorkbenchSessionConflict;
    conflictSnapshot?: AgentWorkbenchSessionSnapshot;
  } = { serverHasAdvanced: false };

  const snapshot = updateJsonFileDurably(
    SESSION_SNAPSHOT_FILE,
    emptySnapshot,
    (stored) => {
      const current = normalizeSnapshot(stored);
      outcome.serverHasAdvanced = Boolean(
        baseUpdatedAt &&
        current.updatedAt !== new Date(0).toISOString() &&
        current.updatedAt !== baseUpdatedAt,
      );
      const localDiffersFromServer =
        stableSignature(normalized) !== stableSignature(current);
      if (!input.force && outcome.serverHasAdvanced && localDiffersFromServer) {
        outcome.conflict = {
          code: "snapshot-outdated",
          baseUpdatedAt,
          serverUpdatedAt: current.updatedAt,
          localSessionCount: normalized.sessions.length,
          serverSessionCount: current.sessions.length,
          summary:
            "The server snapshot changed after this browser tab loaded. Reload the server copy or force overwrite with the current local state.",
        };
        outcome.conflictSnapshot = current;
        return current;
      }
      return {
        schemaVersion: WORKBENCH_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        activeSessionId: normalized.activeSessionId ?? null,
        preferences: normalized.preferences,
        sessions: normalized.sessions,
      };
    },
    isSessionSnapshot,
  );

  if (outcome.conflict && outcome.conflictSnapshot) {
    const { conflict, conflictSnapshot } = outcome;
    appendExperimentEvent({
      kind: "session",
      status: "conflict",
      title: "Session sync conflict",
      summary: `${conflict.localSessionCount} local vs ${conflict.serverSessionCount} server sessions`,
      relatedId: conflictSnapshot.activeSessionId || undefined,
      metadata: {
        baseUpdatedAt: conflict.baseUpdatedAt || null,
        serverUpdatedAt: conflict.serverUpdatedAt
      }
    });
    return {
      ok: false as const,
      conflict,
      snapshot: conflictSnapshot,
      versions: readSessionVersions()
    };
  }
  const now = snapshot.updatedAt;

  const version: AgentWorkbenchSessionVersion = {
    id: `session-version-${crypto.randomUUID()}`,
    savedAt: now,
    source: input.force ? "force-overwrite" : "server-sync",
    summary: summarizeSnapshot(snapshot),
    activeSessionId: snapshot.activeSessionId ?? null,
    sessionCount: snapshot.sessions.length,
    conflictDetected: Boolean(outcome.serverHasAdvanced && input.force)
  };
  appendSessionVersion(version);
  appendExperimentEvent({
    kind: "session",
    status: "saved",
    title: input.force ? "Session snapshot force-overwritten" : "Session snapshot synced",
    summary: version.summary,
    relatedId: snapshot.activeSessionId || undefined,
    metadata: {
      sessionCount: snapshot.sessions.length,
      conflictDetected: version.conflictDetected || false
    }
  });

  return {
    ok: true as const,
    snapshot,
    version,
    versions: readSessionVersions()
  };
}
