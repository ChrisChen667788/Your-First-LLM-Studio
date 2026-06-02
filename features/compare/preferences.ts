"use client";

import type {
  AgentCompareIntent,
  AgentCompareOutputShape,
  AgentCompareReviewSummaryDetail,
  AgentCompareReviewSummaryTone
} from "@/lib/agent/types";

export type ComparePreferenceInput = {
  compareTargetIds?: string[];
  compareBaseTargetId?: string;
  compareReviewSummaryTone?: AgentCompareReviewSummaryTone;
  compareReviewSummaryDetail?: AgentCompareReviewSummaryDetail;
  compareBenchmarkUseOutputContract?: boolean;
  compareBenchmarkPreviewDiffOnly?: boolean;
  compareIntent?: AgentCompareIntent;
  compareOutputShape?: AgentCompareOutputShape;
};

const VALID_COMPARE_TONES: AgentCompareReviewSummaryTone[] = ["issue", "pr", "chat"];
const VALID_COMPARE_DETAILS: AgentCompareReviewSummaryDetail[] = ["compact", "strict-review", "friendly-report"];
const VALID_COMPARE_INTENTS: AgentCompareIntent[] = [
  "model-vs-model",
  "preset-vs-preset",
  "template-vs-template",
  "before-vs-after"
];
const VALID_COMPARE_OUTPUT_SHAPES: AgentCompareOutputShape[] = ["freeform", "bullet-list", "strict-json"];

export function normalizeRawComparePreferenceInput(input: unknown): ComparePreferenceInput {
  if (!input || typeof input !== "object") {
    return {};
  }

  const candidate = input as ComparePreferenceInput;
  return {
    compareTargetIds: Array.isArray(candidate.compareTargetIds)
      ? candidate.compareTargetIds.filter((value): value is string => typeof value === "string")
      : undefined,
    compareBaseTargetId:
      typeof candidate.compareBaseTargetId === "string" ? candidate.compareBaseTargetId : undefined,
    compareReviewSummaryTone: VALID_COMPARE_TONES.includes(candidate.compareReviewSummaryTone as AgentCompareReviewSummaryTone)
      ? (candidate.compareReviewSummaryTone as AgentCompareReviewSummaryTone)
      : undefined,
    compareReviewSummaryDetail: VALID_COMPARE_DETAILS.includes(
      candidate.compareReviewSummaryDetail as AgentCompareReviewSummaryDetail
    )
      ? (candidate.compareReviewSummaryDetail as AgentCompareReviewSummaryDetail)
      : undefined,
    compareBenchmarkUseOutputContract:
      typeof candidate.compareBenchmarkUseOutputContract === "boolean"
        ? candidate.compareBenchmarkUseOutputContract
        : undefined,
    compareBenchmarkPreviewDiffOnly:
      typeof candidate.compareBenchmarkPreviewDiffOnly === "boolean"
        ? candidate.compareBenchmarkPreviewDiffOnly
        : undefined,
    compareIntent: VALID_COMPARE_INTENTS.includes(candidate.compareIntent as AgentCompareIntent)
      ? (candidate.compareIntent as AgentCompareIntent)
      : undefined,
    compareOutputShape: VALID_COMPARE_OUTPUT_SHAPES.includes(candidate.compareOutputShape as AgentCompareOutputShape)
      ? (candidate.compareOutputShape as AgentCompareOutputShape)
      : undefined
  };
}

export function normalizeStoredComparePreferences(
  input: ComparePreferenceInput | null | undefined,
  validTargetIds: string[],
  maxCompareLanes: number
) {
  if (!input) {
    return {};
  }

  const validTargetSet = new Set(validTargetIds);
  const compareTargetIds = Array.isArray(input.compareTargetIds)
    ? Array.from(
        new Set(
          input.compareTargetIds.filter(
            (targetId): targetId is string => typeof targetId === "string" && validTargetSet.has(targetId)
          )
        )
      ).slice(0, maxCompareLanes)
    : [];

  return {
    compareTargetIds,
    compareBaseTargetId:
      typeof input.compareBaseTargetId === "string" && validTargetSet.has(input.compareBaseTargetId)
        ? input.compareBaseTargetId
        : undefined,
    compareReviewSummaryTone: VALID_COMPARE_TONES.includes(input.compareReviewSummaryTone as AgentCompareReviewSummaryTone)
      ? (input.compareReviewSummaryTone as AgentCompareReviewSummaryTone)
      : undefined,
    compareReviewSummaryDetail: VALID_COMPARE_DETAILS.includes(
      input.compareReviewSummaryDetail as AgentCompareReviewSummaryDetail
    )
      ? (input.compareReviewSummaryDetail as AgentCompareReviewSummaryDetail)
      : undefined,
    compareBenchmarkUseOutputContract:
      typeof input.compareBenchmarkUseOutputContract === "boolean" ? input.compareBenchmarkUseOutputContract : undefined,
    compareBenchmarkPreviewDiffOnly:
      typeof input.compareBenchmarkPreviewDiffOnly === "boolean" ? input.compareBenchmarkPreviewDiffOnly : undefined,
    compareIntent: VALID_COMPARE_INTENTS.includes(input.compareIntent as AgentCompareIntent)
      ? (input.compareIntent as AgentCompareIntent)
      : undefined,
    compareOutputShape: VALID_COMPARE_OUTPUT_SHAPES.includes(input.compareOutputShape as AgentCompareOutputShape)
      ? (input.compareOutputShape as AgentCompareOutputShape)
      : undefined
  };
}

export type ComparePreferenceSnapshotInput = {
  compareTargetIds: string[];
  compareBaseTargetId: string | null;
  compareReviewSummaryTone: AgentCompareReviewSummaryTone;
  compareReviewSummaryDetail: AgentCompareReviewSummaryDetail;
  compareBenchmarkUseOutputContract: boolean;
  compareBenchmarkPreviewDiffOnly: boolean;
  compareIntent: AgentCompareIntent;
  compareOutputShape: AgentCompareOutputShape;
};

export function buildStoredComparePreferences(input: ComparePreferenceSnapshotInput) {
  return {
    compareTargetIds: input.compareTargetIds,
    compareBaseTargetId: input.compareBaseTargetId || undefined,
    compareReviewSummaryTone: input.compareReviewSummaryTone,
    compareReviewSummaryDetail: input.compareReviewSummaryDetail,
    compareBenchmarkUseOutputContract: input.compareBenchmarkUseOutputContract,
    compareBenchmarkPreviewDiffOnly: input.compareBenchmarkPreviewDiffOnly,
    compareIntent: input.compareIntent,
    compareOutputShape: input.compareOutputShape
  };
}

export const buildStoredComparePreferenceSlice = buildStoredComparePreferences;

export function applyStoredComparePreferences({
  input,
  validTargetIds,
  maxCompareLanes,
  setters
}: {
  input: ComparePreferenceInput | null | undefined;
  validTargetIds: string[];
  maxCompareLanes: number;
  setters: {
    setCompareTargetIds: (value: string[]) => void;
    setCompareBaseTargetId: (value: string) => void;
    setCompareReviewSummaryTone: (value: AgentCompareReviewSummaryTone) => void;
    setCompareReviewSummaryDetail: (value: AgentCompareReviewSummaryDetail) => void;
    setCompareBenchmarkUseOutputContract: (value: boolean) => void;
    setCompareBenchmarkPreviewDiffOnly: (value: boolean) => void;
    setCompareIntent: (value: AgentCompareIntent) => void;
    setCompareOutputShape: (value: AgentCompareOutputShape) => void;
  };
}) {
  const storedComparePreferences = normalizeStoredComparePreferences(
    input,
    validTargetIds,
    maxCompareLanes
  );
  if (storedComparePreferences.compareTargetIds?.length) {
    setters.setCompareTargetIds(storedComparePreferences.compareTargetIds);
  }
  if (storedComparePreferences.compareBaseTargetId) {
    setters.setCompareBaseTargetId(storedComparePreferences.compareBaseTargetId);
  }
  if (storedComparePreferences.compareReviewSummaryTone) {
    setters.setCompareReviewSummaryTone(storedComparePreferences.compareReviewSummaryTone);
  }
  if (storedComparePreferences.compareReviewSummaryDetail) {
    setters.setCompareReviewSummaryDetail(storedComparePreferences.compareReviewSummaryDetail);
  }
  if (typeof storedComparePreferences.compareBenchmarkUseOutputContract === "boolean") {
    setters.setCompareBenchmarkUseOutputContract(storedComparePreferences.compareBenchmarkUseOutputContract);
  }
  if (typeof storedComparePreferences.compareBenchmarkPreviewDiffOnly === "boolean") {
    setters.setCompareBenchmarkPreviewDiffOnly(storedComparePreferences.compareBenchmarkPreviewDiffOnly);
  }
  if (storedComparePreferences.compareIntent) {
    setters.setCompareIntent(storedComparePreferences.compareIntent);
  }
  if (storedComparePreferences.compareOutputShape) {
    setters.setCompareOutputShape(storedComparePreferences.compareOutputShape);
  }
}
