"use client";

import type { CompareWorkbenchProps } from "@/features/compare/CompareWorkbench";

type CompareTargetInput = Pick<
  CompareWorkbenchProps,
  "targets" | "selectedTargetId" | "compareTargetIds"
>;

type ComparePromptInput = Pick<
  CompareWorkbenchProps,
  | "compareIntent"
  | "compareOutputShape"
  | "input"
  | "systemPrompt"
  | "enableTools"
  | "enableRetrieval"
  | "contextWindow"
  | "providerProfile"
  | "thinkingMode"
>;

type CompareRunInput = Pick<
  CompareWorkbenchProps,
  | "pending"
  | "comparePending"
  | "compareError"
  | "compareResult"
  | "compareBaseTargetId"
  | "compareReviewSummaryTone"
  | "compareReviewSummaryDetail"
  | "compareRuntimeByTargetId"
  | "compareProgressByTargetId"
>;

type CompareRecoveryInput = Pick<
  CompareWorkbenchProps,
  | "compareRecoveryPendingTargetId"
  | "compareRecoveryConfirmTargetId"
  | "compareRecoveryCooldownByTargetId"
  | "compareRecoveryNotice"
>;

type CompareBenchmarkInput = Pick<
  CompareWorkbenchProps,
  | "compareBenchmarkUseOutputContract"
  | "compareBenchmarkPreviewDiffOnly"
  | "benchmarkPending"
  | "benchmarkError"
  | "benchmarkResult"
>;

type CompareRecipeInput = Pick<
  CompareWorkbenchProps,
  | "recipes"
  | "recipesPending"
  | "recipesError"
  | "activeRecipeId"
  | "recipeDraftLabel"
  | "recipeDraftDescription"
>;

type CompareOptionInput = Pick<
  CompareWorkbenchProps,
  "contextWindowOptions" | "providerProfileOptions" | "thinkingModeOptions"
>;

type CompareActionInput = Pick<
  CompareWorkbenchProps,
  | "onToggleCompareTarget"
  | "onCompareIntentChange"
  | "onCompareOutputShapeChange"
  | "onInputChange"
  | "onSystemPromptChange"
  | "onEnableToolsChange"
  | "onEnableRetrievalChange"
  | "onContextWindowChange"
  | "onProviderProfileChange"
  | "onThinkingModeChange"
  | "onRunCompare"
  | "onRerunLane"
  | "onSetBaseLane"
  | "onCompareReviewSummaryToneChange"
  | "onCompareReviewSummaryDetailChange"
  | "onSendToBenchmark"
  | "onExportMarkdown"
  | "onCompareBenchmarkUseOutputContractChange"
  | "onCompareBenchmarkPreviewDiffOnlyChange"
  | "onRetryLocalRecovery"
  | "onExportLaneMarkdown"
  | "onCopyMarkdown"
  | "onCopyLaneMarkdown"
  | "onCopyLaneReviewSummary"
  | "onPreviewLaneMarkdown"
  | "onRecipeDraftLabelChange"
  | "onRecipeDraftDescriptionChange"
  | "onRefreshRecipes"
  | "onApplyRecipe"
  | "onRunRecipeCompare"
  | "onRunRecipeBenchmark"
  | "onDeleteRecipe"
  | "onSaveCurrentRecipe"
  | "onExportRecipesJson"
  | "onImportRecipesJson"
  | "onCopy"
>;

type CompareWorkbenchShellPropsInput = {
  locale: string;
  target: CompareTargetInput;
  prompt: ComparePromptInput;
  run: CompareRunInput;
  recovery: CompareRecoveryInput;
  benchmark: CompareBenchmarkInput;
  recipe: CompareRecipeInput;
  options: CompareOptionInput;
  actions: CompareActionInput;
  copyState: string;
};

export function useCompareWorkbenchShellProps({
  locale,
  target,
  prompt,
  run,
  recovery,
  benchmark,
  recipe,
  options,
  actions,
  copyState,
}: CompareWorkbenchShellPropsInput): CompareWorkbenchProps {
  return {
    locale,
    ...target,
    ...prompt,
    ...run,
    ...recovery,
    ...benchmark,
    ...recipe,
    recipesExecutionPending: run.comparePending || benchmark.benchmarkPending,
    ...options,
    ...actions,
    copyState,
  };
}
