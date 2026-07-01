"use client";

import { useFineTuneRunState } from "./run-state";
import { useFineTuneSetupState } from "./setup-state";
import { useFineTuneUiCacheState } from "./ui-cache-state";

type FineTuneSetupStateModel = ReturnType<typeof useFineTuneSetupState>;
type FineTuneRunStateModel = ReturnType<typeof useFineTuneRunState>;
type FineTuneEvidenceStateModel = ReturnType<typeof useFineTuneUiCacheState>;

export type FineTuneStudioSetupViewModel = FineTuneSetupStateModel & {
  dataset: {
    form: FineTuneSetupStateModel["datasetForm"];
    setForm: FineTuneSetupStateModel["setDatasetForm"];
    sourceMode: FineTuneSetupStateModel["datasetSourceMode"];
    setSourceMode: FineTuneSetupStateModel["setDatasetSourceMode"];
    validation: FineTuneSetupStateModel["datasetValidation"];
    setValidation: FineTuneSetupStateModel["setDatasetValidation"];
    quality: FineTuneSetupStateModel["datasetValidationQuality"];
    setQuality: FineTuneSetupStateModel["setDatasetValidationQuality"];
    qualityWarnings: FineTuneSetupStateModel["datasetValidationQualityWarnings"];
    setQualityWarnings: FineTuneSetupStateModel["setDatasetValidationQualityWarnings"];
    watchDrafts: FineTuneSetupStateModel["datasetWatchDrafts"];
    setWatchDrafts: FineTuneSetupStateModel["setDatasetWatchDrafts"];
  };
  communityImport: {
    form: FineTuneSetupStateModel["communityImportForm"];
    setForm: FineTuneSetupStateModel["setCommunityImportForm"];
  };
  recipe: {
    form: FineTuneSetupStateModel["recipeForm"];
    setForm: FineTuneSetupStateModel["setRecipeForm"];
    selectedId: FineTuneSetupStateModel["selectedRecipeId"];
    setSelectedId: FineTuneSetupStateModel["setSelectedRecipeId"];
  };
};

export type FineTuneStudioRunViewModel = FineTuneRunStateModel & {
  train: {
    stage: FineTuneRunStateModel["trainStage"];
    setStage: FineTuneRunStateModel["setTrainStage"];
  };
  evaluation: {
    form: FineTuneRunStateModel["evaluateForm"];
    setForm: FineTuneRunStateModel["setEvaluateForm"];
  };
  chat: {
    form: FineTuneRunStateModel["chatForm"];
    setForm: FineTuneRunStateModel["setChatForm"];
  };
  distillation: {
    form: FineTuneRunStateModel["distillationForm"];
    setForm: FineTuneRunStateModel["setDistillationForm"];
  };
  exportBundle: {
    form: FineTuneRunStateModel["exportForm"];
    setForm: FineTuneRunStateModel["setExportForm"];
  };
};

export type FineTuneStudioEvidenceViewModel = FineTuneEvidenceStateModel & {
  charts: {
    rangeByJobId: FineTuneEvidenceStateModel["chartRangeByJobId"];
    hoverByJobId: FineTuneEvidenceStateModel["chartHoverByJobId"];
    smoothingByJobId: FineTuneEvidenceStateModel["chartSmoothingByJobId"];
    selectedOverlayJobIdsByJobId: FineTuneEvidenceStateModel["selectedOverlayJobIdsByJobId"];
    setRangeForJob: FineTuneEvidenceStateModel["setChartRangeForJob"];
    setHoverForJob: FineTuneEvidenceStateModel["setChartHoverForJob"];
    setSmoothingForJob: FineTuneEvidenceStateModel["setChartSmoothingForJob"];
    toggleOverlayJobForJob: FineTuneEvidenceStateModel["toggleOverlayJobForJob"];
  };
  reports: {
    lastByJobId: FineTuneEvidenceStateModel["lastReportByJobId"];
    cacheJobReport: FineTuneEvidenceStateModel["cacheJobReport"];
  };
};

export function useFineTuneStudioSetupViewModel(): FineTuneStudioSetupViewModel {
  const state = useFineTuneSetupState();

  return {
    ...state,
    dataset: {
      form: state.datasetForm,
      setForm: state.setDatasetForm,
      sourceMode: state.datasetSourceMode,
      setSourceMode: state.setDatasetSourceMode,
      validation: state.datasetValidation,
      setValidation: state.setDatasetValidation,
      quality: state.datasetValidationQuality,
      setQuality: state.setDatasetValidationQuality,
      qualityWarnings: state.datasetValidationQualityWarnings,
      setQualityWarnings: state.setDatasetValidationQualityWarnings,
      watchDrafts: state.datasetWatchDrafts,
      setWatchDrafts: state.setDatasetWatchDrafts,
    },
    communityImport: {
      form: state.communityImportForm,
      setForm: state.setCommunityImportForm,
    },
    recipe: {
      form: state.recipeForm,
      setForm: state.setRecipeForm,
      selectedId: state.selectedRecipeId,
      setSelectedId: state.setSelectedRecipeId,
    },
  };
}

export function useFineTuneStudioRunViewModel(): FineTuneStudioRunViewModel {
  const state = useFineTuneRunState();

  return {
    ...state,
    train: {
      stage: state.trainStage,
      setStage: state.setTrainStage,
    },
    evaluation: {
      form: state.evaluateForm,
      setForm: state.setEvaluateForm,
    },
    chat: {
      form: state.chatForm,
      setForm: state.setChatForm,
    },
    distillation: {
      form: state.distillationForm,
      setForm: state.setDistillationForm,
    },
    exportBundle: {
      form: state.exportForm,
      setForm: state.setExportForm,
    },
  };
}

export function useFineTuneStudioEvidenceViewModel(): FineTuneStudioEvidenceViewModel {
  const state = useFineTuneUiCacheState();

  return {
    ...state,
    charts: {
      rangeByJobId: state.chartRangeByJobId,
      hoverByJobId: state.chartHoverByJobId,
      smoothingByJobId: state.chartSmoothingByJobId,
      selectedOverlayJobIdsByJobId: state.selectedOverlayJobIdsByJobId,
      setRangeForJob: state.setChartRangeForJob,
      setHoverForJob: state.setChartHoverForJob,
      setSmoothingForJob: state.setChartSmoothingForJob,
      toggleOverlayJobForJob: state.toggleOverlayJobForJob,
    },
    reports: {
      lastByJobId: state.lastReportByJobId,
      cacheJobReport: state.cacheJobReport,
    },
  };
}
