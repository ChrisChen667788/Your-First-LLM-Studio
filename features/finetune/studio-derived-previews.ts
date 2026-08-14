import type {
  AgentFineTuneSummary,
  AgentTarget,
} from "@/lib/agent/types";
import {
  DEFAULT_DISTILLATION_FORM,
  type FineTuneChatFormState,
  type FineTuneDistillationFormState,
  type FineTuneEvaluateFormState,
  type FineTuneExportFormState,
  type FineTuneTrainStage,
} from "@/features/finetune/run-state";
import type {
  FineTuneDatasetFormState,
  FineTuneRecipeFormState,
} from "@/features/finetune/setup-state";
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

export function buildFineTuneTrainingPreviewViewModel(input: {
  summary: AgentFineTuneSummary | null;
  targetCatalog: AgentTarget[];
  recipeForm: FineTuneRecipeFormState;
  datasetForm: FineTuneDatasetFormState;
  distillationForm: FineTuneDistillationFormState;
  trainStage: FineTuneTrainStage;
}) {
  const selectedRecipeDataset =
    input.summary?.datasets.find(
      (dataset) => dataset.id === input.recipeForm.datasetId,
    ) || null;
  const selectedRecipeTarget =
    input.summary?.localTargets.find(
      (target) => target.id === input.recipeForm.baseTargetId,
    ) || null;
  const estimatedTrainingSteps = estimateFineTuneSteps(
    input.recipeForm,
    selectedRecipeDataset?.sampleCount,
  );
  const effectiveTrainingBatch =
    input.recipeForm.batchSize *
    Math.max(1, input.recipeForm.gradientAccumulationSteps);
  const estimatedTrainingSamples =
    typeof selectedRecipeDataset?.sampleCount === "number"
      ? Math.max(
          1,
          Math.round(
            selectedRecipeDataset.sampleCount *
              (1 -
                Math.max(
                  0,
                  Math.min(0.8, input.recipeForm.validationSplitPct / 100),
                )),
          ),
        )
      : null;
  const selectedDistillationTeacher =
    input.targetCatalog.find(
      (target) => target.id === input.distillationForm.teacherTargetId,
    ) || null;
  const distillationOutputPath =
    input.distillationForm.outputPath.trim() ||
    (input.recipeForm.adapterName
      ? `data/fine-tune/distilled/${normalizeFineTuneSlug(input.recipeForm.adapterName)}.jsonl`
      : DEFAULT_DISTILLATION_FORM.outputPath);
  const datasetPath =
    selectedRecipeDataset?.sourcePath || input.datasetForm.sourcePath || "";
  const targetModel = selectedRecipeTarget?.modelDefault || "";
  const trainingCommandPreview =
    input.trainStage === "distillation"
      ? buildDistillationCommandPreview({
          distillationForm: input.distillationForm,
          teacherModel: selectedDistillationTeacher?.modelDefault || "",
          outputPath: distillationOutputPath,
        })
      : buildTrainingCommandPreview({
          recipe: input.recipeForm,
          stage: input.trainStage,
          datasetPath,
          targetModel,
          adapterName: input.recipeForm.adapterName,
          estimatedSteps: estimatedTrainingSteps,
        });
  const trainingYamlPreview =
    input.trainStage === "distillation"
      ? buildDistillationYamlPreview({
          distillationForm: input.distillationForm,
          teacherLabel: selectedDistillationTeacher?.label || "",
          teacherModel: selectedDistillationTeacher?.modelDefault || "",
          outputPath: distillationOutputPath,
        })
      : buildTrainingYamlPreview({
          recipe: input.recipeForm,
          stage: input.trainStage,
          datasetPath,
          datasetLabel:
            selectedRecipeDataset?.label ||
            input.datasetForm.label ||
            input.recipeForm.datasetId,
          targetModel,
          adapterName: input.recipeForm.adapterName,
          estimatedSteps: estimatedTrainingSteps,
        });

  return {
    selectedRecipeDataset,
    selectedRecipeTarget,
    estimatedTrainingSteps,
    effectiveTrainingBatch,
    estimatedTrainingSamples,
    selectedDistillationTeacher,
    distillationOutputPath,
    trainingCommandPreview,
    trainingYamlPreview,
  };
}

export function buildFineTuneRunPreviewViewModel(input: {
  summary: AgentFineTuneSummary | null;
  evaluateForm: FineTuneEvaluateFormState;
  chatForm: FineTuneChatFormState;
  exportForm: FineTuneExportFormState;
  locale: string;
  labels: {
    evalNeedsDataset: string;
    evalNeedsCheckpoint: string;
    evalReady: string;
    chatReady: string;
    chatNeedsAdapter: string;
    exportNeedsAdapter: string;
    exportReady: string;
  };
}) {
  const selectedEvaluateDataset =
    input.summary?.datasets.find(
      (dataset) => dataset.id === input.evaluateForm.datasetId,
    ) || null;
  const checkpointOptions = new Map<string, string>();
  (input.summary?.adapters || []).forEach((adapter) => {
    if (adapter.bestCheckpoint?.path) {
      checkpointOptions.set(
        adapter.bestCheckpoint.path,
        `${adapter.adapterName} · best ${adapter.bestCheckpoint.metric} @ ${adapter.bestCheckpoint.step}`,
      );
    }
    if (adapter.outputDir) {
      checkpointOptions.set(
        adapter.outputDir,
        `${adapter.adapterName} · ${adapter.status}`,
      );
    }
  });
  (input.summary?.jobs || []).forEach((job) => {
    if (job.outputDir) {
      checkpointOptions.set(job.outputDir, `${job.adapterName} · ${job.status}`);
    }
  });
  const evaluateCheckpointOptions = Array.from(
    checkpointOptions,
    ([path, label]) => ({ path, label }),
  );
  const evaluateCommandPreview = buildEvaluateCommandPreview({
    checkpointPath: input.evaluateForm.checkpointPath,
    datasetPath: selectedEvaluateDataset?.sourcePath || "",
    evaluateForm: input.evaluateForm,
  });
  const evaluateYamlPreview = buildEvaluateYamlPreview({
    checkpointPath: input.evaluateForm.checkpointPath,
    datasetPath: selectedEvaluateDataset?.sourcePath || "",
    datasetLabel: selectedEvaluateDataset?.label || "",
    evaluateForm: input.evaluateForm,
  });
  const selectedEvaluateAdapter =
    input.summary?.adapters.find(
      (adapter) => adapter.outputDir === input.evaluateForm.checkpointPath,
    ) ||
    input.summary?.adapters.find((adapter) => adapter.status === "ready") ||
    null;
  const selectedChatAdapter =
    input.summary?.adapters.find(
      (adapter) => adapter.id === input.chatForm.adapterId,
    ) || null;
  const selectedExportAdapter =
    input.summary?.adapters.find(
      (adapter) => adapter.id === input.exportForm.adapterId,
    ) || null;
  const exportChecklistReady =
    input.exportForm.licenseReviewed &&
    input.exportForm.datasetAttributionReviewed &&
    input.exportForm.secretScanStatus === "passed" &&
    input.exportForm.samplePrompts.trim().length > 0 &&
    input.exportForm.knownLimitations.trim().length > 0;

  return {
    selectedEvaluateDataset,
    evaluateCheckpointOptions,
    evaluateCommandPreview,
    evaluateYamlPreview,
    selectedEvaluateAdapter,
    evaluationReadiness: !input.evaluateForm.datasetId
      ? input.labels.evalNeedsDataset
      : !input.evaluateForm.checkpointPath.trim()
        ? input.labels.evalNeedsCheckpoint
        : input.labels.evalReady,
    selectedChatAdapter,
    chatAdapterCommandPreview: buildChatAdapterCommandPreview({
      adapterPath: selectedChatAdapter?.outputDir || "",
      chatForm: input.chatForm,
    }),
    chatReadiness: input.chatForm.adapterId
      ? input.labels.chatReady
      : input.labels.chatNeedsAdapter,
    selectedExportAdapter,
    exportAdapterCommandPreview: buildExportAdapterCommandPreview({
      adapterPath: selectedExportAdapter?.outputDir || "",
      exportForm: input.exportForm,
    }),
    exportReadiness: !input.exportForm.adapterId
      ? input.labels.exportNeedsAdapter
      : exportChecklistReady
        ? input.labels.exportReady
        : input.locale.startsWith("en")
          ? "Adapter selected, but publish checklist is still holding release."
          : "Adapter 已选择，但发布前检查清单仍处于 HOLD。",
    operationHistory: input.summary?.operations || [],
  };
}
