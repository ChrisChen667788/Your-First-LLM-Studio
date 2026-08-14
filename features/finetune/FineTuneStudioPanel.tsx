"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  FineTuneEvidenceComposer,
  FineTuneRunModesComposer,
  FineTuneSetupComposer,
} from "@/features/finetune/composers";
import {
  useFineTuneEvidenceComposerProps,
  useFineTuneRunModesComposerProps,
  useFineTuneSetupComposerProps,
} from "@/features/finetune/studio-composer-adapters";
import type {
  AgentFineTuneDataset,
  AgentFineTuneDatasetQuality,
  AgentFineTuneJob,
  AgentFineTuneSourceSurface,
  AgentFineTuneUpstreamDatasetCandidate,
  AgentTarget,
} from "@/lib/agent/types";
import {
  normalizeFineTuneActionResponse,
  type FineTuneActionResponse,
} from "@/features/finetune/actions";
import {
  useFineTuneSurfaceState,
  type FineTuneJobGroupKey,
  type FineTuneLabTab,
  type FineTuneWorkspaceTab,
} from "@/features/finetune/state";
import {
  type CommunityDatasetPreset,
  type NumericRecipeFieldKey,
} from "@/features/finetune/setup-state";
import {
  type FineTuneChatFormState,
  type FineTuneDistillationFormState,
  type FineTuneEvalMetric,
  type FineTuneEvaluateFormState,
  type FineTuneExportFormState,
  type FineTuneTrainStage,
} from "@/features/finetune/run-state";
import {
  buildFineTuneRunPreviewViewModel,
  buildFineTuneTrainingPreviewViewModel,
} from "@/features/finetune/studio-derived-previews";
import { buildFineTuneTrainingArgGroups } from "@/features/finetune/training-args-view-model";
import {
  getFineTuneRecipeHelp,
  getFineTuneStudioCopy,
} from "@/features/finetune/studio-copy";
import {
  formatFineTuneDateTime as formatDateTime,
  formatFineTuneNumber as formatNumber,
  formatFineTuneSampleCount as formatSampleCount,
  formatFineTuneSignedDurationMs as formatSignedDurationMs,
  formatFineTuneSignedInteger as formatSignedInteger,
  formatFineTuneSignedNumber as formatSignedNumber,
  getFineTuneJobProgressPercent as getJobProgressPercent,
  getFineTuneJobStatusMeta as getJobStatusMeta,
  getFineTuneRunDeltaConclusionLabel as getRunDeltaConclusionLabel,
} from "@/features/finetune/studio-formatters";
import {
  type TrainingChartRangePreset,
} from "@/features/finetune/ui-cache-state";
import {
  useFineTuneStudioEvidenceViewModel,
  useFineTuneStudioRunViewModel,
  useFineTuneStudioSetupViewModel,
} from "@/features/finetune/studio-view-model-adapters";
import { useFineTuneSubmitHandlers } from "@/features/finetune/submit-handlers";
import { useFineTuneClipboardActions } from "@/features/finetune/clipboard-actions";
import { useFineTuneReportActions } from "@/features/finetune/report-actions";
import {
  useFineTuneAssetJobActions,
  useFineTuneRunJobActions,
} from "@/features/finetune/job-actions";
import { useFineTuneAdapterOrchestrationActions } from "@/features/finetune/adapter-orchestration-actions";
import { useFineTuneCommunityPresetActions } from "@/features/finetune/community-preset-actions";
import { useFineTuneTrainingArgsSnapshot } from "@/features/finetune/training-args-snapshot";
import { useFineTuneTabSubmitActions } from "@/features/finetune/tab-submit-actions";
import {
  COMMUNITY_DATASET_PRESETS,
  buildCommunityPresetDatasetSaveMetadata,
  buildDatasetCandidateImportPlan as buildCommunityDatasetCandidateImportPlan,
  getCommunityPresetBestFor,
  getCommunityPresetDescription,
  getCommunityPresetDifficulty,
  getCommunityPresetLabel,
  getCommunityPresetLicenseRiskLabel,
  getCommunityPresetModelFit,
  getCommunityPresetRecipeNotes,
  getCommunityPresetRecommendedSteps,
  getFineTuneLicenseRiskLabel,
} from "@/features/finetune/community-preset-catalog";
import { buildLoraTrainingDefaults } from "@/lib/finetune/lora-config";

export type FineTuneStudioPanelProps = {
  locale: string;
  surface?: AgentFineTuneSourceSurface;
};

export function FineTuneStudioPanel({
  locale,
  surface = "fine-tune-studio",
}: FineTuneStudioPanelProps) {
  const isEnglish = locale.startsWith("en");
  const text = useMemo(() => getFineTuneStudioCopy(isEnglish), [isEnglish]);

  const recipeHelp = useMemo(() => getFineTuneRecipeHelp(isEnglish), [isEnglish]);

  const {
    summary,
    setSummary,
    targetCatalog,
    setTargetCatalog,
    pending,
    setPending,
    message,
    setMessage,
    messageTone,
    setMessageTone,
    actionPending,
    setActionPending,
    collapsedJobGroups,
    setCollapsedJobGroups,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    activeFineTuneLabTab,
    setActiveFineTuneLabTab,
  } = useFineTuneSurfaceState();
  const {
    datasetForm,
    setDatasetForm,
    communityImportForm,
    setCommunityImportForm,
    datasetSourceMode,
    setDatasetSourceMode,
    recipeForm,
    setRecipeForm,
    selectedRecipeId,
    setSelectedRecipeId,
    datasetValidation,
    setDatasetValidation,
    datasetValidationQuality,
    setDatasetValidationQuality,
    datasetValidationQualityWarnings,
    setDatasetValidationQualityWarnings,
    datasetWatchDrafts,
    setDatasetWatchDrafts,
  } = useFineTuneStudioSetupViewModel();
  const {
    chartRangeByJobId,
    chartHoverByJobId,
    chartSmoothingByJobId,
    selectedOverlayJobIdsByJobId,
    lastReportByJobId,
    setChartRangeForJob,
    setChartHoverForJob,
    setChartSmoothingForJob,
    toggleOverlayJobForJob,
    cacheJobReport,
  } = useFineTuneStudioEvidenceViewModel();
  const {
    trainStage,
    setTrainStage,
    evaluateForm,
    setEvaluateForm,
    chatForm,
    setChatForm,
    distillationForm,
    setDistillationForm,
    exportForm,
    setExportForm,
  } = useFineTuneStudioRunViewModel();
  const { postAction, runSecondaryAction } = useFineTuneSubmitHandlers({
    surface,
    setPending,
    setMessage,
    setMessageTone,
    setActionPending,
    setSummary,
    setDatasetValidation,
    setDatasetValidationQuality,
    setDatasetValidationQualityWarnings,
    defaultSecondarySuccessMessage: text.actionOpenSuccess,
  });
  const { copyValue } = useFineTuneClipboardActions({
    copiedMessage: text.copied,
    setMessage,
    setMessageTone,
  });
  const { exportJobReport } = useFineTuneReportActions({
    postAction,
    cacheJobReport,
    copyValue,
    reportExportSuccessMessage: text.reportExportSuccess,
    reportCopySuccessMessage: text.reportCopySuccess,
  });
  const { saveTrainingArgsSnapshot, loadTrainingArgsSnapshot } =
    useFineTuneTrainingArgsSnapshot({
      recipeForm,
      trainStage,
      setRecipeForm,
      setTrainStage,
      setMessage,
      setMessageTone,
      messages: {
        saved: text.argsSaved,
        missing: text.argsMissing,
        loaded: text.argsLoaded,
      },
    });

  const getChartRangeLabel = useCallback(
    (range: TrainingChartRangePreset) => {
      switch (range) {
        case "first-300":
          return text.chartRangeFirst300;
        case "last-300":
          return text.chartRangeLast300;
        case "last-100":
          return text.chartRangeLast100;
        default:
          return text.chartRangeAll;
      }
    },
    [
      text.chartRangeAll,
      text.chartRangeFirst300,
      text.chartRangeLast100,
      text.chartRangeLast300,
    ],
  );

  const jobGroups = useMemo<
    Array<{ key: FineTuneJobGroupKey; label: string; jobs: AgentFineTuneJob[] }>
  >(() => {
    const jobs = summary?.jobs || [];
    return [
      {
        key: "active",
        label: text.jobGroupActive,
        jobs: jobs.filter(
          (job) => job.status === "queued" || job.status === "running",
        ),
      },
      {
        key: "needs-review",
        label: text.jobGroupNeedsReview,
        jobs: jobs.filter(
          (job) => job.status === "failed" || job.status === "cancelled",
        ),
      },
      {
        key: "completed",
        label: text.jobGroupCompleted,
        jobs: jobs.filter((job) => job.status === "completed"),
      },
      {
        key: "staged",
        label: text.jobGroupStaged,
        jobs: jobs.filter(
          (job) => job.status === "staged" || job.status === "draft",
        ),
      },
    ];
  }, [
    summary?.jobs,
    text.jobGroupActive,
    text.jobGroupCompleted,
    text.jobGroupNeedsReview,
    text.jobGroupStaged,
  ]);

  const activeJobCount =
    summary?.jobs.filter(
      (job) => job.status === "queued" || job.status === "running",
    ).length || 0;
  const completedJobCount =
    summary?.jobs.filter((job) => job.status === "completed").length || 0;
  const failedJobCount =
    summary?.jobs.filter(
      (job) => job.status === "failed" || job.status === "cancelled",
    ).length || 0;
  const readyAdapterCount =
    summary?.adapters.filter((adapter) => adapter.status === "ready").length ||
    0;
  const activeWorkspaceSummary =
    activeWorkspaceTab === "setup"
      ? text.setupSummary
      : activeWorkspaceTab === "runs"
        ? text.runsSummary
        : text.assetsSummary;
  const workspaceTabs = useMemo(
    () =>
      [
        {
          key: "setup" as const,
          label: text.tabSetup,
          count:
            (summary?.datasets?.length || 0) + (summary?.recipes?.length || 0),
        },
        {
          key: "runs" as const,
          label: text.tabRuns,
          count: summary?.jobs?.length || 0,
        },
        {
          key: "assets" as const,
          label: text.tabAssets,
          count:
            (summary?.localTargets?.length || 0) +
            (summary?.adapters?.length || 0),
        },
      ] satisfies Array<{
        key: FineTuneWorkspaceTab;
        label: string;
        count: number;
      }>,
    [
      summary?.adapters?.length,
      summary?.datasets?.length,
      summary?.jobs?.length,
      summary?.localTargets?.length,
      summary?.recipes?.length,
      text.tabAssets,
      text.tabRuns,
      text.tabSetup,
    ],
  );

  const loadSummary = useCallback(async () => {
    setPending(true);
    try {
      const response = await fetch("/api/finetune", {
        cache: "no-store",
      });
      const payload = normalizeFineTuneActionResponse(
        (await response.json()) as FineTuneActionResponse,
      );
      const nextSummary = payload.summary;
      if (!response.ok || !nextSummary) {
        throw new Error(payload.error || "Failed to load fine-tune summary.");
      }
      setSummary(nextSummary);
      setRecipeForm((current) => ({
        ...current,
        ...(() => {
          const nextBaseTargetId =
            current.baseTargetId || nextSummary.localTargets?.[0]?.id || "";
          if (!nextBaseTargetId || current.baseTargetId) {
            return {
              datasetId: current.datasetId || nextSummary.datasets?.[0]?.id || "",
              baseTargetId: nextBaseTargetId,
            };
          }
          const target = nextSummary.localTargets?.find(
            (entry) => entry.id === nextBaseTargetId,
          );
          const defaults = buildLoraTrainingDefaults(
            target?.modelDefault || nextBaseTargetId,
          );
          return {
            datasetId: current.datasetId || nextSummary.datasets?.[0]?.id || "",
            baseTargetId: nextBaseTargetId,
            targetModules: defaults.targetModules,
            scheduler: defaults.scheduler.id,
            warmupRatio: defaults.scheduler.warmupRatio,
            packingPolicy: defaults.packing.id,
            evalEverySteps: defaults.evalEverySteps,
            saveEverySteps: current.saveEverySteps || defaults.saveEverySteps,
            bestCheckpointMetric: defaults.bestCheckpointMetric,
            loadBestCheckpointAtEnd: defaults.loadBestCheckpointAtEnd,
          };
        })(),
      }));
      setSelectedRecipeId(
        (current) => current || nextSummary.recipes?.[0]?.id || "",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load fine-tune summary.",
      );
      setMessageTone("error");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const loadTargetCatalog = useCallback(async (strict = false) => {
    try {
      const response = await fetch("/api/agent/targets", { cache: "no-store" });
      const payload = (await response.json()) as {
        targets?: AgentTarget[];
        error?: string;
      };
      if (!response.ok || !Array.isArray(payload.targets)) {
        throw new Error(payload.error || "Failed to refresh target catalog.");
      }
      setTargetCatalog(payload.targets);
      return payload.targets;
    } catch (error) {
      if (strict) {
        throw error;
      }
      return [] as AgentTarget[];
    }
  }, []);

  useEffect(() => {
    void loadTargetCatalog();
  }, [loadTargetCatalog]);

  useEffect(() => {
    if (!targetCatalog.length) return;
    setDistillationForm((current) => ({
      ...current,
      teacherTargetId:
        current.teacherTargetId ||
        targetCatalog.find((target) => target.execution === "remote")?.id ||
        targetCatalog[0]?.id ||
        "",
    }));
  }, [targetCatalog]);

  useEffect(() => {
    if (
      !summary?.jobs?.some(
        (job) => job.status === "queued" || job.status === "running",
      )
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadSummary();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [loadSummary, summary?.jobs]);

  useEffect(() => {
    if (!summary?.datasets?.length) return;
    setDatasetWatchDrafts((current) => {
      const next = { ...current };
      summary.datasets.forEach((dataset) => {
        if (!next[dataset.id]) {
          next[dataset.id] = {
            upstreamQuery: dataset.upstreamQuery || dataset.label,
            refreshCadenceHours: dataset.refreshCadenceHours || 24,
          };
        }
      });
      return next;
    });
  }, [summary?.datasets]);

  useEffect(() => {
    if (!summary) return;
    const firstDatasetId = summary.datasets?.[0]?.id || "";
    const firstReadyAdapter = summary.adapters.find(
      (adapter) => adapter.status === "ready",
    );
    const firstAdapterPath =
      firstReadyAdapter?.bestCheckpoint?.path ||
      firstReadyAdapter?.outputDir ||
      summary.jobs.find((job) => job.status === "completed")?.outputDir ||
      "";
    const firstAdapter = firstReadyAdapter;
    setEvaluateForm((current) => ({
      ...current,
      datasetId: current.datasetId || firstDatasetId,
      checkpointPath: current.checkpointPath || firstAdapterPath,
    }));
    setChatForm((current) => ({
      ...current,
      adapterId: current.adapterId || firstAdapter?.id || "",
    }));
    setExportForm((current) => ({
      ...current,
      adapterId: current.adapterId || firstAdapter?.id || "",
      outputDir:
        current.outputDir ||
        (firstAdapter?.outputDir ? `${firstAdapter.outputDir}/export` : ""),
    }));
  }, [summary]);

  const {
    attachAdapterRuntime,
    detachAdapterRuntime,
    runAdapterBenchmarkHandoff,
    runAdapterCompareHandoff,
    runAdapterProofLoop,
  } = useFineTuneAdapterOrchestrationActions({
    locale,
    surface,
    summary,
    loadTargetCatalog,
    setSummary,
    setActionPending,
    setMessage,
    setMessageTone,
    messages: {
      runtimeAttachSuccess: text.runtimeAttachSuccess,
      runtimeDetachSuccess: text.runtimeDetachSuccess,
      handoffMissingContext: text.handoffMissingContext,
      handoffBenchmarkSuccess: text.handoffBenchmarkSuccess,
      handoffCompareSuccess: text.handoffCompareSuccess,
      proofLoopSuccess: text.proofLoopSuccess,
    },
  });

  const canSaveDataset = Boolean(
    datasetForm.label.trim() &&
    datasetForm.sourcePath.trim() &&
    datasetValidation?.ok,
  );
  const selectedRecipe =
    summary?.recipes.find((recipe) => recipe.id === selectedRecipeId) || null;
  const {
    selectedRecipeDataset,
    selectedRecipeTarget,
    estimatedTrainingSteps,
    effectiveTrainingBatch,
    estimatedTrainingSamples,
    selectedDistillationTeacher,
    distillationOutputPath,
    trainingCommandPreview,
    trainingYamlPreview,
  } = useMemo(
    () =>
      buildFineTuneTrainingPreviewViewModel({
        summary,
        targetCatalog,
        recipeForm,
        datasetForm,
        distillationForm,
        trainStage,
      }),
    [
      datasetForm,
      distillationForm,
      recipeForm,
      summary,
      targetCatalog,
      trainStage,
    ],
  );
  const trainingArgGroups = buildFineTuneTrainingArgGroups({
    datasetForm,
    effectiveTrainingBatch,
    estimatedTrainingSamples,
    estimatedTrainingSteps,
    isEnglish,
    recipeForm,
    recipeHelp,
    selectedRecipeDataset,
    selectedRecipeTarget,
    text,
    trainStage,
  });
  const {
    evaluateCheckpointOptions,
    evaluateCommandPreview,
    evaluateYamlPreview,
    selectedEvaluateAdapter,
    evaluationReadiness,
    chatAdapterCommandPreview,
    chatReadiness,
    exportAdapterCommandPreview,
    exportReadiness,
    operationHistory,
  } = useMemo(
    () =>
      buildFineTuneRunPreviewViewModel({
        summary,
        evaluateForm,
        chatForm,
        exportForm,
        locale,
        labels: {
          evalNeedsDataset: text.evalNeedsDataset,
          evalNeedsCheckpoint: text.evalNeedsCheckpoint,
          evalReady: text.evalReady,
          chatReady: text.chatReady,
          chatNeedsAdapter: text.chatNeedsAdapter,
          exportNeedsAdapter: text.exportNeedsAdapter,
          exportReady: text.exportReady,
        },
      }),
    [chatForm, evaluateForm, exportForm, locale, summary, text],
  );
  const toggleEvaluateMetric = useCallback((metric: FineTuneEvalMetric) => {
    setEvaluateForm((current) => {
      const nextMetrics = current.metrics.includes(metric)
        ? current.metrics.filter((item) => item !== metric)
        : [...current.metrics, metric];
      return {
        ...current,
        metrics: nextMetrics.length ? nextMetrics : ["loss"],
      };
    });
  }, []);
  const fineTuneLabTabs = useMemo(
    () =>
      [
        { key: "train" as const, label: text.fineTuneTrainTab },
        { key: "evaluate" as const, label: text.fineTuneEvaluateTab },
        { key: "chat" as const, label: text.fineTuneChatTab },
        { key: "export" as const, label: text.fineTuneExportTab },
      ] satisfies Array<{ key: FineTuneLabTab; label: string }>,
    [
      text.fineTuneChatTab,
      text.fineTuneEvaluateTab,
      text.fineTuneExportTab,
      text.fineTuneTrainTab,
    ],
  );
  const recipeById = useMemo(
    () =>
      new Map((summary?.recipes || []).map((recipe) => [recipe.id, recipe])),
    [summary?.recipes],
  );
  const targetById = useMemo(
    () =>
      new Map(
        (summary?.localTargets || []).map((target) => [target.id, target]),
      ),
    [summary?.localTargets],
  );
  const adapterByJobId = useMemo(
    () =>
      new Map(
        (summary?.adapters || []).map((adapter) => [adapter.jobId, adapter]),
      ),
    [summary?.adapters],
  );
  const getDatasetWatchDraft = useCallback(
    (dataset: AgentFineTuneDataset) =>
      datasetWatchDrafts[dataset.id] || {
        upstreamQuery: dataset.upstreamQuery || dataset.label,
        refreshCadenceHours: dataset.refreshCadenceHours || 24,
      },
    [datasetWatchDrafts],
  );

  const getJobSourceUrl = useCallback(
    (job: AgentFineTuneJob) => {
      const recipe = recipeById.get(job.recipeId);
      return recipe?.baseTargetId
        ? targetById.get(recipe.baseTargetId)?.sourceUrl
        : undefined;
    },
    [recipeById, targetById],
  );

  const getPresetLabel = useCallback(
    (preset: CommunityDatasetPreset) => getCommunityPresetLabel(preset, isEnglish),
    [isEnglish],
  );

  const getPresetDescription = useCallback(
    (preset: CommunityDatasetPreset) =>
      getCommunityPresetDescription(preset, isEnglish),
    [isEnglish],
  );

  const getPresetBestFor = useCallback(
    (preset: CommunityDatasetPreset) =>
      getCommunityPresetBestFor(preset, isEnglish),
    [isEnglish],
  );

  const getPresetRecommendedSteps = useCallback(
    (preset: CommunityDatasetPreset) =>
      getCommunityPresetRecommendedSteps(preset, isEnglish),
    [isEnglish],
  );

  const getPresetDifficulty = useCallback(
    (preset: CommunityDatasetPreset) =>
      getCommunityPresetDifficulty(preset, isEnglish),
    [isEnglish],
  );

  const getPresetRecipeNotes = useCallback(
    (preset: CommunityDatasetPreset) =>
      getCommunityPresetRecipeNotes(preset, isEnglish),
    [isEnglish],
  );

  const getPresetLicenseRisk = useCallback(
    (preset: CommunityDatasetPreset) =>
      getCommunityPresetLicenseRiskLabel(preset, isEnglish),
    [isEnglish],
  );

  const getPresetModelFit = useCallback(
    (preset: CommunityDatasetPreset) =>
      getCommunityPresetModelFit(preset, isEnglish),
    [isEnglish],
  );

  const formatQualityScore = useCallback((score?: number | null) => {
    return typeof score === "number" && Number.isFinite(score)
      ? Math.round(score) + "/100"
      : "--";
  }, []);

  const getLicenseRiskLabel = useCallback(
    (risk?: AgentFineTuneDatasetQuality["licenseRisk"]) =>
      getFineTuneLicenseRiskLabel(risk, isEnglish),
    [isEnglish],
  );

  const buildPresetDatasetSaveMetadata = useCallback(
    (preset: CommunityDatasetPreset) =>
      buildCommunityPresetDatasetSaveMetadata(preset, isEnglish),
    [isEnglish],
  );

  const buildDatasetCandidateImportPlan = useCallback(
    (
      dataset: AgentFineTuneDataset,
      candidate: AgentFineTuneUpstreamDatasetCandidate,
    ) =>
      buildCommunityDatasetCandidateImportPlan({
        dataset,
        candidate,
        isEnglish,
        formatDateTime,
        formatSampleCount,
      }),
    [isEnglish],
  );

  const assetJobActions = useFineTuneAssetJobActions({
    postAction,
    runSecondaryAction,
    copyValue,
    buildDatasetCandidateImportPlan,
    messages: {
      datasetWatchSave: text.datasetWatchSave,
      datasetWatchCheck: text.datasetWatchCheck,
      importPlanCopied: text.importPlanCopied,
      bestCheckpointBackfill: text.backfillBestCheckpointsSuccess,
      lifecycleExportPlan: text.lifecycleExportPlanSuccess,
      lifecycleRollbackProof: text.lifecycleRollbackProofSuccess,
    },
  });
  const runJobActions = useFineTuneRunJobActions({
    postAction,
    runSecondaryAction,
    exportJobReport,
    messages: {
      startSuccess: text.startSuccess,
      rerunSuccess: text.rerunSuccess,
      cancelSuccess: text.cancelSuccess,
    },
  });

  const {
    applyCommunityDatasetPreset,
    importCommunityDatasetSource,
    quickStartCommunityDatasetPreset,
  } = useFineTuneCommunityPresetActions({
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
    messages: {
      presetLoaded: text.presetLoaded,
      communityImportSuccess: text.communityImportSuccess,
      validated: text.validated,
      saveSuccessDataset: text.saveSuccessDataset,
      presetQuickStartMissingTarget: text.presetQuickStartMissingTarget,
      presetQuickStartSuccess: text.presetQuickStartSuccess,
    },
  });
  const {
    validateDataset,
    saveDataset,
    saveRecipe,
    stageRecipeJob,
    stageSelectedRecipeJob,
    runDistillation,
    runEvaluation,
    runChatAdapter,
    runExportAdapter,
  } = useFineTuneTabSubmitActions({
    datasetForm,
    communityDatasetPresets: COMMUNITY_DATASET_PRESETS,
    recipeForm,
    selectedRecipeId,
    distillationForm,
    distillationOutputPath,
    evaluateForm,
    selectedEvaluateAdapterId: selectedEvaluateAdapter?.id,
    chatForm,
    exportForm,
    postAction,
    runSecondaryAction,
    buildPresetDatasetSaveMetadata,
    setDatasetValidationQuality,
    setDatasetValidationQualityWarnings,
    setRecipeForm,
    setSelectedRecipeId,
    messages: {
      validated: text.validated,
      saveSuccessDataset: text.saveSuccessDataset,
      saveSuccessRecipe: text.saveSuccessRecipe,
      stageSuccess: text.stageSuccess,
      distillationRunSuccess: text.distillationRunSuccess,
      evalRunSuccess: text.evalRunSuccess,
      chatRunSuccess: text.chatRunSuccess,
      exportRunSuccess: text.exportRunSuccess,
    },
  });

  const numericRecipeFields = useMemo(
    () =>
      [
        {
          key: "sequenceLength",
          label: text.sequenceLength,
          helper: recipeHelp.sequenceLength,
          step: 1,
        },
        {
          key: "batchSize",
          label: text.batchSize,
          helper: recipeHelp.batchSize,
          step: 1,
        },
        {
          key: "epochs",
          label: text.epochs,
          helper: recipeHelp.epochs,
          step: 1,
        },
        {
          key: "learningRate",
          label: text.learningRate,
          helper: recipeHelp.learningRate,
          step: 0.00001,
        },
        {
          key: "numLayers",
          label: text.numLayers,
          helper: recipeHelp.numLayers,
          step: 1,
        },
        {
          key: "gradientAccumulationSteps",
          label: text.gradientAccumulationSteps,
          helper: recipeHelp.gradientAccumulationSteps,
          step: 1,
        },
        {
          key: "loraRank",
          label: text.loraRank,
          helper: recipeHelp.loraRank,
          step: 1,
        },
        {
          key: "loraAlpha",
          label: text.loraAlpha,
          helper: recipeHelp.loraAlpha,
          step: 1,
        },
        {
          key: "validationSplitPct",
          label: text.validationSplitPct,
          helper: recipeHelp.validationSplitPct,
          step: 1,
        },
        {
          key: "warmupRatio",
          label: text.warmupRatio,
          helper: recipeHelp.warmupRatio,
          step: 0.01,
        },
        {
          key: "evalEverySteps",
          label: text.evalEverySteps,
          helper: recipeHelp.evalEverySteps,
          step: 1,
        },
        {
          key: "saveEverySteps",
          label: text.saveEverySteps,
          helper: recipeHelp.saveEverySteps,
          step: 1,
        },
        { key: "seed", label: text.seed, helper: recipeHelp.seed, step: 1 },
      ] satisfies Array<{
        key: NumericRecipeFieldKey;
        label: string;
        helper: string;
        step: number;
      }>,
    [recipeHelp, text],
  );
  const recipeScheduleFields = numericRecipeFields.filter((field) =>
    [
      "sequenceLength",
      "batchSize",
      "epochs",
      "learningRate",
      "gradientAccumulationSteps",
      "warmupRatio",
    ].includes(field.key),
  );
  const recipeAdapterFields = numericRecipeFields.filter((field) =>
    ["numLayers", "loraRank", "loraAlpha"].includes(field.key),
  );
  const recipeEvidenceFields = numericRecipeFields.filter((field) =>
    ["validationSplitPct", "evalEverySteps", "saveEverySteps", "seed"].includes(
      field.key,
    ),
  );

  const updateRecipeNumber = useCallback(
    (key: NumericRecipeFieldKey, value: string) => {
      const nextValue = Number(value);
      setRecipeForm((current) => ({
        ...current,
        [key]: Number.isFinite(nextValue) ? nextValue : current[key],
      }));
    },
    [],
  );

  const runModesComposerProps = useFineTuneRunModesComposerProps({
    text,
    activeWorkspaceTab,
    activeFineTuneLabTab,
    fineTuneLabTabs,
    estimatedTrainingSteps,
    effectiveTrainingBatch,
    estimatedTrainingSamples,
    formatSampleCount,
    onFineTuneLabTabChange: setActiveFineTuneLabTab,
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
  });

  const setupComposerProps = useFineTuneSetupComposerProps({
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
    communityDatasetPresets: COMMUNITY_DATASET_PRESETS,
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
  });

  const evidenceComposerProps = useFineTuneEvidenceComposerProps({
    activeWorkspaceTab,
    summary,
    text,
    actionPending,
    operationHistory,
    getDatasetWatchDraft,
    setDatasetWatchDrafts,
    assetActions: assetJobActions,
    copyValue,
    formatDateTime,
    formatQualityScore,
    formatSampleCount,
    attachAdapterRuntime,
    detachAdapterRuntime,
    runAdapterBenchmarkHandoff,
    runAdapterCompareHandoff,
    runAdapterProofLoop,
    recordLifecycleExportPlan: assetJobActions.recordLifecycleExportPlan,
    runLifecycleRollbackProof: assetJobActions.runLifecycleRollbackProof,
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
    jobActions: runJobActions,
  });

  return (
    <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.94))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
            {text.eyebrow}
          </p>
          <h3 className="ui-balance mt-2 text-xl font-semibold text-white">
            {text.title}
          </h3>
          <p className="ui-pretty mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {text.subtitle}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {text.dataDir}:{" "}
            <span className="text-slate-300">{summary?.dataDir || "--"}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSummary()}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {pending ? text.loading : text.refresh}
        </button>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            messageTone === "error"
              ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="mt-5 rounded-[26px] border border-white/10 bg-slate-950/45 p-3">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
              {text.workspaceTabs}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {workspaceTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveWorkspaceTab(tab.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeWorkspaceTab === tab.key
                      ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-50"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 rounded-full bg-black/25 px-2 py-0.5 text-[10px] text-slate-300">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <p className="ui-pretty max-w-2xl rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs leading-5 text-slate-400">
            {activeWorkspaceSummary}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {[
          { label: text.activeJobs, value: activeJobCount },
          { label: text.completedJobs, value: completedJobCount },
          { label: text.failedJobs, value: failedJobCount },
          { label: text.readyAdapters, value: readyAdapterCount },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[22px] border border-white/10 bg-white/[0.035] px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <FineTuneRunModesComposer {...runModesComposerProps} />

      <FineTuneSetupComposer {...setupComposerProps} />

      <FineTuneEvidenceComposer {...evidenceComposerProps} />
    </div>
  );
}
