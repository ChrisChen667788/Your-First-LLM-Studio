import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { readBenchmarkLogs } from "@/lib/agent/log-store";
import { readTimelineEvents } from "@/lib/agent/timeline-store";
import type {
  AgentFineTuneCurvePoint,
  AgentFineTuneDataset,
  AgentFineTuneExperimentEvidence,
  AgentFineTuneJob,
  AgentFineTuneRecipe,
  AgentFineTuneReportExport,
  AgentFineTuneReportFormat,
  AgentFineTuneReportMetricsSummary,
  AgentFineTuneRunComparisonSummary,
} from "@/lib/agent/types";
import { listArtifactFiles } from "./bundle-service";
import {
  averageFinite,
  buildFineTuneMetricsCsv,
  classifyFineTuneRunDelta,
  finiteDelta,
  formatFineTuneRunDeltaConclusion,
  formatReportDurationDelta,
  formatReportNumber,
  formatReportPct,
  formatReportSignedInteger,
  formatReportSignedNumber,
  summarizeFineTuneMetrics,
} from "./metrics-service";
import {
  getJobPaths,
  readFineTuneMetricsFile,
  readJobs,
  readRecipes,
  readRuntimeAttachments,
  readStoredDatasets,
  tailLines,
} from "./repository";
import {
  VENV_PYTHON,
  WORKER_SCRIPT,
  readJsonFile,
  type FineTuneJobBundle,
} from "./store-internal";

function buildFineTuneRunComparison(input: {
  job: AgentFineTuneJob;
  recipe?: AgentFineTuneRecipe;
}): AgentFineTuneRunComparisonSummary {
  const adapterName =
    input.job.adapterName || input.recipe?.adapterName || input.job.id;
  const runs = readJobs()
    .filter((job) => job.adapterName === adapterName)
    .sort((a, b) =>
      (b.startedAt || b.createdAt || b.updatedAt).localeCompare(
        a.startedAt || a.createdAt || a.updatedAt,
      ),
    )
    .slice(0, 8)
    .map((job) => {
      const paths = getJobPaths(job.id);
      const metrics = readFineTuneMetricsFile(paths.metricsFile);
      const summary = summarizeFineTuneMetrics(metrics);
      const durationMs =
        job.startedAt && job.completedAt
          ? Math.max(
              0,
              new Date(job.completedAt).getTime() -
                new Date(job.startedAt).getTime(),
            )
          : null;
      return {
        jobId: job.id,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        durationMs,
        outputDir: job.outputDir,
        trainLatest: summary.train.latest ?? null,
        validLatest: summary.valid.latest ?? null,
        validBest: summary.valid.best ?? null,
        latestStep: summary.latestStep ?? null,
        pointCount: summary.pointCount,
      };
    });
  const validValues = runs
    .map((run) => run.validBest)
    .filter((value): value is number => typeof value === "number");
  const latestValidValues = runs
    .map((run) => run.validLatest)
    .filter((value): value is number => typeof value === "number");
  const latestRun = runs[0];
  const previousRun = runs[1];
  let deltaToPrevious: AgentFineTuneRunComparisonSummary["deltaToPrevious"] =
    null;
  if (latestRun && previousRun) {
    const trainLatestDelta = finiteDelta(
      latestRun.trainLatest,
      previousRun.trainLatest,
    );
    const validLatestDelta = finiteDelta(
      latestRun.validLatest,
      previousRun.validLatest,
    );
    const validBestDelta = finiteDelta(
      latestRun.validBest,
      previousRun.validBest,
    );
    deltaToPrevious = {
      previousJobId: previousRun.jobId,
      trainLatestDelta,
      validLatestDelta,
      validBestDelta,
      durationMsDelta: finiteDelta(
        latestRun.durationMs,
        previousRun.durationMs,
      ),
      latestStepDelta: finiteDelta(
        latestRun.latestStep,
        previousRun.latestStep,
      ),
      conclusion: classifyFineTuneRunDelta([
        validLatestDelta,
        validBestDelta,
        trainLatestDelta,
      ]),
    };
  }
  return {
    adapterName,
    runCount: runs.length,
    bestValidationLoss: validValues.length ? Math.min(...validValues) : null,
    latestValidationLoss: latestValidValues[0] ?? null,
    deltaToPrevious,
    runs,
  };
}

function buildFineTuneExperimentEvidence(input: {
  job: AgentFineTuneJob;
  recipe?: AgentFineTuneRecipe;
  dataset?: AgentFineTuneDataset;
}): AgentFineTuneExperimentEvidence {
  const adapterId = `adapter:${input.job.id}`;
  const attachment = readRuntimeAttachments().find(
    (entry) => entry.adapterId === adapterId,
  );
  const adapter = {
    id: adapterId,
    jobId: input.job.id,
    adapterName: input.job.adapterName,
    baseTargetId: input.recipe?.baseTargetId,
    attachedTargetId: attachment?.alias,
    attachedTargetLabel: attachment?.label,
    attachedAt: attachment?.attachedAt,
  };
  const relatedIds = new Set(
    [
      input.job.id,
      adapter?.id,
      input.recipe?.id,
      input.dataset?.id,
      input.job.datasetId,
      input.job.recipeId,
    ].filter((value): value is string => Boolean(value)),
  );
  const targetIds = new Set(
    [
      input.recipe?.baseTargetId,
      adapter?.baseTargetId,
      adapter?.attachedTargetId,
    ].filter((value): value is string => Boolean(value)),
  );
  const timelineEvents = readTimelineEvents({ limit: 240 })
    .filter((event) => {
      if (event.relatedId && relatedIds.has(event.relatedId)) return true;
      if (event.targetIds?.some((targetId) => targetIds.has(targetId))) {
        return true;
      }
      return false;
    })
    .slice(0, 18);
  const compareEvents = timelineEvents
    .filter((event) => event.kind === "compare")
    .slice(0, 8);
  const benchmarkEvents = timelineEvents
    .filter((event) => event.kind === "benchmark")
    .slice(0, 8);
  const benchmarkRuns = readBenchmarkLogs({ limit: 160 })
    .filter((log) => {
      const resultTargetIds = log.results.map((result) => result.targetId);
      if (resultTargetIds.some((targetId) => targetIds.has(targetId)))
        return true;
      const note = log.runNote || "";
      return [input.job.id, input.job.adapterName, adapter?.adapterName]
        .filter((token): token is string => Boolean(token))
        .some((token) => note.includes(token));
    })
    .slice(-6)
    .reverse()
    .map((log) => {
      const matchingResults = log.results.filter((result) =>
        targetIds.size
          ? targetIds.has(result.targetId)
          : result.targetLabel.includes(input.job.adapterName),
      );
      const scopedResults = matchingResults.length
        ? matchingResults
        : log.results;
      return {
        runId: log.runId,
        generatedAt: log.generatedAt,
        label:
          log.suiteLabel ||
          log.datasetLabel ||
          log.promptSetLabel ||
          log.prompt,
        ok: log.ok,
        mode: log.benchmarkMode,
        runNote: log.runNote,
        targetIds: scopedResults.map((result) => result.targetId),
        avgFirstTokenLatencyMs: averageFinite(
          scopedResults.map((result) => result.avgFirstTokenLatencyMs),
        ),
        avgLatencyMs: averageFinite(
          scopedResults.map((result) => result.avgLatencyMs),
        ),
        avgScore: averageFinite(scopedResults.map((result) => result.avgScore)),
        passRate: averageFinite(scopedResults.map((result) => result.passRate)),
      };
    });

  return {
    timelineEvents,
    compareEvents,
    benchmarkEvents,
    benchmarkRuns,
  };
}

function buildFineTuneMarkdownReport(input: {
  job: AgentFineTuneJob;
  recipe?: AgentFineTuneRecipe;
  dataset?: AgentFineTuneDataset;
  bundle: FineTuneJobBundle | null;
  metricsSummary: AgentFineTuneReportMetricsSummary;
  metrics: AgentFineTuneCurvePoint[];
  artifactFiles: string[];
  logLines: string[];
  generatedAt: string;
  evidence: AgentFineTuneExperimentEvidence;
  runComparison: AgentFineTuneRunComparisonSummary;
}) {
  const {
    job,
    recipe,
    dataset,
    bundle,
    metricsSummary,
    metrics,
    artifactFiles,
    logLines,
    generatedAt,
    evidence,
    runComparison,
  } = input;
  const plan = bundle?.plan;
  const curveSample = metrics
    .filter(
      (point, index) => index < 12 || index >= Math.max(0, metrics.length - 12),
    )
    .map(
      (point) =>
        `| ${point.step} | ${point.split} | ${formatReportNumber(point.loss)} | ${formatReportNumber(point.learningRate)} | ${formatReportNumber(point.tokensPerSecond)} | ${point.at} |`,
    );
  const comparisonRows = runComparison.runs.map(
    (run) =>
      `| ${run.jobId} | ${run.status} | ${formatReportNumber(run.trainLatest)} | ${formatReportNumber(run.validLatest)} | ${formatReportNumber(run.validBest)} | ${run.latestStep ?? "--"} | ${typeof run.durationMs === "number" ? `${Math.round(run.durationMs / 1000)}s` : "--"} | ${run.outputDir} |`,
  );
  return [
    `# Fine-tune Run Report: ${job.adapterName}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Run Summary",
    "",
    `- Job ID: ${job.id}`,
    `- Status: ${job.status}`,
    `- Base model: ${job.baseModelRef || plan?.modelRef || "--"}`,
    `- Dataset: ${dataset?.label || bundle?.dataset.label || job.datasetId}`,
    `- Recipe: ${recipe?.label || job.recipeId}`,
    `- Adapter: ${job.adapterName}`,
    `- Started: ${job.startedAt || "--"}`,
    `- Completed: ${job.completedAt || "--"}`,
    `- Output dir: ${job.outputDir}`,
    `- Dataset source: ${dataset?.sourceLabel || dataset?.sourceType || bundle?.dataset.sourceLabel || bundle?.dataset.sourceType || "--"}`,
    dataset?.sourceUrl || bundle?.dataset.sourceUrl
      ? `- Dataset URL: ${dataset?.sourceUrl || bundle?.dataset.sourceUrl}`
      : "",
    dataset?.license || bundle?.dataset.license
      ? `- Dataset license: ${dataset?.license || bundle?.dataset.license}`
      : "",
    "",
    "## Training Configuration",
    "",
    `- Method: ${recipe?.fineTuneMethod || plan?.fineTuneMethod || "--"}`,
    `- Optimizer: ${recipe?.optimizer || plan?.optimizer || "--"}`,
    `- Sequence length: ${recipe?.sequenceLength ?? plan?.maxSeqLength ?? "--"}`,
    `- Batch size: ${recipe?.batchSize ?? plan?.batchSize ?? "--"}`,
    `- Epochs: ${recipe?.epochs ?? "--"}`,
    `- Learning rate: ${recipe?.learningRate ?? plan?.learningRate ?? "--"}`,
    `- LoRA rank / alpha: ${recipe ? `${recipe.loraRank} / ${recipe.loraAlpha}` : "--"}`,
    `- Gradient accumulation: ${recipe?.gradientAccumulationSteps ?? plan?.gradAccumulationSteps ?? "--"}`,
    `- Validation split: ${recipe?.validationSplitPct ?? plan?.validationSplitPct ?? "--"}%`,
    `- Total planned steps: ${plan?.totalSteps ?? "--"}`,
    "",
    "## Loss Summary",
    "",
    "| Split | First | Latest | Best | Delta | Relative delta |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| Train | ${formatReportNumber(metricsSummary.train.first)} | ${formatReportNumber(metricsSummary.train.latest)} | ${formatReportNumber(metricsSummary.train.best)} | ${formatReportNumber(metricsSummary.train.delta)} | ${formatReportPct(metricsSummary.train.relativeDeltaPct)} |`,
    `| Validation | ${formatReportNumber(metricsSummary.valid.first)} | ${formatReportNumber(metricsSummary.valid.latest)} | ${formatReportNumber(metricsSummary.valid.best)} | ${formatReportNumber(metricsSummary.valid.delta)} | ${formatReportPct(metricsSummary.valid.relativeDeltaPct)} |`,
    "",
    `Metrics points: ${metricsSummary.pointCount}`,
    `Step range: ${metricsSummary.firstStep ?? "--"} - ${metricsSummary.latestStep ?? "--"}`,
    `Axis note: chart values are normalized per split to the first observed point = 1.00; raw losses are preserved in metrics.csv.`,
    "",
    "## Multi-run Comparison",
    "",
    `Adapter key: ${runComparison.adapterName}`,
    `Compared runs: ${runComparison.runCount}`,
    `Best validation loss: ${formatReportNumber(runComparison.bestValidationLoss)}`,
    `Latest validation loss: ${formatReportNumber(runComparison.latestValidationLoss)}`,
    runComparison.deltaToPrevious
      ? `Delta conclusion: ${formatFineTuneRunDeltaConclusion(runComparison.deltaToPrevious.conclusion)}`
      : "Delta conclusion: --",
    runComparison.deltaToPrevious
      ? `Compared with previous job: ${runComparison.deltaToPrevious.previousJobId}`
      : "",
    runComparison.deltaToPrevious
      ? [
          "Delta vs previous:",
          `train latest ${formatReportSignedNumber(runComparison.deltaToPrevious.trainLatestDelta)}`,
          `validation latest ${formatReportSignedNumber(runComparison.deltaToPrevious.validLatestDelta)}`,
          `best validation ${formatReportSignedNumber(runComparison.deltaToPrevious.validBestDelta)}`,
          `duration ${formatReportDurationDelta(runComparison.deltaToPrevious.durationMsDelta)}`,
          `latest step ${formatReportSignedInteger(runComparison.deltaToPrevious.latestStepDelta)}.`,
        ].join(" ")
      : "",
    "",
    "| Job | Status | Latest train | Latest validation | Best validation | Latest step | Duration | Output dir |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...(comparisonRows.length
      ? comparisonRows
      : ["| -- | -- | -- | -- | -- | -- | -- | -- |"]),
    "",
    "## Full Loss Curve Sample",
    "",
    "| Step | Split | Raw loss | Learning rate | Tokens/s | At |",
    "| ---: | --- | ---: | ---: | ---: | --- |",
    ...(curveSample.length ? curveSample : ["| -- | -- | -- | -- | -- | -- |"]),
    metrics.length > curveSample.length
      ? `\nFull curve is available in ${job.metricsFile || "metrics.csv"}.`
      : "",
    "",
    "## Dataset Source & Quality",
    "",
    `- Source type: ${dataset?.sourceType || bundle?.dataset.sourceType || "--"}`,
    `- Source label: ${dataset?.sourceLabel || bundle?.dataset.sourceLabel || "--"}`,
    `- Source path: ${dataset?.sourcePath || bundle?.dataset.sourcePath || "--"}`,
    `- Upstream query: ${dataset?.upstreamQuery || "--"}`,
    `- Sample count: ${dataset?.sampleCount || bundle?.dataset.sampleCount || "--"}`,
    `- Quality score: ${dataset?.quality?.score ?? bundle?.dataset.quality?.score ?? "--"}`,
    `- License risk: ${dataset?.quality?.licenseRisk ?? bundle?.dataset.quality?.licenseRisk ?? "--"}`,
    `- Recommended steps: ${
      dataset?.quality?.recommendedSteps
        ? `${dataset.quality.recommendedSteps.min}-${dataset.quality.recommendedSteps.max} (${dataset.quality.recommendedSteps.label})`
        : bundle?.dataset.quality?.recommendedSteps
          ? `${bundle.dataset.quality.recommendedSteps.min}-${bundle.dataset.quality.recommendedSteps.max} (${bundle.dataset.quality.recommendedSteps.label})`
          : "--"
    }`,
    `- Converted / duplicate / PII-risk rows: ${
      dataset?.quality || bundle?.dataset.quality
        ? `${dataset?.quality?.convertedRows ?? bundle?.dataset.quality?.convertedRows ?? "--"} / ${dataset?.quality?.duplicateRows ?? bundle?.dataset.quality?.duplicateRows ?? "--"} / ${dataset?.quality?.piiRiskRows ?? bundle?.dataset.quality?.piiRiskRows ?? "--"}`
        : "--"
    }`,
    `- Validation warnings: ${dataset?.validation.warnings.length ?? bundle?.dataset.validation.warnings.length ?? 0}`,
    ...(dataset?.qualityWarnings || bundle?.dataset.qualityWarnings || []).map(
      (warning) => `  - ${warning}`,
    ),
    "",
    "## Post-training Evidence",
    "",
    `- Timeline events: ${evidence.timelineEvents.length}`,
    `- Compare events: ${evidence.compareEvents.length}`,
    `- Benchmark events: ${evidence.benchmarkEvents.length}`,
    evidence.benchmarkRuns.length
      ? ""
      : "- No matching benchmark runs found yet.",
    ...evidence.benchmarkRuns.flatMap((run) => [
      `- Benchmark ${run.runId || run.generatedAt}: ${run.ok ? "ok" : "failed"} · ${run.label}`,
      `  - Targets: ${run.targetIds.join(", ") || "--"}`,
      `  - Avg first token: ${formatReportNumber(run.avgFirstTokenLatencyMs)} ms · Avg total: ${formatReportNumber(run.avgLatencyMs)} ms · Avg score: ${formatReportNumber(run.avgScore)} · Pass rate: ${formatReportPct(run.passRate)}`,
    ]),
    evidence.timelineEvents.length ? "" : "",
    ...evidence.timelineEvents.slice(0, 12).map((event) => {
      return `- [${event.kind}/${event.status}] ${event.at} · ${event.title}: ${event.summary}`;
    }),
    "",
    "## Artifacts",
    "",
    `- Bundle: ${job.bundlePath}`,
    `- Config: ${job.configFile || "--"}`,
    `- Metrics: ${job.metricsFile || "--"}`,
    `- Worker log: ${job.logFile || "--"}`,
    `- Checkpoint/artifact files: ${artifactFiles.length}`,
    ...artifactFiles.slice(0, 20).map((file) => `  - ${file}`),
    artifactFiles.length > 20
      ? `  - ... ${artifactFiles.length - 20} more`
      : "",
    "",
    "## Recent Worker Log",
    "",
    "```text",
    ...(logLines.length ? logLines : ["No worker log lines available."]),
    "```",
    "",
    "## Recommended Follow-up",
    "",
    "- Attach the adapter runtime, then run Compare against the base lane.",
    "- Send the adapter to the benchmark suite linked above before publishing.",
    "- Keep this report with `metrics.csv` and `run-manifest.json` for reproducibility.",
    "- Use the Experiment Timeline section to verify training -> attach -> compare -> benchmark order.",
    "",
    "## Reproduce",
    "",
    "```bash",
    `${VENV_PYTHON} ${WORKER_SCRIPT} --job-bundle ${job.bundleFile || "<bundle.json>"}`,
    "```",
    "",
  ].join("\n");
}

export function exportFineTuneJobReport(input: {
  jobId: string;
  format?: AgentFineTuneReportFormat;
}): AgentFineTuneReportExport {
  const format = input.format || "markdown";
  const job = readJobs().find((entry) => entry.id === input.jobId);
  if (!job) {
    throw new Error("Fine-tune job not found.");
  }
  const paths = getJobPaths(job.id);
  mkdirSync(paths.reportsDir, { recursive: true });
  const recipe = readRecipes().find((entry) => entry.id === job.recipeId);
  const dataset = readStoredDatasets().find(
    (entry) => entry.id === job.datasetId,
  );
  const bundle = readJsonFile<FineTuneJobBundle | null>(paths.bundleFile, null);
  const metrics = readFineTuneMetricsFile(paths.metricsFile);
  const metricsSummary = summarizeFineTuneMetrics(metrics);
  const artifactFiles = listArtifactFiles(paths.outputDir, 500);
  const logLines = tailLines(paths.logFile, 80);
  const generatedAt = new Date().toISOString();
  const evidence = buildFineTuneExperimentEvidence({ job, recipe, dataset });
  const runComparison = buildFineTuneRunComparison({ job, recipe });
  const manifest = {
    kind: "first-llm-studio-finetune-report",
    generatedAt,
    job,
    recipe,
    dataset,
    bundle,
    metricsSummary,
    evidence,
    runComparison,
    artifactFiles,
  };
  const fileNameByFormat: Record<AgentFineTuneReportFormat, string> = {
    markdown: "training-report.md",
    "manifest-json": "run-manifest.json",
    "metrics-csv": "metrics.csv",
  };
  const filePath = path.join(paths.reportsDir, fileNameByFormat[format]);
  const content =
    format === "metrics-csv"
      ? buildFineTuneMetricsCsv(metrics)
      : format === "manifest-json"
        ? `${JSON.stringify(manifest, null, 2)}\n`
        : buildFineTuneMarkdownReport({
            job,
            recipe,
            dataset,
            bundle,
            metricsSummary,
            metrics,
            artifactFiles,
            logLines,
            generatedAt,
            evidence,
            runComparison,
          });
  writeFileSync(filePath, content, "utf8");
  return {
    jobId: job.id,
    format,
    filePath,
    content,
    generatedAt,
    metricsSummary,
    evidence,
    runComparison,
  };
}
