"use client";

import { useMemo } from "react";
import type { CompareSessionPreferencePort } from "@/features/compare/session-preference-port";
import type { AgentTurn } from "./session-model";
import type {
  AgentConnectionCheckResponse,
  AgentProviderProfile,
  AgentThinkingMode,
  AgentWorkbenchMode,
} from "@/lib/agent/types";

export function useAgentSessionSyncProjections(input: {
  preference: {
    selectedTargetId: string;
    workbenchMode: AgentWorkbenchMode;
    compareSessionPreferencePort: Pick<CompareSessionPreferencePort, "snapshot">;
    enableTools: boolean;
    enableRetrieval: boolean;
    contextWindow: number;
    providerProfile: AgentProviderProfile;
    thinkingMode: AgentThinkingMode;
  };
  active: {
    sessionId: string;
    input: string;
    systemPrompt: string;
    turns: AgentTurn[];
    connectionChecksByTargetId: Record<string, AgentConnectionCheckResponse>;
  };
}) {
  const preferenceState = useMemo(
    () => ({ ...input.preference }),
    [
      input.preference.compareSessionPreferencePort,
      input.preference.contextWindow,
      input.preference.enableRetrieval,
      input.preference.enableTools,
      input.preference.providerProfile,
      input.preference.selectedTargetId,
      input.preference.thinkingMode,
      input.preference.workbenchMode,
    ],
  );
  const activeSessionState = useMemo(
    () => ({ ...input.active }),
    [
      input.active.connectionChecksByTargetId,
      input.active.input,
      input.active.sessionId,
      input.active.systemPrompt,
      input.active.turns,
    ],
  );
  return { preferenceState, activeSessionState };
}
