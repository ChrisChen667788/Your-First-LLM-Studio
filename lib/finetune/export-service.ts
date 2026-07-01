import crypto from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import { buildFineTuneOperationEventReferences } from "@/features/finetune/experiment-references";
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
  publishTarget?: string;
  licenseReviewed?: boolean;
  datasetAttributionReviewed?: boolean;
  secretScanStatus?: string;
  samplePrompts?: string;
  knownLimitations?: string;
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
  const requestedPublishTarget = input.publishTarget?.trim() || "local";
  const publishTarget = ["huggingface", "modelscope", "local"].includes(
    requestedPublishTarget,
  )
    ? requestedPublishTarget
    : "local";
  const requestedSecretScanStatus = input.secretScanStatus?.trim() || "not-run";
  const secretScanStatus = ["not-run", "passed", "needs-review"].includes(
    requestedSecretScanStatus,
  )
    ? requestedSecretScanStatus
    : "not-run";
  const samplePrompts = (input.samplePrompts || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  const knownLimitations =
    input.knownLimitations?.trim() ||
    "No limitations were recorded in the export wizard.";
  const modelCardFile = path.join(exportDir, "MODEL_CARD.md");
  const datasetCardFile = path.join(exportDir, "DATASET_CARD.md");
  const publishChecklistFile = path.join(exportDir, "PUBLISH_CHECKLIST.md");
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
      `- Publish target: ${publishTarget}`,
      `- Hub ID: ${input.hubId?.trim() || "--"}`,
      "",
      "## Sample prompts",
      "",
      ...(samplePrompts.length
        ? samplePrompts.map((prompt) => `- ${prompt}`)
        : ["- Add at least one representative prompt before publishing."]),
      "",
      "## Known limitations",
      "",
      knownLimitations,
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
  const publishChecklist = {
    licenseReviewed: Boolean(input.licenseReviewed),
    datasetAttributionReviewed: Boolean(input.datasetAttributionReviewed),
    secretScanStatus,
    samplePromptCount: samplePrompts.length,
    knownLimitationsRecorded: Boolean(input.knownLimitations?.trim()),
  };
  const publishChecklistStatus =
    publishChecklist.licenseReviewed &&
    publishChecklist.datasetAttributionReviewed &&
    publishChecklist.secretScanStatus === "passed" &&
    publishChecklist.samplePromptCount > 0 &&
    publishChecklist.knownLimitationsRecorded
      ? "PASS"
      : "HOLD";
  writeFileSync(
    publishChecklistFile,
    [
      `# Publish Checklist: ${adapter.adapterName}`,
      "",
      `Generated: ${generatedAt}`,
      "",
      `- Publish target: ${publishTarget}`,
      `- License reviewed: ${publishChecklist.licenseReviewed ? "yes" : "no"}`,
      `- Dataset attribution reviewed: ${publishChecklist.datasetAttributionReviewed ? "yes" : "no"}`,
      `- Secret scan status: ${publishChecklist.secretScanStatus}`,
      `- Sample prompts: ${publishChecklist.samplePromptCount}`,
      `- Known limitations recorded: ${publishChecklist.knownLimitationsRecorded ? "yes" : "no"}`,
      "",
      "## Release gate",
      "",
      publishChecklistStatus === "PASS"
        ? "PASS: Ready for a publication rehearsal."
        : "HOLD: Complete the missing publish checklist items before public release.",
      "",
    ].join("\n"),
    "utf8",
  );
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
        publishTarget,
        publishChecklist,
        samplePrompts,
        knownLimitations,
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
      `- Publish target: ${publishTarget}`,
      `- Source adapter: ${adapter.outputDir}`,
      `- Publish checklist: ${publishChecklistFile}`,
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
        publishTarget,
        publishChecklist,
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
    artifactFor(publishChecklistFile, "Publish checklist", "text/markdown"),
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
      publishTarget,
      publishChecklistStatus,
      licenseReviewed: publishChecklist.licenseReviewed,
      datasetAttributionReviewed: publishChecklist.datasetAttributionReviewed,
      secretScanStatus: publishChecklist.secretScanStatus,
      samplePromptCount: publishChecklist.samplePromptCount,
      knownLimitationsRecorded: publishChecklist.knownLimitationsRecorded,
    },
  });
  appendExperimentEvent({
    kind: "finetune",
    status: "completed",
    title: "Adapter export prepared",
    summary: operation.summary,
    relatedId: operation.id,
    ...buildFineTuneOperationEventReferences(operation),
    metadata: {
      adapterId: adapter.id,
      exportDir,
      publishTarget,
      publishChecklistStatus,
      licenseReviewed: publishChecklist.licenseReviewed,
      datasetAttributionReviewed: publishChecklist.datasetAttributionReviewed,
      secretScanStatus: publishChecklist.secretScanStatus,
      samplePromptCount: publishChecklist.samplePromptCount,
      knownLimitationsRecorded: publishChecklist.knownLimitationsRecorded,
    },
  });
  return operation;
}
