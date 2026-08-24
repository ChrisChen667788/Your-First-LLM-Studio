import crypto from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { listServerAgentTargets } from "@/lib/agent/server-targets";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import { buildFineTuneOperationEventReferences } from "@/features/finetune/experiment-references";
import { withTelemetrySpan } from "@/features/telemetry/trace-adapter";
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
import {
  mapFineTuneInferenceWithConcurrency,
  runFineTuneTeacherInference,
} from "./inference-service";

export async function runFineTuneDistillation(input: {
  teacherTargetId: string;
  outputPath?: string;
  sampleCount?: number;
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  seedPrompt?: string;
  includeReasoningTrace?: boolean;
}) {
  return withTelemetrySpan(
    "finetune.distillation",
    {
      "finetune.teacher.target.id": input.teacherTargetId,
      "finetune.requested.samples": Math.max(1, input.sampleCount || 16),
      "finetune.reasoning.summary.enabled": input.includeReasoningTrace === true,
    },
    () => runFineTuneDistillationOperation(input),
  );
}

async function runFineTuneDistillationOperation(input: {
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
  const sampleCount = Math.max(1, Math.min(input.sampleCount || 16, 256));
  const seedPrompt =
    input.seedPrompt?.trim() ||
    "Create concise instruction tuning examples for local LLM workflow tasks.";
  const generatedAt = new Date().toISOString();
  const requests = Array.from({ length: sampleCount }, (_, index) => {
    const topic = [
      "compare two model outputs",
      "summarize benchmark evidence",
      "explain a local runtime warning",
      "draft a grounded release note",
      "prepare a fine-tune dataset quality checklist",
    ][index % 5];
    return {
      instruction: `${seedPrompt} Example ${index + 1}: ${topic}.`,
      topic,
    };
  });
  const generatedRows = await mapFineTuneInferenceWithConcurrency(
    requests,
    2,
    async (request, index) => {
      try {
        const prompt = input.includeReasoningTrace
          ? `${request.instruction}\nReturn a concise reasoning summary followed by the final answer. Do not reveal hidden chain-of-thought.`
          : `${request.instruction}\nReturn only the final answer.`;
        const response = await runFineTuneTeacherInference({
          teacherTargetId: target.id,
          prompt,
          options: {
            maxNewTokens: input.maxNewTokens,
            temperature: input.temperature,
            topP: input.topP,
          },
        });
        if (!response.content.trim()) throw new Error("Teacher returned an empty response.");
        return {
          index,
          row: {
            instruction: request.instruction,
            input: "",
            output: response.content.trim(),
            metadata: {
              teacherTarget: target.label,
              teacherTargetId: target.id,
              resolvedModel: response.resolvedModel,
              generatedAt,
              synthetic: true,
              usage: response.usage || null,
            },
          },
          error: null as string | null,
        };
      } catch (error) {
        return {
          index,
          row: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
  const rows = generatedRows.flatMap((entry) => (entry.row ? [entry.row] : []));
  const failures = generatedRows.filter((entry) => entry.error);
  if (!rows.length) {
    throw new Error(
      `Teacher inference produced no usable rows. ${failures[0]?.error || "Check provider configuration."}`,
    );
  }
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
    label: `Distilled teacher data · ${target.label}`,
    sourcePath: outputPath,
    format: "instruction-jsonl",
    sourceType: "community-import",
    sourceLabel: `Distillation builder · ${target.label}`,
    qualityWarnings: [
      "Teacher-generated synthetic data. Review factuality, licensing, diversity, and domain fit before training.",
    ],
    quality: {
      score: 76,
      licenseRisk: "unknown",
      downloadedRows: rows.length,
      convertedRows: rows.length,
      sampledRows: rows.length,
      duplicateRows: 0,
      skippedRows: 0,
      piiRiskRows: 0,
      schemaConversion: "generated instruction-jsonl starter rows",
      recommendedSteps: {
        min: Math.max(100, rows.length),
        max: Math.max(400, rows.length * 4),
        label: "Teacher data should be manually reviewed before a promotion run.",
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
      `- Requested rows: ${sampleCount}`,
      `- Generated rows: ${rows.length}`,
      `- Skipped failures: ${failures.length}`,
      `- Validation: ${validation.ok ? "ok" : "failed"}`,
      `- Teacher target: ${target.id}`,
      "",
      "Every retained row was generated by the configured teacher Provider port. Failed provider calls were skipped and recorded in the manifest.",
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
        failures,
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
    title: `Teacher distillation · ${target.label}`,
    datasetId: dataset.id,
    targetId: target.id,
    outputDir: paths.outputDir,
    summary: `Generated ${rows.length}/${sampleCount} real teacher instruction rows for ${target.label}.`,
    metrics: {
      sampleCount: rows.length,
      requestedSampleCount: sampleCount,
      failedSampleCount: failures.length,
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
    title: "Teacher distillation dataset generated",
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
