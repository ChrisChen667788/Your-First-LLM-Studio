"use client";

import { useState } from "react";
import { agentTargets as builtinAgentTargets } from "@/lib/agent/catalog";
import {
  getDefaultSystemPromptForLocale,
  getLocalizedStarterPrompts,
} from "@/lib/i18n";
import type {
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
  AgentWorkbenchMode,
  AgentWorkbenchSessionConflict,
} from "@/lib/agent/types";
import type { AgentSessionSyncState } from "./session-sync-status";
import type { AgentTurn, StoredAgentSession } from "./session-model";

export function useAgentChatSessionState(initialMode: AgentWorkbenchMode) {
  const [availableTargets, setAvailableTargets] =
    useState<AgentTarget[]>(builtinAgentTargets);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [savedSessions, setSavedSessions] = useState<StoredAgentSession[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("anthropic-claude");
  const [workbenchMode, setWorkbenchMode] =
    useState<AgentWorkbenchMode>(initialMode);
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [input, setInput] = useState(
    () => getLocalizedStarterPrompts("zh-CN")[0],
  );
  const [systemPrompt, setSystemPrompt] = useState(() =>
    getDefaultSystemPromptForLocale("zh-CN"),
  );
  const [enableTools, setEnableTools] = useState(true);
  const [enableRetrieval, setEnableRetrieval] = useState(false);
  const [contextWindow, setContextWindow] = useState(32768);
  const [providerProfile, setProviderProfile] =
    useState<AgentProviderProfile>("balanced");
  const [thinkingMode, setThinkingMode] =
    useState<AgentThinkingMode>("standard");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expandedCitationKey, setExpandedCitationKey] = useState("");
  const [expandedTraceTurnId, setExpandedTraceTurnId] = useState("");
  const [expandedReviewFileKey, setExpandedReviewFileKey] = useState("");
  const [toolDecisionBusyKey, setToolDecisionBusyKey] = useState("");
  const [toolDecisionStatusByToken, setToolDecisionStatusByToken] = useState<
    Record<string, "approved" | "rejected">
  >({});
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [serverSessionSyncState, setServerSessionSyncState] =
    useState<AgentSessionSyncState>("");
  const [serverSnapshotUpdatedAt, setServerSnapshotUpdatedAt] = useState<
    string | null
  >(null);
  const [sessionSyncConflict, setSessionSyncConflict] =
    useState<AgentWorkbenchSessionConflict | null>(null);

  return {
    availableTargets,
    setAvailableTargets,
    sessionId,
    setSessionId,
    savedSessions,
    setSavedSessions,
    selectedTargetId,
    setSelectedTargetId,
    workbenchMode,
    setWorkbenchMode,
    turns,
    setTurns,
    input,
    setInput,
    systemPrompt,
    setSystemPrompt,
    enableTools,
    setEnableTools,
    enableRetrieval,
    setEnableRetrieval,
    contextWindow,
    setContextWindow,
    providerProfile,
    setProviderProfile,
    thinkingMode,
    setThinkingMode,
    pending,
    setPending,
    error,
    setError,
    expandedCitationKey,
    setExpandedCitationKey,
    expandedTraceTurnId,
    setExpandedTraceTurnId,
    expandedReviewFileKey,
    setExpandedReviewFileKey,
    toolDecisionBusyKey,
    setToolDecisionBusyKey,
    toolDecisionStatusByToken,
    setToolDecisionStatusByToken,
    preferencesReady,
    setPreferencesReady,
    serverSessionSyncState,
    setServerSessionSyncState,
    serverSnapshotUpdatedAt,
    setServerSnapshotUpdatedAt,
    sessionSyncConflict,
    setSessionSyncConflict,
  };
}
