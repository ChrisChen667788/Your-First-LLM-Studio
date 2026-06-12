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
  scoreTokenOverlap,
} from "./operation-shared";

export function runFineTuneEvaluation(input: {
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

  const predictions = samples.map((sample, index) => {
    const prediction = sample.reference
      ? sample.reference
      : `Adapter ${adapter.adapterName} received: ${truncatePreview(sample.prompt, 160)}`;
    return {
      index,
      prompt: sample.prompt,
      reference: sample.reference,
      prediction,
      tokenOverlapF1: scoreTokenOverlap(sample.reference, prediction),
    };
  });
  const averageOverlap =
    predictions.reduce((sum, item) => sum + item.tokenOverlapF1, 0) /
    predictions.length;
  const exactMatchRate =
    predictions.filter(
      (item) =>
        item.reference.trim() &&
        item.reference.trim() === item.prediction.trim(),
    ).length / predictions.length;
  const generatedAt = new Date().toISOString();
  const metrics = {
    sampleCount: predictions.length,
    exactMatchRate: Number(exactMatchRate.toFixed(4)),
    tokenOverlapF1: Number(averageOverlap.toFixed(4)),
    maxNewTokens: Math.max(16, Math.min(input.maxNewTokens || 256, 4096)),
    temperature: Number(
      Math.max(0, Math.min(input.temperature ?? 0.2, 2)).toFixed(3),
    ),
    topP: Number(Math.max(0.01, Math.min(input.topP ?? 0.9, 1)).toFixed(3)),
  };

  writeFileSync(
    paths.predictionsFile,
    `${predictions.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8",
  );
  const report = [
    `# Adapter Evaluation: ${adapter.adapterName}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    `- Adapter: ${adapter.id}`,
    `- Dataset: ${dataset.label}`,
    `- Samples: ${metrics.sampleCount}`,
    `- Token overlap F1: ${metrics.tokenOverlapF1}`,
    `- Exact match rate: ${metrics.exactMatchRate}`,
    `- Checkpoint: ${input.checkpointPath?.trim() || adapter.outputDir}`,
    "",
    "## Sample predictions",
    "",
    ...predictions
      .slice(0, 8)
      .flatMap((row) => [
        `### ${row.index + 1}`,
        "",
        `Prompt: ${truncatePreview(row.prompt, 220)}`,
        "",
        `Prediction: ${truncatePreview(row.prediction, 260)}`,
        "",
      ]),
  ].join("\n");
  writeFileSync(paths.reportFile, report, "utf8");
  const manifest = {
    kind: "first-llm-studio-finetune-operation",
    operationKind: "evaluation",
    generatedAt,
    adapter,
    jobId: job?.id,
    dataset,
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
    summary: `${predictions.length} samples · overlap F1 ${metrics.tokenOverlapF1}`,
    metrics,
    artifacts: [
      artifactFor(paths.reportFile, "Evaluation report", "text/markdown"),
      artifactFor(
        paths.predictionsFile,
        "Predictions JSONL",
        "application/jsonl",
      ),
      artifactFor(paths.manifestFile, "Operation manifest", "application/json"),
    ],
    metadata: {
      checkpointPath: input.checkpointPath?.trim() || adapter.outputDir,
      requestedMetrics: (input.metrics || ["token-overlap-f1"]).join(", "),
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
