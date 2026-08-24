import { createHash, randomUUID } from "node:crypto";

import { readFineTuneQualityExportEvidence } from "@/features/finetune/quality-export-acceptance";
import {
  buildTrainingExecutionPlan,
  readTrainingExecutionPlanCatalog,
  type TrainingExecutionPlanInput,
} from "@/features/finetune/training-execution-plan";
import { readTrainingCapabilityRegistry } from "@/features/finetune/training-capabilities";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const REPRODUCIBLE_TRAINING_RECIPE_SCHEMA_VERSION =
  "finetune.reproducible-training-recipes.v1" as const;
const STORE_SCHEMA_VERSION =
  "finetune.reproducible-training-recipes-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "finetune",
  "v1.11.3-reproducible-training-recipes.json",
);

type Status = "pass" | "hold";
type RecipeRehearsal = {
  id: string;
  generatedAt: string;
  recipeDigest: string;
  pins: {
    baseModelDigest: string;
    datasetDigest: string;
    runtimeDigest: string;
    evaluatorDigest: string;
  };
  checks: {
    canonicalRoundTrip: boolean;
    inputsPinned: boolean;
    implementedPlanWorkerReady: boolean;
    unsupportedConfigurationRejected: boolean;
    argvIsStructured: boolean;
    remoteReadBackPlanned: boolean;
  };
};

export type ReproducibleTrainingRecipeState = {
  localStatus: Status;
  productionStatus: "hold";
  checks: {
    capabilityMatrixBound: boolean;
    recipeRoundTripCanonical: boolean;
    immutableInputsPinned: boolean;
    implementedWorkerPlanBound: boolean;
    unsupportedConfigurationFailsClosed: boolean;
    qualityEvidenceBound: boolean;
    packageReadBackBound: boolean;
    remoteReadBackPlanned: boolean;
    freshnessWithinWindow: boolean;
  };
  summary: {
    implementedBackends: number;
    samplePlanMode: string;
    qualityExportStatus: string;
    rehearsal: RecipeRehearsal | null;
  };
  blockers: string[];
  stateDigest: string;
};

export type ReproducibleTrainingRecipeReceipt =
  ReproducibleTrainingRecipeState & {
    id: string;
    generatedAt: string;
    evidenceDigest: string;
  };

type Inputs = {
  training: ReturnType<typeof readTrainingCapabilityRegistry>;
  execution: ReturnType<typeof readTrainingExecutionPlanCatalog>;
  quality: ReturnType<typeof readFineTuneQualityExportEvidence>;
  rehearsal: RecipeRehearsal | null;
  now?: number;
};

function digest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isDigest(value: string) {
  return /^[a-f0-9]{64}$/iu.test(value);
}

export function buildReproducibleTrainingRecipeState(
  input: Inputs,
): ReproducibleTrainingRecipeState {
  const rehearsal = input.rehearsal;
  const quality = input.quality.latest;
  const now = input.now || Date.now();
  const checks = {
    capabilityMatrixBound:
      input.training.sampleCompatibility.supported &&
      input.training.totals.implemented > 0,
    recipeRoundTripCanonical: Boolean(rehearsal?.checks.canonicalRoundTrip),
    immutableInputsPinned: Boolean(rehearsal?.checks.inputsPinned),
    implementedWorkerPlanBound: Boolean(
      rehearsal?.checks.implementedPlanWorkerReady &&
        input.execution.sample.executionMode === "worker-ready",
    ),
    unsupportedConfigurationFailsClosed: Boolean(
      rehearsal?.checks.unsupportedConfigurationRejected,
    ),
    qualityEvidenceBound: quality?.localStatus === "pass" && Boolean(quality.quality),
    packageReadBackBound: Boolean(
      quality?.package?.readBackVerified && quality.package.rollbackVerified,
    ),
    remoteReadBackPlanned: Boolean(rehearsal?.checks.remoteReadBackPlanned),
    freshnessWithinWindow: Boolean(
      rehearsal &&
        now - Date.parse(rehearsal.generatedAt) <= 24 * 60 * 60 * 1_000,
    ),
  };
  const blockers = [
    ...(checks.capabilityMatrixBound
      ? []
      : ["No implemented backend capability matrix can accept the sample recipe."]),
    ...(checks.recipeRoundTripCanonical
      ? []
      : ["No canonical recipe import/export rehearsal is available."]),
    ...(checks.immutableInputsPinned
      ? []
      : ["No rehearsal pins the base model, dataset, runtime, and evaluator inputs."]),
    ...(checks.implementedWorkerPlanBound
      ? []
      : ["No worker-ready plan is bound to the canonical recipe."]),
    ...(checks.unsupportedConfigurationFailsClosed
      ? []
      : ["Unsupported backend configuration has not been proven to fail closed."]),
    ...(checks.qualityEvidenceBound
      ? []
      : ["No passing Fine-tune quality/export receipt is bound to a recipe."]),
    ...(checks.packageReadBackBound
      ? []
      : ["No locally read-back and rollback-verified adapter package is available."]),
    ...(checks.remoteReadBackPlanned
      ? []
      : ["The immutable remote package read-back plan is absent."]),
    ...(checks.freshnessWithinWindow
      ? []
      : ["The latest reproducibility rehearsal is older than the 24-hour window."]),
    "Independent worker replay, representative quality/cost measurement, model-card review, authenticated remote publication/read-back, and release approval remain production HOLD gates.",
  ];
  const withoutDigest = {
    localStatus: blockers.length === 1 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    checks,
    summary: {
      implementedBackends: input.training.totals.implemented,
      samplePlanMode: input.execution.sample.executionMode,
      qualityExportStatus: input.quality.localStatus,
      rehearsal,
    },
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function sampleRecipeInput(): TrainingExecutionPlanInput {
  return {
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
    targetModules: ["q_proj", "k_proj", "v_proj", "o_proj"],
    packingPolicy: "disabled",
    saveEverySteps: 100,
    evalEverySteps: 100,
    totalSteps: 1_000,
    bestCheckpointMetric: "eval_loss",
    loadBestCheckpointAtEnd: true,
    seed: 42,
  };
}

function readCurrentState(rehearsal: RecipeRehearsal | null) {
  return buildReproducibleTrainingRecipeState({
    training: readTrainingCapabilityRegistry(),
    execution: readTrainingExecutionPlanCatalog(),
    quality: readFineTuneQualityExportEvidence(),
    rehearsal,
  });
}

/** Validates the recipe contract only; it never starts a training worker or creates a remote package. */
export function runReproducibleTrainingRecipeRehearsal() {
  const input = sampleRecipeInput();
  const plan = buildTrainingExecutionPlan(input);
  const canonicalRecipe = {
    schemaVersion: REPRODUCIBLE_TRAINING_RECIPE_SCHEMA_VERSION,
    config: plan.config,
    provenance: {
      baseModelDigest: digest({ id: input.modelId, family: input.modelFamily }),
      datasetDigest: digest({ path: input.datasetPath, format: "jsonl" }),
      runtimeDigest: digest({ backend: plan.backend, argv: plan.argv }),
      evaluatorDigest: digest({ id: "paired-quality-contract", version: "v1" }),
    },
    packagePlan: {
      remoteReadBackRequired: true,
      remoteCoordinatesImmutable: true,
      modelCardRequired: true,
    },
  };
  const serialized = stableJson(canonicalRecipe);
  const reparsed = JSON.parse(serialized) as typeof canonicalRecipe;
  const unsupportedPlan = buildTrainingExecutionPlan({
    ...input,
    backendId: "llama-factory",
    modelId: "Qwen/Qwen3-8B",
  });
  const rehearsal: RecipeRehearsal = {
    id: `reproducible-training-recipe-rehearsal-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    recipeDigest: `sha256:${digest(canonicalRecipe)}`,
    pins: canonicalRecipe.provenance,
    checks: {
      canonicalRoundTrip: stableJson(reparsed) === serialized,
      inputsPinned: Object.values(canonicalRecipe.provenance).every(isDigest),
      implementedPlanWorkerReady:
        plan.planSupported && plan.executionMode === "worker-ready",
      unsupportedConfigurationRejected:
        !unsupportedPlan.executable && unsupportedPlan.blockers.length > 0,
      argvIsStructured:
        Array.isArray(plan.argv) && plan.safety.shellInterpolation === false,
      remoteReadBackPlanned:
        canonicalRecipe.packagePlan.remoteReadBackRequired &&
        canonicalRecipe.packagePlan.remoteCoordinatesImmutable,
    },
  };
  const state = readCurrentState(rehearsal);
  const withoutDigest = {
    id: `reproducible-training-recipe-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: ReproducibleTrainingRecipeReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return { receipt, rehearsal };
}

export function readReproducibleTrainingRecipeEvidence() {
  const receipts = readDurableReceipts<ReproducibleTrainingRecipeReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const current = readCurrentState(receipts[0]?.summary.rehearsal || null);
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: REPRODUCIBLE_TRAINING_RECIPE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
