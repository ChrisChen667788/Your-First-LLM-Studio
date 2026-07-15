"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  FineTuneEvidenceComposer,
  FineTuneRunModesComposer,
  FineTuneSetupComposer,
} from "@/components/finetune/composers";
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
  type FineTuneTrainingArgGroup,
  type NumericRecipeFieldKey,
} from "@/features/finetune/setup-state";
import {
  DEFAULT_DISTILLATION_FORM,
  type FineTuneChatFormState,
  type FineTuneDistillationFormState,
  type FineTuneEvalMetric,
  type FineTuneEvaluateFormState,
  type FineTuneExportFormState,
  type FineTuneTrainStage,
} from "@/features/finetune/run-state";
import {
  buildChatAdapterCommandPreview,
  buildDistillationCommandPreview,
  buildDistillationYamlPreview,
  buildEvaluateCommandPreview,
  buildEvaluateYamlPreview,
  buildExportAdapterCommandPreview,
  buildTrainingCommandPreview,
  buildTrainingYamlPreview,
  estimateFineTuneSteps,
  normalizeFineTuneSlug,
} from "@/features/finetune/preview-builders";
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

function formatDateTime(value?: string) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatNumber(value?: number | null, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function formatSignedNumber(value?: number | null, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatSignedInteger(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${Math.round(value)}`;
}

function formatSignedDurationMs(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${Math.round(value / 1000)}s`;
}

function getRunDeltaConclusionLabel(
  conclusion: string | undefined,
  isEnglish: boolean,
) {
  switch (conclusion) {
    case "improved":
      return isEnglish ? "Improved" : "整体改善";
    case "regressed":
      return isEnglish ? "Regressed" : "整体回退";
    case "mixed":
      return isEnglish ? "Mixed" : "有升有降";
    case "stable":
      return isEnglish ? "Stable" : "基本稳定";
    case "insufficient-data":
      return isEnglish ? "Insufficient data" : "数据不足";
    default:
      return "--";
  }
}

function formatSampleCount(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value.toLocaleString();
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getJobProgressPercent(job: AgentFineTuneJob) {
  if (job.status === "completed") return 100;
  if (typeof job.progress?.percent === "number")
    return clampPercent(job.progress.percent);
  const currentStep = job.progress?.currentStep;
  const totalSteps = job.progress?.totalSteps;
  if (
    typeof currentStep === "number" &&
    typeof totalSteps === "number" &&
    totalSteps > 0
  ) {
    return clampPercent((currentStep / totalSteps) * 100);
  }
  return 0;
}

function getJobStatusMeta(job: AgentFineTuneJob) {
  switch (job.status) {
    case "completed":
      return {
        label: "completed",
        dot: "bg-emerald-300",
        badge: "bg-emerald-400/10 text-emerald-100",
        bar: "from-emerald-300 to-cyan-300",
      };
    case "failed":
      return {
        label: "failed",
        dot: "bg-rose-300",
        badge: "bg-rose-400/10 text-rose-100",
        bar: "from-rose-300 to-amber-300",
      };
    case "running":
    case "queued":
      return {
        label: job.status,
        dot: "bg-cyan-300",
        badge: "bg-cyan-400/10 text-cyan-100",
        bar: "from-cyan-300 to-violet-300",
      };
    case "cancelled":
      return {
        label: "cancelled",
        dot: "bg-slate-400",
        badge: "bg-slate-400/10 text-slate-100",
        bar: "from-slate-400 to-slate-500",
      };
    default:
      return {
        label: job.status,
        dot: "bg-amber-300",
        badge: "bg-amber-400/10 text-amber-100",
        bar: "from-amber-300 to-cyan-300",
      };
  }
}

export function FineTuneStudioPanel({
  locale,
  surface = "fine-tune-studio",
}: FineTuneStudioPanelProps) {
  const isEnglish = locale.startsWith("en");
  const text = useMemo(() => {
    if (isEnglish) {
      return {
        eyebrow: "Local fine-tune lab",
        title: "Fine-tune workflow slice",
        subtitle:
          "Validate a local dataset, save a repeatable recipe, and stage a fine-tune job bundle inside the current admin workflow.",
        refresh: "Refresh",
        loading: "Loading...",
        workspaceTabs: "Workspace",
        tabSetup: "Setup",
        tabRuns: "Runs & logs",
        tabAssets: "Assets",
        fineTuneLabTabs: "Fine-tune modes",
        fineTuneTrainTab: "Train",
        fineTuneEvaluateTab: "Evaluate & Predict",
        fineTuneChatTab: "Chat Adapter",
        fineTuneExportTab: "Export",
        fineTuneTabPlanned: "Planned",
        trainConsoleTitle: "Train control console",
        trainConsoleHint:
          "Mirror the LLaMA-Factory flow: choose a training stage, inspect the exact command/YAML, then stage or run the local worker.",
        trainStage: "Training stage",
        trainStageSft: "Supervised fine-tune",
        trainStagePretrain: "Continued pre-train",
        trainStagePreference: "Preference tuning",
        trainStageDistillation: "Distillation data",
        distillationConsoleTitle: "Distillation dataset builder",
        distillationConsoleHint:
          "Use a stronger teacher target to generate starter instruction data, then validate and fine-tune the smaller local adapter.",
        distillationTeacher: "Teacher target",
        distillationOutputPath: "Output JSONL path",
        distillationSamples: "Sample count",
        distillationSeedPrompt: "Seed prompt",
        distillationIncludeReasoning: "Keep reasoning traces",
        distillationGeneration: "Teacher generation",
        distillationRun: "Generate dataset",
        distillationRunSuccess: "Distillation starter dataset generated.",
        distillationCommandCopied: "Distillation command copied.",
        distillationYamlCopied: "Distillation YAML copied.",
        commandPreview: "Command preview",
        yamlPreview: "YAML preview",
        copyCommand: "Copy command",
        copyYaml: "Copy YAML",
        saveArgs: "Save args",
        loadArgs: "Load args",
        trainingArgsMatrix: "Training args matrix",
        trainingArgsMatrixHint:
          "Grouped controls show the actual value, default recommendation, and resource impact before the job is staged.",
        trainingArgsRecommended: "Recommended",
        trainingArgsImpact: "Impact",
        trainActions: "Train actions",
        trainActionHint:
          "Save/load snapshots keep experiments repeatable; staging turns the selected recipe into a runnable local worker bundle.",
        argsSaved: "Training args snapshot saved locally.",
        argsLoaded: "Training args snapshot loaded.",
        argsMissing: "No saved training args snapshot yet.",
        commandCopied: "Training command copied.",
        yamlCopied: "Training YAML copied.",
        estimatedSteps: "Estimated steps",
        effectiveBatch: "Effective batch",
        trainSamples: "Train samples",
        recipeGroupIdentity: "Identity",
        recipeGroupSchedule: "Schedule & memory",
        recipeGroupAdapter: "Adapter capacity",
        recipeGroupEvidence: "Evidence",
        evaluatePlaceholder:
          "Evaluation will reuse the staged checkpoint path, validation dataset, generation settings, and ROUGE-style metrics.",
        evaluateConsoleTitle: "Evaluate & Predict console",
        evaluateConsoleHint:
          "Prepare the post-training evaluation before wiring the worker: choose a validation dataset, adapter output/checkpoint, generation budget, and metrics.",
        evalDataset: "Evaluation dataset",
        evalCheckpoint: "Adapter or checkpoint path",
        evalCheckpointHelper:
          "Use a ready adapter output directory or paste a checkpoint path from a completed run.",
        evalGeneration: "Generation settings",
        evalMetrics: "Metrics",
        evalMaxSamples: "Max samples",
        evalMaxNewTokens: "Max new tokens",
        evalTemperature: "Temperature",
        evalTopP: "Top-p",
        evalSavePredictions: "Save predictions",
        evalReadiness: "Evaluation readiness",
        evalReady:
          "Ready to run evaluation and write predictions, metrics, and a report.",
        evalNeedsDataset: "Select a dataset before evaluating.",
        evalNeedsCheckpoint: "Select or paste an adapter/checkpoint path.",
        evalApiPlanned:
          "Runs locally now: creates predictions.jsonl, operation manifest, and evaluation report.",
        evalRun: "Run evaluation",
        evalRunSuccess: "Evaluation operation completed.",
        evalCommandCopied: "Evaluation command copied.",
        evalYamlCopied: "Evaluation YAML copied.",
        chatPlaceholder:
          "Adapter chat will load the selected adapter into a safe local runtime and compare replies against the base model.",
        chatConsoleTitle: "Chat Adapter sandbox",
        chatConsoleHint:
          "Prepare a controlled single-turn adapter chat before wiring the live sandbox: role, prompt, generation controls, and output cleanup.",
        chatAdapter: "Adapter",
        chatRole: "Role",
        chatSystemPrompt: "System prompt",
        chatPrompt: "Test prompt",
        chatSkipSpecialTokens: "Skip special tokens",
        chatRenderHtmlTags: "Render HTML tags",
        chatReadiness: "Chat readiness",
        chatReady: "Ready to attach this adapter and run a sandbox chat.",
        chatNeedsAdapter: "Select a ready adapter before chatting.",
        chatApiPlanned:
          "Runs locally now: writes a chat transcript, manifest, and smoke report.",
        chatRun: "Run adapter chat",
        chatRunSuccess: "Adapter chat operation completed.",
        exportPlaceholder:
          "Export will package adapter files, config, metrics, report, and optional quantized artifacts for deployment.",
        exportConsoleTitle: "Adapter export wizard",
        exportConsoleHint:
          "Prepare deployment packaging with an explicit adapter, export format, quantization level, shard budget, and optional Hub metadata.",
        exportAdapter: "Adapter",
        exportFormat: "Export format",
        exportQuantization: "Quantization",
        exportShardSize: "Max shard size (GB)",
        exportOutputDir: "Export output dir",
        exportHubId: "HF Hub ID",
        exportIncludeDatasetCard: "Include dataset/model card",
        exportPublishTarget: "Publish target",
        exportSecretScanStatus: "Secret scan status",
        exportLicenseReviewed: "License reviewed",
        exportDatasetAttribution: "Dataset attribution reviewed",
        exportSamplePrompts: "Sample prompts",
        exportKnownLimitations: "Known limitations",
        exportReadiness: "Export readiness",
        exportReady:
          "Ready to package adapter metadata, model card, dataset card, and manifest.",
        exportNeedsAdapter: "Select a ready adapter before exporting.",
        exportApiPlanned:
          "Runs locally now: writes deployment cards, export manifest, and report.",
        exportRun: "Run export",
        exportRunSuccess: "Adapter export operation completed.",
        adapterCommandCopied: "Adapter command copied.",
        operationHistory: "Operation history",
        operationHistoryEmpty:
          "Evaluation, chat, export, and distillation operations will appear here.",
        operationArtifacts: "Artifacts",
        setupSummary:
          "Dataset intake, recipe parameters, and job staging stay in one guided flow.",
        runsSummary:
          "Active jobs, grouped history, loss curves, exported reports, and worker logs live here.",
        assetsSummary:
          "Validated datasets, local targets, and ready adapters are separated from the run console.",
        activeJobs: "Active jobs",
        completedJobs: "Completed jobs",
        failedJobs: "Needs review",
        readyAdapters: "Ready adapters",
        bestCheckpointCoverage: "Best checkpoint coverage",
        missingBestCheckpoints: "Missing best checkpoint",
        bestCheckpointBackfillHint:
          "Backfill historical ready adapters from validation curves or final checkpoint files so export, evaluation, and runtime attach use explicit checkpoint evidence.",
        backfillBestCheckpoints: "Backfill best checkpoints",
        backfillBestCheckpointsSuccess:
          "Best checkpoint markers refreshed for ready adapters.",
        adapterLifecycle: "Adapter lifecycle",
        lifecycleRegistry: "Lifecycle registry",
        lifecycleVariants: "Variants",
        lifecycleDiffs: "Variant diffs",
        lifecycleExportPlans: "Export plans",
        lifecycleRollbackProofs: "Rollback proofs",
        lifecycleActions: "Lifecycle actions",
        lifecycleRegistryHint:
          "Tracks adapter variants, merge/quantized export plans, and rollback-safe runtime attach evidence.",
        lifecycleVariantList: "Variant registry",
        lifecycleVariantDetail: "Variant detail",
        lifecycleNoVariants: "No adapter variants match the current filters.",
        lifecycleStatusAll: "All states",
        lifecycleStatusReady: "Ready",
        lifecycleStatusCheckpointing: "Checkpointing",
        lifecycleStatusIncomplete: "Incomplete",
        lifecycleStatusAttached: "Attached",
        lifecycleDiffAll: "All diffs",
        lifecycleDiffImproved: "Improved",
        lifecycleDiffRegressed: "Regressed",
        lifecycleDiffStable: "Stable",
        lifecycleDiffMixed: "Mixed",
        lifecycleDiffInsufficient: "No baseline",
        lifecycleExportAll: "All export formats",
        lifecycleVariantGroup: "Variant group",
        lifecycleBaseTarget: "Base target",
        lifecycleBestCheckpoint: "Best checkpoint",
        lifecycleAttachedTarget: "Attached target",
        lifecycleExportFormats: "Export formats",
        lifecycleRollbackProofCount: "Rollback proofs",
        lifecycleDiffConclusion: "Diff conclusion",
        lifecycleCheckpointDelta: "Checkpoint delta",
        lifecycleMetricDelta: "Metric delta",
        lifecycleExportDelta: "Export delta",
        lifecycleUpdatedAt: "Updated",
        recordLifecycleExportPlan: "Plan merged q8 export",
        lifecycleExportPlanSuccess: "Adapter export plan recorded.",
        runLifecycleRollbackProof: "Run rollback proof",
        lifecycleRollbackProofSuccess: "Adapter rollback proof recorded.",
        datasetTitle: "1. Dataset",
        datasetHint:
          "Point to a local JSONL dataset and run validation before saving it into the registry.",
        datasetLabel: "Dataset label",
        datasetPath: "Local dataset path",
        datasetFormat: "Dataset format",
        upstreamQuery: "Upstream dataset query",
        refreshCadence: "Refresh cadence (hours)",
        datasetValidate: "Validate",
        datasetSave: "Save dataset",
        datasetWatchSave: "Save watch",
        datasetWatchCheck: "Check upstream datasets",
        datasetSourceLocal: "Local file",
        datasetSourceCommunity: "Community presets",
        communityDatasetTitle: "Common open-source starters",
        communityDatasetHint:
          "Use a curated starter dataset now, then keep the upstream query for Hugging Face, ModelScope, or GitHub refresh checks.",
        communityImportTitle: "Import community dataset URL",
        communityImportHint:
          "Paste a direct JSON, JSONL, or CSV file URL from Hugging Face, GitHub raw, or ModelScope. First LLM Studio samples, converts, saves, and validates it as project JSONL.",
        communityImportGuardDirect: "Direct file URL only",
        communityImportGuardSchema:
          "Auto-converts messages, instruction/output, prompt/response, and CSV rows",
        communityImportGuardLimit: "Samples up to 5k rows / 8 MB",
        communityImportGuardLicense:
          "Review license and private data before training",
        communityImportLabel: "Imported dataset name",
        communityImportUrl: "Source file URL",
        communityImportSourceLabel: "Source label",
        communityImportSampleLimit: "Sample limit",
        communityImportLicense: "License note",
        communityImportFormat: "Output schema",
        communityImportAction: "Import and validate",
        communityImportSuccess: "Community dataset imported and validated.",
        loadPreset: "Load preset",
        quickStartPreset: "Quick start",
        bestFor: "Best for",
        sourcePage: "Source page",
        docsPage: "Docs",
        paperPage: "Paper",
        recommendedPlan: "Suggested run",
        difficulty: "Difficulty",
        license: "License",
        starterRows: "Rows",
        upstreamRows: "Upstream rows",
        lastUpdated: "Updated",
        candidateImportNote:
          "Candidate only: sample, convert to JSONL, dedupe, then validate before training.",
        copyImportPlan: "Copy import plan",
        importPlanCopied: "Dataset import plan copied.",
        presetLoaded: "Dataset preset loaded. Validate it before saving.",
        presetQuickStartSuccess: "Preset saved with a recommended recipe.",
        presetQuickStartMissingTarget:
          "Preset dataset was saved, but no local fine-tune target is available for recipe creation.",
        recipeTitle: "2. Recipe",
        recipeHint:
          "Keep recipe inputs explicit so compare and benchmark can reuse the exact same setup later.",
        recipeSave: "Save recipe",
        jobTitle: "3. Stage job",
        jobHint:
          "Stage a persisted bundle, then run the local MLX worker directly from this admin panel and watch logs plus loss curves come back.",
        stageJob: "Stage job bundle",
        startJob: "Start local worker",
        rerunJob: "Rerun with latest data strategy",
        cancelJob: "Cancel worker",
        datasets: "Datasets",
        recipes: "Recipes",
        jobs: "Jobs",
        adapters: "Adapters",
        warnings: "Warnings",
        errors: "Errors",
        preview: "Preview",
        localTargets: "Local fine-tune targets",
        empty: "Nothing saved yet.",
        bundlePath: "Bundle path",
        outputDir: "Output dir",
        benchmarkSuite: "Benchmark suite",
        gradientCheckpointing: "Gradient checkpointing",
        notes: "Notes",
        adapterName: "Adapter name",
        baseTarget: "Base target",
        progress: "Progress",
        workerLog: "Worker log",
        adapterArtifacts: "Adapter artifacts",
        checkpointCount: "Checkpoints",
        latestCheckpoint: "Latest checkpoint",
        trainingCurve: "Training curve",
        chartRange: "Zoom range",
        chartRangeAll: "All",
        chartRangeFirst300: "First 300",
        chartRangeLast300: "Last 300",
        chartRangeLast100: "Last 100",
        chartWindow: "Visible window",
        overlayRuns: "Run family overlay",
        overlayRunsHint:
          "Faint lines show recent runs with the same adapter, recipe/dataset, or base model family, normalized per run.",
        overlayRunTable: "Overlay summary",
        currentRun: "Current run",
        chartStep: "Step",
        chartSplitTrain: "Train",
        chartSplitValid: "Val",
        lossAxis: "relative loss",
        stepAxis: "steps (100 / tick)",
        lossDelta: "relative delta",
        rawLoss: "raw loss",
        normalizedLossHint: "normalized to each split's first point = 1.00",
        currentLoss: "Current loss",
        heartbeat: "Heartbeat",
        startedAt: "Started",
        completedAt: "Completed",
        configFile: "Config file",
        openDir: "Open dir",
        openBundle: "Open bundle",
        openSource: "Open source page",
        copyPath: "Copy path",
        sendToBenchmark: "Send to benchmark",
        sendToCompare: "Send to compare",
        runProofLoop: "Run proof loop",
        attachRuntime: "Attach runtime",
        detachRuntime: "Detach runtime",
        runtimeAttached: "Attached runtime",
        attachedAt: "Attached at",
        copied: "Copied.",
        actionOpenSuccess: "Opened in Finder.",
        saveSuccessDataset: "Dataset saved.",
        saveSuccessRecipe: "Recipe saved.",
        stageSuccess: "Fine-tune job bundle staged.",
        startSuccess: "Local fine-tune worker started.",
        rerunSuccess:
          "Fine-tune job rerun started with the latest dataset strategy.",
        cancelSuccess: "Fine-tune worker cancelled.",
        exportReport: "Export report",
        exportMarkdownReport: "Markdown report",
        exportManifestJson: "Manifest JSON",
        exportMetricsCsv: "Metrics CSV",
        latestReport: "Latest exported report",
        reportPath: "Report path",
        reportPoints: "curve points",
        reportLatestStep: "latest step",
        qualityScore: "quality score",
        licenseRisk: "license risk",
        recommendedSteps: "recommended steps",
        convertedRows: "converted rows",
        modelFit: "model fit",
        risk: "risk",
        runComparison: "Multi-run comparison",
        runsCompared: "runs compared",
        bestValLoss: "best val loss",
        latestValLoss: "latest val loss",
        runDelta: "Delta vs previous",
        previousRun: "previous run",
        deltaConclusion: "conclusion",
        trainDelta: "train latest",
        validDelta: "val latest",
        bestValidDelta: "best val",
        durationDelta: "duration",
        stepDelta: "step",
        evidenceSummary: "Evidence summary",
        evidenceTimeline: "timeline",
        evidenceCompare: "compare",
        evidenceBenchmark: "benchmark events",
        evidenceBenchmarkRuns: "benchmark runs",
        evidenceReady: "Proof evidence is attached to this report.",
        evidenceMissing:
          "No compare or benchmark evidence is linked yet. Run the proof loop before sharing this adapter.",
        copyReportPath: "Copy report path",
        openReports: "Open reports dir",
        previewReport: "Preview report",
        downloadFullBundle: "Download full bundle",
        completeBundleHint:
          "Complete bundle includes the job config, split datasets, MLX config, metrics, worker log, adapter artifacts, reports, manifest, and inventory.",
        reportExportSuccess: "Fine-tune report exported.",
        reportCopySuccess: "Fine-tune report copied.",
        handoffBenchmarkSuccess: "Adapter benchmark handoff completed.",
        handoffCompareSuccess: "Adapter compare handoff completed.",
        proofLoopSuccess:
          "Adapter proof loop completed: attach, compare, and benchmark.",
        handoffMissingContext:
          "This adapter is missing its recipe or dataset context.",
        runtimeAttachSuccess: "Adapter runtime mounted.",
        runtimeDetachSuccess: "Adapter runtime detached.",
        validated:
          "Validation complete. Review preview and warnings before saving.",
        noValidation: "Run dataset validation first.",
        recipeLabel: "Recipe label",
        sequenceLength: "Sequence length",
        batchSize: "Batch size",
        epochs: "Epochs",
        learningRate: "Learning rate",
        fineTuneMethod: "Fine-tune method",
        optimizer: "Optimizer",
        numLayers: "Trainable layers",
        gradientAccumulationSteps: "Grad accumulation",
        loraRank: "LoRA rank",
        loraAlpha: "LoRA alpha",
        validationSplitPct: "Validation split %",
        targetModules: "Target modules",
        scheduler: "Scheduler",
        warmupRatio: "Warmup ratio",
        packingPolicy: "Packing policy",
        evalEverySteps: "Eval every N steps",
        saveEverySteps: "Save every N steps",
        bestCheckpointMetric: "Best checkpoint metric",
        loadBestCheckpointAtEnd: "Load best checkpoint at end",
        applyModelDefaults: "Apply model defaults",
        recipeGroupLoraPolicy: "LoRA policy",
        seed: "Seed",
        jobGroupActive: "Active",
        jobGroupNeedsReview: "Needs review",
        jobGroupCompleted: "Completed",
        jobGroupStaged: "Staged",
        jobGroupCollapsed: "Collapsed",
        jobGroupExpanded: "Expanded",
        jobGroupRerunHint:
          "Failed or cancelled jobs can be rerun as a new job using the latest dataset preparation strategy.",
        jobGroupLatestRun: "Latest",
        rerunLatestFailed: "Rerun latest failed",
        jobNextStep: "Recommended next step",
        jobNextCompleted:
          "Attach the adapter, run Compare, then send the same evidence path to Benchmark before sharing.",
        jobNextFailed:
          "Rerun with the latest dataset strategy. The old bundle and logs stay intact for audit.",
        jobNextRunning:
          "Watch the normalized loss curve and worker log; export the report after completion.",
        jobNextStaged:
          "Start the local worker when dataset quality, recipe, and hardware budget look safe.",
        jobAdapterPending: "Adapter artifact is not ready yet.",
        dataDir: "Data dir",
      };
    }
    return {
      eyebrow: "本地微调实验台",
      title: "Fine-tune 工作流第一批切片",
      subtitle:
        "先把本地数据集校验、可复用配方和作业 bundle 接入现有后台，不脱离当前项目框架。",
      refresh: "刷新",
      loading: "加载中...",
      workspaceTabs: "工作区",
      tabSetup: "配置",
      tabRuns: "作业与日志",
      tabAssets: "资产库",
      fineTuneLabTabs: "微调模式",
      fineTuneTrainTab: "Train",
      fineTuneEvaluateTab: "Evaluate & Predict",
      fineTuneChatTab: "Chat Adapter",
      fineTuneExportTab: "Export",
      fineTuneTabPlanned: "规划中",
      trainConsoleTitle: "训练控制台",
      trainConsoleHint:
        "对齐 LLaMA-Factory 的操作流：选择训练阶段，检查命令和 YAML，再暂存或启动本地 worker。",
      trainStage: "训练阶段",
      trainStageSft: "监督微调",
      trainStagePretrain: "继续预训练",
      trainStagePreference: "偏好优化",
      trainStageDistillation: "蒸馏数据",
      distillationConsoleTitle: "蒸馏数据构建器",
      distillationConsoleHint:
        "用更强教师目标生成 starter 指令数据，再校验并微调更小的本地 adapter。",
      distillationTeacher: "教师目标",
      distillationOutputPath: "输出 JSONL 路径",
      distillationSamples: "样本数",
      distillationSeedPrompt: "种子提示词",
      distillationIncludeReasoning: "保留 reasoning trace",
      distillationGeneration: "教师生成参数",
      distillationRun: "生成数据集",
      distillationRunSuccess: "蒸馏 starter 数据集已生成。",
      distillationCommandCopied: "蒸馏命令已复制。",
      distillationYamlCopied: "蒸馏 YAML 已复制。",
      commandPreview: "命令预览",
      yamlPreview: "YAML 预览",
      copyCommand: "复制命令",
      copyYaml: "复制 YAML",
      saveArgs: "保存参数",
      loadArgs: "载入参数",
      trainingArgsMatrix: "训练参数矩阵",
      trainingArgsMatrixHint:
        "按分组展示实际值、推荐值和资源影响，暂存作业前先把关键参数看清楚。",
      trainingArgsRecommended: "推荐",
      trainingArgsImpact: "影响",
      trainActions: "训练操作",
      trainActionHint:
        "保存/载入参数保证实验可复现；暂存会把当前选中的配方生成可运行的本地 worker bundle。",
      argsSaved: "训练参数快照已保存到本地。",
      argsLoaded: "训练参数快照已载入。",
      argsMissing: "还没有保存过训练参数快照。",
      commandCopied: "训练命令已复制。",
      yamlCopied: "训练 YAML 已复制。",
      estimatedSteps: "预估 step",
      effectiveBatch: "等效 batch",
      trainSamples: "训练样本",
      recipeGroupIdentity: "身份与数据",
      recipeGroupSchedule: "调度与内存",
      recipeGroupAdapter: "Adapter 容量",
      recipeGroupEvidence: "证据链",
      evaluatePlaceholder:
        "Evaluate 会沿用已暂存 checkpoint、验证集、生成参数和 ROUGE 类指标。",
      evaluateConsoleTitle: "Evaluate & Predict 控制台",
      evaluateConsoleHint:
        "先把训练后评估配置准备好：选择验证数据集、adapter 产物或 checkpoint、生成预算和评测指标。",
      evalDataset: "评估数据集",
      evalCheckpoint: "Adapter 或 checkpoint 路径",
      evalCheckpointHelper:
        "可选择已就绪 adapter 的产物目录，也可以粘贴已完成作业里的 checkpoint 路径。",
      evalGeneration: "生成参数",
      evalMetrics: "评估指标",
      evalMaxSamples: "最大样本数",
      evalMaxNewTokens: "最大生成长度",
      evalTemperature: "温度",
      evalTopP: "Top-p",
      evalSavePredictions: "保存预测结果",
      evalReadiness: "评估就绪度",
      evalReady: "已可运行评估，并写入预测、指标和报告。",
      evalNeedsDataset: "评估前请选择数据集。",
      evalNeedsCheckpoint: "请选择或填写 adapter / checkpoint 路径。",
      evalApiPlanned:
        "现在会本地生成 predictions.jsonl、operation manifest 和评估报告。",
      evalRun: "运行评估",
      evalRunSuccess: "评估操作已完成。",
      evalCommandCopied: "评估命令已复制。",
      evalYamlCopied: "评估 YAML 已复制。",
      chatPlaceholder:
        "Chat Adapter 会把选中的 adapter 安全挂到本地运行时，并和基础模型对话对比。",
      chatConsoleTitle: "Chat Adapter 沙盒",
      chatConsoleHint:
        "先准备受控单轮 adapter 对话配置：角色、提示词、生成参数和输出清理策略，后续直接接实时沙盒。",
      chatAdapter: "Adapter",
      chatRole: "角色",
      chatSystemPrompt: "系统提示词",
      chatPrompt: "测试提示词",
      chatSkipSpecialTokens: "跳过特殊 token",
      chatRenderHtmlTags: "渲染 HTML 标签",
      chatReadiness: "对话就绪度",
      chatReady: "可挂载 adapter 并启动沙盒对话。",
      chatNeedsAdapter: "对话前请选择一个可用 adapter。",
      chatApiPlanned: "现在会本地写入 chat transcript、manifest 和冒烟报告。",
      chatRun: "运行 Adapter 对话",
      chatRunSuccess: "Adapter 对话操作已完成。",
      exportPlaceholder:
        "Export 会打包 adapter 文件、配置、指标、报告，以及可选量化产物，方便部署。",
      exportConsoleTitle: "Adapter 导出向导",
      exportConsoleHint:
        "显式选择 adapter、导出格式、量化等级、分片预算和可选 Hub 元数据，为部署打包做准备。",
      exportAdapter: "Adapter",
      exportFormat: "导出格式",
      exportQuantization: "量化等级",
      exportShardSize: "最大分片大小（GB）",
      exportOutputDir: "导出目录",
      exportHubId: "HF Hub ID",
      exportIncludeDatasetCard: "包含数据集 / 模型卡",
      exportPublishTarget: "发布目标",
      exportSecretScanStatus: "Secret scan 状态",
      exportLicenseReviewed: "许可证已复核",
      exportDatasetAttribution: "数据来源归属已复核",
      exportSamplePrompts: "样例提示词",
      exportKnownLimitations: "已知限制",
      exportReadiness: "导出就绪度",
      exportReady: "已可打包 adapter 元数据、模型卡、数据卡和 manifest。",
      exportNeedsAdapter: "导出前请选择一个可用 adapter。",
      exportApiPlanned: "现在会本地写入部署卡片、导出 manifest 和报告。",
      exportRun: "运行导出",
      exportRunSuccess: "Adapter 导出操作已完成。",
      adapterCommandCopied: "Adapter 命令已复制。",
      operationHistory: "操作记录",
      operationHistoryEmpty: "评估、对话、导出和蒸馏操作会出现在这里。",
      operationArtifacts: "产物",
      setupSummary:
        "数据接入、配方参数和作业暂存放在同一条引导式流程里，减少来回跳转。",
      runsSummary:
        "运行中作业、分组历史、loss 曲线、报告导出和 worker 日志集中在这里。",
      assetsSummary:
        "已校验数据集、本地目标和可挂载 adapter 与运行控制台分离管理。",
      activeJobs: "运行中",
      completedJobs: "已完成",
      failedJobs: "需处理",
      readyAdapters: "可挂载 adapter",
      bestCheckpointCoverage: "最佳 checkpoint 覆盖率",
      missingBestCheckpoints: "缺少最佳 checkpoint",
      bestCheckpointBackfillHint:
        "从历史验证曲线或最终 checkpoint 文件回填可用 adapter 的最佳 checkpoint 证据，让导出、评估和运行时挂载都有明确依据。",
      backfillBestCheckpoints: "回填最佳 checkpoint",
      backfillBestCheckpointsSuccess: "已刷新可用 adapter 的最佳 checkpoint 标记。",
      adapterLifecycle: "Adapter 生命周期",
      lifecycleRegistry: "生命周期注册表",
      lifecycleVariants: "变体",
      lifecycleDiffs: "变体差异",
      lifecycleExportPlans: "导出计划",
      lifecycleRollbackProofs: "回滚证据",
      lifecycleActions: "生命周期动作",
      lifecycleRegistryHint:
        "追踪 adapter 变体、merge/量化导出计划，以及可回滚的运行时挂载证据。",
      lifecycleVariantList: "变体注册表",
      lifecycleVariantDetail: "变体详情",
      lifecycleNoVariants: "当前筛选条件下没有匹配的 adapter 变体。",
      lifecycleStatusAll: "全部状态",
      lifecycleStatusReady: "可用",
      lifecycleStatusCheckpointing: "保存中",
      lifecycleStatusIncomplete: "未完成",
      lifecycleStatusAttached: "已挂载",
      lifecycleDiffAll: "全部差异",
      lifecycleDiffImproved: "有提升",
      lifecycleDiffRegressed: "有回退",
      lifecycleDiffStable: "稳定",
      lifecycleDiffMixed: "混合",
      lifecycleDiffInsufficient: "无基线",
      lifecycleExportAll: "全部导出格式",
      lifecycleVariantGroup: "变体分组",
      lifecycleBaseTarget: "基础目标",
      lifecycleBestCheckpoint: "最佳 checkpoint",
      lifecycleAttachedTarget: "挂载目标",
      lifecycleExportFormats: "导出格式",
      lifecycleRollbackProofCount: "回滚证据",
      lifecycleDiffConclusion: "差异结论",
      lifecycleCheckpointDelta: "Checkpoint 差值",
      lifecycleMetricDelta: "指标差值",
      lifecycleExportDelta: "导出差值",
      lifecycleUpdatedAt: "更新时间",
      recordLifecycleExportPlan: "规划 merged q8 导出",
      lifecycleExportPlanSuccess: "Adapter 导出计划已记录。",
      runLifecycleRollbackProof: "运行回滚证明",
      lifecycleRollbackProofSuccess: "Adapter 回滚证明已记录。",
      datasetTitle: "1. 数据集",
      datasetHint:
        "填写本地 JSONL 数据路径，先做校验，再把它保存进数据集注册表。",
      datasetLabel: "数据集名称",
      datasetPath: "本地数据路径",
      datasetFormat: "数据格式",
      upstreamQuery: "上游数据集查询词",
      refreshCadence: "刷新周期（小时）",
      datasetValidate: "校验数据集",
      datasetSave: "保存数据集",
      datasetWatchSave: "保存监听配置",
      datasetWatchCheck: "检查上游数据集",
      datasetSourceLocal: "本地文件",
      datasetSourceCommunity: "社区预设",
      communityDatasetTitle: "常用开源社区入门数据集",
      communityDatasetHint:
        "先加载一份可直接校验的 starter 数据集，同时保留 Hugging Face、魔搭或 GitHub 的上游检索词，方便后续定期更新。",
      communityImportTitle: "导入社区数据集 URL",
      communityImportHint:
        "粘贴 Hugging Face、GitHub raw 或魔搭上的 JSON / JSONL / CSV 直链。系统会抽样、转换、保存并按项目 JSONL 自动校验。",
      communityImportGuardDirect: "只支持数据文件直链",
      communityImportGuardSchema:
        "自动转换 messages、instruction/output、prompt/response 和 CSV 行",
      communityImportGuardLimit: "最多抽样 5k 行 / 8 MB",
      communityImportGuardLicense: "训练前确认许可证和隐私数据",
      communityImportLabel: "导入后的数据集名称",
      communityImportUrl: "来源文件 URL",
      communityImportSourceLabel: "来源标签",
      communityImportSampleLimit: "抽样上限",
      communityImportLicense: "许可证备注",
      communityImportFormat: "输出格式",
      communityImportAction: "导入并校验",
      communityImportSuccess: "社区数据集已导入并校验。",
      loadPreset: "加载预设",
      quickStartPreset: "快速开始",
      bestFor: "适合场景",
      sourcePage: "来源页",
      docsPage: "说明页",
      paperPage: "论文",
      recommendedPlan: "推荐跑法",
      difficulty: "难度",
      license: "许可证",
      starterRows: "样本量",
      upstreamRows: "上游样本",
      lastUpdated: "更新时间",
      candidateImportNote:
        "候选源只代表可追踪来源：训练前仍需要抽样、转成 JSONL、去重并校验。",
      copyImportPlan: "复制导入计划",
      importPlanCopied: "数据集导入计划已复制。",
      presetLoaded: "数据集预设已加载，请先校验再保存。",
      presetQuickStartSuccess: "预设数据集和推荐配方已保存。",
      presetQuickStartMissingTarget:
        "预设数据集已保存，但当前没有可用于创建配方的本地微调目标。",
      recipeTitle: "2. 配方",
      recipeHint:
        "把训练关键参数显式固化下来，后面 compare / benchmark 才能沿用同一口径。",
      recipeSave: "保存配方",
      jobTitle: "3. 作业暂存",
      jobHint:
        "先生成可落盘的 job bundle，再直接从后台启动本地 MLX worker，并回看日志和 loss 曲线。",
      stageJob: "暂存作业 bundle",
      startJob: "启动本地 worker",
      rerunJob: "按新数据策略重跑",
      cancelJob: "取消 worker",
      datasets: "数据集",
      recipes: "配方",
      jobs: "作业",
      adapters: "Adapter 产物",
      warnings: "警告",
      errors: "错误",
      preview: "预览",
      localTargets: "本地可微调目标",
      empty: "暂无记录。",
      bundlePath: "Bundle 路径",
      outputDir: "产物目录",
      benchmarkSuite: "Benchmark 套件",
      gradientCheckpointing: "梯度检查点",
      notes: "备注",
      adapterName: "Adapter 名称",
      baseTarget: "基础模型",
      progress: "进度",
      workerLog: "Worker 日志",
      adapterArtifacts: "Adapter 产物",
      checkpointCount: "Checkpoint 数量",
      latestCheckpoint: "最近 checkpoint",
      trainingCurve: "训练曲线",
      chartRange: "区间缩放",
      chartRangeAll: "全量",
      chartRangeFirst300: "前 300 轮",
      chartRangeLast300: "后 300 轮",
      chartRangeLast100: "后 100 轮",
      chartWindow: "当前视窗",
      overlayRuns: "同组 run 叠加",
      overlayRunsHint:
        "淡线表示同 adapter、同配方/数据集或同基础模型组的最近训练记录，每次 run 单独归一化。",
      overlayRunTable: "叠加摘要",
      currentRun: "当前 run",
      chartStep: "轮次",
      chartSplitTrain: "训练",
      chartSplitValid: "验证",
      lossAxis: "相对 loss",
      stepAxis: "训练轮次（每格 100）",
      lossDelta: "相对变化",
      rawLoss: "原始 loss",
      normalizedLossHint: "按每条曲线首个点归一化为 1.00",
      currentLoss: "当前损失",
      heartbeat: "心跳",
      startedAt: "开始时间",
      completedAt: "完成时间",
      configFile: "配置文件",
      openDir: "打开目录",
      openBundle: "打开 bundle",
      openSource: "打开来源页",
      copyPath: "复制路径",
      sendToBenchmark: "送到 benchmark",
      sendToCompare: "送到 compare",
      runProofLoop: "跑完整证据链",
      attachRuntime: "挂载到运行时",
      detachRuntime: "从运行时卸载",
      runtimeAttached: "已挂载运行时",
      attachedAt: "挂载时间",
      copied: "已复制。",
      actionOpenSuccess: "已在 Finder 中打开。",
      saveSuccessDataset: "数据集已保存。",
      saveSuccessRecipe: "配方已保存。",
      stageSuccess: "Fine-tune 作业 bundle 已暂存。",
      startSuccess: "本地 Fine-tune worker 已启动。",
      rerunSuccess: "已使用最新数据准备策略创建并启动新作业。",
      cancelSuccess: "Fine-tune worker 已取消。",
      exportReport: "导出报告",
      exportMarkdownReport: "Markdown 报告",
      exportManifestJson: "Manifest JSON",
      exportMetricsCsv: "指标 CSV",
      latestReport: "最近导出的报告",
      reportPath: "报告路径",
      reportPoints: "曲线点数",
      reportLatestStep: "最新轮次",
      qualityScore: "质量分",
      licenseRisk: "许可证风险",
      recommendedSteps: "推荐轮次",
      convertedRows: "转换行数",
      modelFit: "适配规模",
      risk: "风险",
      runComparison: "多 run 对比",
      runsCompared: "对比 run 数",
      bestValLoss: "最佳验证 loss",
      latestValLoss: "最新验证 loss",
      runDelta: "相对上一 run",
      previousRun: "上一 run",
      deltaConclusion: "结论",
      trainDelta: "训练最新",
      validDelta: "验证最新",
      bestValidDelta: "最佳验证",
      durationDelta: "耗时",
      stepDelta: "轮次",
      evidenceSummary: "证据摘要",
      evidenceTimeline: "时间线",
      evidenceCompare: "Compare",
      evidenceBenchmark: "Benchmark 事件",
      evidenceBenchmarkRuns: "Benchmark 运行",
      evidenceReady: "这份报告已经带上证据链。",
      evidenceMissing:
        "还没有关联 Compare 或 Benchmark 证据。分享 adapter 前建议先跑完整证据链。",
      copyReportPath: "复制报告路径",
      openReports: "打开报告目录",
      previewReport: "预览报告",
      downloadFullBundle: "下载完整 bundle",
      completeBundleHint:
        "完整 bundle 包含作业配置、切分数据集、MLX 配置、指标、worker 日志、adapter 产物、报告、manifest 和文件清单。",
      reportExportSuccess: "Fine-tune 报告已导出。",
      reportCopySuccess: "Fine-tune 报告已复制。",
      handoffBenchmarkSuccess: "Adapter benchmark handoff 已完成。",
      handoffCompareSuccess: "Adapter compare handoff 已完成。",
      proofLoopSuccess:
        "Adapter 证据链已完成：挂载、compare 和 benchmark 均已触发。",
      handoffMissingContext:
        "这个 adapter 缺少配方或数据集上下文，暂时无法 handoff。",
      runtimeAttachSuccess: "Adapter 已挂载到本地运行时。",
      runtimeDetachSuccess: "Adapter 已从本地运行时卸载。",
      validated: "数据校验完成，可以先检查样例预览和警告再保存。",
      noValidation: "请先做一次数据集校验。",
      recipeLabel: "配方名称",
      sequenceLength: "序列长度",
      batchSize: "批大小",
      epochs: "Epoch 数",
      learningRate: "学习率",
      fineTuneMethod: "微调方法",
      optimizer: "优化器",
      numLayers: "训练层数",
      gradientAccumulationSteps: "梯度累积",
      loraRank: "LoRA Rank",
      loraAlpha: "LoRA Alpha",
      validationSplitPct: "验证集占比",
      targetModules: "Target modules",
      scheduler: "学习率调度",
      warmupRatio: "Warmup 比例",
      packingPolicy: "Packing 策略",
      evalEverySteps: "每隔 N 步评估",
      saveEverySteps: "每隔 N 步保存",
      bestCheckpointMetric: "最佳 checkpoint 指标",
      loadBestCheckpointAtEnd: "完成后选用最佳 checkpoint",
      applyModelDefaults: "套用模型默认值",
      recipeGroupLoraPolicy: "LoRA 策略",
      seed: "随机种子",
      jobGroupActive: "运行中",
      jobGroupNeedsReview: "需要处理",
      jobGroupCompleted: "已完成",
      jobGroupStaged: "已暂存",
      jobGroupCollapsed: "已折叠",
      jobGroupExpanded: "已展开",
      jobGroupRerunHint:
        "失败或取消的旧作业会按最新数据准备策略创建新作业重跑，不覆盖旧日志。",
      jobGroupLatestRun: "最近",
      rerunLatestFailed: "重跑最近失败项",
      jobNextStep: "建议下一步",
      jobNextCompleted:
        "先挂载 adapter，再跑 Compare，随后沿用同一证据链送到 Benchmark，最后再分享。",
      jobNextFailed:
        "按最新数据策略重跑。旧 bundle 和日志会保留，方便追溯失败原因。",
      jobNextRunning: "观察归一化 loss 曲线和 worker 日志；完成后再导出报告。",
      jobNextStaged: "确认数据质量、配方和硬件预算安全后，启动本地 worker。",
      jobAdapterPending: "Adapter 产物还未就绪。",
      dataDir: "数据目录",
    };
  }, [isEnglish]);

  const recipeHelp = useMemo(() => {
    if (isEnglish) {
      return {
        label:
          "A reusable name for this training recipe, shown later in jobs and handoff records.",
        datasetId:
          "Choose the validated dataset that will be split into train and validation samples.",
        baseTargetId:
          "The local model that receives the adapter. Pick the smallest safe target for smoke runs.",
        adapterName:
          "Output adapter folder and runtime alias. Use a short, versioned name.",
        fineTuneMethod:
          "LoRA is the default low-memory adapter method; DoRA is experimental and heavier.",
        optimizer:
          "AdamW is the stable default for adapter fine-tuning; only change when comparing recipes.",
        sequenceLength:
          "Maximum tokens per training sample. Higher values need more memory.",
        batchSize:
          "Samples processed per step. Lower it if memory pressure rises.",
        epochs:
          "How many full passes over the dataset. Starter datasets usually need only a few epochs.",
        learningRate:
          "Update size for adapter weights. Too high can make loss unstable.",
        numLayers:
          "How many transformer layers participate in training. More layers cost more memory.",
        gradientAccumulationSteps:
          "Accumulates gradients across mini steps to simulate a larger batch.",
        loraRank:
          "Adapter capacity. Higher rank can learn more but grows adapter size and memory use.",
        loraAlpha:
          "LoRA scaling factor. Usually keep near 2x rank for a stable first pass.",
        validationSplitPct:
          "Percent of samples held out for validation so the curve can catch overfitting.",
        targetModules:
          "PEFT/MLX module names to adapt. Use model-family defaults unless you are debugging module coverage.",
        scheduler:
          "Learning-rate decay strategy recorded in the recipe and report for reproducible comparisons.",
        warmupRatio:
          "Fraction of planned steps reserved for warmup. Typical LoRA values stay between 0.02 and 0.05.",
        packingPolicy:
          "Example packing policy. Keep disabled until chat boundaries and loss masks are verified.",
        evalEverySteps:
          "Validation cadence. Use the same cadence as checkpoint saving for best-checkpoint selection.",
        saveEverySteps:
          "Checkpoint cadence. Default 100 for real LoRA runs; set 0 only for very short smoke runs.",
        bestCheckpointMetric:
          "Metric used to choose the adapter checkpoint shown in reports and handoff evidence.",
        loadBestCheckpointAtEnd:
          "Marks the selected checkpoint as the export/attach candidate when training completes.",
        seed: "Keeps data split and synthetic worker curve repeatable across runs.",
        benchmarkSuiteId:
          "Benchmark suite to attach after training so adapter results stay comparable.",
        notes:
          "Human context for why this recipe exists and what behavior it should improve.",
        gradientCheckpointing:
          "Trades compute for lower memory use. Keep enabled on Apple Silicon.",
      };
    }
    return {
      label: "这条训练配方的可复用名称，后续作业和 handoff 记录都会显示它。",
      datasetId: "选择已经校验过的数据集，训练时会自动拆成训练集和验证集。",
      baseTargetId:
        "adapter 要挂载到的本地基础模型。新手 smoke 建议先选最小安全模型。",
      adapterName: "输出 adapter 文件夹和运行时别名，建议用短名称并带版本。",
      fineTuneMethod: "LoRA 是默认低内存微调方法；DoRA 更实验，资源消耗更高。",
      optimizer:
        "AdamW 是 adapter 微调的稳定默认值，只有做配方对比时才建议修改。",
      sequenceLength: "单条训练样本最多保留的 token 数；越大越吃内存。",
      batchSize: "每一步处理的样本数；如果内存压力高，优先调小这个值。",
      epochs: "完整遍历数据集的轮数；starter 数据集一般只需要少量轮次。",
      learningRate: "adapter 权重更新幅度；过高会让 loss 抖动或发散。",
      numLayers:
        "参与训练的 Transformer 层数；层数越多，显存/共享内存压力越大。",
      gradientAccumulationSteps:
        "多次小 batch 累积梯度，用更低显存模拟更大 batch。",
      loraRank: "adapter 容量；rank 越高可学习内容越多，但文件和内存也会变大。",
      loraAlpha: "LoRA 缩放系数；首次训练通常保持在 rank 的 2 倍附近。",
      validationSplitPct: "留作验证集的样本比例，用来观察是否过拟合。",
      targetModules:
        "PEFT/MLX 要挂载 adapter 的模块名。除非在调试覆盖范围，否则建议使用模型族默认值。",
      scheduler:
        "学习率衰减策略，会写入配方和报告，方便不同实验可复现对比。",
      warmupRatio:
        "训练前段 warmup 占比；常见 LoRA 设置一般在 0.02 到 0.05 之间。",
      packingPolicy:
        "样本打包策略。聊天边界和 loss mask 没确认前，建议保持关闭。",
      evalEverySteps:
        "验证集评估间隔。建议和 checkpoint 保存间隔一致，方便选择最佳 checkpoint。",
      saveEverySteps:
        "checkpoint 保存间隔；真实 LoRA 默认 100，只有很短的 smoke 才建议设 0。",
      bestCheckpointMetric:
        "训练结束后用于选择 adapter checkpoint 的指标，会进入报告和 handoff 证据。",
      loadBestCheckpointAtEnd:
        "训练完成后把选中的 checkpoint 标记为导出/挂载候选。",
      seed: "固定数据拆分和模拟曲线，方便复现实验结果。",
      benchmarkSuiteId:
        "训练后要关联的 benchmark 套件，让 adapter 回归结果可追踪。",
      notes: "记录这条配方要解决什么行为问题，方便以后复盘。",
      gradientCheckpointing:
        "用额外计算换更低内存占用，Apple Silicon 上建议保持开启。",
    };
  }, [isEnglish]);

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
  const selectedRecipeDataset =
    summary?.datasets.find((dataset) => dataset.id === recipeForm.datasetId) ||
    null;
  const selectedRecipeTarget =
    summary?.localTargets.find(
      (target) => target.id === recipeForm.baseTargetId,
    ) || null;
  const estimatedTrainingSteps = useMemo(
    () => estimateFineTuneSteps(recipeForm, selectedRecipeDataset?.sampleCount),
    [recipeForm, selectedRecipeDataset?.sampleCount],
  );
  const effectiveTrainingBatch =
    recipeForm.batchSize * Math.max(1, recipeForm.gradientAccumulationSteps);
  const estimatedTrainingSamples =
    typeof selectedRecipeDataset?.sampleCount === "number"
      ? Math.max(
          1,
          Math.round(
            selectedRecipeDataset.sampleCount *
              (1 -
                Math.max(
                  0,
                  Math.min(0.8, recipeForm.validationSplitPct / 100),
                )),
          ),
        )
      : null;
  const selectedDistillationTeacher =
    targetCatalog.find(
      (target) => target.id === distillationForm.teacherTargetId,
    ) || null;
  const distillationOutputPath =
    distillationForm.outputPath.trim() ||
    (recipeForm.adapterName
      ? `data/fine-tune/distilled/${normalizeFineTuneSlug(recipeForm.adapterName)}.jsonl`
      : DEFAULT_DISTILLATION_FORM.outputPath);
  const trainingCommandPreview = useMemo(
    () =>
      trainStage === "distillation"
        ? buildDistillationCommandPreview({
            distillationForm,
            teacherModel: selectedDistillationTeacher?.modelDefault || "",
            outputPath: distillationOutputPath,
          })
        : buildTrainingCommandPreview({
            recipe: recipeForm,
            stage: trainStage,
            datasetPath:
              selectedRecipeDataset?.sourcePath || datasetForm.sourcePath || "",
            targetModel: selectedRecipeTarget?.modelDefault || "",
            adapterName: recipeForm.adapterName,
            estimatedSteps: estimatedTrainingSteps,
          }),
    [
      datasetForm.sourcePath,
      distillationForm,
      distillationOutputPath,
      estimatedTrainingSteps,
      recipeForm,
      selectedRecipeDataset?.sourcePath,
      selectedDistillationTeacher?.modelDefault,
      selectedRecipeTarget?.modelDefault,
      trainStage,
    ],
  );
  const trainingYamlPreview = useMemo(
    () =>
      trainStage === "distillation"
        ? buildDistillationYamlPreview({
            distillationForm,
            teacherLabel: selectedDistillationTeacher?.label || "",
            teacherModel: selectedDistillationTeacher?.modelDefault || "",
            outputPath: distillationOutputPath,
          })
        : buildTrainingYamlPreview({
            recipe: recipeForm,
            stage: trainStage,
            datasetPath:
              selectedRecipeDataset?.sourcePath || datasetForm.sourcePath || "",
            datasetLabel:
              selectedRecipeDataset?.label ||
              datasetForm.label ||
              recipeForm.datasetId,
            targetModel: selectedRecipeTarget?.modelDefault || "",
            adapterName: recipeForm.adapterName,
            estimatedSteps: estimatedTrainingSteps,
          }),
    [
      datasetForm.label,
      datasetForm.sourcePath,
      distillationForm,
      distillationOutputPath,
      estimatedTrainingSteps,
      recipeForm,
      selectedRecipeDataset?.label,
      selectedRecipeDataset?.sourcePath,
      selectedDistillationTeacher?.label,
      selectedDistillationTeacher?.modelDefault,
      selectedRecipeTarget?.modelDefault,
      trainStage,
    ],
  );
  const trainingArgGroups = useMemo<FineTuneTrainingArgGroup[]>(() => {
    const contextValue = (tokens?: number | null) =>
      typeof tokens === "number" && Number.isFinite(tokens)
        ? `${Math.round(tokens / 1024)}K`
        : "--";
    const recommendedContext = selectedRecipeTarget?.recommendedContextWindow
      ? contextValue(selectedRecipeTarget.recommendedContextWindow)
      : isEnglish
        ? "8K starter, 16K after memory check"
        : "新手先 8K，确认内存后再 16K";
    const datasetRows = formatSampleCount(selectedRecipeDataset?.sampleCount);
    const adapterCapacity = `${recipeForm.fineTuneMethod.toUpperCase()} r${recipeForm.loraRank} / alpha ${recipeForm.loraAlpha}`;
    const checkpointCadence =
      recipeForm.saveEverySteps > 0
        ? `${recipeForm.saveEverySteps} steps`
        : isEnglish
          ? "final only"
          : "仅最终产物";

    return [
      {
        label: text.recipeGroupIdentity,
        items: [
          {
            label: text.trainStage,
            value: trainStage,
            helper: isEnglish
              ? "Written into the job bundle and report metadata."
              : "会写入作业 bundle 和报告元数据。",
            recommended: text.trainStageSft,
            impact: isEnglish
              ? "Defines downstream command mode."
              : "决定后续命令和评估口径。",
          },
          {
            label: text.datasets,
            value:
              selectedRecipeDataset?.label ||
              datasetForm.label ||
              recipeForm.datasetId ||
              "--",
            helper: recipeHelp.datasetId,
            recommended: isEnglish
              ? "Validated JSONL, sampled before long runs"
              : "已校验 JSONL，长轮次前先抽样",
            impact: isEnglish
              ? `${datasetRows} rows available`
              : `可用样本 ${datasetRows}`,
          },
          {
            label: text.baseTarget,
            value:
              selectedRecipeTarget?.label ||
              selectedRecipeTarget?.modelDefault ||
              recipeForm.baseTargetId ||
              "--",
            helper: recipeHelp.baseTargetId,
            recommended: isEnglish
              ? "Smallest safe local target first"
              : "优先选择最小安全本地模型",
            impact: selectedRecipeTarget?.parameterScale || "--",
          },
          {
            label: text.adapterName,
            value: recipeForm.adapterName || "--",
            helper: recipeHelp.adapterName,
            recommended: isEnglish
              ? "Short, versioned, behavior-specific"
              : "短名称、带版本、体现行为目标",
            impact: isEnglish ? "Controls output folder" : "决定产物目录名",
          },
        ],
      },
      {
        label: text.recipeGroupSchedule,
        items: [
          {
            label: text.sequenceLength,
            value: contextValue(recipeForm.sequenceLength),
            helper: recipeHelp.sequenceLength,
            recommended: recommendedContext,
            impact: isEnglish
              ? "Higher context increases memory pressure."
              : "上下文越长，内存压力越高。",
          },
          {
            label: text.effectiveBatch,
            value: String(effectiveTrainingBatch),
            helper: recipeHelp.gradientAccumulationSteps,
            recommended: isEnglish
              ? "1-4 on memory-tight Macs"
              : "内存紧张时建议 1-4",
            impact: `${text.batchSize} ${recipeForm.batchSize} x ${text.gradientAccumulationSteps} ${recipeForm.gradientAccumulationSteps}`,
          },
          {
            label: text.estimatedSteps,
            value: formatSampleCount(estimatedTrainingSteps),
            helper: recipeHelp.epochs,
            recommended: isEnglish
              ? "Smoke 100-300, longer 800-1500"
              : "冒烟 100-300，长轮次 800-1500",
            impact:
              estimatedTrainingSamples !== null
                ? `${text.trainSamples}: ${formatSampleCount(estimatedTrainingSamples)}`
                : "--",
          },
          {
            label: text.learningRate,
            value: String(recipeForm.learningRate),
            helper: recipeHelp.learningRate,
            recommended: "2e-4 LoRA / 5e-5 cautious",
            impact: isEnglish
              ? "Too high can spike loss."
              : "过高容易让 loss 抖动。",
          },
          {
            label: text.epochs,
            value: String(recipeForm.epochs),
            helper: recipeHelp.epochs,
            recommended: isEnglish
              ? "1-3 starter passes"
              : "starter 建议 1-3 轮",
            impact: isEnglish
              ? "More passes raise overfit risk."
              : "轮次越多越需要防过拟合。",
          },
        ],
      },
      {
        label: text.recipeGroupAdapter,
        items: [
          {
            label: text.fineTuneMethod,
            value: recipeForm.fineTuneMethod.toUpperCase(),
            helper: recipeHelp.fineTuneMethod,
            recommended: "LoRA",
            impact: isEnglish
              ? "DoRA is heavier and experimental."
              : "DoRA 更重且更实验。",
          },
          {
            label: `${text.loraRank} / ${text.loraAlpha}`,
            value: adapterCapacity,
            helper: `${recipeHelp.loraRank} ${recipeHelp.loraAlpha}`,
            recommended: "r16 / alpha32",
            impact: isEnglish
              ? "Higher rank grows adapter size."
              : "rank 越高 adapter 越大。",
          },
          {
            label: text.targetModules,
            value: recipeForm.targetModules.join(", ") || "--",
            helper: recipeHelp.targetModules,
            recommended: isEnglish
              ? "Model-family default"
              : "模型族默认值",
            impact: isEnglish
              ? "Controls adapter coverage."
              : "决定 adapter 覆盖范围。",
          },
          {
            label: text.numLayers,
            value: String(recipeForm.numLayers),
            helper: recipeHelp.numLayers,
            recommended: isEnglish
              ? "8-16 local starter"
              : "本地 starter 建议 8-16",
            impact: isEnglish
              ? "More layers cost memory and time."
              : "层数越多越耗内存和时间。",
          },
          {
            label: text.optimizer,
            value: recipeForm.optimizer.toUpperCase(),
            helper: recipeHelp.optimizer,
            recommended: "AdamW",
            impact: isEnglish
              ? "Keep stable unless comparing recipes."
              : "非配方对比不建议频繁改。",
          },
          {
            label: text.scheduler,
            value: `${recipeForm.scheduler} / ${recipeForm.warmupRatio}`,
            helper: `${recipeHelp.scheduler} ${recipeHelp.warmupRatio}`,
            recommended: "cosine / 0.03",
            impact: isEnglish
              ? "Stabilizes longer local runs."
              : "让长轮次训练更稳定。",
          },
          {
            label: text.packingPolicy,
            value: recipeForm.packingPolicy,
            helper: recipeHelp.packingPolicy,
            recommended: "disabled",
            impact: isEnglish
              ? "Avoids boundary bugs until masks are verified."
              : "边界和 mask 确认前避免引入噪音。",
          },
          {
            label: text.gradientCheckpointing,
            value: recipeForm.gradientCheckpointing
              ? isEnglish
                ? "Enabled"
                : "开启"
              : isEnglish
                ? "Disabled"
                : "关闭",
            helper: recipeHelp.gradientCheckpointing,
            recommended: isEnglish
              ? "Enabled on Apple Silicon"
              : "Apple Silicon 建议开启",
            impact: isEnglish
              ? "Saves memory, costs extra compute."
              : "省内存，但会增加计算。",
          },
        ],
      },
      {
        label: text.recipeGroupEvidence,
        items: [
          {
            label: text.validationSplitPct,
            value: `${recipeForm.validationSplitPct}%`,
            helper: recipeHelp.validationSplitPct,
            recommended: "10%",
            impact: isEnglish
              ? "Required for train/val curve."
              : "用于生成训练/验证曲线。",
          },
          {
            label: text.evalEverySteps,
            value: `${recipeForm.evalEverySteps} steps`,
            helper: recipeHelp.evalEverySteps,
            recommended: isEnglish
              ? "Match save cadence"
              : "与保存间隔一致",
            impact: isEnglish
              ? "Feeds best-checkpoint selection."
              : "用于选择最佳 checkpoint。",
          },
          {
            label: text.saveEverySteps,
            value: checkpointCadence,
            helper: recipeHelp.saveEverySteps,
            recommended: isEnglish
              ? "100-200 for long runs"
              : "长轮次建议 100-200",
            impact: isEnglish
              ? "More checkpoints improve recovery."
              : "checkpoint 越多越便于恢复。",
          },
          {
            label: text.bestCheckpointMetric,
            value: recipeForm.bestCheckpointMetric,
            helper: recipeHelp.bestCheckpointMetric,
            recommended: "eval_loss",
            impact: recipeForm.loadBestCheckpointAtEnd
              ? isEnglish
                ? "Selected checkpoint becomes handoff candidate."
                : "选中 checkpoint 会成为 handoff 候选。"
              : isEnglish
                ? "Reported but not auto-selected for handoff."
                : "只进入报告，不自动作为 handoff 候选。",
          },
          {
            label: text.seed,
            value: String(recipeForm.seed),
            helper: recipeHelp.seed,
            recommended: "42",
            impact: isEnglish ? "Keeps runs reproducible." : "保证实验可复现。",
          },
          {
            label: text.benchmarkSuite,
            value: recipeForm.benchmarkSuiteId || "--",
            helper: recipeHelp.benchmarkSuiteId,
            recommended: "milestone-formal",
            impact: isEnglish
              ? "Links adapter to release evidence."
              : "把 adapter 串到发布证据链。",
          },
        ],
      },
    ];
  }, [
    datasetForm.label,
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
  ]);
  const selectedEvaluateDataset =
    summary?.datasets.find(
      (dataset) => dataset.id === evaluateForm.datasetId,
    ) || null;
  const evaluateCheckpointOptions = useMemo(() => {
    const options = new Map<string, string>();
    (summary?.adapters || []).forEach((adapter) => {
      if (adapter.bestCheckpoint?.path) {
        options.set(
          adapter.bestCheckpoint.path,
          `${adapter.adapterName} · best ${adapter.bestCheckpoint.metric} @ ${adapter.bestCheckpoint.step}`,
        );
      }
      if (adapter.outputDir) {
        options.set(
          adapter.outputDir,
          `${adapter.adapterName} · ${adapter.status}`,
        );
      }
    });
    (summary?.jobs || []).forEach((job) => {
      if (job.outputDir) {
        options.set(job.outputDir, `${job.adapterName} · ${job.status}`);
      }
    });
    return Array.from(options, ([pathValue, label]) => ({
      path: pathValue,
      label,
    }));
  }, [summary?.adapters, summary?.jobs]);
  const evaluateCommandPreview = useMemo(
    () =>
      buildEvaluateCommandPreview({
        checkpointPath: evaluateForm.checkpointPath,
        datasetPath: selectedEvaluateDataset?.sourcePath || "",
        evaluateForm,
      }),
    [evaluateForm, selectedEvaluateDataset?.sourcePath],
  );
  const evaluateYamlPreview = useMemo(
    () =>
      buildEvaluateYamlPreview({
        checkpointPath: evaluateForm.checkpointPath,
        datasetPath: selectedEvaluateDataset?.sourcePath || "",
        datasetLabel: selectedEvaluateDataset?.label || "",
        evaluateForm,
      }),
    [
      evaluateForm,
      selectedEvaluateDataset?.label,
      selectedEvaluateDataset?.sourcePath,
    ],
  );
  const selectedEvaluateAdapter =
    summary?.adapters.find(
      (adapter) => adapter.outputDir === evaluateForm.checkpointPath,
    ) ||
    summary?.adapters.find((adapter) => adapter.status === "ready") ||
    null;
  const evaluationReadiness = !evaluateForm.datasetId
    ? text.evalNeedsDataset
    : !evaluateForm.checkpointPath.trim()
      ? text.evalNeedsCheckpoint
      : text.evalReady;
  const selectedChatAdapter =
    summary?.adapters.find((adapter) => adapter.id === chatForm.adapterId) ||
    null;
  const selectedExportAdapter =
    summary?.adapters.find((adapter) => adapter.id === exportForm.adapterId) ||
    null;
  const chatAdapterCommandPreview = useMemo(
    () =>
      buildChatAdapterCommandPreview({
        adapterPath: selectedChatAdapter?.outputDir || "",
        chatForm,
      }),
    [chatForm, selectedChatAdapter?.outputDir],
  );
  const exportAdapterCommandPreview = useMemo(
    () =>
      buildExportAdapterCommandPreview({
        adapterPath: selectedExportAdapter?.outputDir || "",
        exportForm,
      }),
    [exportForm, selectedExportAdapter?.outputDir],
  );
  const chatReadiness = chatForm.adapterId
    ? text.chatReady
    : text.chatNeedsAdapter;
  const exportChecklistReady =
    exportForm.licenseReviewed &&
    exportForm.datasetAttributionReviewed &&
    exportForm.secretScanStatus === "passed" &&
    exportForm.samplePrompts.trim().length > 0 &&
    exportForm.knownLimitations.trim().length > 0;
  const exportReadiness = !exportForm.adapterId
    ? text.exportNeedsAdapter
    : exportChecklistReady
      ? text.exportReady
      : locale.startsWith("en")
        ? "Adapter selected, but publish checklist is still holding release."
        : "Adapter 已选择，但发布前检查清单仍处于 HOLD。";
  const operationHistory = summary?.operations || [];
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
