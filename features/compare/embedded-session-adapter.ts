"use client";

import { useEffect, useMemo } from "react";
import { useComparePreferencePersistenceModel } from "./preference-persistence-model";
import { buildCompareReproduceRequestArtifacts } from "./reproduce-artifacts";
import type { CompareWorkbenchStateModel } from "./workbench-state-model";
import type { CompareSessionPreferencePort } from "./session-preference-port";
import type {
  AgentMessage,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";

type EmbeddedCompareSessionPrompt = {
  input: string;
  historyMessages: AgentMessage[];
  systemPrompt: string;
  contextWindow: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
};

type EmbeddedCompareSessionAdapterInput = {
  agentTargets: AgentTarget[];
  maxCompareLanes: number;
  targetState: CompareWorkbenchStateModel["targetState"];
  promptState: CompareWorkbenchStateModel["promptState"];
  runState: CompareWorkbenchStateModel["runState"];
  benchmarkState: CompareWorkbenchStateModel["benchmarkState"];
  prompt: EmbeddedCompareSessionPrompt;
};

export function useEmbeddedCompareSessionAdapter({
  agentTargets,
  maxCompareLanes,
  targetState,
  promptState,
  runState,
  benchmarkState,
  prompt,
}: EmbeddedCompareSessionAdapterInput) {
  const validTargetIds = useMemo(
    () => agentTargets.map((target) => target.id),
    [agentTargets],
  );

  const preferenceModel = useComparePreferencePersistenceModel({
    targetState,
    promptState,
    runState,
    benchmarkState,
    validTargetIds,
    maxCompareLanes,
  });

  useEffect(() => {
    const validTargetSet = new Set(validTargetIds);
    targetState.setCompareTargetIds((current) => {
      const next = current.filter((targetId) => validTargetSet.has(targetId));
      return next.length === current.length ? current : next;
    });
  }, [targetState.setCompareTargetIds, validTargetIds]);

  const preferencePort = useMemo<CompareSessionPreferencePort>(
    () => ({
      snapshot: preferenceModel.preferenceInput,
      apply: preferenceModel.applyStoredPreferenceInput,
    }),
    [
      preferenceModel.applyStoredPreferenceInput,
      preferenceModel.preferenceInput,
    ],
  );

  const reproduceRequestArtifacts = useMemo(
    () =>
      buildCompareReproduceRequestArtifacts({
        compareTargetIds: targetState.compareTargetIds,
        input: prompt.input,
        historyMessages: prompt.historyMessages,
        systemPrompt: prompt.systemPrompt,
        compareIntent: promptState.compareIntent,
        compareOutputShape: promptState.compareOutputShape,
        contextWindow: prompt.contextWindow,
        enableTools: prompt.enableTools,
        enableRetrieval: prompt.enableRetrieval,
        providerProfile: prompt.providerProfile,
        thinkingMode: prompt.thinkingMode,
        compareResult: runState.compareResult,
      }),
    [
      prompt.contextWindow,
      prompt.enableRetrieval,
      prompt.enableTools,
      prompt.historyMessages,
      prompt.input,
      prompt.providerProfile,
      prompt.systemPrompt,
      prompt.thinkingMode,
      promptState.compareIntent,
      promptState.compareOutputShape,
      runState.compareResult,
      targetState.compareTargetIds,
    ],
  );

  return {
    preferencePort,
    reproduceRequestArtifacts,
  };
}
