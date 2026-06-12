import crypto from "crypto";
import { spawn } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import type {
  AgentFineTuneDataset,
  AgentFineTuneJob,
  AgentFineTuneRecipe,
  AgentFineTuneTargetOption,
} from "@/lib/agent/types";
import {
  VENV_PYTHON,
  WORKER_SCRIPT,
  type FineTuneJobBundle,
  type FineTunePreparedDatasetSummary,
} from "./store-internal";
import { buildFineTuneBundleReadme } from "./bundle-service";
import {
  getJobPaths,
  mergeJobState,
  readJobs,
  readRecipes,
  readStoredJobs,
  updateStoredJob,
  writeJobRuntimeState,
  writeStoredJobs,
} from "./repository";
import {
  coerceChatMessages,
  readDatasets,
  readLocalTextFile,
  readStringField,
} from "./dataset-service";
import {
  listFineTuneTargetOptions,
  resolveBaseModelRef,
} from "./target-service";
function normalizeInstructionSample(line: string) {
  const parsed = JSON.parse(line) as Record<string, unknown>;
  const prompt = readStringField(parsed, [
    "prompt",
    "instruction",
    "query",
    "question",
    "input",
  ]);
  const completion = readStringField(parsed, [
    "completion",
    "response",
    "output",
    "answer",
    "target",
  ]);
  return {
    prompt: prompt.trim(),
    completion: completion.trim(),
  };
}

function normalizeChatSample(line: string) {
  const parsed = JSON.parse(line) as Record<string, unknown>;
  return { messages: coerceChatMessages(parsed) };
}

export function prepareFineTuneDataset(
  dataset: AgentFineTuneDataset,
  datasetDir: string,
  options: {
    validationSplitPct?: number;
    minEvalBatchSize?: number;
  } = {},
) {
  const validationSplitPct = options.validationSplitPct ?? 10;
  const minEvalBatchSize = Math.max(
    1,
    Math.floor(options.minEvalBatchSize ?? 1),
  );
  if (!dataset.sourcePath) {
    throw new Error("Dataset source path is missing.");
  }
  mkdirSync(datasetDir, { recursive: true });
  const rawLines = readLocalTextFile(dataset.sourcePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rawLines.length) {
    throw new Error("Dataset file is empty.");
  }

  const normalizedSamples = rawLines.map((line) =>
    dataset.format === "chat-jsonl"
      ? normalizeChatSample(line)
      : normalizeInstructionSample(line),
  );
  const total = normalizedSamples.length;
  const validRatio = Math.max(0.02, Math.min(validationSplitPct / 100, 0.3));
  const validCount =
    total >= 10 ? Math.max(1, Math.round(total * validRatio)) : 0;
  const testCount = total >= 40 ? Math.max(1, Math.round(total * 0.05)) : 0;
  const trainCount = Math.max(1, total - validCount - testCount);
  let train = normalizedSamples.slice(0, trainCount);
  let valid = normalizedSamples.slice(trainCount, trainCount + validCount);
  const test = normalizedSamples.slice(trainCount + validCount);
  let validationDisabledReason: string | undefined;

  if (valid.length > 0 && valid.length < minEvalBatchSize) {
    train = [...train, ...valid];
    validationDisabledReason = `Validation split had ${valid.length} sample(s), below batch size ${minEvalBatchSize}; merged it back into training to avoid MLX eval startup failure.`;
    valid = [];
  }

  const writeJsonl = (filePath: string, values: unknown[]) => {
    writeFileSync(
      filePath,
      values.map((value) => JSON.stringify(value)).join("\n") +
        (values.length ? "\n" : ""),
      "utf8",
    );
  };

  const trainPath = path.join(datasetDir, "train.jsonl");
  const validPath = path.join(datasetDir, "valid.jsonl");
  const testPath = path.join(datasetDir, "test.jsonl");

  rmSync(validPath, { force: true });
  rmSync(testPath, { force: true });

  writeJsonl(trainPath, train);
  if (valid.length) {
    writeJsonl(validPath, valid);
  }
  if (test.length) {
    writeJsonl(testPath, test);
  }

  return {
    trainSamples: train.length,
    validSamples: valid.length,
    testSamples: test.length,
    validationDisabledReason,
  } satisfies FineTunePreparedDatasetSummary;
}

export function deriveTrainingPlan(
  recipe: AgentFineTuneRecipe,
  datasetStats: FineTunePreparedDatasetSummary,
) {
  const effectiveBatchSize = Math.max(
    1,
    recipe.batchSize * Math.max(1, recipe.gradientAccumulationSteps),
  );
  const batchesPerEpoch = Math.max(
    1,
    Math.ceil(datasetStats.trainSamples / effectiveBatchSize),
  );
  const totalSteps = Math.max(1, batchesPerEpoch * Math.max(1, recipe.epochs));
  return {
    totalSteps,
    stepsPerReport: Math.max(1, Math.min(10, Math.ceil(totalSteps / 20))),
    stepsPerEval:
      datasetStats.validSamples > 0
        ? Math.max(
            1,
            Math.min(
              totalSteps,
              Math.ceil(totalSteps / Math.max(1, recipe.epochs)),
            ),
          )
        : totalSteps,
    saveEvery:
      recipe.saveEverySteps > 0
        ? Math.max(1, Math.min(totalSteps, recipe.saveEverySteps))
        : Math.max(1, Math.min(totalSteps, Math.ceil(totalSteps / 2))),
  };
}

export function buildJobBundle(
  recipe: AgentFineTuneRecipe,
  dataset: AgentFineTuneDataset,
  target: AgentFineTuneTargetOption,
  paths: ReturnType<typeof getJobPaths>,
  datasetStats: FineTunePreparedDatasetSummary,
): FineTuneJobBundle {
  const trainingPlan = deriveTrainingPlan(recipe, datasetStats);
  const modelRef = resolveBaseModelRef(target);
  return {
    kind: "first-llm-studio-finetune-job",
    generatedAt: new Date().toISOString(),
    recipe,
    dataset: {
      id: dataset.id,
      label: dataset.label,
      format: dataset.format,
      sourcePath: dataset.sourcePath,
      sourceType: dataset.sourceType,
      sourceUrl: dataset.sourceUrl,
      sourceLabel: dataset.sourceLabel,
      license: dataset.license,
      qualityWarnings: dataset.qualityWarnings,
      quality: dataset.quality,
      sampleCount: dataset.sampleCount,
      validation: dataset.validation,
    },
    baseTarget: target,
    plan: {
      trainingBackend: "mlx-lm-lora",
      intendedRuntime: "apple-silicon-local",
      outputDir: paths.outputDir,
      datasetDir: paths.datasetDir,
      configFile: paths.configFile,
      stateFile: paths.stateFile,
      metricsFile: paths.metricsFile,
      logFile: paths.logFile,
      modelRef,
      totalSteps: trainingPlan.totalSteps,
      trainSamples: datasetStats.trainSamples,
      validSamples: datasetStats.validSamples,
      testSamples: datasetStats.testSamples,
      stepsPerReport: trainingPlan.stepsPerReport,
      stepsPerEval: trainingPlan.stepsPerEval,
      saveEvery: trainingPlan.saveEvery,
      maxSeqLength: recipe.sequenceLength,
      batchSize: recipe.batchSize,
      validationDisabledReason: datasetStats.validationDisabledReason,
      learningRate: recipe.learningRate,
      fineTuneMethod: recipe.fineTuneMethod,
      optimizer: recipe.optimizer,
      numLayers: recipe.numLayers,
      gradAccumulationSteps: recipe.gradientAccumulationSteps,
      gradCheckpoint: recipe.gradientCheckpointing,
      validationSplitPct: recipe.validationSplitPct,
      adapterPath: paths.outputDir,
      seed: recipe.seed,
      nextStep:
        "Run the local MLX fine-tune worker and stream logs/curves back into /admin.",
    },
  };
}

export function stageFineTuneJob(input: { recipeId: string; notes?: string }) {
  const recipe = readRecipes().find((entry) => entry.id === input.recipeId);
  if (!recipe) {
    throw new Error("Selected recipe no longer exists.");
  }
  const dataset = readDatasets().find((entry) => entry.id === recipe.datasetId);
  if (!dataset) {
    throw new Error("Recipe dataset no longer exists.");
  }
  const target = listFineTuneTargetOptions().find(
    (entry) => entry.id === recipe.baseTargetId,
  );
  if (!target) {
    throw new Error("Recipe base target is no longer available.");
  }

  const now = new Date().toISOString();
  const jobId = `ft-job-${crypto.randomUUID()}`;
  const paths = getJobPaths(jobId);
  mkdirSync(paths.bundlePath, { recursive: true });
  mkdirSync(paths.outputDir, { recursive: true });
  mkdirSync(paths.datasetDir, { recursive: true });

  const baseModelRef = resolveBaseModelRef(target);
  const datasetStats = prepareFineTuneDataset(dataset, paths.datasetDir, {
    validationSplitPct: recipe.validationSplitPct,
    minEvalBatchSize: recipe.batchSize,
  });
  writeFileSync(
    paths.configFile,
    [
      "lora_parameters:",
      `  rank: ${recipe.loraRank}`,
      "  dropout: 0.0",
      `  scale: ${recipe.loraAlpha}`,
    ].join("\n") + "\n",
    "utf8",
  );
  const bundle = buildJobBundle(recipe, dataset, target, paths, datasetStats);
  writeFileSync(
    paths.bundleFile,
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    paths.readmeFile,
    buildFineTuneBundleReadme({
      jobId,
      recipe,
      dataset,
      target,
      paths,
      datasetStats,
    }),
    "utf8",
  );

  writeJobRuntimeState(jobId, {
    status: "staged",
    updatedAt: now,
    latestMessage: datasetStats.validationDisabledReason
      ? `Job bundle staged. ${datasetStats.validationDisabledReason}`
      : "Job bundle staged. Start the local worker when ready.",
    baseModelRef,
    curve: [],
  });

  const job: AgentFineTuneJob = {
    id: jobId,
    recipeId: recipe.id,
    datasetId: dataset.id,
    status: "staged",
    createdAt: now,
    updatedAt: now,
    adapterName: recipe.adapterName,
    bundlePath: paths.bundlePath,
    outputDir: paths.outputDir,
    bundleFile: paths.bundleFile,
    datasetDir: paths.datasetDir,
    configFile: paths.configFile,
    metricsFile: paths.metricsFile,
    logFile: paths.logFile,
    stateFile: paths.stateFile,
    baseModelRef,
    benchmarkSuiteId: recipe.benchmarkSuiteId,
    notes: input.notes?.trim() || undefined,
  };

  const jobs = [job, ...readStoredJobs()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  writeStoredJobs(jobs);
  appendExperimentEvent({
    kind: "finetune",
    status: "saved",
    title: "Fine-tune job staged",
    summary: `${recipe.label} · ${dataset.label} · ${target.label}`,
    relatedId: jobId,
    targetIds: [target.id],
    artifacts: [
      { kind: "directory", role: "bundle", label: "Job bundle", uri: paths.bundlePath },
      { kind: "file", role: "manifest", label: "Job bundle JSON", uri: paths.bundleFile, mimeType: "application/json" },
      { kind: "directory", role: "dataset", label: "Prepared dataset", uri: paths.datasetDir },
      { kind: "file", role: "log", label: "Worker log", uri: paths.logFile, mimeType: "text/plain" },
      { kind: "directory", role: "adapter", label: "Adapter output", uri: paths.outputDir },
    ],
    links: [
      { relation: "uses", entityType: "recipe", id: recipe.id, label: recipe.label },
      { relation: "uses", entityType: "dataset", id: dataset.id, label: dataset.label },
      { relation: "produced", entityType: "job", id: jobId },
    ],
    metadata: {
      recipeId: recipe.id,
      datasetId: dataset.id,
      adapterName: recipe.adapterName,
      sourceType: dataset.sourceType,
      sourceUrl: dataset.sourceUrl,
      sampleCount: dataset.sampleCount,
      totalSteps: bundle.plan.totalSteps,
      outputDir: paths.outputDir,
    },
  });
  return mergeJobState(job);
}

export function startFineTuneJob(input: { jobId: string }) {
  const job = readJobs().find((entry) => entry.id === input.jobId);
  if (!job) {
    throw new Error("Fine-tune job not found.");
  }
  if (job.status === "running" || job.status === "queued") {
    throw new Error("Fine-tune job is already running.");
  }
  const recipe = readRecipes().find((entry) => entry.id === job.recipeId);
  const dataset = readDatasets().find((entry) => entry.id === job.datasetId);
  const target = listFineTuneTargetOptions().find(
    (entry) => entry.id === recipe?.baseTargetId,
  );
  if (!recipe || !dataset || !target) {
    throw new Error("Fine-tune job dependencies are no longer available.");
  }
  if (!existsSync(VENV_PYTHON)) {
    throw new Error(`Missing Python runtime: ${VENV_PYTHON}`);
  }
  if (!existsSync(WORKER_SCRIPT)) {
    throw new Error(`Missing worker script: ${WORKER_SCRIPT}`);
  }

  const paths = getJobPaths(job.id);
  mkdirSync(paths.bundlePath, { recursive: true });
  mkdirSync(paths.outputDir, { recursive: true });
  const datasetStats = prepareFineTuneDataset(dataset, paths.datasetDir, {
    validationSplitPct: recipe.validationSplitPct,
    minEvalBatchSize: recipe.batchSize,
  });
  writeFileSync(
    paths.configFile,
    [
      "lora_parameters:",
      `  rank: ${recipe.loraRank}`,
      "  dropout: 0.0",
      `  scale: ${recipe.loraAlpha}`,
    ].join("\n") + "\n",
    "utf8",
  );
  const bundle = buildJobBundle(recipe, dataset, target, paths, datasetStats);
  writeFileSync(
    paths.bundleFile,
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    paths.readmeFile,
    buildFineTuneBundleReadme({
      jobId: job.id,
      recipe,
      dataset,
      target,
      paths,
      datasetStats,
    }),
    "utf8",
  );

  const now = new Date().toISOString();
  writeJobRuntimeState(job.id, {
    status: "queued",
    startedAt: now,
    updatedAt: now,
    latestMessage: datasetStats.validationDisabledReason
      ? `Queued local MLX fine-tune worker. ${datasetStats.validationDisabledReason}`
      : "Queued local MLX fine-tune worker.",
    errorMessage: undefined,
    progress: {
      currentStep: 0,
      totalSteps: bundle.plan.totalSteps,
      percent: 0,
    },
    curve: [],
    baseModelRef: bundle.plan.modelRef,
  });

  updateStoredJob(job.id, (current) => ({
    ...current,
    status: "queued",
    updatedAt: now,
    baseModelRef: bundle.plan.modelRef,
    bundleFile: paths.bundleFile,
    datasetDir: paths.datasetDir,
    configFile: paths.configFile,
    metricsFile: paths.metricsFile,
    logFile: paths.logFile,
    stateFile: paths.stateFile,
  }));

  const child = spawn(
    VENV_PYTHON,
    [WORKER_SCRIPT, "--job-bundle", paths.bundleFile],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();

  writeJobRuntimeState(job.id, {
    launcherPid: child.pid ?? null,
    status: "queued",
    latestMessage: datasetStats.validationDisabledReason
      ? `Local fine-tune worker started. ${datasetStats.validationDisabledReason}`
      : "Local fine-tune worker started.",
  });
  updateStoredJob(job.id, (current) => ({
    ...current,
    updatedAt: new Date().toISOString(),
    launcherPid: child.pid ?? null,
  }));

  appendExperimentEvent({
    kind: "finetune",
    status: "started",
    title: "Fine-tune worker started",
    summary: `${recipe.label} · ${target.label} · ${bundle.plan.totalSteps} steps`,
    relatedId: job.id,
    targetIds: [target.id],
    artifacts: [
      { kind: "file", role: "manifest", label: "Job bundle JSON", uri: paths.bundleFile, mimeType: "application/json" },
      { kind: "file", role: "log", label: "Worker log", uri: paths.logFile, mimeType: "text/plain" },
      { kind: "directory", role: "adapter", label: "Adapter output", uri: paths.outputDir },
    ],
    links: [
      { relation: "uses", entityType: "recipe", id: recipe.id, label: recipe.label },
      { relation: "uses", entityType: "dataset", id: dataset.id, label: dataset.label },
      { relation: "continues", entityType: "job", id: job.id },
    ],
    metadata: {
      recipeId: recipe.id,
      datasetId: dataset.id,
      adapterName: recipe.adapterName,
      sourceType: dataset.sourceType,
      sampleCount: dataset.sampleCount,
      workerScript: WORKER_SCRIPT,
      bundleFile: paths.bundleFile,
      totalSteps: bundle.plan.totalSteps,
      launcherPid: child.pid ?? null,
    },
  });

  return readJobs().find((entry) => entry.id === job.id)!;
}

export function rerunFineTuneJob(input: { jobId: string }) {
  const sourceJob = readJobs().find((entry) => entry.id === input.jobId);
  if (!sourceJob) {
    throw new Error("Fine-tune job not found.");
  }
  if (sourceJob.status === "queued" || sourceJob.status === "running") {
    throw new Error("Fine-tune job is already running.");
  }
  const stagedJob = stageFineTuneJob({
    recipeId: sourceJob.recipeId,
    notes: `Rerun from ${sourceJob.id} using the latest dataset preparation strategy.`,
  });
  return startFineTuneJob({ jobId: stagedJob.id });
}

export function cancelFineTuneJob(input: { jobId: string }) {
  const job = readJobs().find((entry) => entry.id === input.jobId);
  if (!job) {
    throw new Error("Fine-tune job not found.");
  }

  const pid = typeof job.launcherPid === "number" ? job.launcherPid : null;
  if (pid) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // ignore already exited workers
      }
    }
  }

  const now = new Date().toISOString();
  writeJobRuntimeState(job.id, {
    status: "cancelled",
    updatedAt: now,
    completedAt: now,
    latestMessage: "Fine-tune job cancelled.",
    errorMessage: undefined,
  });
  updateStoredJob(job.id, (current) => ({
    ...current,
    status: "cancelled",
    updatedAt: now,
  }));
  appendExperimentEvent({
    kind: "finetune",
    status: "cancelled",
    title: "Fine-tune job cancelled",
    summary: `${job.adapterName} stopped before completion`,
    relatedId: job.id,
  });
  return readJobs().find((entry) => entry.id === job.id)!;
}
