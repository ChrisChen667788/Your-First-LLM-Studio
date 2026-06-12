import { getDefaultSystemPromptForLocale, type AppLocale } from "@/lib/i18n";
import type { AgentTurn, StoredAgentSession } from "@/features/agent/session-model";
import type { CompareSessionPreferencePort } from "@/features/compare/session-preference-port";
import type {
  AgentConnectionCheckResponse,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
  AgentWorkbenchMode,
  AgentWorkbenchStoredPreferences,
} from "@/lib/agent/types";

const FALLBACK_TARGET_ID = "anthropic-claude";
const DEFAULT_CONTEXT_WINDOW = 32768;
const DEFAULT_PROVIDER_PROFILE: AgentProviderProfile = "balanced";
const DEFAULT_THINKING_MODE: AgentThinkingMode = "standard";

type AgentWorkbenchSessionApplySetters = {
  setTranscriptPinnedToBottom: (value: boolean) => void;
  setSessionId: (value: string) => void;
  setSelectedTargetId: (value: string) => void;
  setEnableTools: (value: boolean) => void;
  setEnableRetrieval: (value: boolean) => void;
  setContextWindow: (value: number) => void;
  setProviderProfile: (value: AgentProviderProfile) => void;
  setThinkingMode: (value: AgentThinkingMode) => void;
  setInput: (value: string) => void;
  setSystemPrompt: (value: string) => void;
  setTurns: (value: AgentTurn[]) => void;
  setConnectionChecksByTargetId: (
    value: Record<string, AgentConnectionCheckResponse>,
  ) => void;
  setError: (value: string) => void;
  setRuntimeLogExcerpt: (value: string) => void;
  setToolDecisionBusyKey: (value: string) => void;
  setToolDecisionStatusByToken: (
    value: Record<string, "approved" | "rejected">,
  ) => void;
};

type AgentWorkbenchPreferenceApplySetters = {
  setSelectedTargetId: (value: string) => void;
  setWorkbenchMode: (value: AgentWorkbenchMode) => void;
  setEnableTools: (value: boolean) => void;
  setEnableRetrieval: (value: boolean) => void;
  setContextWindow: (value: number) => void;
  setProviderProfile: (value: AgentProviderProfile) => void;
  setThinkingMode: (value: AgentThinkingMode) => void;
};

function hasTarget(targets: AgentTarget[], targetId: string | undefined) {
  return Boolean(targetId && targets.some((target) => target.id === targetId));
}

export function applyStoredAgentSession({
  session,
  agentTargets,
  locale,
  contextWindowOptions,
  providerProfileOptions,
  thinkingModeOptions,
  setters,
}: {
  session: StoredAgentSession;
  agentTargets: AgentTarget[];
  locale: AppLocale;
  contextWindowOptions: number[];
  providerProfileOptions: AgentProviderProfile[];
  thinkingModeOptions: AgentThinkingMode[];
  setters: AgentWorkbenchSessionApplySetters;
}) {
  setters.setTranscriptPinnedToBottom(true);
  setters.setSessionId(session.id);
  setters.setSelectedTargetId(
    hasTarget(agentTargets, session.selectedTargetId)
      ? session.selectedTargetId
      : FALLBACK_TARGET_ID,
  );
  setters.setEnableTools(Boolean(session.enableTools));
  setters.setEnableRetrieval(Boolean(session.enableRetrieval));
  setters.setContextWindow(
    contextWindowOptions.includes(session.contextWindow)
      ? session.contextWindow
      : DEFAULT_CONTEXT_WINDOW,
  );
  setters.setProviderProfile(
    providerProfileOptions.includes(session.providerProfile)
      ? session.providerProfile
      : DEFAULT_PROVIDER_PROFILE,
  );
  setters.setThinkingMode(
    thinkingModeOptions.includes(session.thinkingMode)
      ? session.thinkingMode
      : DEFAULT_THINKING_MODE,
  );
  setters.setInput(session.input || "");
  setters.setSystemPrompt(
    session.systemPrompt || getDefaultSystemPromptForLocale(locale),
  );
  setters.setTurns(Array.isArray(session.turns) ? session.turns : []);
  setters.setConnectionChecksByTargetId(session.connectionChecksByTargetId || {});
  setters.setError("");
  setters.setRuntimeLogExcerpt("");
  setters.setToolDecisionBusyKey("");
  setters.setToolDecisionStatusByToken({});
}

export function applyStoredAgentWorkbenchPreferences({
  preferences,
  agentTargets,
  forceInitialMode,
  contextWindowOptions,
  providerProfileOptions,
  thinkingModeOptions,
  compareSessionPreferencePort,
  setters,
}: {
  preferences: AgentWorkbenchStoredPreferences | null;
  agentTargets: AgentTarget[];
  forceInitialMode: boolean;
  contextWindowOptions: number[];
  providerProfileOptions: AgentProviderProfile[];
  thinkingModeOptions: AgentThinkingMode[];
  compareSessionPreferencePort: Pick<CompareSessionPreferencePort, "apply">;
  setters: AgentWorkbenchPreferenceApplySetters;
}) {
  if (!preferences) return;
  if (hasTarget(agentTargets, preferences.selectedTargetId)) {
    setters.setSelectedTargetId(preferences.selectedTargetId as string);
  }
  if (
    !forceInitialMode &&
    (preferences.workbenchMode === "chat" ||
      preferences.workbenchMode === "compare")
  ) {
    setters.setWorkbenchMode(preferences.workbenchMode);
  }
  compareSessionPreferencePort.apply(preferences);
  if (typeof preferences.enableTools === "boolean") {
    setters.setEnableTools(preferences.enableTools);
  }
  if (typeof preferences.enableRetrieval === "boolean") {
    setters.setEnableRetrieval(preferences.enableRetrieval);
  }
  if (
    typeof preferences.contextWindow === "number" &&
    contextWindowOptions.includes(preferences.contextWindow)
  ) {
    setters.setContextWindow(preferences.contextWindow);
  }
  if (
    typeof preferences.providerProfile === "string" &&
    providerProfileOptions.includes(
      preferences.providerProfile as AgentProviderProfile,
    )
  ) {
    setters.setProviderProfile(preferences.providerProfile as AgentProviderProfile);
  }
  if (
    typeof preferences.thinkingMode === "string" &&
    thinkingModeOptions.includes(preferences.thinkingMode as AgentThinkingMode)
  ) {
    setters.setThinkingMode(preferences.thinkingMode as AgentThinkingMode);
  }
}
