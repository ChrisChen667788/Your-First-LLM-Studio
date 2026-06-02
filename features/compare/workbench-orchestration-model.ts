"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  AgentCompareSourceSurface,
  AgentMessage,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
  AgentWorkbenchMode,
} from "@/lib/agent/types";
import { useCompareRecipeOrchestration } from "./recipe-orchestration";
import { useCompareActions } from "./useCompareActions";
import { useCompareLifecycle } from "./useCompareLifecycle";
import type { CompareWorkbenchStateModel } from "./workbench-state-model";

type Setter<T> = Dispatch<SetStateAction<T>>;

type ComparePromptBinding = {
  input: string;
  setInput: Setter<string>;
  systemPrompt: string;
  setSystemPrompt: Setter<string>;
  contextWindow: number;
  setContextWindow: Setter<number>;
  enableTools: boolean;
  setEnableTools: Setter<boolean>;
  enableRetrieval: boolean;
  setEnableRetrieval: Setter<boolean>;
  providerProfile: AgentProviderProfile;
  setProviderProfile: Setter<AgentProviderProfile>;
  thinkingMode: AgentThinkingMode;
  setThinkingMode: Setter<AgentThinkingMode>;
};

type CompareWorkbenchBinding = {
  selectedTargetId: string;
  setSelectedTargetId: Setter<string>;
  setWorkbenchMode: Setter<AgentWorkbenchMode>;
};

type CompareWorkbenchOrchestrationModelInput = {
  locale: string;
  sourceSurface: AgentCompareSourceSurface;
  agentTargets: AgentTarget[];
  historyMessages: AgentMessage[];
  maxCompareLanes: number;
  targetState: CompareWorkbenchStateModel["targetState"];
  promptState: CompareWorkbenchStateModel["promptState"];
  runState: CompareWorkbenchStateModel["runState"];
  recoveryState: CompareWorkbenchStateModel["recoveryState"];
  benchmarkState: CompareWorkbenchStateModel["benchmarkState"];
  recipeState: CompareWorkbenchStateModel["recipeState"];
  prompt: ComparePromptBinding;
  workbench: CompareWorkbenchBinding;
  copyText: (text: string, key: string) => Promise<void>;
};

export function useCompareWorkbenchOrchestrationModel({
  locale,
  sourceSurface,
  agentTargets,
  historyMessages,
  maxCompareLanes,
  targetState,
  promptState,
  runState,
  recoveryState,
  benchmarkState,
  recipeState,
  prompt,
  workbench,
  copyText,
}: CompareWorkbenchOrchestrationModelInput) {
  useCompareLifecycle({
    agentTargets,
    selectedTargetId: workbench.selectedTargetId,
    compareTargetIds: targetState.compareTargetIds,
    compareIntent: promptState.compareIntent,
    compareOutputShape: promptState.compareOutputShape,
    comparePending: runState.comparePending,
    compareRequestId: runState.compareRequestId,
    compareResult: runState.compareResult,
    contextWindow: prompt.contextWindow,
    enableRetrieval: prompt.enableRetrieval,
    enableTools: prompt.enableTools,
    input: prompt.input,
    providerProfile: prompt.providerProfile,
    systemPrompt: prompt.systemPrompt,
    thinkingMode: prompt.thinkingMode,
    maxCompareLanes,
    setCompareTargetIds: targetState.setCompareTargetIds,
    setCompareError: runState.setCompareError,
    setBenchmarkError: benchmarkState.setBenchmarkError,
    setCompareBaseTargetId: runState.setCompareBaseTargetId,
    setCompareRuntimeByTargetId: runState.setCompareRuntimeByTargetId,
    setCompareProgressByTargetId: runState.setCompareProgressByTargetId,
  });

  const recipeActions = useCompareRecipeOrchestration({
    locale,
    sourceSurface,
    recipes: recipeState.recipes,
    agentTargets,
    selectedTargetId: workbench.selectedTargetId,
    historyMessages,
    setRecipesError: recipeState.setRecipesError,
    setActiveRecipeId: recipeState.setActiveRecipeId,
    setRecipeDraftLabel: recipeState.setRecipeDraftLabel,
    setRecipeDraftDescription: recipeState.setRecipeDraftDescription,
    setSelectedTargetId: workbench.setSelectedTargetId,
    setCompareTargetIds: targetState.setCompareTargetIds,
    setInput: prompt.setInput,
    setSystemPrompt: prompt.setSystemPrompt,
    setCompareIntent: promptState.setCompareIntent,
    setCompareOutputShape: promptState.setCompareOutputShape,
    setContextWindow: prompt.setContextWindow,
    setEnableTools: prompt.setEnableTools,
    setEnableRetrieval: prompt.setEnableRetrieval,
    setProviderProfile: prompt.setProviderProfile,
    setThinkingMode: prompt.setThinkingMode,
    setWorkbenchMode: workbench.setWorkbenchMode,
    setComparePending: runState.setComparePending,
    setCompareError: runState.setCompareError,
    setCompareResult: runState.setCompareResult,
    setCompareBaseTargetId: runState.setCompareBaseTargetId,
    setCompareRequestId: runState.setCompareRequestId,
    setCompareProgressByTargetId: runState.setCompareProgressByTargetId,
    setBenchmarkPending: benchmarkState.setBenchmarkPending,
    setBenchmarkError: benchmarkState.setBenchmarkError,
    setBenchmarkResult: benchmarkState.setBenchmarkResult,
  });

  const compareActions = useCompareActions({
    locale,
    sourceSurface,
    agentTargets,
    compareTargetIds: targetState.compareTargetIds,
    compareIntent: promptState.compareIntent,
    compareOutputShape: promptState.compareOutputShape,
    comparePending: runState.comparePending,
    compareResult: runState.compareResult,
    compareBaseTargetId: runState.compareBaseTargetId,
    compareRequestId: runState.compareRequestId,
    compareProgressByTargetId: runState.compareProgressByTargetId,
    compareBenchmarkUseOutputContract:
      benchmarkState.compareBenchmarkUseOutputContract,
    compareReviewSummaryTone: runState.compareReviewSummaryTone,
    compareReviewSummaryDetail: runState.compareReviewSummaryDetail,
    compareRecoveryConfirmTargetId:
      recoveryState.compareRecoveryConfirmTargetId,
    compareRecoveryCooldownByTargetId:
      recoveryState.compareRecoveryCooldownByTargetId,
    historyMessages,
    input: prompt.input,
    systemPrompt: prompt.systemPrompt,
    contextWindow: prompt.contextWindow,
    enableTools: prompt.enableTools,
    enableRetrieval: prompt.enableRetrieval,
    providerProfile: prompt.providerProfile,
    thinkingMode: prompt.thinkingMode,
    setComparePending: runState.setComparePending,
    setCompareError: runState.setCompareError,
    setCompareResult: runState.setCompareResult,
    setCompareBaseTargetId: runState.setCompareBaseTargetId,
    setCompareRequestId: runState.setCompareRequestId,
    setCompareProgressByTargetId: runState.setCompareProgressByTargetId,
    setCompareRuntimeByTargetId: runState.setCompareRuntimeByTargetId,
    setCompareRecoveryPendingTargetId:
      recoveryState.setCompareRecoveryPendingTargetId,
    setCompareRecoveryConfirmTargetId:
      recoveryState.setCompareRecoveryConfirmTargetId,
    setCompareRecoveryCooldownByTargetId:
      recoveryState.setCompareRecoveryCooldownByTargetId,
    setCompareRecoveryNotice: recoveryState.setCompareRecoveryNotice,
    setBenchmarkPending: benchmarkState.setBenchmarkPending,
    setBenchmarkError: benchmarkState.setBenchmarkError,
    setBenchmarkResult: benchmarkState.setBenchmarkResult,
    copyText,
  });

  return {
    ...compareActions,
    applyStudioRecipe: recipeActions.applyStudioRecipe,
    runStudioRecipeCompare: recipeActions.runStudioRecipeCompare,
    runStudioRecipeBenchmark: recipeActions.runStudioRecipeBenchmark,
  };
}
