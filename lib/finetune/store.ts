import crypto from "crypto";
import { spawn } from "child_process";
import { existsSync } from "fs";
import type {
  AgentFineTuneRecipe,
  AgentFineTuneSummary,
} from "@/lib/agent/types";
import { FINETUNE_DIR, ensureFineTuneDir } from "./store-internal";
import {
  getLoraPackingPolicy,
  getLoraSchedulerPreset,
  normalizeLoraBestCheckpointMetric,
  normalizeLoraTargetModules,
} from "./lora-config";
import { buildFineTuneAdapterArtifacts } from "./bundle-service";
import { buildFineTuneAdapterLifecycleSummary } from "./lifecycle-service";
export { exportFineTuneJobReport } from "./report-service";
export { exportFineTuneJobBundleArchive } from "./bundle-service";
import {
  getJobPaths,
  readJobs,
  readOperations,
  readRecipes,
  writeRecipes,
} from "./repository";
import {
  readDatasets,
  resolveLocalDatasetPath,
  saveFineTuneDataset,
  validateFineTuneDatasetFromPath,
} from "./dataset-service";
import { listFineTuneTargetOptions } from "./target-service";
export {
  runFineTuneAdapterChat,
  runFineTuneAdapterExport,
  runFineTuneDistillation,
  runFineTuneEvaluation,
} from "./operation-service";
export {
  checkFineTuneDatasetUpstream,
  importFineTuneCommunityDataset,
  saveFineTuneDataset,
  saveFineTuneDatasetWatch,
  validateFineTuneDatasetContent,
  validateFineTuneDatasetFromPath,
} from "./dataset-service";
export { listFineTuneTargetOptions } from "./target-service";

export function readFineTuneSummary(): AgentFineTuneSummary {
  ensureFineTuneDir();
  const localTargets = listFineTuneTargetOptions();
  const datasets = readDatasets();
  const recipes = readRecipes();
  const jobs = readJobs();
  const operations = readOperations();
  const adapters = buildFineTuneAdapterArtifacts(jobs, recipes, localTargets);
  return {
    generatedAt: new Date().toISOString(),
    dataDir: FINETUNE_DIR,
    localTargets,
    datasets,
    recipes,
    jobs,
    adapters,
    operations,
    lifecycle: buildFineTuneAdapterLifecycleSummary({
      jobs,
      recipes,
      adapters,
      operations,
    }),
  };
}

export function saveFineTuneRecipe(input: {
  id?: string;
  label: string;
  datasetId: string;
  baseTargetId: string;
  adapterName: string;
  sequenceLength: number;
  batchSize: number;
  epochs: number;
  learningRate: number;
  fineTuneMethod: "lora" | "dora";
  optimizer: "adam" | "adamw" | "sgd" | "adafactor";
  numLayers: number;
  gradientAccumulationSteps: number;
  loraRank: number;
  loraAlpha: number;
  gradientCheckpointing: boolean;
  validationSplitPct: number;
  targetModules?: unknown;
  scheduler?: string;
  warmupRatio?: number;
  packingPolicy?: string;
  evalEverySteps?: number;
  saveEverySteps: number;
  bestCheckpointMetric?: unknown;
  loadBestCheckpointAtEnd?: boolean;
  seed: number;
  benchmarkSuiteId?: string;
  notes?: string;
}) {
  const label = input.label.trim();
  const adapterName = input.adapterName.trim();
  if (!label) {
    throw new Error("Recipe label is required.");
  }
  if (!adapterName) {
    throw new Error("Adapter name is required.");
  }
  const dataset = readDatasets().find((entry) => entry.id === input.datasetId);
  if (!dataset) {
    throw new Error("Selected dataset no longer exists.");
  }
  const target = listFineTuneTargetOptions().find(
    (entry) => entry.id === input.baseTargetId,
  );
  if (!target) {
    throw new Error(
      "Selected base target is not available for local fine-tune planning.",
    );
  }
  const now = new Date().toISOString();
  const recipes = readRecipes();
  const existing = input.id
    ? recipes.find((recipe) => recipe.id === input.id)
    : recipes.find(
        (recipe) =>
          recipe.datasetId === dataset.id &&
          recipe.baseTargetId === target.id &&
          recipe.adapterName === adapterName,
      );
  const scheduler = getLoraSchedulerPreset(input.scheduler);
  const packing = getLoraPackingPolicy(input.packingPolicy);
  const recipe: AgentFineTuneRecipe = {
    id: existing?.id || `ft-recipe-${crypto.randomUUID()}`,
    label,
    datasetId: dataset.id,
    baseTargetId: target.id,
    adapterName,
    sequenceLength: Math.max(1024, Math.min(input.sequenceLength, 32768)),
    batchSize: Math.max(1, Math.min(input.batchSize, 64)),
    epochs: Math.max(1, Math.min(input.epochs, 12)),
    learningRate: Math.max(0.000001, Math.min(input.learningRate, 0.01)),
    fineTuneMethod: input.fineTuneMethod === "dora" ? "dora" : "lora",
    optimizer:
      input.optimizer === "adamw" ||
      input.optimizer === "sgd" ||
      input.optimizer === "adafactor"
        ? input.optimizer
        : "adam",
    numLayers: Math.max(-1, Math.min(input.numLayers, 96)),
    gradientAccumulationSteps: Math.max(
      1,
      Math.min(input.gradientAccumulationSteps, 64),
    ),
    loraRank: Math.max(2, Math.min(input.loraRank, 128)),
    loraAlpha: Math.max(4, Math.min(input.loraAlpha, 256)),
    gradientCheckpointing: Boolean(input.gradientCheckpointing),
    validationSplitPct: Math.max(5, Math.min(input.validationSplitPct, 30)),
    targetModules: normalizeLoraTargetModules(
      input.targetModules,
      target.modelDefault || target.id,
    ),
    scheduler: scheduler.id,
    warmupRatio:
      typeof input.warmupRatio === "number" && Number.isFinite(input.warmupRatio)
        ? Math.max(0, Math.min(input.warmupRatio, 0.25))
        : scheduler.warmupRatio,
    packingPolicy: packing.id,
    evalEverySteps:
      typeof input.evalEverySteps === "number" &&
      Number.isFinite(input.evalEverySteps)
        ? Math.max(1, Math.min(input.evalEverySteps, 5000))
        : 100,
    saveEverySteps: Math.max(0, Math.min(input.saveEverySteps, 5000)),
    bestCheckpointMetric: normalizeLoraBestCheckpointMetric(
      input.bestCheckpointMetric,
    ),
    loadBestCheckpointAtEnd:
      typeof input.loadBestCheckpointAtEnd === "boolean"
        ? input.loadBestCheckpointAtEnd
        : true,
    seed: Math.max(1, Math.min(input.seed, 999999)),
    benchmarkSuiteId: input.benchmarkSuiteId?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const next = [
    recipe,
    ...recipes.filter((entry) => entry.id !== recipe.id),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeRecipes(next);
  return recipe;
}

function openExternalPath(targetPath: string) {
  const child = spawn("open", [targetPath], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export function openFineTunePath(input: {
  kind:
    | "job-bundle"
    | "job-output"
    | "job-reports"
    | "adapter-output"
    | "dataset-source";
  id: string;
}) {
  const summary = readFineTuneSummary();
  let resolvedPath = "";

  if (input.kind === "job-bundle") {
    const job = summary.jobs.find((entry) => entry.id === input.id);
    if (!job) throw new Error("Fine-tune job not found.");
    resolvedPath = job.bundlePath;
  } else if (input.kind === "job-output") {
    const job = summary.jobs.find((entry) => entry.id === input.id);
    if (!job) throw new Error("Fine-tune job not found.");
    resolvedPath = job.outputDir;
  } else if (input.kind === "job-reports") {
    const job = summary.jobs.find((entry) => entry.id === input.id);
    if (!job) throw new Error("Fine-tune job not found.");
    resolvedPath = getJobPaths(job.id).reportsDir;
  } else if (input.kind === "adapter-output") {
    const adapter = summary.adapters.find((entry) => entry.id === input.id);
    if (!adapter) throw new Error("Fine-tune adapter not found.");
    resolvedPath = adapter.outputDir;
  } else {
    const dataset = summary.datasets.find((entry) => entry.id === input.id);
    if (!dataset?.sourcePath)
      throw new Error("Dataset source path is not available.");
    resolvedPath = resolveLocalDatasetPath(dataset.sourcePath);
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }
  openExternalPath(resolvedPath);
  return {
    kind: input.kind,
    id: input.id,
    path: resolvedPath,
    opened: true,
  };
}

export function openFineTuneSourcePage(input: {
  adapterId?: string;
  targetId?: string;
  jobId?: string;
}) {
  const summary = readFineTuneSummary();
  const targets = summary.localTargets;
  const recipes = summary.recipes;

  let target = input.targetId
    ? targets.find((entry) => entry.id === input.targetId)
    : undefined;

  if (!target && input.adapterId) {
    const adapter = summary.adapters.find(
      (entry) => entry.id === input.adapterId,
    );
    target = adapter?.baseTargetId
      ? targets.find((entry) => entry.id === adapter.baseTargetId)
      : undefined;
  }

  if (!target && input.jobId) {
    const job = summary.jobs.find((entry) => entry.id === input.jobId);
    const recipe = job
      ? recipes.find((entry) => entry.id === job.recipeId)
      : undefined;
    target = recipe
      ? targets.find((entry) => entry.id === recipe.baseTargetId)
      : undefined;
  }

  if (!target?.sourceUrl) {
    throw new Error("This fine-tune target does not expose a source page yet.");
  }

  openExternalPath(target.sourceUrl);
  return {
    targetId: target.id,
    sourceUrl: target.sourceUrl,
    opened: true,
  };
}

export async function refreshDueFineTuneDatasetWatches() {
  const { refreshDueFineTuneDatasetWatches: refreshDatasets } =
    await import("./dataset-service");
  await refreshDatasets();
  return readFineTuneSummary();
}
