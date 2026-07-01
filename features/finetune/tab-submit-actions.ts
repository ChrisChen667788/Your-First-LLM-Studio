"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AgentFineTuneDatasetQuality } from "@/lib/agent/types";
import type { FineTuneActionResponse } from "./actions";
import type {
  CommunityDatasetPreset,
  FineTuneDatasetFormState,
  FineTuneRecipeFormState,
  PresetDatasetSaveMetadata,
} from "./setup-state";
import type {
  FineTuneChatFormState,
  FineTuneDistillationFormState,
  FineTuneEvaluateFormState,
  FineTuneExportFormState,
} from "./run-state";

type FineTuneStateSetter<T> = Dispatch<SetStateAction<T>>;

type FineTuneSecondaryAction = (
  actionKey: string,
  body: Record<string, unknown>,
  successMessage?: string,
) => Promise<void>;

type FineTuneTabSubmitActionsOptions = {
  datasetForm: FineTuneDatasetFormState;
  communityDatasetPresets: CommunityDatasetPreset[];
  recipeForm: FineTuneRecipeFormState;
  selectedRecipeId: string;
  distillationForm: FineTuneDistillationFormState;
  distillationOutputPath: string;
  evaluateForm: FineTuneEvaluateFormState;
  selectedEvaluateAdapterId?: string;
  chatForm: FineTuneChatFormState;
  exportForm: FineTuneExportFormState;
  postAction: (
    body: Record<string, unknown>,
    successMessage: string,
  ) => Promise<FineTuneActionResponse | null>;
  runSecondaryAction: FineTuneSecondaryAction;
  buildPresetDatasetSaveMetadata: (
    preset: CommunityDatasetPreset,
  ) => PresetDatasetSaveMetadata;
  setDatasetValidationQuality: FineTuneStateSetter<AgentFineTuneDatasetQuality | null>;
  setDatasetValidationQualityWarnings: FineTuneStateSetter<string[]>;
  setRecipeForm: FineTuneStateSetter<FineTuneRecipeFormState>;
  setSelectedRecipeId: FineTuneStateSetter<string>;
  messages: {
    validated: string;
    saveSuccessDataset: string;
    saveSuccessRecipe: string;
    stageSuccess: string;
    distillationRunSuccess: string;
    evalRunSuccess: string;
    chatRunSuccess: string;
    exportRunSuccess: string;
  };
};

function getPresetMetadataForDataset(
  presets: CommunityDatasetPreset[],
  datasetForm: FineTuneDatasetFormState,
  buildPresetDatasetSaveMetadata: (
    preset: CommunityDatasetPreset,
  ) => PresetDatasetSaveMetadata,
) {
  const matchingPreset = presets.find(
    (preset) =>
      preset.localPath === datasetForm.sourcePath &&
      preset.format === datasetForm.format,
  );
  return matchingPreset ? buildPresetDatasetSaveMetadata(matchingPreset) : null;
}

export function useFineTuneTabSubmitActions({
  datasetForm,
  communityDatasetPresets,
  recipeForm,
  selectedRecipeId,
  distillationForm,
  distillationOutputPath,
  evaluateForm,
  selectedEvaluateAdapterId,
  chatForm,
  exportForm,
  postAction,
  runSecondaryAction,
  buildPresetDatasetSaveMetadata,
  setDatasetValidationQuality,
  setDatasetValidationQualityWarnings,
  setRecipeForm,
  setSelectedRecipeId,
  messages,
}: FineTuneTabSubmitActionsOptions) {
  const validateDataset = useCallback(() => {
    const presetMetadata = getPresetMetadataForDataset(
      communityDatasetPresets,
      datasetForm,
      buildPresetDatasetSaveMetadata,
    );
    setDatasetValidationQuality(presetMetadata?.quality || null);
    setDatasetValidationQualityWarnings(presetMetadata?.qualityWarnings || []);
    return postAction(
      { action: "validate-dataset", ...datasetForm },
      messages.validated,
    );
  }, [
    buildPresetDatasetSaveMetadata,
    communityDatasetPresets,
    datasetForm,
    messages.validated,
    postAction,
    setDatasetValidationQuality,
    setDatasetValidationQualityWarnings,
  ]);

  const saveDataset = useCallback(async () => {
    const presetMetadata = getPresetMetadataForDataset(
      communityDatasetPresets,
      datasetForm,
      buildPresetDatasetSaveMetadata,
    );
    const payload = await postAction(
      {
        action: "save-dataset",
        ...datasetForm,
        ...(presetMetadata || {}),
      },
      messages.saveSuccessDataset,
    );
    setDatasetValidationQualityWarnings(
      payload?.dataset?.qualityWarnings || presetMetadata?.qualityWarnings || [],
    );
    if (payload?.summary?.datasets?.[0]) {
      setRecipeForm((current) => ({
        ...current,
        datasetId: payload.summary?.datasets?.[0]?.id || current.datasetId,
      }));
    }
    return payload;
  }, [
    buildPresetDatasetSaveMetadata,
    communityDatasetPresets,
    datasetForm,
    messages.saveSuccessDataset,
    postAction,
    setDatasetValidationQualityWarnings,
    setRecipeForm,
  ]);

  const saveRecipe = useCallback(async () => {
    const payload = await postAction(
      { action: "save-recipe", ...recipeForm },
      messages.saveSuccessRecipe,
    );
    const nextRecipeId = payload?.summary?.recipes?.[0]?.id;
    if (typeof nextRecipeId === "string" && nextRecipeId) {
      setSelectedRecipeId(nextRecipeId);
    }
    return payload;
  }, [messages.saveSuccessRecipe, postAction, recipeForm, setSelectedRecipeId]);

  const stageRecipeJob = useCallback(
    (recipeId: string) => {
      if (!recipeId) return Promise.resolve(null);
      return postAction(
        { action: "stage-job", recipeId },
        messages.stageSuccess,
      );
    },
    [messages.stageSuccess, postAction],
  );

  const stageSelectedRecipeJob = useCallback(
    () => stageRecipeJob(selectedRecipeId),
    [selectedRecipeId, stageRecipeJob],
  );

  const runDistillation = useCallback(
    () =>
      runSecondaryAction(
        "distillation-run",
        {
          action: "run-distillation",
          teacherTargetId: distillationForm.teacherTargetId,
          outputPath: distillationOutputPath,
          sampleCount: distillationForm.sampleCount,
          maxNewTokens: distillationForm.maxNewTokens,
          temperature: distillationForm.temperature,
          topP: distillationForm.topP,
          seedPrompt: distillationForm.seedPrompt,
          includeReasoningTrace: distillationForm.includeReasoningTrace,
        },
        messages.distillationRunSuccess,
      ),
    [
      distillationForm,
      distillationOutputPath,
      messages.distillationRunSuccess,
      runSecondaryAction,
    ],
  );

  const runEvaluation = useCallback(() => {
    if (!selectedEvaluateAdapterId) return Promise.resolve();
    return runSecondaryAction(
      "evaluation-run",
      {
        action: "run-evaluation",
        adapterId: selectedEvaluateAdapterId,
        datasetId: evaluateForm.datasetId,
        checkpointPath: evaluateForm.checkpointPath,
        maxSamples: evaluateForm.maxSamples,
        maxNewTokens: evaluateForm.maxNewTokens,
        temperature: evaluateForm.temperature,
        topP: evaluateForm.topP,
        metrics: evaluateForm.metrics,
        savePredictions: evaluateForm.savePredictions,
      },
      messages.evalRunSuccess,
    );
  }, [
    evaluateForm,
    messages.evalRunSuccess,
    runSecondaryAction,
    selectedEvaluateAdapterId,
  ]);

  const runChatAdapter = useCallback(
    () =>
      runSecondaryAction(
        "chat-adapter-run",
        {
          action: "run-chat-adapter",
          adapterId: chatForm.adapterId,
          role: chatForm.role,
          systemPrompt: chatForm.systemPrompt,
          prompt: chatForm.prompt,
          maxNewTokens: chatForm.maxNewTokens,
          temperature: chatForm.temperature,
          topP: chatForm.topP,
          skipSpecialTokens: chatForm.skipSpecialTokens,
          renderHtmlTags: chatForm.renderHtmlTags,
        },
        messages.chatRunSuccess,
      ),
    [chatForm, messages.chatRunSuccess, runSecondaryAction],
  );

  const runExportAdapter = useCallback(
    () =>
      runSecondaryAction(
        "export-adapter-run",
        {
          action: "run-export-adapter",
          adapterId: exportForm.adapterId,
          exportFormat: exportForm.exportFormat,
          quantization: exportForm.quantization,
          maxShardSizeGb: exportForm.maxShardSizeGb,
          outputDir: exportForm.outputDir,
          hubId: exportForm.hubId,
          includeDatasetCard: exportForm.includeDatasetCard,
          publishTarget: exportForm.publishTarget,
          licenseReviewed: exportForm.licenseReviewed,
          datasetAttributionReviewed: exportForm.datasetAttributionReviewed,
          secretScanStatus: exportForm.secretScanStatus,
          samplePrompts: exportForm.samplePrompts,
          knownLimitations: exportForm.knownLimitations,
        },
        messages.exportRunSuccess,
      ),
    [exportForm, messages.exportRunSuccess, runSecondaryAction],
  );

  return {
    validateDataset,
    saveDataset,
    saveRecipe,
    stageRecipeJob,
    stageSelectedRecipeJob,
    runDistillation,
    runEvaluation,
    runChatAdapter,
    runExportAdapter,
  };
}

export type FineTuneTabSubmitActions = ReturnType<
  typeof useFineTuneTabSubmitActions
>;

export type FineTuneDatasetSubmitActions = Pick<
  FineTuneTabSubmitActions,
  "validateDataset" | "saveDataset"
>;

export type FineTuneRunSubmitActions = Pick<
  FineTuneTabSubmitActions,
  | "stageRecipeJob"
  | "stageSelectedRecipeJob"
  | "runDistillation"
  | "runEvaluation"
  | "runChatAdapter"
  | "runExportAdapter"
>;
