import { spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import path from "path";
import type {
  AgentFineTuneAdapterArtifact,
  AgentFineTuneBundleArchive,
  AgentFineTuneDataset,
  AgentFineTuneJob,
  AgentFineTuneRecipe,
  AgentFineTuneTargetOption,
} from "@/lib/agent/types";
import { getJobPaths, readJobs, readRuntimeAttachments } from "./repository";
import {
  normalizeRuntimeAliasSegment,
  VENV_PYTHON,
  WORKER_SCRIPT,
  type FineTunePreparedDatasetSummary,
} from "./store-internal";
import { exportFineTuneJobReport } from "./report-service";

export function listArtifactFiles(rootDir: string, maxFiles = 24) {
  if (!existsSync(rootDir)) return [] as string[];
  const files: string[] = [];
  const stack = [rootDir];
  while (stack.length && files.length < maxFiles) {
    const current = stack.pop();
    if (!current) continue;
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      const relativePath = path.relative(rootDir, fullPath) || entry.name;
      files.push(relativePath);
      if (files.length >= maxFiles) break;
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

export function collectBundleInventory(rootDir: string, maxFiles = 5000) {
  if (!existsSync(rootDir)) {
    return {
      files: [] as Array<{ path: string; sizeBytes: number }>,
      totalBytes: 0,
      truncated: false,
    };
  }

  const files: Array<{ path: string; sizeBytes: number }> = [];
  const stack = [rootDir];
  let totalBytes = 0;
  let truncated = false;

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (files.length >= maxFiles) {
        truncated = true;
        continue;
      }
      try {
        const stats = statSync(fullPath);
        const relativePath = path.relative(rootDir, fullPath) || entry.name;
        totalBytes += stats.size;
        files.push({
          path: relativePath.split(path.sep).join("/"),
          sizeBytes: stats.size,
        });
      } catch {
        continue;
      }
    }
  }

  return {
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    totalBytes,
    truncated,
  };
}

export function writeFineTuneBundleArchiveManifest(input: {
  job: AgentFineTuneJob;
  paths: ReturnType<typeof getJobPaths>;
  archiveFileName: string;
  generatedAt: string;
}) {
  const { job, paths, archiveFileName, generatedAt } = input;
  mkdirSync(paths.reportsDir, { recursive: true });
  const inventory = collectBundleInventory(paths.bundlePath);
  const manifestPath = path.join(paths.reportsDir, "bundle-manifest.json");
  const inventoryPath = path.join(paths.reportsDir, "bundle-inventory.txt");
  const manifest = {
    kind: "first-llm-studio-finetune-full-bundle",
    generatedAt,
    jobId: job.id,
    adapterName: job.adapterName,
    archiveFileName,
    bundlePath: paths.bundlePath,
    includes: {
      jobBundle: existsSync(paths.bundleFile),
      readme: existsSync(paths.readmeFile),
      config: existsSync(paths.configFile),
      splitDatasetDir: existsSync(paths.datasetDir),
      metrics: existsSync(paths.metricsFile),
      workerLog: existsSync(paths.logFile),
      runtimeState: existsSync(paths.stateFile),
      adapterArtifacts: existsSync(paths.outputDir),
      reports: existsSync(paths.reportsDir),
    },
    recommendedUse:
      "Keep this archive with the release evidence. It contains the reproducible job bundle, split datasets, config, worker log, metrics, adapter artifacts, reports, and this inventory.",
    inventory: {
      fileCount: inventory.files.length,
      totalUncompressedBytes: inventory.totalBytes,
      truncated: inventory.truncated,
      files: inventory.files,
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(
    inventoryPath,
    [
      `First LLM Studio fine-tune bundle inventory`,
      `Generated at: ${generatedAt}`,
      `Job ID: ${job.id}`,
      `Adapter: ${job.adapterName}`,
      `Archive: ${archiveFileName}`,
      `Files: ${inventory.files.length}`,
      `Total bytes: ${inventory.totalBytes}`,
      inventory.truncated ? "Warning: inventory truncated." : "",
      "",
      ...inventory.files.map(
        (file) =>
          `${file.sizeBytes.toString().padStart(12, " ")}  ${file.path}`,
      ),
      "",
    ]
      .filter((line) => line !== "")
      .join("\n"),
    "utf8",
  );
  return {
    manifestPath,
    inventoryPath,
    includedFileCount: inventory.files.length,
    totalUncompressedBytes: inventory.totalBytes,
  };
}

export function countCheckpointFiles(rootDir: string) {
  return listArtifactFiles(rootDir, 200).filter(
    (file) =>
      /\.(safetensors|npz|bin|ckpt|pt)$/i.test(file) ||
      /adapter|checkpoint|weights/i.test(file),
  ).length;
}

export function getLatestArtifactTimestamp(rootDir: string, files: string[]) {
  let latestMs = 0;
  for (const relativePath of files) {
    try {
      const stats = statSync(path.join(rootDir, relativePath));
      latestMs = Math.max(latestMs, stats.mtimeMs);
    } catch {
      // ignore missing artifact files
    }
  }
  return latestMs > 0 ? new Date(latestMs).toISOString() : undefined;
}

export function buildFineTuneAdapterArtifacts(
  jobs: AgentFineTuneJob[],
  recipes: AgentFineTuneRecipe[],
  localTargets: AgentFineTuneTargetOption[],
) {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const targetById = new Map(localTargets.map((target) => [target.id, target]));
  const attachmentByAdapterId = new Map(
    readRuntimeAttachments().map((entry) => [entry.adapterId, entry]),
  );

  return jobs
    .map((job) => {
      const files = listArtifactFiles(job.outputDir);
      const checkpointCount = countCheckpointFiles(job.outputDir);
      const recipe = recipeById.get(job.recipeId);
      const baseTarget = recipe
        ? targetById.get(recipe.baseTargetId)
        : undefined;
      const attachment = attachmentByAdapterId.get(`adapter:${job.id}`);
      const latestCheckpointAt = getLatestArtifactTimestamp(
        job.outputDir,
        files,
      );
      const status: AgentFineTuneAdapterArtifact["status"] =
        checkpointCount > 0
          ? job.status === "running" || job.status === "queued"
            ? "checkpointing"
            : "ready"
          : "incomplete";
      return {
        id: `adapter:${job.id}`,
        jobId: job.id,
        adapterName: job.adapterName,
        baseTargetId: baseTarget?.id,
        baseTargetLabel: baseTarget?.label,
        sourceUrl: baseTarget?.sourceUrl,
        outputDir: job.outputDir,
        configFile: job.configFile,
        metricsFile: job.metricsFile,
        status,
        checkpointCount,
        latestCheckpointAt,
        files,
        benchmarkSuiteId: job.benchmarkSuiteId,
        attachedTargetId: attachment?.alias,
        attachedTargetLabel: attachment?.label,
        attachedAt: attachment?.attachedAt,
        updatedAt: latestCheckpointAt || job.updatedAt,
      } satisfies AgentFineTuneAdapterArtifact;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function buildFineTuneBundleReadme(input: {
  jobId: string;
  recipe: AgentFineTuneRecipe;
  dataset: AgentFineTuneDataset;
  target: AgentFineTuneTargetOption;
  paths: ReturnType<typeof getJobPaths>;
  datasetStats: FineTunePreparedDatasetSummary;
}) {
  const { jobId, recipe, dataset, target, paths, datasetStats } = input;
  return [
    `# ${recipe.label}`,
    "",
    "## Bundle",
    "",
    `- Job ID: ${jobId}`,
    `- Dataset: ${dataset.label}`,
    `- Dataset source: ${dataset.sourceLabel || dataset.sourceType}`,
    dataset.sourceUrl ? `- Dataset URL: ${dataset.sourceUrl}` : "",
    dataset.license ? `- Dataset license: ${dataset.license}` : "",
    `- Base target: ${target.label}`,
    `- Adapter name: ${recipe.adapterName}`,
    `- Train / validation / test samples: ${datasetStats.trainSamples} / ${datasetStats.validSamples} / ${datasetStats.testSamples}`,
    `- Output dir: ${paths.outputDir}`,
    "",
    "## Recipe",
    "",
    `- Method: ${recipe.fineTuneMethod}`,
    `- Optimizer: ${recipe.optimizer}`,
    `- Sequence length: ${recipe.sequenceLength}`,
    `- Batch size: ${recipe.batchSize}`,
    `- Epochs: ${recipe.epochs}`,
    `- Learning rate: ${recipe.learningRate}`,
    `- LoRA rank / alpha: ${recipe.loraRank} / ${recipe.loraAlpha}`,
    `- Gradient accumulation: ${recipe.gradientAccumulationSteps}`,
    `- Validation split: ${recipe.validationSplitPct}%`,
    "",
    "## Post-training proof loop",
    "",
    "1. Start the local worker from /admin and wait until the adapter is ready.",
    "2. Attach the adapter runtime from the adapter card.",
    "3. Run Compare against the base lane to inspect answer shape and regressions.",
    "4. Send the same adapter to Benchmark for latency, quality, and pass-rate evidence.",
    "5. Export the report and this bundle before sharing or publishing.",
    "",
    "## Reproduce",
    "",
    "```bash",
    `${VENV_PYTHON} ${WORKER_SCRIPT} --job-bundle ${paths.bundleFile}`,
    "```",
    "",
    dataset.qualityWarnings?.length ? "## Dataset warnings" : "",
    ...(dataset.qualityWarnings || []).map((warning) => `- ${warning}`),
    "",
  ].join("\n");
}

export function exportFineTuneJobBundleArchive(input: {
  jobId: string;
}): AgentFineTuneBundleArchive {
  const job = readJobs().find((entry) => entry.id === input.jobId);
  if (!job) {
    throw new Error("Fine-tune job not found.");
  }
  const paths = getJobPaths(job.id);
  if (!existsSync(paths.bundlePath)) {
    throw new Error(
      `Fine-tune bundle path does not exist: ${paths.bundlePath}`,
    );
  }

  exportFineTuneJobReport({ jobId: job.id, format: "markdown" });
  exportFineTuneJobReport({ jobId: job.id, format: "manifest-json" });
  exportFineTuneJobReport({ jobId: job.id, format: "metrics-csv" });

  const generatedAt = new Date().toISOString();
  const archiveDir = path.join(tmpdir(), "first-llm-studio-finetune-bundles");
  mkdirSync(archiveDir, { recursive: true });
  const safeAdapterName =
    normalizeRuntimeAliasSegment(job.adapterName) || "adapter";
  const fileName = `first-llm-studio-finetune-${safeAdapterName}-${job.id}.tgz`;
  const filePath = path.join(archiveDir, fileName);
  const archiveManifest = writeFineTuneBundleArchiveManifest({
    job,
    paths,
    archiveFileName: fileName,
    generatedAt,
  });
  const result = spawnSync(
    "tar",
    ["-czf", filePath, "-C", paths.bundlePath, "."],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        result.error?.message ||
        "Failed to create archive.",
    );
  }
  const stats = statSync(filePath);
  return {
    jobId: job.id,
    filePath,
    fileName,
    sizeBytes: stats.size,
    manifestPath: archiveManifest.manifestPath,
    inventoryPath: archiveManifest.inventoryPath,
    includedFileCount: archiveManifest.includedFileCount,
    totalUncompressedBytes: archiveManifest.totalUncompressedBytes,
    generatedAt,
  };
}
