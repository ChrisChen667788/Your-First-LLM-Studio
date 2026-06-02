import crypto from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { appendTimelineEvent } from "@/lib/agent/timeline-store";
import type { AgentFineTuneOperationArtifact } from "@/lib/agent/types";
import {
  artifactFor,
  getOperationPaths,
  saveFineTuneOperation,
} from "./repository";
import { normalizeUserPathInput } from "./store-internal";
import { resolveFineTuneAdapter } from "./operation-shared";

export function runFineTuneAdapterExport(input: {
  adapterId: string;
  exportFormat?: string;
  quantization?: string;
  maxShardSizeGb?: number;
  outputDir?: string;
  hubId?: string;
  includeDatasetCard?: boolean;
}) {
  const { adapter, job } = resolveFineTuneAdapter(input.adapterId);
  const id = `ft-op-export-${crypto.randomUUID()}`;
  const paths = getOperationPaths("export-adapter", id);
  const exportDir = input.outputDir?.trim()
    ? path.resolve(normalizeUserPathInput(input.outputDir))
    : path.join(paths.outputDir, "adapter-export");
  mkdirSync(paths.outputDir, { recursive: true });
  mkdirSync(exportDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const exportFormat = input.exportFormat?.trim() || "adapter-bundle";
  const quantization = input.quantization?.trim() || "none";
  const modelCardFile = path.join(exportDir, "MODEL_CARD.md");
  const datasetCardFile = path.join(exportDir, "DATASET_CARD.md");
  const exportManifestFile = path.join(
    exportDir,
    "adapter-export-manifest.json",
  );
  writeFileSync(
    modelCardFile,
    [
      `# ${adapter.adapterName}`,
      "",
      "This export was prepared by First LLM Studio.",
      "",
      `- Base target: ${adapter.baseTargetLabel || adapter.baseTargetId || "--"}`,
      `- Adapter source: ${adapter.outputDir}`,
      `- Export format: ${exportFormat}`,
      `- Quantization: ${quantization}`,
      `- Hub ID: ${input.hubId?.trim() || "--"}`,
      "",
      "## Recommended validation",
      "",
      "Run Compare against the base lane, then Benchmark with the same output contract before publishing.",
      "",
    ].join("\n"),
    "utf8",
  );
  if (input.includeDatasetCard) {
    writeFileSync(
      datasetCardFile,
      [
        `# Dataset card for ${adapter.adapterName}`,
        "",
        `Source job: ${adapter.jobId}`,
        `Dataset ID: ${job?.datasetId || "--"}`,
        "",
        "Review license, PII, duplication, and schema conversion notes before sharing.",
        "",
      ].join("\n"),
      "utf8",
    );
  }
  writeFileSync(
    exportManifestFile,
    JSON.stringify(
      {
        kind: "first-llm-studio-adapter-export",
        generatedAt,
        adapter,
        outputDir: exportDir,
        exportFormat,
        quantization,
        maxShardSizeGb: Math.max(1, Math.min(input.maxShardSizeGb || 5, 100)),
        hubId: input.hubId?.trim() || null,
        includeDatasetCard: Boolean(input.includeDatasetCard),
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(
    paths.reportFile,
    [
      `# Adapter Export: ${adapter.adapterName}`,
      "",
      `Generated: ${generatedAt}`,
      "",
      `- Export directory: ${exportDir}`,
      `- Format: ${exportFormat}`,
      `- Quantization: ${quantization}`,
      `- Source adapter: ${adapter.outputDir}`,
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    paths.manifestFile,
    JSON.stringify(
      {
        kind: "first-llm-studio-finetune-operation",
        operationKind: "export-adapter",
        generatedAt,
        adapter,
        exportDir,
      },
      null,
      2,
    ),
    "utf8",
  );
  const artifacts = [
    artifactFor(paths.reportFile, "Export report", "text/markdown"),
    artifactFor(
      exportManifestFile,
      "Adapter export manifest",
      "application/json",
    ),
    artifactFor(modelCardFile, "Model card", "text/markdown"),
    input.includeDatasetCard
      ? artifactFor(datasetCardFile, "Dataset card", "text/markdown")
      : null,
    artifactFor(paths.manifestFile, "Operation manifest", "application/json"),
  ].filter((artifact): artifact is AgentFineTuneOperationArtifact =>
    Boolean(artifact),
  );
  const operation = saveFineTuneOperation({
    id,
    kind: "export-adapter",
    status: "completed",
    title: `Export · ${adapter.adapterName}`,
    adapterId: adapter.id,
    jobId: adapter.jobId,
    outputDir: paths.outputDir,
    summary: `Prepared ${exportFormat} export in ${exportDir}.`,
    metrics: {
      maxShardSizeGb: Math.max(1, Math.min(input.maxShardSizeGb || 5, 100)),
    },
    artifacts,
    metadata: {
      exportDir,
      exportFormat,
      quantization,
      hubId: input.hubId?.trim() || "",
    },
  });
  appendTimelineEvent({
    kind: "finetune",
    status: "completed",
    title: "Adapter export prepared",
    summary: operation.summary,
    relatedId: operation.id,
    metadata: {
      adapterId: adapter.id,
      exportDir,
    },
  });
  return operation;
}
