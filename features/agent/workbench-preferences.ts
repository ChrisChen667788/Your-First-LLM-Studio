import {
  buildStoredComparePreferenceSlice,
  normalizeRawComparePreferenceInput,
  type ComparePreferenceSnapshotInput,
} from "@/features/compare/preferences";
import type {
  AgentProviderProfile,
  AgentThinkingMode,
  AgentWorkbenchMode,
  AgentWorkbenchStoredPreferences,
} from "@/lib/agent/types";

const PROVIDER_PROFILE_OPTIONS: AgentProviderProfile[] = [
  "speed",
  "balanced",
  "tool-first",
];
const THINKING_MODE_OPTIONS: AgentThinkingMode[] = ["standard", "thinking"];

export type BuildAgentWorkbenchPreferencesInput = Omit<
  AgentWorkbenchStoredPreferences,
  "updatedAt" | keyof ComparePreferenceSnapshotInput
> & {
  comparePreferences: ComparePreferenceSnapshotInput;
};

function normalizeWorkbenchMode(input: unknown): AgentWorkbenchMode | undefined {
  return input === "chat" || input === "compare" ? input : undefined;
}

export function normalizeStoredWorkbenchPreferences(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<AgentWorkbenchStoredPreferences>;
  return {
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
        ? candidate.updatedAt
        : new Date(0).toISOString(),
    selectedTargetId:
      typeof candidate.selectedTargetId === "string"
        ? candidate.selectedTargetId
        : undefined,
    workbenchMode: normalizeWorkbenchMode(candidate.workbenchMode),
    ...normalizeRawComparePreferenceInput(candidate),
    enableTools:
      typeof candidate.enableTools === "boolean"
        ? candidate.enableTools
        : undefined,
    enableRetrieval:
      typeof candidate.enableRetrieval === "boolean"
        ? candidate.enableRetrieval
        : undefined,
    contextWindow:
      typeof candidate.contextWindow === "number"
        ? candidate.contextWindow
        : undefined,
    providerProfile: PROVIDER_PROFILE_OPTIONS.includes(
      candidate.providerProfile as AgentProviderProfile,
    )
      ? (candidate.providerProfile as AgentProviderProfile)
      : undefined,
    thinkingMode: THINKING_MODE_OPTIONS.includes(
      candidate.thinkingMode as AgentThinkingMode,
    )
      ? (candidate.thinkingMode as AgentThinkingMode)
      : undefined,
  } satisfies AgentWorkbenchStoredPreferences;
}

export function buildStoredWorkbenchPreferences(
  input: BuildAgentWorkbenchPreferencesInput,
) {
  const { comparePreferences, ...workbenchPreferences } = input;
  return {
    updatedAt: new Date().toISOString(),
    ...workbenchPreferences,
    ...buildStoredComparePreferenceSlice(comparePreferences),
  } satisfies AgentWorkbenchStoredPreferences;
}
