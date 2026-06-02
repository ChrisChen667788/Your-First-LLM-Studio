"use client";

import { useCompareRecipePersistence } from "./recipe-persistence";
import { useCompareState } from "./useCompareState";

type CompareStateModel = ReturnType<typeof useCompareState>;
type CompareRecipeStateModel = ReturnType<typeof useCompareRecipePersistence>;

export type CompareWorkbenchStateModel = CompareStateModel &
  CompareRecipeStateModel & {
    targetState: {
      compareTargetIds: CompareStateModel["compareTargetIds"];
      setCompareTargetIds: CompareStateModel["setCompareTargetIds"];
    };
    promptState: {
      compareIntent: CompareStateModel["compareIntent"];
      setCompareIntent: CompareStateModel["setCompareIntent"];
      compareOutputShape: CompareStateModel["compareOutputShape"];
      setCompareOutputShape: CompareStateModel["setCompareOutputShape"];
    };
    runState: {
      comparePending: CompareStateModel["comparePending"];
      setComparePending: CompareStateModel["setComparePending"];
      compareError: CompareStateModel["compareError"];
      setCompareError: CompareStateModel["setCompareError"];
      compareResult: CompareStateModel["compareResult"];
      setCompareResult: CompareStateModel["setCompareResult"];
      compareBaseTargetId: CompareStateModel["compareBaseTargetId"];
      setCompareBaseTargetId: CompareStateModel["setCompareBaseTargetId"];
      compareReviewSummaryTone: CompareStateModel["compareReviewSummaryTone"];
      setCompareReviewSummaryTone: CompareStateModel["setCompareReviewSummaryTone"];
      compareReviewSummaryDetail: CompareStateModel["compareReviewSummaryDetail"];
      setCompareReviewSummaryDetail: CompareStateModel["setCompareReviewSummaryDetail"];
      compareRequestId: CompareStateModel["compareRequestId"];
      setCompareRequestId: CompareStateModel["setCompareRequestId"];
      compareRuntimeByTargetId: CompareStateModel["compareRuntimeByTargetId"];
      setCompareRuntimeByTargetId: CompareStateModel["setCompareRuntimeByTargetId"];
      compareProgressByTargetId: CompareStateModel["compareProgressByTargetId"];
      setCompareProgressByTargetId: CompareStateModel["setCompareProgressByTargetId"];
    };
    recoveryState: {
      compareRecoveryPendingTargetId: CompareStateModel["compareRecoveryPendingTargetId"];
      setCompareRecoveryPendingTargetId: CompareStateModel["setCompareRecoveryPendingTargetId"];
      compareRecoveryConfirmTargetId: CompareStateModel["compareRecoveryConfirmTargetId"];
      setCompareRecoveryConfirmTargetId: CompareStateModel["setCompareRecoveryConfirmTargetId"];
      compareRecoveryCooldownByTargetId: CompareStateModel["compareRecoveryCooldownByTargetId"];
      setCompareRecoveryCooldownByTargetId: CompareStateModel["setCompareRecoveryCooldownByTargetId"];
      compareRecoveryNotice: CompareStateModel["compareRecoveryNotice"];
      setCompareRecoveryNotice: CompareStateModel["setCompareRecoveryNotice"];
    };
    benchmarkState: {
      compareBenchmarkUseOutputContract: CompareStateModel["compareBenchmarkUseOutputContract"];
      setCompareBenchmarkUseOutputContract: CompareStateModel["setCompareBenchmarkUseOutputContract"];
      compareBenchmarkPreviewDiffOnly: CompareStateModel["compareBenchmarkPreviewDiffOnly"];
      setCompareBenchmarkPreviewDiffOnly: CompareStateModel["setCompareBenchmarkPreviewDiffOnly"];
      benchmarkPending: CompareStateModel["benchmarkPending"];
      setBenchmarkPending: CompareStateModel["setBenchmarkPending"];
      benchmarkError: CompareStateModel["benchmarkError"];
      setBenchmarkError: CompareStateModel["setBenchmarkError"];
      benchmarkResult: CompareStateModel["benchmarkResult"];
      setBenchmarkResult: CompareStateModel["setBenchmarkResult"];
    };
    recipeState: CompareRecipeStateModel;
  };

export function useCompareWorkbenchStateModel({
  locale,
}: {
  locale: string;
}): CompareWorkbenchStateModel {
  const compareState = useCompareState();
  const recipeState = useCompareRecipePersistence({ locale });

  return {
    ...compareState,
    ...recipeState,
    targetState: {
      compareTargetIds: compareState.compareTargetIds,
      setCompareTargetIds: compareState.setCompareTargetIds,
    },
    promptState: {
      compareIntent: compareState.compareIntent,
      setCompareIntent: compareState.setCompareIntent,
      compareOutputShape: compareState.compareOutputShape,
      setCompareOutputShape: compareState.setCompareOutputShape,
    },
    runState: {
      comparePending: compareState.comparePending,
      setComparePending: compareState.setComparePending,
      compareError: compareState.compareError,
      setCompareError: compareState.setCompareError,
      compareResult: compareState.compareResult,
      setCompareResult: compareState.setCompareResult,
      compareBaseTargetId: compareState.compareBaseTargetId,
      setCompareBaseTargetId: compareState.setCompareBaseTargetId,
      compareReviewSummaryTone: compareState.compareReviewSummaryTone,
      setCompareReviewSummaryTone: compareState.setCompareReviewSummaryTone,
      compareReviewSummaryDetail: compareState.compareReviewSummaryDetail,
      setCompareReviewSummaryDetail:
        compareState.setCompareReviewSummaryDetail,
      compareRequestId: compareState.compareRequestId,
      setCompareRequestId: compareState.setCompareRequestId,
      compareRuntimeByTargetId: compareState.compareRuntimeByTargetId,
      setCompareRuntimeByTargetId: compareState.setCompareRuntimeByTargetId,
      compareProgressByTargetId: compareState.compareProgressByTargetId,
      setCompareProgressByTargetId: compareState.setCompareProgressByTargetId,
    },
    recoveryState: {
      compareRecoveryPendingTargetId:
        compareState.compareRecoveryPendingTargetId,
      setCompareRecoveryPendingTargetId:
        compareState.setCompareRecoveryPendingTargetId,
      compareRecoveryConfirmTargetId:
        compareState.compareRecoveryConfirmTargetId,
      setCompareRecoveryConfirmTargetId:
        compareState.setCompareRecoveryConfirmTargetId,
      compareRecoveryCooldownByTargetId:
        compareState.compareRecoveryCooldownByTargetId,
      setCompareRecoveryCooldownByTargetId:
        compareState.setCompareRecoveryCooldownByTargetId,
      compareRecoveryNotice: compareState.compareRecoveryNotice,
      setCompareRecoveryNotice: compareState.setCompareRecoveryNotice,
    },
    benchmarkState: {
      compareBenchmarkUseOutputContract:
        compareState.compareBenchmarkUseOutputContract,
      setCompareBenchmarkUseOutputContract:
        compareState.setCompareBenchmarkUseOutputContract,
      compareBenchmarkPreviewDiffOnly:
        compareState.compareBenchmarkPreviewDiffOnly,
      setCompareBenchmarkPreviewDiffOnly:
        compareState.setCompareBenchmarkPreviewDiffOnly,
      benchmarkPending: compareState.benchmarkPending,
      setBenchmarkPending: compareState.setBenchmarkPending,
      benchmarkError: compareState.benchmarkError,
      setBenchmarkError: compareState.setBenchmarkError,
      benchmarkResult: compareState.benchmarkResult,
      setBenchmarkResult: compareState.setBenchmarkResult,
    },
    recipeState,
  };
}
