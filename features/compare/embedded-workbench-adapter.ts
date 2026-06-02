"use client";

import {
  useCallback,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useCompareWorkbenchOrchestrationModel } from "./workbench-orchestration-model";
import { useCompareWorkbenchShellProps } from "./workbench-shell-props";
import type { CompareWorkbenchStateModel } from "./workbench-state-model";
import type {
  AgentCompareSourceSurface,
  AgentMessage,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
  AgentWorkbenchMode,
} from "@/lib/agent/types";

type Setter<T> = Dispatch<SetStateAction<T>>;

type EmbeddedComparePromptBinding = {
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

type EmbeddedCompareWorkbenchBinding = {
  workbenchMode: AgentWorkbenchMode;
  selectedTargetId: string;
  setSelectedTargetId: Setter<string>;
  setWorkbenchMode: Setter<AgentWorkbenchMode>;
};

type EmbeddedCompareWorkbenchOptions = {
  contextWindowOptions: number[];
  providerProfileOptions: AgentProviderProfile[];
  thinkingModeOptions: AgentThinkingMode[];
};

type EmbeddedCompareWorkbenchAdapterInput = {
  locale: string;
  sourceSurface: AgentCompareSourceSurface;
  agentTargets: AgentTarget[];
  historyMessages: AgentMessage[];
  maxCompareLanes: number;
  pending: boolean;
  targetState: CompareWorkbenchStateModel["targetState"];
  promptState: CompareWorkbenchStateModel["promptState"];
  runState: CompareWorkbenchStateModel["runState"];
  recoveryState: CompareWorkbenchStateModel["recoveryState"];
  benchmarkState: CompareWorkbenchStateModel["benchmarkState"];
  recipeState: CompareWorkbenchStateModel["recipeState"];
  prompt: EmbeddedComparePromptBinding;
  workbench: EmbeddedCompareWorkbenchBinding;
  options: EmbeddedCompareWorkbenchOptions;
  copyState: string;
  copyText: (text: string, key: string) => Promise<void>;
};

export function useEmbeddedCompareWorkbenchAdapter({
  locale,
  sourceSurface,
  agentTargets,
  historyMessages,
  maxCompareLanes,
  pending,
  targetState,
  promptState,
  runState,
  recoveryState,
  benchmarkState,
  recipeState,
  prompt,
  workbench,
  options,
  copyState,
  copyText,
}: EmbeddedCompareWorkbenchAdapterInput) {
  useEffect(() => {
    void recipeState.loadStudioRecipes();
  }, [recipeState.loadStudioRecipes]);

  const handleToggleCompareTarget = useCallback(
    (targetId: string) => {
      if (targetId === workbench.selectedTargetId) {
        return;
      }
      targetState.setCompareTargetIds((current) => {
        const deduped = Array.from(new Set(current));
        if (deduped.includes(targetId)) {
          return deduped.filter((id) => id !== targetId);
        }
        if (deduped.length >= maxCompareLanes) {
          return deduped;
        }
        return [...deduped, targetId];
      });
    },
    [maxCompareLanes, targetState.setCompareTargetIds, workbench.selectedTargetId],
  );

  const handleCreateStudioRecipe = useCallback(
    () =>
      recipeState.saveCurrentStudioRecipe({
        workbenchMode: workbench.workbenchMode,
        compareOutputShape: promptState.compareOutputShape,
        enableTools: prompt.enableTools,
        enableRetrieval: prompt.enableRetrieval,
        targetIds: targetState.compareTargetIds,
        input: prompt.input,
        systemPrompt: prompt.systemPrompt,
        compareIntent: promptState.compareIntent,
        contextWindow: prompt.contextWindow,
        providerProfile: prompt.providerProfile,
        thinkingMode: prompt.thinkingMode,
      }),
    [
      prompt.contextWindow,
      prompt.enableRetrieval,
      prompt.enableTools,
      prompt.input,
      prompt.providerProfile,
      prompt.systemPrompt,
      prompt.thinkingMode,
      promptState.compareIntent,
      promptState.compareOutputShape,
      recipeState.saveCurrentStudioRecipe,
      targetState.compareTargetIds,
      workbench.workbenchMode,
    ],
  );

  const {
    handleRunCompare,
    handleRerunCompareLane,
    handleSendCompareToBenchmark,
    requestRetryCompareLaneRecovery,
    handleExportCompareMarkdown,
    handleExportCompareLaneMarkdown,
    handleCopyCompareMarkdown,
    handleCopyCompareLaneMarkdown,
    handleCopyCompareLaneReviewSummary,
    handlePreviewCompareLaneMarkdown,
    applyStudioRecipe: handleApplyStudioRecipe,
    runStudioRecipeCompare: handleRunStudioRecipeCompare,
    runStudioRecipeBenchmark: handleRunStudioRecipeBenchmark,
  } = useCompareWorkbenchOrchestrationModel({
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
    workbench: {
      selectedTargetId: workbench.selectedTargetId,
      setSelectedTargetId: workbench.setSelectedTargetId,
      setWorkbenchMode: workbench.setWorkbenchMode,
    },
    copyText,
  });

  return useCompareWorkbenchShellProps({
    locale,
    target: {
      targets: agentTargets,
      selectedTargetId: workbench.selectedTargetId,
      compareTargetIds: targetState.compareTargetIds,
    },
    prompt: {
      compareIntent: promptState.compareIntent,
      compareOutputShape: promptState.compareOutputShape,
      input: prompt.input,
      systemPrompt: prompt.systemPrompt,
      enableTools: prompt.enableTools,
      enableRetrieval: prompt.enableRetrieval,
      contextWindow: prompt.contextWindow,
      providerProfile: prompt.providerProfile,
      thinkingMode: prompt.thinkingMode,
    },
    run: {
      pending,
      comparePending: runState.comparePending,
      compareError: runState.compareError,
      compareResult: runState.compareResult,
      compareBaseTargetId: runState.compareBaseTargetId,
      compareReviewSummaryTone: runState.compareReviewSummaryTone,
      compareReviewSummaryDetail: runState.compareReviewSummaryDetail,
      compareRuntimeByTargetId: runState.compareRuntimeByTargetId,
      compareProgressByTargetId: runState.compareProgressByTargetId,
    },
    recovery: {
      compareRecoveryPendingTargetId:
        recoveryState.compareRecoveryPendingTargetId,
      compareRecoveryConfirmTargetId:
        recoveryState.compareRecoveryConfirmTargetId,
      compareRecoveryCooldownByTargetId:
        recoveryState.compareRecoveryCooldownByTargetId,
      compareRecoveryNotice: recoveryState.compareRecoveryNotice,
    },
    benchmark: {
      compareBenchmarkUseOutputContract:
        benchmarkState.compareBenchmarkUseOutputContract,
      compareBenchmarkPreviewDiffOnly:
        benchmarkState.compareBenchmarkPreviewDiffOnly,
      benchmarkPending: benchmarkState.benchmarkPending,
      benchmarkError: benchmarkState.benchmarkError,
      benchmarkResult: benchmarkState.benchmarkResult,
    },
    recipe: {
      recipes: recipeState.recipes,
      recipesPending: recipeState.recipesPending,
      recipesError: recipeState.recipesError,
      activeRecipeId: recipeState.activeRecipeId,
      recipeDraftLabel: recipeState.recipeDraftLabel,
      recipeDraftDescription: recipeState.recipeDraftDescription,
    },
    options,
    actions: {
      onToggleCompareTarget: handleToggleCompareTarget,
      onCompareIntentChange: promptState.setCompareIntent,
      onCompareOutputShapeChange: promptState.setCompareOutputShape,
      onInputChange: prompt.setInput,
      onSystemPromptChange: prompt.setSystemPrompt,
      onEnableToolsChange: prompt.setEnableTools,
      onEnableRetrievalChange: prompt.setEnableRetrieval,
      onContextWindowChange: prompt.setContextWindow,
      onProviderProfileChange: prompt.setProviderProfile,
      onThinkingModeChange: prompt.setThinkingMode,
      onRunCompare: handleRunCompare,
      onRerunLane: handleRerunCompareLane,
      onSetBaseLane: runState.setCompareBaseTargetId,
      onCompareReviewSummaryToneChange: runState.setCompareReviewSummaryTone,
      onCompareReviewSummaryDetailChange:
        runState.setCompareReviewSummaryDetail,
      onSendToBenchmark: handleSendCompareToBenchmark,
      onExportMarkdown: handleExportCompareMarkdown,
      onCompareBenchmarkUseOutputContractChange:
        benchmarkState.setCompareBenchmarkUseOutputContract,
      onCompareBenchmarkPreviewDiffOnlyChange:
        benchmarkState.setCompareBenchmarkPreviewDiffOnly,
      onRetryLocalRecovery: requestRetryCompareLaneRecovery,
      onExportLaneMarkdown: handleExportCompareLaneMarkdown,
      onCopyMarkdown: handleCopyCompareMarkdown,
      onCopyLaneMarkdown: handleCopyCompareLaneMarkdown,
      onCopyLaneReviewSummary: handleCopyCompareLaneReviewSummary,
      onPreviewLaneMarkdown: handlePreviewCompareLaneMarkdown,
      onRecipeDraftLabelChange: recipeState.setRecipeDraftLabel,
      onRecipeDraftDescriptionChange: recipeState.setRecipeDraftDescription,
      onRefreshRecipes: recipeState.loadStudioRecipes,
      onApplyRecipe: handleApplyStudioRecipe,
      onRunRecipeCompare: handleRunStudioRecipeCompare,
      onRunRecipeBenchmark: handleRunStudioRecipeBenchmark,
      onDeleteRecipe: recipeState.deleteStudioRecipe,
      onSaveCurrentRecipe: handleCreateStudioRecipe,
      onExportRecipesJson: recipeState.exportStudioRecipesJson,
      onImportRecipesJson: recipeState.importStudioRecipesJson,
      onCopy: copyText,
    },
    copyState,
  });
}
