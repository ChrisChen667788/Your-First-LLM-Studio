"use client";

import { useCallback } from "react";
import {
  applyStoredAgentSession,
  applyStoredAgentWorkbenchPreferences,
} from "@/features/agent/session-apply";
import type { StoredAgentSession } from "@/features/agent/session-model";
import type { CompareSessionPreferencePort } from "@/features/compare/session-preference-port";
import type { AppLocale } from "@/lib/i18n";
import type {
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
  AgentWorkbenchStoredPreferences,
} from "@/lib/agent/types";

type SessionSetters = Parameters<typeof applyStoredAgentSession>[0]["setters"];
type PreferenceSetters = Parameters<
  typeof applyStoredAgentWorkbenchPreferences
>[0]["setters"];

export function useAgentSessionApplyActions(input: {
  agentTargets: AgentTarget[];
  locale: AppLocale;
  forceInitialMode: boolean;
  contextWindowOptions: number[];
  providerProfileOptions: AgentProviderProfile[];
  thinkingModeOptions: AgentThinkingMode[];
  compareSessionPreferencePort: Pick<CompareSessionPreferencePort, "apply">;
  sessionSetters: SessionSetters;
  preferenceSetters: PreferenceSetters;
}) {
  const {
    agentTargets,
    locale,
    forceInitialMode,
    contextWindowOptions,
    providerProfileOptions,
    thinkingModeOptions,
    compareSessionPreferencePort,
    sessionSetters,
    preferenceSetters,
  } = input;

  const restoreSession = useCallback(
    (session: StoredAgentSession) => {
      applyStoredAgentSession({
        session,
        agentTargets,
        locale,
        contextWindowOptions,
        providerProfileOptions,
        thinkingModeOptions,
        setters: sessionSetters,
      });
    },
    [
      agentTargets,
      contextWindowOptions,
      locale,
      providerProfileOptions,
      sessionSetters,
      thinkingModeOptions,
    ],
  );

  const applyHydratedWorkbenchPreferences = useCallback(
    (preferences: AgentWorkbenchStoredPreferences | null) => {
      applyStoredAgentWorkbenchPreferences({
        preferences,
        agentTargets,
        forceInitialMode,
        contextWindowOptions,
        providerProfileOptions,
        thinkingModeOptions,
        compareSessionPreferencePort,
        setters: preferenceSetters,
      });
    },
    [
      agentTargets,
      compareSessionPreferencePort,
      contextWindowOptions,
      forceInitialMode,
      preferenceSetters,
      providerProfileOptions,
      thinkingModeOptions,
    ],
  );

  return { restoreSession, applyHydratedWorkbenchPreferences };
}
