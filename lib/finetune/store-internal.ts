import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import type {
  AgentFineTuneDataset,
  AgentFineTuneDatasetFormat,
  AgentFineTuneDatasetQuality,
  AgentFineTuneDatasetValidation,
  AgentFineTuneJob,
  AgentFineTuneRecipe,
  AgentFineTuneTargetOption,
} from "@/lib/agent/types";

export const FINETUNE_DIR = getLocalAgentDataPath("finetune");
export const DATASETS_FILE = path.join(FINETUNE_DIR, "datasets.json");
export const RECIPES_FILE = path.join(FINETUNE_DIR, "recipes.json");
export const JOBS_FILE = path.join(FINETUNE_DIR, "jobs.json");
export const OPERATIONS_FILE = path.join(FINETUNE_DIR, "operations.json");
export const RUNTIME_ATTACHMENTS_FILE = path.join(
  FINETUNE_DIR,
  "runtime-attachments.json",
);
export const JOB_BUNDLES_DIR = path.join(FINETUNE_DIR, "jobs");
export const OPERATIONS_DIR = path.join(FINETUNE_DIR, "operations");
export const VENV_PYTHON = path.join(process.cwd(), ".venv", "bin", "python");
export const WORKER_SCRIPT = path.join(
  process.cwd(),
  "scripts",
  "finetune_worker.py",
);
export const LOCAL_GATEWAY_BASE_URL = (
  process.env.LOCAL_AGENT_BASE_URL || "http://127.0.0.1:4000/v1"
).replace(/\/$/, "");
export const BUNDLED_SMOKE_DATASET_ID = "ft-dataset-first-llm-studio-smoke-v2";
export const BUNDLED_SMOKE_DATASET_LABEL = "First LLM Studio smoke v2";
export const BUNDLED_SMOKE_DATASET_PATH = path.join(
  process.cwd(),
  "data",
  "fine-tune",
  "first-llm-studio-smoke-v2.jsonl",
);
export const PROJECT_FINE_TUNE_DATA_DIR = path.join(
  process.cwd(),
  "data",
  "fine-tune",
);
export const PROJECT_COMMUNITY_DATA_DIR = path.join(
  PROJECT_FINE_TUNE_DATA_DIR,
  "community",
);
export const LEGACY_SMOKE_DATASET_PATH = "/tmp/first-llm-studio-ft-smoke.jsonl";
export const MAX_CURVE_POINTS = 120;
export const MAX_LOG_LINES = 14;
export const MAX_COMMUNITY_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_COMMUNITY_IMPORT_ROWS = 5000;

export type FineTunePreparedDatasetSummary = {
  trainSamples: number;
  validSamples: number;
  testSamples: number;
  validationDisabledReason?: string;
};

export type FineTuneJobRuntimeState = Partial<AgentFineTuneJob> & {
  launcherPid?: number | null;
};

export type FineTuneRuntimeAttachment = {
  adapterId: string;
  jobId: string;
  alias: string;
  label: string;
  baseTargetId: string;
  baseTargetLabel: string;
  baseModelRef: string;
  baseSourcePath?: string;
  baseSourceRepoId?: string;
  baseParameterScale?: string;
  baseQuantizationLabel?: string;
  baseRecommendedContextWindow?: number | null;
  baseRecommendedContext: string;
  baseMemoryProfile: string;
  adapterPath: string;
  attachedAt: string;
  updatedAt: string;
};

export type FineTuneJobBundle = {
  kind: "first-llm-studio-finetune-job";
  generatedAt: string;
  recipe: AgentFineTuneRecipe;
  dataset: {
    id: string;
    label: string;
    format: AgentFineTuneDatasetFormat;
    sourcePath?: string;
    sourceType?: AgentFineTuneDataset["sourceType"];
    sourceUrl?: string;
    sourceLabel?: string;
    license?: string;
    qualityWarnings?: string[];
    quality?: AgentFineTuneDatasetQuality;
    sampleCount: number;
    validation: AgentFineTuneDatasetValidation;
  };
  baseTarget: AgentFineTuneTargetOption;
  plan: {
    trainingBackend: "mlx-lm-lora";
    intendedRuntime: "apple-silicon-local";
    outputDir: string;
    datasetDir: string;
    configFile: string;
    stateFile: string;
    metricsFile: string;
    logFile: string;
    modelRef: string;
    totalSteps: number;
    trainSamples: number;
    validSamples: number;
    testSamples: number;
    stepsPerReport: number;
    stepsPerEval: number;
    saveEvery: number;
    maxSeqLength: number;
    batchSize: number;
    validationDisabledReason?: string;
    learningRate: number;
    fineTuneMethod: "lora" | "dora";
    optimizer: "adam" | "adamw" | "sgd" | "adafactor";
    numLayers: number;
    gradAccumulationSteps: number;
    gradCheckpoint: boolean;
    validationSplitPct: number;
    adapterPath: string;
    seed: number;
    nextStep: string;
  };
};

export function ensureFineTuneDir() {
  mkdirSync(FINETUNE_DIR, { recursive: true });
  mkdirSync(JOB_BUNDLES_DIR, { recursive: true });
  mkdirSync(OPERATIONS_DIR, { recursive: true });
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, value: unknown) {
  ensureFineTuneDir();
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function normalizeRuntimeAliasSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function toEnvKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function truncatePreview(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function normalizeUserPathInput(sourcePath: string) {
  const trimmed = sourcePath.trim();
  if (trimmed.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(trimmed).pathname);
    } catch {
      return trimmed.replace(/^file:\/\//, "");
    }
  }
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/")) {
    return path.join(homedir(), trimmed.slice(2));
  }
  return trimmed;
}

export function normalizeFineTuneSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function isInsidePath(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return (
    Boolean(relative) &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
}
