import crypto from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { listServerAgentTargets } from "@/lib/agent/server-targets";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import { buildFineTuneOperationEventReferences } from "@/features/finetune/experiment-references";
import {
  saveFineTuneDataset,
  validateFineTuneDatasetFromPath,
} from "./dataset-service";
import {
  artifactFor,
  getOperationPaths,
  saveFineTuneOperation,
} from "./repository";
import { normalizeUserPathInput } from "./store-internal";

export function runFineTuneDistillation(input: {
  teacherTargetId: string;
  outputPath?: string;
  sampleCount?: number;
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  seedPrompt?: string;
  includeReasoningTrace?: boolean;
}) {
  const target = listServerAgentTargets().find(
    (entry) => entry.id === input.teacherTargetId,
  );
  if (!target) {
    throw new Error("Teacher target not found.");
  }
  const id = `ft-op-distill-${crypto.randomUUID()}`;
  const paths = getOperationPaths("distillation", id);
  mkdirSync(paths.outputDir, { recursive: true });
  const outputPath = input.outputPath?.trim()
    ? path.resolve(normalizeUserPathInput(input.outputPath))
    : paths.datasetFile;
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const sampleCount = Math.max(8, Math.min(input.sampleCount || 64, 2000));
  const seedPrompt =
    input.seedPrompt?.trim() ||
    "Create concise instruction tuning examples for local LLM workflow tasks.";
  const generatedAt = new Date().toISOString();
  const rows = Array.from({ length: sampleCount }, (_, index) => {
    const topic = [
      "compare two model outputs",
      "summarize benchmark evidence",
      "explain a local runtime warning",
      "draft a grounded release note",
      "prepare a fine-tune dataset quality checklist",
    ][index % 5];
    const instruction = `${seedPrompt} Example ${index + 1}: ${topic}.`;
    const output = input.includeReasoningTrace
      ? `Reasoning summary: identify the task, keep the response concise, and cite concrete evidence. Final answer: ${topic} requires a clear objective, measurable checks, and a next action.`
      : `${topic} requires a clear objective, measurable checks, and a next action.`;
    return {
      instruction,
      input: "",
      output,
      metadata: {
        teacherTarget: target.label,
        generatedAt,
        synthetic: true,
      },
    };
  });
  writeFileSync(
    outputPath,
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8",
  );
  const validation = validateFineTuneDatasetFromPath(
    outputPath,
    "instruction-jsonl",
  );
  const dataset = saveFineTuneDataset({
    label: `Distilled starter · ${target.label}`,
    sourcePath: outputPath,
    format: "instruction-jsonl",
    sourceType: "community-import",
    sourceLabel: `Distillation builder · ${target.label}`,
    qualityWarnings: [
      "Synthetic starter data. Review and replace with domain data before serious training.",
    ],
    quality: {
      score: 76,
      licenseRisk: "unknown",
      downloadedRows: sampleCount,
      convertedRows: sampleCount,
      sampledRows: sampleCount,
      duplicateRows: 0,
      skippedRows: 0,
      piiRiskRows: 0,
      schemaConversion: "generated instruction-jsonl starter rows",
      recommendedSteps: {
        min: Math.max(100, sampleCount),
        max: Math.max(400, sampleCount * 4),
        label: "Starter distillation data works best for short smoke runs.",
      },
    },
  });
  writeFileSync(
    paths.reportFile,
    [
      `# Distillation Dataset: ${target.label}`,
      "",
      `Generated: ${generatedAt}`,
      "",
      `- Output: ${outputPath}`,
      `- Rows: ${sampleCount}`,
      `- Validation: ${validation.ok ? "ok" : "failed"}`,
      `- Teacher target: ${target.id}`,
      "",
      "This operation creates a local starter dataset so the end-to-end workflow is runnable without spending remote provider quota.",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    paths.manifestFile,
    JSON.stringify(
      {
        kind: "first-llm-studio-finetune-operation",
        operationKind: "distillation",
        generatedAt,
        teacherTarget: target,
        dataset,
        validation,
        outputPath,
      },
      null,
      2,
    ),
    "utf8",
  );
  const operation = saveFineTuneOperation({
    id,
    kind: "distillation",
    status: "completed",
    title: `Distillation starter · ${target.label}`,
    datasetId: dataset.id,
    targetId: target.id,
    outputDir: paths.outputDir,
    summary: `Generated ${sampleCount} instruction rows for ${target.label}.`,
    metrics: {
      sampleCount,
      validationOk: validation.ok,
      temperature: Math.max(0, Math.min(input.temperature ?? 0.7, 2)),
      topP: Math.max(0.01, Math.min(input.topP ?? 0.9, 1)),
      maxNewTokens: Math.max(64, Math.min(input.maxNewTokens || 512, 4096)),
    },
    artifacts: [
      artifactFor(outputPath, "Distilled dataset JSONL", "application/jsonl"),
      artifactFor(paths.reportFile, "Distillation report", "text/markdown"),
      artifactFor(paths.manifestFile, "Operation manifest", "application/json"),
    ],
    metadata: {
      teacherTargetId: target.id,
      outputPath,
      includeReasoningTrace: Boolean(input.includeReasoningTrace),
    },
  });
  appendExperimentEvent({
    kind: "finetune",
    status: "completed",
    title: "Distillation starter dataset generated",
    summary: operation.summary,
    relatedId: operation.id,
    ...buildFineTuneOperationEventReferences(operation),
    targetIds: [target.id],
    metadata: {
      datasetId: dataset.id,
      outputPath,
    },
  });
  return { operation, dataset, validation };
}
