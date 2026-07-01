import type {
  FineTuneChatFormState,
  FineTuneDistillationFormState,
  FineTuneEvaluateFormState,
  FineTuneExportFormState,
  FineTuneTrainStage,
} from "./run-state";
import type { FineTuneRecipeFormState } from "./setup-state";

export function normalizeFineTuneSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function estimateFineTuneSteps(
  recipe: FineTuneRecipeFormState,
  sampleCount?: number | null,
) {
  if (typeof sampleCount !== "number" || !Number.isFinite(sampleCount)) {
    return null;
  }
  const validationRatio = Math.max(
    0,
    Math.min(0.8, recipe.validationSplitPct / 100),
  );
  const trainSamples = Math.max(
    1,
    Math.round(sampleCount * (1 - validationRatio)),
  );
  const effectiveBatch = Math.max(
    1,
    recipe.batchSize * Math.max(1, recipe.gradientAccumulationSteps),
  );
  return Math.max(1, Math.ceil(trainSamples / effectiveBatch) * recipe.epochs);
}

export function buildTrainingCommandPreview({
  recipe,
  stage,
  datasetPath,
  targetModel,
  adapterName,
  estimatedSteps,
}: {
  recipe: FineTuneRecipeFormState;
  stage: FineTuneTrainStage;
  datasetPath: string;
  targetModel: string;
  adapterName: string;
  estimatedSteps: number | null;
}) {
  const command = [
    "python -m mlx_lm.lora",
    "--train",
    '--config "mlx-lora-config.yaml"',
    `--model "${targetModel || recipe.baseTargetId || "<base-model>"}"`,
    `--data "${datasetPath || recipe.datasetId || "<dataset-jsonl>"}"`,
    `--adapter-path "adapters/${adapterName || recipe.adapterName || "<adapter-name>"}"`,
    `--max-seq-length ${recipe.sequenceLength}`,
    `--batch-size ${recipe.batchSize}`,
    `--iters ${estimatedSteps || "<estimated-steps>"}`,
    `--learning-rate ${recipe.learningRate}`,
    `--lora-layers ${recipe.numLayers}`,
    `--grad-accumulation ${recipe.gradientAccumulationSteps}`,
    `--save-every ${recipe.saveEverySteps}`,
    `--steps-per-eval ${recipe.evalEverySteps}`,
    `--seed ${recipe.seed}`,
  ];
  if (recipe.gradientCheckpointing) {
    command.push("--grad-checkpoint");
  }
  if (stage !== "supervised-fine-tune") {
    command.push(`# stage=${stage}`);
  }
  return command.join(" \\\n  ");
}

export function buildTrainingYamlPreview({
  recipe,
  stage,
  datasetPath,
  datasetLabel,
  targetModel,
  adapterName,
  estimatedSteps,
}: {
  recipe: FineTuneRecipeFormState;
  stage: FineTuneTrainStage;
  datasetPath: string;
  datasetLabel: string;
  targetModel: string;
  adapterName: string;
  estimatedSteps: number | null;
}) {
  return [
    "training:",
    `  stage: ${stage}`,
    "  backend: mlx-lm-lora",
    `  model: ${targetModel || recipe.baseTargetId || "<base-model>"}`,
    `  dataset: ${datasetPath || recipe.datasetId || "<dataset-jsonl>"}`,
    `  dataset_label: ${datasetLabel || "<dataset-label>"}`,
    `  adapter: ${adapterName || recipe.adapterName || "<adapter-name>"}`,
    `  sequence_length: ${recipe.sequenceLength}`,
    `  batch_size: ${recipe.batchSize}`,
    `  epochs: ${recipe.epochs}`,
    `  estimated_steps: ${estimatedSteps || "unknown"}`,
    `  learning_rate: ${recipe.learningRate}`,
    "lora:",
    `  method: ${recipe.fineTuneMethod}`,
    `  rank: ${recipe.loraRank}`,
    `  alpha: ${recipe.loraAlpha}`,
    `  layers: ${recipe.numLayers}`,
    "  target_modules:",
    ...recipe.targetModules.map((moduleName) => `    - ${moduleName}`),
    "runtime:",
    `  optimizer: ${recipe.optimizer}`,
    `  gradient_accumulation_steps: ${recipe.gradientAccumulationSteps}`,
    `  gradient_checkpointing: ${recipe.gradientCheckpointing ? "true" : "false"}`,
    `  scheduler: ${recipe.scheduler}`,
    `  warmup_ratio: ${recipe.warmupRatio}`,
    `  packing_policy: ${recipe.packingPolicy}`,
    `  validation_split_pct: ${recipe.validationSplitPct}`,
    `  eval_every_steps: ${recipe.evalEverySteps}`,
    `  save_every_steps: ${recipe.saveEverySteps}`,
    `  best_checkpoint_metric: ${recipe.bestCheckpointMetric}`,
    `  load_best_checkpoint_at_end: ${recipe.loadBestCheckpointAtEnd ? "true" : "false"}`,
    `  seed: ${recipe.seed}`,
    `  benchmark_suite: ${recipe.benchmarkSuiteId || "none"}`,
  ].join("\n");
}

export function buildDistillationCommandPreview({
  distillationForm,
  teacherModel,
  outputPath,
}: {
  distillationForm: FineTuneDistillationFormState;
  teacherModel: string;
  outputPath: string;
}) {
  return [
    "python -m first_llm_studio.distill_dataset",
    `--teacher "${teacherModel || distillationForm.teacherTargetId || "<teacher-target>"}"`,
    `--output "${outputPath || distillationForm.outputPath || "<distilled-jsonl>"}"`,
    `--samples ${distillationForm.sampleCount}`,
    `--max-new-tokens ${distillationForm.maxNewTokens}`,
    `--temperature ${distillationForm.temperature}`,
    `--top-p ${distillationForm.topP}`,
    `--seed-prompt "${distillationForm.seedPrompt.replaceAll('"', '\\"') || "<seed-prompt>"}"`,
    distillationForm.includeReasoningTrace
      ? "--include-reasoning-trace"
      : "--strip-reasoning-trace",
  ].join(" \\\n  ");
}

export function buildDistillationYamlPreview({
  distillationForm,
  teacherLabel,
  teacherModel,
  outputPath,
}: {
  distillationForm: FineTuneDistillationFormState;
  teacherLabel: string;
  teacherModel: string;
  outputPath: string;
}) {
  return [
    "distillation:",
    "  backend: first-llm-studio-dataset-distiller",
    `  teacher_target: ${distillationForm.teacherTargetId || "<teacher-target>"}`,
    `  teacher_label: ${teacherLabel || "<teacher-label>"}`,
    `  teacher_model: ${teacherModel || "<teacher-model>"}`,
    `  output_path: ${outputPath || distillationForm.outputPath || "<distilled-jsonl>"}`,
    `  samples: ${distillationForm.sampleCount}`,
    `  max_new_tokens: ${distillationForm.maxNewTokens}`,
    `  temperature: ${distillationForm.temperature}`,
    `  top_p: ${distillationForm.topP}`,
    `  include_reasoning_trace: ${distillationForm.includeReasoningTrace ? "true" : "false"}`,
    "  schema:",
    "    format: instruction-jsonl",
    "    fields: [instruction, input, output, source]",
    `  seed_prompt: ${JSON.stringify(distillationForm.seedPrompt)}`,
  ].join("\n");
}

export function buildEvaluateCommandPreview({
  checkpointPath,
  datasetPath,
  evaluateForm,
}: {
  checkpointPath: string;
  datasetPath: string;
  evaluateForm: FineTuneEvaluateFormState;
}) {
  return [
    "python -m first_llm_studio.eval_adapter",
    `--adapter-path "${checkpointPath || "<adapter-or-checkpoint-path>"}"`,
    `--dataset "${datasetPath || "<validation-jsonl>"}"`,
    `--max-samples ${evaluateForm.maxSamples}`,
    `--max-new-tokens ${evaluateForm.maxNewTokens}`,
    `--temperature ${evaluateForm.temperature}`,
    `--top-p ${evaluateForm.topP}`,
    `--metrics "${evaluateForm.metrics.join(",") || "loss"}"`,
    evaluateForm.savePredictions
      ? "--save-predictions"
      : "--no-save-predictions",
  ].join(" \\\n  ");
}

export function buildEvaluateYamlPreview({
  checkpointPath,
  datasetPath,
  datasetLabel,
  evaluateForm,
}: {
  checkpointPath: string;
  datasetPath: string;
  datasetLabel: string;
  evaluateForm: FineTuneEvaluateFormState;
}) {
  return [
    "evaluation:",
    "  backend: local-adapter-eval",
    `  adapter_or_checkpoint: ${checkpointPath || "<adapter-or-checkpoint-path>"}`,
    `  dataset: ${datasetPath || "<validation-jsonl>"}`,
    `  dataset_label: ${datasetLabel || "<dataset-label>"}`,
    `  max_samples: ${evaluateForm.maxSamples}`,
    `  max_new_tokens: ${evaluateForm.maxNewTokens}`,
    `  temperature: ${evaluateForm.temperature}`,
    `  top_p: ${evaluateForm.topP}`,
    `  metrics: [${evaluateForm.metrics.join(", ")}]`,
    `  save_predictions: ${evaluateForm.savePredictions ? "true" : "false"}`,
  ].join("\n");
}

export function buildChatAdapterCommandPreview({
  adapterPath,
  chatForm,
}: {
  adapterPath: string;
  chatForm: FineTuneChatFormState;
}) {
  return [
    "python -m first_llm_studio.chat_adapter",
    `--adapter-id "${chatForm.adapterId || "<adapter-id>"}"`,
    `--adapter-path "${adapterPath || "<adapter-output-dir>"}"`,
    `--role ${chatForm.role}`,
    `--max-new-tokens ${chatForm.maxNewTokens}`,
    `--temperature ${chatForm.temperature}`,
    `--top-p ${chatForm.topP}`,
    chatForm.skipSpecialTokens
      ? "--skip-special-tokens"
      : "--keep-special-tokens",
    chatForm.renderHtmlTags ? "--render-html-tags" : "--plain-text",
  ].join(" \\\n  ");
}

export function buildExportAdapterCommandPreview({
  adapterPath,
  exportForm,
}: {
  adapterPath: string;
  exportForm: FineTuneExportFormState;
}) {
  const command = [
    "python -m first_llm_studio.export_adapter",
    `--adapter-id "${exportForm.adapterId || "<adapter-id>"}"`,
    `--adapter-path "${adapterPath || "<adapter-output-dir>"}"`,
    `--format ${exportForm.exportFormat}`,
    `--quantization ${exportForm.quantization}`,
    `--max-shard-size-gb ${exportForm.maxShardSizeGb}`,
    `--output-dir "${exportForm.outputDir || "<export-dir>"}"`,
  ];
  if (exportForm.hubId.trim()) {
    command.push(`--hub-id "${exportForm.hubId.trim()}"`);
  }
  command.push(`--publish-target ${exportForm.publishTarget}`);
  command.push(`--secret-scan-status ${exportForm.secretScanStatus}`);
  if (exportForm.includeDatasetCard) {
    command.push("--include-dataset-card");
  }
  if (exportForm.licenseReviewed) {
    command.push("--license-reviewed");
  }
  if (exportForm.datasetAttributionReviewed) {
    command.push("--dataset-attribution-reviewed");
  }
  if (exportForm.samplePrompts.trim()) {
    command.push("--include-sample-prompts");
  }
  if (exportForm.knownLimitations.trim()) {
    command.push("--include-known-limitations");
  }
  return command.join(" \\\n  ");
}
