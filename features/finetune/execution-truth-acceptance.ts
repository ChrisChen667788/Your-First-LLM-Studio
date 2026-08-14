import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  FINETUNE_BACKEND_EXECUTION_SCHEMA_VERSION,
  buildMlxBackendExecutionContract,
} from "@/features/finetune/backend-execution-contract";
import {
  FINETUNE_EVALUATION_METRIC_SCHEMA_VERSION,
  evaluateFineTuneMetricSet,
} from "@/features/finetune/evaluation-metric-registry";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import type { AgentFineTuneRecipe } from "@/lib/agent/types";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { buildMlxLoraConfig } from "@/lib/finetune/job-service";
import { resolveFineTuneCheckpointDirectory } from "@/lib/finetune/runtime-service";
import type { FineTuneJobBundle } from "@/lib/finetune/store-internal";

export const FINETUNE_EXECUTION_TRUTH_SCHEMA_VERSION =
  "finetune.execution-truth.v1" as const;
const STORE_SCHEMA_VERSION = "finetune.execution-truth-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.6.8-finetune-execution-truth.json",
);

type Slice = {
  id: string;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type FineTuneExecutionTruthReceipt = {
  id: string;
  generatedAt: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: Slice[];
  totals: { slices: 15; passed: number; held: number };
  schemas: {
    backend: typeof FINETUNE_BACKEND_EXECUTION_SCHEMA_VERSION;
    metrics: typeof FINETUNE_EVALUATION_METRIC_SCHEMA_VERSION;
  };
  evidenceDigest: string;
  disclosure: string;
  error?: string;
};

function slice(id: string, label: string, passed: boolean, summary: string): Slice {
  return { id, label, status: passed ? "pass" : "hold", summary };
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function recipe(): AgentFineTuneRecipe {
  const now = "2026-08-14T00:00:00.000Z";
  return {
    id: "v168-recipe",
    label: "v1.6.8 execution truth",
    datasetId: "v168-dataset",
    baseTargetId: "v168-model",
    adapterName: "v168-adapter",
    sequenceLength: 2048,
    batchSize: 1,
    epochs: 3,
    learningRate: 1e-5,
    fineTuneMethod: "lora",
    optimizer: "adam",
    numLayers: 16,
    gradientAccumulationSteps: 8,
    loraRank: 16,
    loraAlpha: 32,
    gradientCheckpointing: true,
    validationSplitPct: 10,
    targetModules: ["q_proj", "v_proj"],
    scheduler: "cosine",
    warmupRatio: 0.1,
    packingPolicy: "disabled",
    evalEverySteps: 100,
    saveEverySteps: 100,
    bestCheckpointMetric: "eval_loss",
    loadBestCheckpointAtEnd: true,
    seed: 42,
    createdAt: now,
    updatedAt: now,
  };
}

function configBundle(input: {
  root: string;
  recipe: AgentFineTuneRecipe;
  targetModules: string[];
  schedulerConfig: FineTuneJobBundle["plan"]["schedulerConfig"];
}): FineTuneJobBundle {
  const root = input.root;
  return {
    kind: "first-llm-studio-finetune-job",
    generatedAt: "2026-08-14T00:00:00.000Z",
    recipe: input.recipe,
    dataset: {
      id: "v168-dataset",
      label: "v1.6.8 fixture",
      format: "instruction-jsonl",
      sourceType: "bundled-preset",
      sampleCount: 20,
      validation: {
        ok: true,
        format: "instruction-jsonl",
        sampleCount: 20,
        warnings: [],
        errors: [],
        preview: [],
      },
    },
    baseTarget: {
      id: "v168-model",
      label: "Qwen fixture",
      providerLabel: "MLX",
      modelDefault: "mlx-community/Qwen3-4B-4bit",
    },
    plan: {
      trainingBackend: "mlx-lm-lora",
      intendedRuntime: "apple-silicon-local",
      outputDir: path.join(root, "artifacts"),
      datasetDir: path.join(root, "dataset"),
      configFile: path.join(root, "mlx-lora-config.yaml"),
      stateFile: path.join(root, "state.json"),
      metricsFile: path.join(root, "metrics.jsonl"),
      logFile: path.join(root, "worker.log"),
      modelRef: "mlx-community/Qwen3-4B-4bit",
      totalSteps: 1000,
      trainSamples: 18,
      validSamples: 2,
      testSamples: 0,
      stepsPerReport: 10,
      stepsPerEval: 100,
      saveEvery: 100,
      backendExecutionSchemaVersion: FINETUNE_BACKEND_EXECUTION_SCHEMA_VERSION,
      requestedTargetModules: input.recipe.targetModules,
      targetModules: input.targetModules,
      scheduler: input.recipe.scheduler,
      schedulerConfig: input.schedulerConfig,
      warmupRatio: input.recipe.warmupRatio,
      packingPolicy: input.recipe.packingPolicy,
      bestCheckpointMetric: input.recipe.bestCheckpointMetric,
      loadBestCheckpointAtEnd: input.recipe.loadBestCheckpointAtEnd,
      maxSeqLength: input.recipe.sequenceLength,
      batchSize: input.recipe.batchSize,
      learningRate: input.recipe.learningRate,
      fineTuneMethod: input.recipe.fineTuneMethod,
      optimizer: input.recipe.optimizer,
      numLayers: input.recipe.numLayers,
      gradAccumulationSteps: input.recipe.gradientAccumulationSteps,
      gradCheckpoint: input.recipe.gradientCheckpointing,
      validationSplitPct: input.recipe.validationSplitPct,
      adapterPath: path.join(root, "artifacts"),
      seed: input.recipe.seed,
      nextStep: "Execute through the MLX worker.",
    },
  };
}

export async function runFineTuneExecutionTruthAcceptance() {
  const slices: Slice[] = [];
  const root = mkdtempSync(path.join(os.tmpdir(), "first-llm-v168-"));
  let error: string | undefined;
  try {
    const baseRecipe = recipe();
    const contract = buildMlxBackendExecutionContract({
      ...baseRecipe,
      totalSteps: 1000,
      validSamples: 2,
    });
    slices.push(slice("backend-schema", "Backend execution schema", contract.schemaVersion === FINETUNE_BACKEND_EXECUTION_SCHEMA_VERSION, contract.schemaVersion));
    slices.push(slice("backend-executable", "Supported MLX recipe", contract.executable, contract.blockers.join(" ") || "Executable."));
    slices.push(slice("target-module-map", "Target module mapping", contract.applied.targetModules.join(",") === "self_attn.q_proj,self_attn.v_proj", contract.applied.targetModules.join(", ")));
    slices.push(slice("lora-scale", "LoRA alpha/rank scale", contract.applied.lora.scale === 2, String(contract.applied.lora.scale)));
    slices.push(slice("cosine-schedule", "Cosine scheduler applied", contract.applied.scheduler.name === "cosine_decay" && contract.applied.scheduler.arguments[1] === 900, JSON.stringify(contract.applied.scheduler)));
    slices.push(slice("warmup-steps", "Warmup steps applied", contract.applied.scheduler.warmup === 100, `${contract.applied.scheduler.warmup}/1000`));

    const yaml = buildMlxLoraConfig(configBundle({
      root,
      recipe: baseRecipe,
      targetModules: contract.applied.targetModules,
      schedulerConfig: contract.applied.scheduler,
    }));
    slices.push(slice("yaml-schedule", "YAML scheduler contract", yaml.includes("lr_schedule:\n  name: cosine_decay") && yaml.includes("warmup: 100"), "Generated config contains an executable MLX lr_schedule."));
    slices.push(slice("yaml-targets", "YAML target modules", yaml.includes("- self_attn.q_proj") && yaml.includes("- self_attn.v_proj"), "Generated config contains mapped MLX keys."));
    slices.push(slice("yaml-save-policy", "YAML save/eval policy", yaml.includes("save_every: 100") && yaml.includes("steps_per_eval: 100"), "save_every=100 and steps_per_eval=100."));

    const packing = buildMlxBackendExecutionContract({ ...baseRecipe, packingPolicy: "pack-by-length", totalSteps: 1000, validSamples: 2 });
    slices.push(slice("packing-fail-closed", "Unsupported packing rejected", !packing.executable && packing.blockers.some((blocker) => blocker.includes("packing contract")), packing.blockers.join(" ")));
    const metric = buildMlxBackendExecutionContract({ ...baseRecipe, bestCheckpointMetric: "win_rate", totalSteps: 1000, validSamples: 2 });
    slices.push(slice("checkpoint-metric-fail-closed", "Unsupported checkpoint metric rejected", !metric.executable && metric.blockers.some((blocker) => blocker.includes("win_rate")), metric.blockers.join(" ")));
    const noValidation = buildMlxBackendExecutionContract({ ...baseRecipe, totalSteps: 1000, validSamples: 0 });
    slices.push(slice("validation-fail-closed", "Best checkpoint requires validation", !noValidation.executable && noValidation.blockers.some((blocker) => blocker.includes("validation split")), noValidation.blockers.join(" ")));

    const outputDir = path.join(root, "artifacts");
    const checkpointDir = path.join(outputDir, "checkpoint-0000100");
    mkdirSync(checkpointDir, { recursive: true });
    writeFileSync(path.join(checkpointDir, "adapters.safetensors"), "fixture", "utf8");
    const resolved = resolveFineTuneCheckpointDirectory({ outputDir, requestedPath: checkpointDir });
    slices.push(slice("checkpoint-selected", "Checkpoint-specific directory", resolved === realpathSync(checkpointDir), resolved));
    let escaped = false;
    try {
      resolveFineTuneCheckpointDirectory({ outputDir, requestedPath: root });
    } catch {
      escaped = true;
    }
    slices.push(slice("checkpoint-boundary", "Checkpoint path boundary", escaped, "Paths outside the job output fail closed."));

    const metricResults = await evaluateFineTuneMetricSet({
      reference: '{"answer":42}',
      prediction: '{"answer":42}',
      latencyMs: 12,
      metrics: ["exact-match", "json-validity", "latency", "loss"],
    });
    const scored = (id: string, value: number) =>
      metricResults.some((entry) => entry.id === id && entry.status === "scored" && entry.value === value);
    const loss = metricResults.find((entry) => entry.id === "loss");
    slices.push(slice("metric-registry-truth", "Metric plugin truth", scored("exact-match", 1) && scored("json-validity", 1) && scored("latency-ms", 12) && loss?.status === "unavailable" && loss.value === null, JSON.stringify(metricResults)));
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Fine-tune execution truth acceptance failed.";
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  while (slices.length < 15) {
    slices.push(slice(`acceptance-error-${slices.length + 1}`, "Acceptance interrupted", false, error || "Acceptance did not reach this slice."));
  }
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const withoutDigest = {
    id: `v168-finetune-execution-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    localStatus: passed === 15 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    slices,
    totals: { slices: 15 as const, passed, held: 15 - passed },
    schemas: {
      backend: FINETUNE_BACKEND_EXECUTION_SCHEMA_VERSION,
      metrics: FINETUNE_EVALUATION_METRIC_SCHEMA_VERSION,
    },
    disclosure:
      "This receipt proves repository-owned MLX configuration, capability rejection, checkpoint containment, and evaluator contracts. It does not prove a new physical training run, remote Hub publication, or production acceptance.",
    error,
  };
  const receipt: FineTuneExecutionTruthReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readFineTuneExecutionTruthEvidence() {
  const receipts = readDurableReceipts<FineTuneExecutionTruthReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: FINETUNE_EXECUTION_TRUTH_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: receipts[0]?.localStatus || ("evidence-needed" as const),
    productionStatus: "hold" as const,
    latest: receipts[0] || null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
