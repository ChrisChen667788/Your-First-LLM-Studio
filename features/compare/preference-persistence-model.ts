"use client";

import { useCallback, useMemo } from "react";
import {
  applyStoredComparePreferences,
  buildStoredComparePreferenceSlice,
  type ComparePreferenceInput,
  type ComparePreferenceSnapshotInput,
} from "@/features/compare/preferences";
import type { CompareWorkbenchStateModel } from "@/features/compare/workbench-state-model";

type ComparePreferencePersistenceState = {
  targetState: Pick<
    CompareWorkbenchStateModel["targetState"],
    "compareTargetIds" | "setCompareTargetIds"
  >;
  promptState: Pick<
    CompareWorkbenchStateModel["promptState"],
    "compareIntent" | "compareOutputShape" | "setCompareIntent" | "setCompareOutputShape"
  >;
  runState: Pick<
    CompareWorkbenchStateModel["runState"],
    | "compareBaseTargetId"
    | "compareReviewSummaryTone"
    | "compareReviewSummaryDetail"
    | "setCompareBaseTargetId"
    | "setCompareReviewSummaryTone"
    | "setCompareReviewSummaryDetail"
  >;
  benchmarkState: Pick<
    CompareWorkbenchStateModel["benchmarkState"],
    | "compareBenchmarkUseOutputContract"
    | "compareBenchmarkPreviewDiffOnly"
    | "setCompareBenchmarkUseOutputContract"
    | "setCompareBenchmarkPreviewDiffOnly"
  >;
};

export function useComparePreferencePersistenceModel({
  targetState,
  promptState,
  runState,
  benchmarkState,
  validTargetIds,
  maxCompareLanes,
}: ComparePreferencePersistenceState & {
  validTargetIds: string[];
  maxCompareLanes: number;
}) {
  const preferenceInput = useMemo<ComparePreferenceSnapshotInput>(
    () => ({
      compareTargetIds: targetState.compareTargetIds,
      compareBaseTargetId: runState.compareBaseTargetId,
      compareReviewSummaryTone: runState.compareReviewSummaryTone,
      compareReviewSummaryDetail: runState.compareReviewSummaryDetail,
      compareBenchmarkUseOutputContract:
        benchmarkState.compareBenchmarkUseOutputContract,
      compareBenchmarkPreviewDiffOnly:
        benchmarkState.compareBenchmarkPreviewDiffOnly,
      compareIntent: promptState.compareIntent,
      compareOutputShape: promptState.compareOutputShape,
    }),
    [
      benchmarkState.compareBenchmarkPreviewDiffOnly,
      benchmarkState.compareBenchmarkUseOutputContract,
      promptState.compareIntent,
      promptState.compareOutputShape,
      runState.compareBaseTargetId,
      runState.compareReviewSummaryDetail,
      runState.compareReviewSummaryTone,
      targetState.compareTargetIds,
    ],
  );

  const buildStoredPreferenceSlice = useCallback(
    () => buildStoredComparePreferenceSlice(preferenceInput),
    [preferenceInput],
  );

  const applyStoredPreferenceInput = useCallback(
    (input: ComparePreferenceInput | null | undefined) => {
      applyStoredComparePreferences({
        input,
        validTargetIds,
        maxCompareLanes,
        setters: {
          setCompareTargetIds: targetState.setCompareTargetIds,
          setCompareBaseTargetId: runState.setCompareBaseTargetId,
          setCompareReviewSummaryTone: runState.setCompareReviewSummaryTone,
          setCompareReviewSummaryDetail: runState.setCompareReviewSummaryDetail,
          setCompareBenchmarkUseOutputContract:
            benchmarkState.setCompareBenchmarkUseOutputContract,
          setCompareBenchmarkPreviewDiffOnly:
            benchmarkState.setCompareBenchmarkPreviewDiffOnly,
          setCompareIntent: promptState.setCompareIntent,
          setCompareOutputShape: promptState.setCompareOutputShape,
        },
      });
    },
    [
      benchmarkState.setCompareBenchmarkPreviewDiffOnly,
      benchmarkState.setCompareBenchmarkUseOutputContract,
      maxCompareLanes,
      promptState.setCompareIntent,
      promptState.setCompareOutputShape,
      runState.setCompareBaseTargetId,
      runState.setCompareReviewSummaryDetail,
      runState.setCompareReviewSummaryTone,
      targetState.setCompareTargetIds,
      validTargetIds,
    ],
  );

  return {
    preferenceInput,
    buildStoredPreferenceSlice,
    applyStoredPreferenceInput,
  };
}
