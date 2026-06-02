"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AgentFineTuneDatasetQuality,
  AgentFineTuneDatasetValidation,
} from "@/lib/agent/types";
import type { FineTuneActionResponse } from "./actions";
import { normalizeFineTuneSlug } from "./preview-builders";
import type {
  CommunityDatasetPreset,
  DatasetSourceMode,
  FineTuneCommunityImportFormState,
  FineTuneDatasetFormState,
  FineTuneRecipeFormState,
  PresetDatasetSaveMetadata,
} from "./setup-state";
import type { FineTuneMessageTone } from "./state";

type FineTuneStateSetter<T> = Dispatch<SetStateAction<T>>;

type FineTuneCommunityPresetActionsOptions = {
  datasetForm: FineTuneDatasetFormState;
  communityImportForm: FineTuneCommunityImportFormState;
  recipeForm: FineTuneRecipeFormState;
  postAction: (
    body: Record<string, unknown>,
    successMessage: string,
  ) => Promise<FineTuneActionResponse | null>;
  setActionPending: FineTuneStateSetter<Record<string, boolean>>;
  setDatasetSourceMode: FineTuneStateSetter<DatasetSourceMode>;
  setDatasetValidation: FineTuneStateSetter<AgentFineTuneDatasetValidation | null>;
  setDatasetValidationQuality: FineTuneStateSetter<AgentFineTuneDatasetQuality | null>;
  setDatasetValidationQualityWarnings: FineTuneStateSetter<string[]>;
  setDatasetForm: FineTuneStateSetter<FineTuneDatasetFormState>;
  setRecipeForm: FineTuneStateSetter<FineTuneRecipeFormState>;
  setSelectedRecipeId: FineTuneStateSetter<string>;
  setMessage: FineTuneStateSetter<string>;
  setMessageTone: FineTuneStateSetter<FineTuneMessageTone>;
  getPresetLabel: (preset: CommunityDatasetPreset) => string;
  getPresetRecipeNotes: (preset: CommunityDatasetPreset) => string;
  buildPresetDatasetSaveMetadata: (
    preset: CommunityDatasetPreset,
  ) => PresetDatasetSaveMetadata;
  messages: {
    presetLoaded: string;
    communityImportSuccess: string;
    validated: string;
    saveSuccessDataset: string;
    presetQuickStartMissingTarget: string;
    presetQuickStartSuccess: string;
  };
};

export function useFineTuneCommunityPresetActions({
  datasetForm,
  communityImportForm,
  recipeForm,
  postAction,
  setActionPending,
  setDatasetSourceMode,
  setDatasetValidation,
  setDatasetValidationQuality,
  setDatasetValidationQualityWarnings,
  setDatasetForm,
  setRecipeForm,
  setSelectedRecipeId,
  setMessage,
  setMessageTone,
  getPresetLabel,
  getPresetRecipeNotes,
  buildPresetDatasetSaveMetadata,
  messages,
}: FineTuneCommunityPresetActionsOptions) {
  const applyCommunityDatasetPreset = useCallback(
    (preset: CommunityDatasetPreset) => {
      const presetMetadata = buildPresetDatasetSaveMetadata(preset);
      setDatasetSourceMode("community");
      setDatasetValidation(null);
      setDatasetValidationQuality(presetMetadata.quality || null);
      setDatasetValidationQualityWarnings(presetMetadata.qualityWarnings || []);
      setDatasetForm({
        label: getPresetLabel(preset),
        sourcePath: preset.localPath,
        format: preset.format,
        upstreamQuery: preset.upstreamQuery,
        refreshCadenceHours: 24,
      });
      setRecipeForm((current) => ({
        ...current,
        epochs: preset.recommendedEpochs,
        batchSize: Math.min(current.batchSize || 4, 4),
        gradientAccumulationSteps: 1,
        validationSplitPct: 10,
        notes: getPresetRecipeNotes(preset),
      }));
      setMessage(messages.presetLoaded);
      setMessageTone("success");
    },
    [
      buildPresetDatasetSaveMetadata,
      getPresetLabel,
      getPresetRecipeNotes,
      messages.presetLoaded,
      setDatasetForm,
      setDatasetSourceMode,
      setDatasetValidation,
      setDatasetValidationQuality,
      setDatasetValidationQualityWarnings,
      setMessage,
      setMessageTone,
      setRecipeForm,
    ],
  );

  const importCommunityDatasetSource = useCallback(async () => {
    const actionKey = "dataset-community-import";
    setActionPending((current) => ({ ...current, [actionKey]: true }));
    try {
      const payload = await postAction(
        {
          action: "import-community-dataset",
          label: communityImportForm.label,
          sourceUrl: communityImportForm.sourceUrl,
          sourceLabel: communityImportForm.sourceLabel,
          sampleLimit: communityImportForm.sampleLimit,
          license: communityImportForm.license,
          format: communityImportForm.format,
          upstreamQuery:
            communityImportForm.upstreamQuery ||
            communityImportForm.sourceLabel ||
            communityImportForm.label,
          refreshCadenceHours: datasetForm.refreshCadenceHours,
        },
        messages.communityImportSuccess,
      );
      if (payload?.dataset) {
        setDatasetSourceMode("community");
        setDatasetValidation(payload.dataset.validation || null);
        setDatasetValidationQuality(payload.dataset.quality || null);
        setDatasetValidationQualityWarnings(
          payload.dataset.qualityWarnings || [],
        );
        setDatasetForm({
          label: payload.dataset.label,
          sourcePath: payload.dataset.sourcePath || "",
          format: payload.dataset.format,
          upstreamQuery:
            payload.dataset.upstreamQuery ||
            communityImportForm.upstreamQuery ||
            payload.dataset.label,
          refreshCadenceHours: payload.dataset.refreshCadenceHours || 24,
        });
        setRecipeForm((current) => ({
          ...current,
          datasetId: payload.dataset?.id || current.datasetId,
        }));
      }
    } finally {
      setActionPending((current) => ({ ...current, [actionKey]: false }));
    }
  }, [
    communityImportForm,
    datasetForm.refreshCadenceHours,
    messages.communityImportSuccess,
    postAction,
    setActionPending,
    setDatasetForm,
    setDatasetSourceMode,
    setDatasetValidation,
    setDatasetValidationQuality,
    setDatasetValidationQualityWarnings,
    setRecipeForm,
  ]);

  const quickStartCommunityDatasetPreset = useCallback(
    async (preset: CommunityDatasetPreset) => {
      const actionKey = `dataset-preset-quickstart:${preset.id}`;
      const presetLabel = getPresetLabel(preset);
      const presetNotes = getPresetRecipeNotes(preset);
      const presetMetadata = buildPresetDatasetSaveMetadata(preset);
      const nextDatasetForm = {
        label: presetLabel,
        sourcePath: preset.localPath,
        format: preset.format,
        upstreamQuery: preset.upstreamQuery,
        refreshCadenceHours: 24,
      };
      setDatasetSourceMode("community");
      setDatasetValidation(null);
      setDatasetValidationQuality(presetMetadata.quality || null);
      setDatasetValidationQualityWarnings(presetMetadata.qualityWarnings || []);
      setDatasetForm(nextDatasetForm);
      setActionPending((current) => ({ ...current, [actionKey]: true }));
      try {
        const validationPayload = await postAction(
          { action: "validate-dataset", ...nextDatasetForm },
          messages.validated,
        );
        if (!validationPayload?.validation?.ok) return;

        const datasetPayload = await postAction(
          {
            action: "save-dataset",
            ...nextDatasetForm,
            ...presetMetadata,
          },
          messages.saveSuccessDataset,
        );
        if (!datasetPayload?.summary) return;
        const savedDataset = datasetPayload.summary.datasets?.find(
          (dataset) =>
            dataset.sourcePath === nextDatasetForm.sourcePath ||
            dataset.label === nextDatasetForm.label,
        );
        if (!savedDataset) return;

        const baseTargetId =
          recipeForm.baseTargetId ||
          datasetPayload.summary.localTargets?.[0]?.id ||
          "";
        const adapterSlug = normalizeFineTuneSlug(preset.id);
        const nextRecipeForm = {
          ...recipeForm,
          label: `${presetLabel} recipe`,
          datasetId: savedDataset.id,
          baseTargetId,
          adapterName:
            recipeForm.adapterName.trim() ||
            `${adapterSlug}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
          epochs: preset.recommendedEpochs,
          batchSize: Math.min(recipeForm.batchSize || 4, 4),
          gradientAccumulationSteps: 1,
          validationSplitPct: 10,
          notes: presetNotes,
        };
        setRecipeForm(nextRecipeForm);

        if (!baseTargetId) {
          setMessage(messages.presetQuickStartMissingTarget);
          setMessageTone("error");
          return;
        }

        const recipePayload = await postAction(
          { action: "save-recipe", ...nextRecipeForm },
          messages.presetQuickStartSuccess,
        );
        const nextRecipeId = recipePayload?.summary?.recipes?.[0]?.id;
        if (typeof nextRecipeId === "string" && nextRecipeId) {
          setSelectedRecipeId(nextRecipeId);
        }
      } finally {
        setActionPending((current) => ({ ...current, [actionKey]: false }));
      }
    },
    [
      buildPresetDatasetSaveMetadata,
      getPresetLabel,
      getPresetRecipeNotes,
      messages.presetQuickStartMissingTarget,
      messages.presetQuickStartSuccess,
      messages.saveSuccessDataset,
      messages.validated,
      postAction,
      recipeForm,
      setActionPending,
      setDatasetForm,
      setDatasetSourceMode,
      setDatasetValidation,
      setDatasetValidationQuality,
      setDatasetValidationQualityWarnings,
      setMessage,
      setMessageTone,
      setRecipeForm,
      setSelectedRecipeId,
    ],
  );

  return {
    applyCommunityDatasetPreset,
    importCommunityDatasetSource,
    quickStartCommunityDatasetPreset,
  };
}
