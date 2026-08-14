import crypto from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import { buildFineTuneOperationEventReferences } from "@/features/finetune/experiment-references";
import { readDatasets } from "./dataset-service";
import {
  artifactFor,
  getOperationPaths,
  saveFineTuneOperation,
} from "./repository";
import { truncatePreview } from "./store-internal";
import {
  readFineTuneSamples,
  resolveFineTuneAdapter,
} from "./operation-shared";
import {
  mapFineTuneInferenceWithConcurrency,
  runFineTuneAdapterInference,
} from "./inference-service";
import { attachFineTuneAdapterRuntime } from "./runtime-service";
import {
  FINETUNE_EVALUATION_METRIC_SCHEMA_VERSION,
  evaluateFineTuneMetricSet,
  normalizeFineTuneMetricIds,
  summarizeFineTuneMetricResults,
} from "@/features/finetune/evaluation-metric-registry";

export async function runFineTuneEvaluation(input: {
  adapterId: string;
  datasetId: string;
  checkpointPath?: string;
  maxSamples?: number;
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  metrics?: string[];
  savePredictions?: boolean;
}) {
  const { adapter, job } = resolveFineTuneAdapter(input.adapterId);
  const dataset = readDatasets().find((entry) => entry.id === input.datasetId);
  if (!dataset) {
    throw new Error("Evaluation dataset not found.");
  }
  const samples = readFineTuneSamples(dataset, input.maxSamples || 24);
  if (!samples.length) {
    throw new Error("Evaluation dataset has no usable samples.");
  }
  const id = `ft-op-eval-${crypto.randomUUID()}`;
  const paths = getOperationPaths("evaluation", id);
  mkdirSync(paths.outputDir, { recursive: true });
  const mounted = await attachFineTuneAdapterRuntime({
    adapterId: adapter.id,
    checkpointPath: input.checkpointPath,
  });
  const resolvedCheckpointPath = mounted.attachment.adapterPath;
  const requestedMetrics = normalizeFineTuneMetricIds(input.metrics);

  const predictions = await mapFineTuneInferenceWithConcurrency(
    samples,
    2,
    async (sample, index) => {
      const startedAt = Date.now();
      try {
        const response = await runFineTuneAdapterInference({
          adapterId: adapter.id,
          prompt: sample.prompt,
          options: {
            maxNewTokens: input.maxNewTokens,
            temperature: input.temperature,
            topP: input.topP,
          },
        });
        const prediction = response.content.trim();
        if (!prediction) throw new Error("Adapter returned an empty response.");
        const latencyMs = Date.now() - startedAt;
        return {
          index,
          prompt: sample.prompt,
          reference: sample.reference,
          prediction,
          latencyMs,
          metricResults: await evaluateFineTuneMetricSet({
            reference: sample.reference,
            prediction,
            latencyMs,
            metrics: requestedMetrics,
          }),
          targetId: adapter.attachedTargetId,
          resolvedModel: response.resolvedModel,
          usage: response.usage || null,
          error: null as string | null,
        };
      } catch (error) {
        return {
          index,
          prompt: sample.prompt,
          reference: sample.reference,
          prediction: "",
          latencyMs: Date.now() - startedAt,
          metricResults: [],
          targetId: adapter.attachedTargetId,
          resolvedModel: null,
          usage: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
  const successfulPredictions = predictions.filter((row) => !row.error);
  if (!successfulPredictions.length) {
    throw new Error(
      `Adapter evaluation produced no usable predictions. ${predictions[0]?.error || "Check the attached runtime."}`,
    );
  }
  const metricSummary = summarizeFineTuneMetricResults(
    successfulPredictions.map((row) => row.metricResults),
  );
  const metricValue = (id: string) =>
    metricSummary.find((metric) => metric.id === id)?.value ?? null;
  const generatedAt = new Date().toISOString();
  const metrics = {
    evaluationMetricSchemaVersion: FINETUNE_EVALUATION_METRIC_SCHEMA_VERSION,
    sampleCount: successfulPredictions.length,
    requestedSampleCount: predictions.length,
    failedSampleCount: predictions.length - successfulPredictions.length,
    exactMatchRate: metricValue("exact-match"),
    tokenOverlapF1: metricValue("token-overlap-f1"),
    rougeL: metricValue("rouge-l"),
    bleu1: metricValue("bleu-1"),
    latencyMs: metricValue("latency-ms"),
    mathEquivalence: metricValue("math-equivalence"),
    jsonValidity: metricValue("json-validity"),
    maxNewTokens: Math.max(16, Math.min(input.maxNewTokens || 256, 4096)),
    temperature: Number(
      Math.max(0, Math.min(input.temperature ?? 0.2, 2)).toFixed(3),
    ),
    topP: Number(Math.max(0.01, Math.min(input.topP ?? 0.9, 1)).toFixed(3)),
  };

  if (input.savePredictions) {
    writeFileSync(
      paths.predictionsFile,
      `${predictions.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    );
  }
  const report = [
    `# Adapter Evaluation: ${adapter.adapterName}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    `- Adapter: ${adapter.id}`,
    `- Dataset: ${dataset.label}`,
    `- Samples: ${metrics.sampleCount}`,
    `- Checkpoint: ${resolvedCheckpointPath}`,
    `- Checkpoint selection: ${mounted.selectionSource}`,
    `- Metric contract: ${FINETUNE_EVALUATION_METRIC_SCHEMA_VERSION}`,
    ...metricSummary.map(
      (metric) =>
        `- ${metric.id}: ${metric.status === "scored" ? metric.value : "unavailable"} (${metric.evaluatorIds.join(", ")})`,
    ),
    "",
    "## Sample predictions",
    "",
    ...(input.savePredictions
      ? predictions.slice(0, 8).flatMap((row) => [
          `### ${row.index + 1}`,
          "",
          `Prompt: ${truncatePreview(row.prompt, 220)}`,
          "",
          row.error
            ? `Skipped: ${truncatePreview(row.error, 260)}`
            : `Prediction: ${truncatePreview(row.prediction, 260)}`,
          "",
        ])
      : ["Prediction retention was disabled for this evaluation."]),
  ].join("\n");
  writeFileSync(paths.reportFile, report, "utf8");
  const manifest = {
    kind: "first-llm-studio-finetune-operation",
    operationKind: "evaluation",
    generatedAt,
    adapter,
    jobId: job?.id,
    dataset,
    checkpoint: {
      path: resolvedCheckpointPath,
      selectionSource: mounted.selectionSource,
    },
    requestedMetrics,
    metricSummary,
    metrics,
  };
  writeFileSync(paths.manifestFile, JSON.stringify(manifest, null, 2), "utf8");

  const operation = saveFineTuneOperation({
    id,
    kind: "evaluation",
    status: "completed",
    title: `Evaluation · ${adapter.adapterName}`,
    adapterId: adapter.id,
    jobId: adapter.jobId,
    datasetId: dataset.id,
    outputDir: paths.outputDir,
    summary: `${metrics.sampleCount}/${metrics.requestedSampleCount} real adapter predictions · overlap F1 ${metrics.tokenOverlapF1}`,
    metrics,
    artifacts: [
      artifactFor(paths.reportFile, "Evaluation report", "text/markdown"),
      ...(input.savePredictions
        ? [artifactFor(
            paths.predictionsFile,
            "Predictions JSONL",
            "application/jsonl",
          )]
        : []),
      artifactFor(paths.manifestFile, "Operation manifest", "application/json"),
    ],
    metadata: {
      checkpointPath: resolvedCheckpointPath,
      checkpointSelectionSource: mounted.selectionSource,
      requestedMetrics,
      savePredictions: Boolean(input.savePredictions),
    },
  });
  appendExperimentEvent({
    kind: "finetune",
    status: "completed",
    title: "Adapter evaluation completed",
    summary: operation.summary,
    relatedId: operation.id,
    ...buildFineTuneOperationEventReferences(operation),
    targetIds: [adapter.attachedTargetId || adapter.baseTargetId || ""].filter(
      Boolean,
    ),
    metadata: {
      adapterId: adapter.id,
      datasetId: dataset.id,
      outputDir: paths.outputDir,
    },
  });
  return operation;
}
