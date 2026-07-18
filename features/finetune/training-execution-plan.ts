import {
  TRAINING_BACKENDS,
  type TrainingBackendCapability,
  type TrainingMethod,
} from "@/features/finetune/training-capabilities";

export const TRAINING_EXECUTION_PLAN_SCHEMA_VERSION =
  "finetune.training-execution-plan.v1" as const;

export type TrainingExecutionPlanInput = {
  backendId: TrainingBackendCapability["id"];
  modelId: string;
  modelFamily: string;
  datasetPath: string;
  outputDir: string;
  method: TrainingMethod;
  quantizationBits: number;
  scheduler: string;
  learningRate: number;
  epochs: number;
  batchSize: number;
  gradientAccumulationSteps: number;
  warmupRatio: number;
  saveEverySteps: number;
  evalEverySteps: number;
  seed: number;
  distributed?: boolean;
};

function requiredText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (/\r|\n|\0/.test(normalized)) throw new Error(`${label} contains unsupported control characters.`);
  return normalized;
}

function positive(value: number, label: string, minimum = 0) {
  if (!Number.isFinite(value) || value <= minimum) throw new Error(`${label} must be greater than ${minimum}.`);
  return value;
}

function compatibilityReasons(
  backend: TrainingBackendCapability,
  input: TrainingExecutionPlanInput,
) {
  return [
    ...(!backend.modelFamilies.includes(input.modelFamily.toLowerCase())
      ? [`${input.modelFamily} is not declared by ${backend.id}.`]
      : []),
    ...(!backend.methods.includes(input.method)
      ? [`${input.method} is not supported by ${backend.id}.`]
      : []),
    ...(!backend.quantizationBits.includes(input.quantizationBits)
      ? [`${input.quantizationBits}-bit training is not supported by ${backend.id}.`]
      : []),
    ...(!backend.supportedSchedulers.includes(input.scheduler)
      ? [`${input.scheduler} is not supported by ${backend.id}.`]
      : []),
    ...(input.distributed && !backend.distributed
      ? [`${backend.id} does not support distributed execution.`]
      : []),
  ];
}

export function buildTrainingExecutionPlan(input: TrainingExecutionPlanInput) {
  const backend = TRAINING_BACKENDS.find((candidate) => candidate.id === input.backendId);
  if (!backend) throw new Error("Unknown training backend.");

  const modelId = requiredText(input.modelId, "modelId");
  const datasetPath = requiredText(input.datasetPath, "datasetPath");
  const outputDir = requiredText(input.outputDir, "outputDir");
  positive(input.learningRate, "learningRate");
  positive(input.epochs, "epochs");
  positive(input.batchSize, "batchSize");
  positive(input.gradientAccumulationSteps, "gradientAccumulationSteps");
  positive(input.saveEverySteps, "saveEverySteps");
  positive(input.evalEverySteps, "evalEverySteps");
  if (!Number.isFinite(input.warmupRatio) || input.warmupRatio < 0 || input.warmupRatio > 1) {
    throw new Error("warmupRatio must be between 0 and 1.");
  }

  const reasons = compatibilityReasons(backend, input);
  const planSupported = reasons.length === 0;
  const executable = planSupported && backend.status === "implemented";
  const config = {
    backend: backend.id,
    model: modelId,
    modelFamily: input.modelFamily.toLowerCase(),
    dataset: datasetPath,
    outputDir,
    method: input.method,
    quantizationBits: input.quantizationBits,
    scheduler: input.scheduler,
    learningRate: input.learningRate,
    epochs: input.epochs,
    batchSize: input.batchSize,
    gradientAccumulationSteps: input.gradientAccumulationSteps,
    warmupRatio: input.warmupRatio,
    saveEverySteps: input.saveEverySteps,
    evalEverySteps: input.evalEverySteps,
    seed: input.seed,
    distributed: Boolean(input.distributed),
    loadBestCheckpointAtEnd: true,
    bestCheckpointMetric: "eval_loss",
  };
  const argv = backend.id === "mlx-lm"
    ? ["python", "-m", "mlx_lm.lora", "--config", "training-plan.json"]
    : backend.id === "llama-factory"
      ? ["llamafactory-cli", "train", "training-plan.json"]
      : ["python", "-m", "first_llm_studio_peft", "--config", "training-plan.json"];

  return {
    schemaVersion: TRAINING_EXECUTION_PLAN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    backend: { id: backend.id, status: backend.status, platforms: backend.platforms },
    planSupported,
    executable,
    executionMode: executable ? "worker-ready" as const : "preview-only" as const,
    reasons,
    blockers: executable
      ? []
      : planSupported
        ? [`${backend.id} has a validated plan adapter but no production executor in this checkout.`]
        : reasons,
    argv,
    config,
    safety: {
      shellInterpolation: false,
      executeRequested: false,
      previewBackendsFailClosed: true,
    },
  };
}

export function readTrainingExecutionPlanCatalog() {
  const sampleInput: TrainingExecutionPlanInput = {
    backendId: "mlx-lm",
    modelId: "mlx-community/Qwen3-4B-4bit",
    modelFamily: "qwen",
    datasetPath: "data/finetune/train.jsonl",
    outputDir: "data/finetune/runs/qwen3-4b-lora",
    method: "lora",
    quantizationBits: 4,
    scheduler: "cosine",
    learningRate: 1e-5,
    epochs: 3,
    batchSize: 1,
    gradientAccumulationSteps: 8,
    warmupRatio: 0.03,
    saveEverySteps: 100,
    evalEverySteps: 100,
    seed: 42,
  };
  const llamaFactoryPreview = buildTrainingExecutionPlan({
    ...sampleInput,
    backendId: "llama-factory",
    modelId: "Qwen/Qwen3-8B",
  });
  return {
    ok: true as const,
    schemaVersion: TRAINING_EXECUTION_PLAN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sample: buildTrainingExecutionPlan(sampleInput),
    preview: llamaFactoryPreview,
    policy: {
      implementedBackendsMayExecute: true,
      previewBackendsMayExecute: false,
      commandShape: "argv",
      canonicalConfig: "training-plan.json",
    },
  };
}
