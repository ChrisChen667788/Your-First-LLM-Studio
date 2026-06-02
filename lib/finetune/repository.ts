import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import type {
  AgentFineTuneCurvePoint,
  AgentFineTuneDataset,
  AgentFineTuneJob,
  AgentFineTuneJobProgress,
  AgentFineTuneOperation,
  AgentFineTuneOperationArtifact,
  AgentFineTuneOperationKind,
  AgentFineTuneRecipe,
} from "@/lib/agent/types";
import {
  JOBS_FILE,
  JOB_BUNDLES_DIR,
  DATASETS_FILE,
  MAX_CURVE_POINTS,
  MAX_LOG_LINES,
  OPERATIONS_DIR,
  OPERATIONS_FILE,
  RECIPES_FILE,
  RUNTIME_ATTACHMENTS_FILE,
  readJsonFile,
  writeJsonFile,
  type FineTuneJobRuntimeState,
  type FineTuneRuntimeAttachment,
} from "./store-internal";

export function readStoredDatasets() {
  return readJsonFile<AgentFineTuneDataset[]>(DATASETS_FILE, []);
}

export function writeDatasets(datasets: AgentFineTuneDataset[]) {
  writeJsonFile(DATASETS_FILE, datasets);
}

export function readRecipes() {
  return readJsonFile<AgentFineTuneRecipe[]>(RECIPES_FILE, [])
    .map(normalizeRecipeRecord)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function writeRecipes(recipes: AgentFineTuneRecipe[]) {
  writeJsonFile(RECIPES_FILE, recipes);
}

export function normalizeRecipeRecord(
  recipe: AgentFineTuneRecipe,
): AgentFineTuneRecipe {
  return {
    ...recipe,
    fineTuneMethod: recipe.fineTuneMethod === "dora" ? "dora" : "lora",
    optimizer:
      recipe.optimizer === "adamw" ||
      recipe.optimizer === "sgd" ||
      recipe.optimizer === "adafactor"
        ? recipe.optimizer
        : "adam",
    numLayers: typeof recipe.numLayers === "number" ? recipe.numLayers : 16,
    gradientAccumulationSteps:
      typeof recipe.gradientAccumulationSteps === "number" &&
      Number.isFinite(recipe.gradientAccumulationSteps)
        ? recipe.gradientAccumulationSteps
        : 1,
    validationSplitPct:
      typeof recipe.validationSplitPct === "number" &&
      Number.isFinite(recipe.validationSplitPct)
        ? recipe.validationSplitPct
        : 10,
    saveEverySteps:
      typeof recipe.saveEverySteps === "number" &&
      Number.isFinite(recipe.saveEverySteps)
        ? recipe.saveEverySteps
        : 0,
    seed:
      typeof recipe.seed === "number" && Number.isFinite(recipe.seed)
        ? recipe.seed
        : 42,
  };
}

export function readStoredJobs() {
  return readJsonFile<AgentFineTuneJob[]>(JOBS_FILE, []).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function writeStoredJobs(jobs: AgentFineTuneJob[]) {
  writeJsonFile(JOBS_FILE, jobs);
}

export function readOperations() {
  return readJsonFile<AgentFineTuneOperation[]>(OPERATIONS_FILE, [])
    .filter(
      (operation) =>
        operation &&
        typeof operation.id === "string" &&
        typeof operation.kind === "string" &&
        typeof operation.outputDir === "string",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function writeOperations(operations: AgentFineTuneOperation[]) {
  writeJsonFile(OPERATIONS_FILE, operations);
}

export function getOperationPaths(
  kind: AgentFineTuneOperationKind,
  id: string,
) {
  const outputDir = path.join(OPERATIONS_DIR, kind, id);
  return {
    outputDir,
    manifestFile: path.join(outputDir, "operation-manifest.json"),
    reportFile: path.join(outputDir, "operation-report.md"),
    predictionsFile: path.join(outputDir, "predictions.jsonl"),
    transcriptFile: path.join(outputDir, "adapter-chat-transcript.json"),
    exportManifestFile: path.join(outputDir, "adapter-export-manifest.json"),
    datasetFile: path.join(outputDir, "distilled-dataset.jsonl"),
  };
}

export function saveFineTuneOperation(
  operation: Omit<AgentFineTuneOperation, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  },
) {
  const now = new Date().toISOString();
  const nextOperation: AgentFineTuneOperation = {
    ...operation,
    createdAt: operation.createdAt || now,
    updatedAt: operation.updatedAt || now,
  };
  const operations = readOperations().filter(
    (entry) => entry.id !== nextOperation.id,
  );
  writeOperations([nextOperation, ...operations]);
  return nextOperation;
}

export function artifactFor(
  filePath: string,
  label: string,
  mediaType?: string,
): AgentFineTuneOperationArtifact {
  let sizeBytes: number | undefined;
  try {
    sizeBytes = statSync(filePath).size;
  } catch {
    sizeBytes = undefined;
  }
  return {
    label,
    filePath,
    mediaType,
    sizeBytes,
  } satisfies AgentFineTuneOperationArtifact;
}

export function getJobPaths(jobId: string) {
  const bundlePath = path.join(JOB_BUNDLES_DIR, jobId);
  return {
    bundlePath,
    outputDir: path.join(bundlePath, "artifacts"),
    datasetDir: path.join(bundlePath, "dataset"),
    bundleFile: path.join(bundlePath, "job-bundle.json"),
    configFile: path.join(bundlePath, "mlx-lora-config.yaml"),
    readmeFile: path.join(bundlePath, "README.md"),
    stateFile: path.join(bundlePath, "state.json"),
    metricsFile: path.join(bundlePath, "metrics.jsonl"),
    logFile: path.join(bundlePath, "worker.log"),
    reportsDir: path.join(bundlePath, "reports"),
  };
}

export function tailLines(filePath: string, limit = MAX_LOG_LINES) {
  if (!existsSync(filePath)) return [] as string[];
  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-limit);
}

export function readJobRuntimeState(
  jobId: string,
): FineTuneJobRuntimeState | null {
  const { stateFile } = getJobPaths(jobId);
  return readJsonFile<FineTuneJobRuntimeState | null>(stateFile, null);
}

export function writeJobRuntimeState(
  jobId: string,
  patch: FineTuneJobRuntimeState,
) {
  const { stateFile } = getJobPaths(jobId);
  const current = readJobRuntimeState(jobId) || {};
  writeJsonFile(stateFile, {
    ...current,
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  });
}

export function normalizeFineTuneMetricPoint(
  value: unknown,
): AgentFineTuneCurvePoint | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<AgentFineTuneCurvePoint>;
  if (
    (entry.split !== "train" && entry.split !== "valid") ||
    typeof entry.step !== "number" ||
    !Number.isFinite(entry.step) ||
    typeof entry.loss !== "number" ||
    !Number.isFinite(entry.loss)
  ) {
    return null;
  }
  return {
    step: entry.step,
    split: entry.split,
    loss: entry.loss,
    learningRate:
      typeof entry.learningRate === "number" &&
      Number.isFinite(entry.learningRate)
        ? entry.learningRate
        : null,
    tokensPerSecond:
      typeof entry.tokensPerSecond === "number" &&
      Number.isFinite(entry.tokensPerSecond)
        ? entry.tokensPerSecond
        : null,
    peakMemoryGb:
      typeof entry.peakMemoryGb === "number" &&
      Number.isFinite(entry.peakMemoryGb)
        ? entry.peakMemoryGb
        : null,
    trainedTokens:
      typeof entry.trainedTokens === "number" &&
      Number.isFinite(entry.trainedTokens)
        ? entry.trainedTokens
        : null,
    durationSec:
      typeof entry.durationSec === "number" &&
      Number.isFinite(entry.durationSec)
        ? entry.durationSec
        : null,
    at: typeof entry.at === "string" ? entry.at : new Date().toISOString(),
  } satisfies AgentFineTuneCurvePoint;
}

export function readFineTuneMetricsFile(metricsFile: string) {
  if (!existsSync(metricsFile)) return [] as AgentFineTuneCurvePoint[];
  return readFileSync(metricsFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return normalizeFineTuneMetricPoint(JSON.parse(line));
      } catch {
        return null;
      }
    })
    .filter((entry): entry is AgentFineTuneCurvePoint => Boolean(entry))
    .sort((a, b) => a.step - b.step || a.split.localeCompare(b.split));
}

export function mergeJobState(job: AgentFineTuneJob) {
  const paths = getJobPaths(job.id);
  const runtime = readJobRuntimeState(job.id) || {};
  const runtimeCurve = Array.isArray(runtime.curve)
    ? runtime.curve
        .map(normalizeFineTuneMetricPoint)
        .filter((entry): entry is AgentFineTuneCurvePoint => Boolean(entry))
        .slice(-MAX_CURVE_POINTS)
    : [];
  const metricsCurve = readFineTuneMetricsFile(paths.metricsFile);
  const curve = metricsCurve.length ? metricsCurve : runtimeCurve;

  return {
    ...job,
    bundlePath: paths.bundlePath,
    outputDir: paths.outputDir,
    bundleFile: paths.bundleFile,
    datasetDir: paths.datasetDir,
    configFile: paths.configFile,
    metricsFile: paths.metricsFile,
    logFile: paths.logFile,
    stateFile: paths.stateFile,
    status: runtime.status || job.status,
    updatedAt: runtime.updatedAt || job.updatedAt,
    launcherPid:
      typeof runtime.launcherPid === "number"
        ? runtime.launcherPid
        : job.launcherPid,
    workerHeartbeatAt: runtime.workerHeartbeatAt || job.workerHeartbeatAt,
    startedAt: runtime.startedAt || job.startedAt,
    completedAt: runtime.completedAt || job.completedAt,
    latestMessage: runtime.latestMessage || job.latestMessage,
    errorMessage: runtime.errorMessage || job.errorMessage,
    baseModelRef: runtime.baseModelRef || job.baseModelRef,
    progress: runtime.progress as AgentFineTuneJobProgress | undefined,
    curve,
    recentLogLines: tailLines(paths.logFile),
  } satisfies AgentFineTuneJob;
}

export function readJobs() {
  return readStoredJobs()
    .map(mergeJobState)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readRuntimeAttachments() {
  return readJsonFile<FineTuneRuntimeAttachment[]>(RUNTIME_ATTACHMENTS_FILE, [])
    .filter((entry) =>
      Boolean(
        entry &&
        typeof entry.adapterId === "string" &&
        typeof entry.alias === "string" &&
        typeof entry.adapterPath === "string" &&
        typeof entry.baseTargetId === "string",
      ),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function writeRuntimeAttachments(entries: FineTuneRuntimeAttachment[]) {
  writeJsonFile(RUNTIME_ATTACHMENTS_FILE, entries);
}

export function updateStoredJob(
  jobId: string,
  updater: (job: AgentFineTuneJob) => AgentFineTuneJob,
) {
  const jobs = readStoredJobs();
  const target = jobs.find((job) => job.id === jobId);
  if (!target) {
    throw new Error("Fine-tune job not found.");
  }
  const next = jobs
    .map((job) => (job.id === jobId ? updater(job) : job))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeStoredJobs(next);
  return next.find((job) => job.id === jobId)!;
}
