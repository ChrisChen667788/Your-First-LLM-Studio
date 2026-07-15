"use client";

import { useCallback, useMemo } from "react";
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import type { FineTuneJobGroupKey } from "@/features/finetune/state";
import { FineTuneEvidenceComposer } from "@/components/finetune/composers/FineTuneEvidenceComposer";
import { FineTuneRunModesComposer } from "@/components/finetune/composers/FineTuneRunModesComposer";
import { FineTuneSetupComposer } from "@/components/finetune/composers/FineTuneSetupComposer";

type RunModesComposerProps = ComponentProps<typeof FineTuneRunModesComposer>;
type SetupComposerProps = ComponentProps<typeof FineTuneSetupComposer>;
type EvidenceComposerProps = ComponentProps<typeof FineTuneEvidenceComposer>;

type TrainRunProps = RunModesComposerProps["trainRunProps"];
type EvaluateRunProps = RunModesComposerProps["evaluateRunProps"];
type ChatRunProps = RunModesComposerProps["chatRunProps"];
type ExportRunProps = RunModesComposerProps["exportRunProps"];
type DatasetSetupProps = SetupComposerProps["datasetSetupProps"];
type RecipeSetupProps = SetupComposerProps["recipeSetupProps"];
type TrainSetupProps = SetupComposerProps["trainSetupProps"];
type AssetsPanelProps = EvidenceComposerProps["assetsPanelProps"];
type RunsPanelProps = EvidenceComposerProps["runsPanelProps"];

type UseFineTuneRunModesComposerPropsOptions = Pick<
  RunModesComposerProps,
  | "text"
  | "activeWorkspaceTab"
  | "activeFineTuneLabTab"
  | "fineTuneLabTabs"
  | "estimatedTrainingSteps"
  | "effectiveTrainingBatch"
  | "estimatedTrainingSamples"
  | "formatSampleCount"
  | "onFineTuneLabTabChange"
> &
  Pick<
    TrainRunProps,
    | "isEnglish"
    | "trainStage"
    | "setTrainStage"
    | "distillationForm"
    | "setDistillationForm"
    | "targetCatalog"
    | "distillationOutputPath"
    | "trainingArgGroups"
    | "trainingCommandPreview"
    | "trainingYamlPreview"
    | "selectedRecipeId"
    | "copyValue"
    | "saveTrainingArgsSnapshot"
    | "loadTrainingArgsSnapshot"
    | "runDistillation"
    | "stageSelectedRecipeJob"
  > &
  Pick<EvaluateRunProps, "actionPending"> &
  Pick<
    EvaluateRunProps,
    | "summary"
    | "evaluateForm"
    | "setEvaluateForm"
    | "evaluateCheckpointOptions"
    | "toggleEvaluateMetric"
    | "evaluationReadiness"
    | "selectedEvaluateAdapter"
    | "runEvaluation"
    | "evaluateCommandPreview"
    | "evaluateYamlPreview"
  > &
  Pick<
    ChatRunProps,
    | "chatForm"
    | "setChatForm"
    | "chatReadiness"
    | "runChatAdapter"
    | "chatAdapterCommandPreview"
  > &
  Pick<
    ExportRunProps,
    | "exportForm"
    | "setExportForm"
    | "exportReadiness"
    | "runExportAdapter"
    | "exportAdapterCommandPreview"
  >;

type UseFineTuneSetupComposerPropsOptions = Pick<
  SetupComposerProps,
  "activeWorkspaceTab" | "activeFineTuneLabTab"
> &
  DatasetSetupProps &
  RecipeSetupProps &
  TrainSetupProps;

type UseFineTuneEvidenceComposerPropsOptions = Pick<
  EvidenceComposerProps,
  "activeWorkspaceTab"
> &
  Omit<
    AssetsPanelProps,
    | "operations"
    | "onAttachAdapterRuntime"
    | "onDetachAdapterRuntime"
    | "onRunAdapterBenchmarkHandoff"
    | "onRunAdapterCompareHandoff"
    | "onRunAdapterProofLoop"
    | "onRecordLifecycleExportPlan"
    | "onRunLifecycleRollbackProof"
  > &
  Omit<RunsPanelProps, "jobs" | "onToggleJobGroup"> & {
    operationHistory: AssetsPanelProps["operations"];
    attachAdapterRuntime: AssetsPanelProps["onAttachAdapterRuntime"];
    detachAdapterRuntime: AssetsPanelProps["onDetachAdapterRuntime"];
    runAdapterBenchmarkHandoff: AssetsPanelProps["onRunAdapterBenchmarkHandoff"];
    runAdapterCompareHandoff: AssetsPanelProps["onRunAdapterCompareHandoff"];
    runAdapterProofLoop: AssetsPanelProps["onRunAdapterProofLoop"];
    recordLifecycleExportPlan: AssetsPanelProps["onRecordLifecycleExportPlan"];
    runLifecycleRollbackProof: AssetsPanelProps["onRunLifecycleRollbackProof"];
    setCollapsedJobGroups: Dispatch<
      SetStateAction<Record<FineTuneJobGroupKey, boolean>>
    >;
  };

export function useFineTuneRunModesComposerProps({
  text,
  activeWorkspaceTab,
  activeFineTuneLabTab,
  fineTuneLabTabs,
  estimatedTrainingSteps,
  effectiveTrainingBatch,
  estimatedTrainingSamples,
  formatSampleCount,
  onFineTuneLabTabChange,
  isEnglish,
  trainStage,
  setTrainStage,
  distillationForm,
  setDistillationForm,
  targetCatalog,
  actionPending,
  distillationOutputPath,
  trainingArgGroups,
  trainingCommandPreview,
  trainingYamlPreview,
  selectedRecipeId,
  copyValue,
  saveTrainingArgsSnapshot,
  loadTrainingArgsSnapshot,
  runDistillation,
  stageSelectedRecipeJob,
  summary,
  evaluateForm,
  setEvaluateForm,
  evaluateCheckpointOptions,
  toggleEvaluateMetric,
  evaluationReadiness,
  selectedEvaluateAdapter,
  runEvaluation,
  evaluateCommandPreview,
  evaluateYamlPreview,
  chatForm,
  setChatForm,
  chatReadiness,
  runChatAdapter,
  chatAdapterCommandPreview,
  exportForm,
  setExportForm,
  exportReadiness,
  runExportAdapter,
  exportAdapterCommandPreview,
}: UseFineTuneRunModesComposerPropsOptions): RunModesComposerProps {
  return useMemo(
    () => ({
      text,
      activeWorkspaceTab,
      activeFineTuneLabTab,
      fineTuneLabTabs,
      estimatedTrainingSteps,
      effectiveTrainingBatch,
      estimatedTrainingSamples,
      formatSampleCount,
      onFineTuneLabTabChange,
      trainRunProps: {
        text,
        isEnglish,
        trainStage,
        setTrainStage,
        distillationForm,
        setDistillationForm,
        targetCatalog,
        actionPending,
        distillationOutputPath,
        trainingArgGroups,
        trainingCommandPreview,
        trainingYamlPreview,
        selectedRecipeId,
        copyValue,
        saveTrainingArgsSnapshot,
        loadTrainingArgsSnapshot,
        runDistillation,
        stageSelectedRecipeJob,
      },
      evaluateRunProps: {
        text,
        isEnglish,
        summary,
        evaluateForm,
        setEvaluateForm,
        evaluateCheckpointOptions,
        toggleEvaluateMetric,
        evaluationReadiness,
        selectedEvaluateAdapter,
        actionPending,
        runEvaluation,
        evaluateCommandPreview,
        evaluateYamlPreview,
        copyValue,
      },
      chatRunProps: {
        text,
        isEnglish,
        summary,
        chatForm,
        setChatForm,
        chatReadiness,
        actionPending,
        runChatAdapter,
        chatAdapterCommandPreview,
        copyValue,
      },
      exportRunProps: {
        text,
        isEnglish,
        summary,
        exportForm,
        setExportForm,
        exportReadiness,
        actionPending,
        runExportAdapter,
        exportAdapterCommandPreview,
        copyValue,
      },
    }),
    [
      actionPending,
      activeFineTuneLabTab,
      activeWorkspaceTab,
      chatAdapterCommandPreview,
      chatForm,
      chatReadiness,
      copyValue,
      distillationForm,
      distillationOutputPath,
      effectiveTrainingBatch,
      estimatedTrainingSamples,
      estimatedTrainingSteps,
      evaluateCheckpointOptions,
      evaluateCommandPreview,
      evaluateForm,
      evaluationReadiness,
      evaluateYamlPreview,
      exportAdapterCommandPreview,
      exportForm,
      exportReadiness,
      fineTuneLabTabs,
      formatSampleCount,
      isEnglish,
      loadTrainingArgsSnapshot,
      onFineTuneLabTabChange,
      runChatAdapter,
      runDistillation,
      runEvaluation,
      runExportAdapter,
      saveTrainingArgsSnapshot,
      selectedEvaluateAdapter,
      selectedRecipeId,
      setChatForm,
      setDistillationForm,
      setEvaluateForm,
      setExportForm,
      setTrainStage,
      stageSelectedRecipeJob,
      summary,
      targetCatalog,
      text,
      toggleEvaluateMetric,
      trainStage,
      trainingArgGroups,
      trainingCommandPreview,
      trainingYamlPreview,
    ],
  );
}

export function useFineTuneSetupComposerProps({
  activeWorkspaceTab,
  activeFineTuneLabTab,
  text,
  isEnglish,
  datasetSourceMode,
  setDatasetSourceMode,
  communityImportForm,
  setCommunityImportForm,
  actionPending,
  importCommunityDatasetSource,
  communityDatasetPresets,
  getPresetLabel,
  getPresetDescription,
  getPresetBestFor,
  getPresetDifficulty,
  getPresetRecommendedSteps,
  getPresetModelFit,
  getPresetLicenseRisk,
  applyCommunityDatasetPreset,
  quickStartCommunityDatasetPreset,
  datasetForm,
  setDatasetForm,
  validateDataset,
  saveDataset,
  canSaveDataset,
  datasetValidation,
  datasetValidationQuality,
  datasetValidationQualityWarnings,
  formatSampleCount,
  formatQualityScore,
  getLicenseRiskLabel,
  summary,
  recipeForm,
  setRecipeForm,
  recipeHelp,
  recipeScheduleFields,
  recipeAdapterFields,
  recipeEvidenceFields,
  updateRecipeNumber,
  saveRecipe,
  selectedRecipeId,
  setSelectedRecipeId,
  selectedRecipe,
  stageRecipeJob,
}: UseFineTuneSetupComposerPropsOptions): SetupComposerProps {
  return useMemo(
    () => ({
      activeWorkspaceTab,
      activeFineTuneLabTab,
      datasetSetupProps: {
        text,
        isEnglish,
        datasetSourceMode,
        setDatasetSourceMode,
        communityImportForm,
        setCommunityImportForm,
        actionPending,
        importCommunityDatasetSource,
        communityDatasetPresets,
        getPresetLabel,
        getPresetDescription,
        getPresetBestFor,
        getPresetDifficulty,
        getPresetRecommendedSteps,
        getPresetModelFit,
        getPresetLicenseRisk,
        applyCommunityDatasetPreset,
        quickStartCommunityDatasetPreset,
        datasetForm,
        setDatasetForm,
        validateDataset,
        saveDataset,
        canSaveDataset,
        datasetValidation,
        datasetValidationQuality,
        datasetValidationQualityWarnings,
        formatSampleCount,
        formatQualityScore,
        getLicenseRiskLabel,
      },
      recipeSetupProps: {
        text,
        summary,
        recipeForm,
        setRecipeForm,
        recipeHelp,
        recipeScheduleFields,
        recipeAdapterFields,
        recipeEvidenceFields,
        updateRecipeNumber,
        saveRecipe,
      },
      trainSetupProps: {
        text,
        summary,
        selectedRecipeId,
        setSelectedRecipeId,
        selectedRecipe,
        stageRecipeJob,
      },
    }),
    [
      actionPending,
      activeFineTuneLabTab,
      activeWorkspaceTab,
      applyCommunityDatasetPreset,
      canSaveDataset,
      communityDatasetPresets,
      communityImportForm,
      datasetForm,
      datasetSourceMode,
      datasetValidation,
      datasetValidationQuality,
      datasetValidationQualityWarnings,
      formatQualityScore,
      formatSampleCount,
      getLicenseRiskLabel,
      getPresetBestFor,
      getPresetDescription,
      getPresetDifficulty,
      getPresetLabel,
      getPresetLicenseRisk,
      getPresetModelFit,
      getPresetRecommendedSteps,
      importCommunityDatasetSource,
      isEnglish,
      quickStartCommunityDatasetPreset,
      recipeAdapterFields,
      recipeEvidenceFields,
      recipeForm,
      recipeHelp,
      recipeScheduleFields,
      saveDataset,
      saveRecipe,
      selectedRecipe,
      selectedRecipeId,
      setCommunityImportForm,
      setDatasetForm,
      setDatasetSourceMode,
      setRecipeForm,
      setSelectedRecipeId,
      stageRecipeJob,
      summary,
      text,
      updateRecipeNumber,
      validateDataset,
    ],
  );
}

export function useFineTuneEvidenceComposerProps({
  activeWorkspaceTab,
  summary,
  text,
  actionPending,
  operationHistory,
  getDatasetWatchDraft,
  setDatasetWatchDrafts,
  assetActions,
  copyValue,
  formatDateTime,
  formatQualityScore,
  formatSampleCount,
  attachAdapterRuntime,
  detachAdapterRuntime,
  runAdapterBenchmarkHandoff,
  runAdapterCompareHandoff,
  runAdapterProofLoop,
  recordLifecycleExportPlan,
  runLifecycleRollbackProof,
  jobGroups,
  collapsedJobGroups,
  chartRangeByJobId,
  chartHoverByJobId,
  chartSmoothingByJobId,
  selectedOverlayJobIdsByJobId,
  lastReportByJobId,
  adapterByJobId,
  isEnglish,
  pending,
  formatNumber,
  formatSignedNumber,
  formatSignedDurationMs,
  formatSignedInteger,
  getJobProgressPercent,
  getJobStatusMeta,
  getJobSourceUrl,
  getRunDeltaConclusionLabel,
  setChartRangeForJob,
  setChartHoverForJob,
  setChartSmoothingForJob,
  toggleOverlayJobForJob,
  setCollapsedJobGroups,
  jobActions,
}: UseFineTuneEvidenceComposerPropsOptions): EvidenceComposerProps {
  const onToggleJobGroup = useCallback(
    (groupKey: string) => {
      const key = groupKey as FineTuneJobGroupKey;
      setCollapsedJobGroups((current) => ({
        ...current,
        [key]: !current[key],
      }));
    },
    [setCollapsedJobGroups],
  );

  return useMemo(
    () => ({
      activeWorkspaceTab,
      assetsPanelProps: {
        summary,
        text,
        actionPending,
        operations: operationHistory,
        getDatasetWatchDraft,
        setDatasetWatchDrafts,
        assetActions,
        copyValue,
        formatDateTime,
        formatQualityScore,
        formatSampleCount,
        onAttachAdapterRuntime: (adapterId) => void attachAdapterRuntime(adapterId),
        onDetachAdapterRuntime: (adapterId) => void detachAdapterRuntime(adapterId),
        onRunAdapterBenchmarkHandoff: (adapterId) =>
          void runAdapterBenchmarkHandoff(adapterId),
        onRunAdapterCompareHandoff: (adapterId) =>
          void runAdapterCompareHandoff(adapterId),
        onRunAdapterProofLoop: (adapterId) => void runAdapterProofLoop(adapterId),
        onRecordLifecycleExportPlan: (adapterId) =>
          void recordLifecycleExportPlan(adapterId),
        onRunLifecycleRollbackProof: (adapterId) =>
          void runLifecycleRollbackProof(adapterId),
      },
      runsPanelProps: {
        jobs: summary?.jobs || [],
        jobGroups,
        collapsedJobGroups,
        chartRangeByJobId,
        chartHoverByJobId,
        chartSmoothingByJobId,
        selectedOverlayJobIdsByJobId,
        lastReportByJobId,
        adapterByJobId,
        text,
        isEnglish,
        pending,
        actionPending,
        formatDateTime,
        formatNumber,
        formatSignedNumber,
        formatSignedDurationMs,
        formatSignedInteger,
        getJobProgressPercent,
        getJobStatusMeta,
        getJobSourceUrl,
        getRunDeltaConclusionLabel,
        setChartRangeForJob,
        setChartHoverForJob,
        setChartSmoothingForJob,
        toggleOverlayJobForJob,
        onToggleJobGroup,
        jobActions,
        copyValue,
        attachAdapterRuntime,
        runAdapterCompareHandoff,
        runAdapterBenchmarkHandoff,
      },
    }),
    [
      actionPending,
      activeWorkspaceTab,
      adapterByJobId,
      assetActions,
      attachAdapterRuntime,
      chartHoverByJobId,
      chartRangeByJobId,
      chartSmoothingByJobId,
      collapsedJobGroups,
      copyValue,
      detachAdapterRuntime,
      formatDateTime,
      formatNumber,
      formatQualityScore,
      formatSampleCount,
      formatSignedDurationMs,
      formatSignedInteger,
      formatSignedNumber,
      getDatasetWatchDraft,
      getJobProgressPercent,
      getJobSourceUrl,
      getJobStatusMeta,
      getRunDeltaConclusionLabel,
      isEnglish,
      jobActions,
      jobGroups,
      lastReportByJobId,
      onToggleJobGroup,
      operationHistory,
      pending,
      runAdapterBenchmarkHandoff,
      runAdapterCompareHandoff,
      runAdapterProofLoop,
      recordLifecycleExportPlan,
      runLifecycleRollbackProof,
      setChartHoverForJob,
      setChartRangeForJob,
      selectedOverlayJobIdsByJobId,
      setChartSmoothingForJob,
      setDatasetWatchDrafts,
      summary,
      text,
      toggleOverlayJobForJob,
    ],
  );
}
