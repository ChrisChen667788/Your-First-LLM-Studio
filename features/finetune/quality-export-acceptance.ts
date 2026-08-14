import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readQualityArtifactBindingEvidence } from "@/features/evaluation/quality-artifact-binding";
import { readReleaseCandidateAcceptanceEvidence } from "@/features/evaluation/release-candidate-acceptance";
import {
  FINETUNE_PAIRED_QUALITY_SCHEMA_VERSION,
  evaluateFineTunePairedQuality,
  type FineTunePairedQualityObservation,
} from "@/features/finetune/paired-quality-contract";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { readBenchmarkLogs } from "@/lib/agent/log-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import {
  FINETUNE_ADAPTER_PACKAGE_SCHEMA_VERSION,
  buildFineTuneAdapterPackage,
} from "@/lib/finetune/export-package-service";
import { resolveFineTuneAdapter } from "@/lib/finetune/operation-shared";

export const FINETUNE_QUALITY_EXPORT_SCHEMA_VERSION =
  "finetune.quality-export-acceptance.v1" as const;
const STORE_SCHEMA_VERSION = "finetune.quality-export-acceptance-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.6.9-finetune-quality-export.json",
);
const PACKAGE_ROOT = getLocalAgentDataPath(
  "experiments",
  "v1.6.9-finetune-quality-export-packages",
);

type Slice = {
  id: string;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type FineTuneQualityExportReceipt = {
  id: string;
  generatedAt: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: Slice[];
  totals: { slices: 15; passed: number; held: number };
  quality: null | {
    schemaVersion: typeof FINETUNE_PAIRED_QUALITY_SCHEMA_VERSION;
    decision: "promote" | "hold" | "reject";
    observations: number;
    seeds: number;
    pairedMeanDifference: number;
    confidenceInterval95: { lower: number; upper: number };
    evidenceDigest: string;
  };
  package: null | {
    schemaVersion: typeof FINETUNE_ADAPTER_PACKAGE_SCHEMA_VERSION;
    adapterId: string;
    archivePath: string;
    archiveBytes: number;
    archiveSha256: string;
    payloadDigest: string;
    selectedCheckpointFile: string;
    readBackVerified: boolean;
    rollbackVerified: boolean;
  };
  evidenceDigest: string;
  disclosure: string;
  blockers: string[];
  productionBlockers: string[];
  error?: string;
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function slice(id: string, label: string, passed: boolean, summary: string): Slice {
  return { id, label, status: passed ? "pass" : "hold", summary };
}

function seedFromRunNote(note: string | undefined, fallback: number) {
  const match = note?.match(/seed\s+(\d+)/i);
  return match ? Number(match[1]) : fallback;
}

function groupByItem<T extends { itemId?: string }>(samples: T[]) {
  const groups = new Map<string, T[]>();
  samples.forEach((sample) => {
    if (!sample.itemId) return;
    const current = groups.get(sample.itemId) || [];
    current.push(sample);
    groups.set(sample.itemId, current);
  });
  return groups;
}

function buildRealPairedQuality() {
  const bindingEvidence = readQualityArtifactBindingEvidence();
  const releaseCandidateEvidence = readReleaseCandidateAcceptanceEvidence();
  const binding = bindingEvidence.latestPassing;
  const releaseCandidate = releaseCandidateEvidence.latestPassing;
  if (!binding || !releaseCandidate) {
    throw new Error("Real paired quality and release-candidate evidence are required.");
  }
  const baseTargetId = binding.selected.baseTargetId;
  const adapterTargetId = binding.selected.adapterTargetId;
  const adapterId = binding.selected.adapterId;
  const checkpointPath = binding.selected.checkpointPath;
  if (!baseTargetId || !adapterTargetId || !adapterId || !checkpointPath) {
    throw new Error("Quality binding is missing its model, adapter, or checkpoint identity.");
  }
  const runIds = new Set(releaseCandidate.workload.benchmarkRunIds);
  const logs = readBenchmarkLogs().filter((log) => runIds.has(log.id));
  const observations: FineTunePairedQualityObservation[] = [];
  const seeds: number[] = [];
  logs.forEach((log, logIndex) => {
    const seed = seedFromRunNote(log.runNote, logIndex + 1);
    seeds.push(seed);
    const baseline = log.results.find((result) => result.targetId === baseTargetId);
    const adapter = log.results.find((result) => result.targetId === adapterTargetId);
    if (!baseline || !adapter) return;
    const baselineGroups = groupByItem(baseline.samples);
    const adapterGroups = groupByItem(adapter.samples);
    baselineGroups.forEach((baselineSamples, itemId) => {
      const adapterSamples = adapterGroups.get(itemId) || [];
      const pairCount = Math.min(baselineSamples.length, adapterSamples.length);
      for (let index = 0; index < pairCount; index += 1) {
        const left = baselineSamples[index];
        const right = adapterSamples[index];
        if (!Number.isFinite(left.score) || !Number.isFinite(right.score)) continue;
        observations.push({
          sampleId: `${log.id}:${itemId}:${index + 1}`,
          seed,
          baselineScore: left.score as number,
          adapterScore: right.score as number,
        });
      }
    });
  });
  const promptSetSha256 = sha256(
    JSON.stringify(
      logs.map((log) => ({
        datasetId: log.datasetId,
        datasetSourceUrl: log.datasetSourceUrl,
        workloads: log.workloads,
      })),
    ),
  );
  const quality = evaluateFineTunePairedQuality({
    datasetId: logs[0]?.datasetId || "unknown-dataset",
    datasetRevision: sha256(
      JSON.stringify(logs.map((log) => [log.datasetId, log.datasetSourceUrl])),
    ),
    promptSetSha256,
    baseModelId: baseTargetId,
    baseModelRevision:
      binding.digests.trainingManifest || binding.digests.registryRecord || baseTargetId,
    adapterId,
    checkpointSha256:
      releaseCandidate.artifact.checkpointSha256 || binding.digests.adapterArtifact || "",
    evaluatorId: "ifeval-starter-deterministic",
    evaluatorVersion: bindingEvidence.schemaVersion,
    seeds,
    observations,
    minimumImprovement: 0,
  });
  return { binding, releaseCandidate, adapterId, checkpointPath, logs, quality };
}

export function runFineTuneQualityExportAcceptance() {
  const id = `v169-finetune-quality-export-${randomUUID()}`;
  const generatedAt = new Date().toISOString();
  const slices: Slice[] = [];
  let qualitySummary: FineTuneQualityExportReceipt["quality"] = null;
  let packageSummary: FineTuneQualityExportReceipt["package"] = null;
  let error: string | undefined;

  try {
    const paired = buildRealPairedQuality();
    const quality = paired.quality;
    qualitySummary = {
      schemaVersion: quality.schemaVersion,
      decision: quality.decision,
      observations: quality.coverage.observations,
      seeds: quality.coverage.seeds,
      pairedMeanDifference: quality.statistics.pairedMeanDifference,
      confidenceInterval95: quality.statistics.confidenceInterval95,
      evidenceDigest: quality.evidenceDigest,
    };
    slices.push(
      slice("real-quality-binding", "Real quality binding", paired.binding.status === "pass", paired.binding.id),
      slice("paired-sample-coverage", "Paired sample coverage", quality.coverage.observations >= 30, `${quality.coverage.observations} observations`),
      slice("multi-seed-coverage", "Multi-seed coverage", quality.coverage.seeds >= 3, `${quality.coverage.seeds} seeds`),
      slice("frozen-inputs", "Frozen input identity", /^[a-f0-9]{64}$/i.test(quality.frozenInputs.promptSetSha256) && /^[a-f0-9]{64}$/i.test(quality.frozenInputs.checkpointSha256), `${quality.frozenInputs.datasetId} · ${quality.frozenInputs.baseModelId}`),
      slice("confidence-interval", "Paired confidence interval", Number.isFinite(quality.statistics.confidenceInterval95.lower) && Number.isFinite(quality.statistics.confidenceInterval95.upper), JSON.stringify(quality.statistics.confidenceInterval95)),
      slice("quality-decision", "Explicit quality decision", ["promote", "hold", "reject"].includes(quality.decision), quality.decision),
    );

    const destinationDir = path.join(PACKAGE_ROOT, id);
    mkdirSync(destinationDir, { recursive: true });
    const qualityReportPath = path.join(destinationDir, "PAIRED_QUALITY_REPORT.json");
    writeFileSync(qualityReportPath, `${JSON.stringify(quality, null, 2)}\n`, "utf8");
    const { adapter } = resolveFineTuneAdapter(paired.adapterId);
    const packageReceipt = buildFineTuneAdapterPackage({
      adapterName: adapter.adapterName,
      baseTargetId: adapter.baseTargetId,
      outputDir: adapter.outputDir,
      requestedCheckpointPath: paired.checkpointPath,
      trainingConfigPath: adapter.configFile,
      destinationDir,
      extraFiles: [
        {
          source: qualityReportPath,
          relativePath: "evidence/PAIRED_QUALITY_REPORT.json",
          role: "evidence",
        },
      ],
    });
    const weights = packageReceipt.files.find((file) => file.role === "weights");
    packageSummary = {
      schemaVersion: packageReceipt.schemaVersion,
      adapterId: paired.adapterId,
      archivePath: packageReceipt.archivePath,
      archiveBytes: packageReceipt.archiveBytes,
      archiveSha256: packageReceipt.archiveSha256,
      payloadDigest: packageReceipt.payloadDigest,
      selectedCheckpointFile: packageReceipt.source.selectedCheckpointFile,
      readBackVerified: packageReceipt.readBack.verified,
      rollbackVerified: packageReceipt.readBack.rollbackVerified,
    };
    slices.push(
      slice("package-schema", "Adapter package schema", packageReceipt.schemaVersion === FINETUNE_ADAPTER_PACKAGE_SCHEMA_VERSION, packageReceipt.schemaVersion),
      slice("promoted-checkpoint", "Promoted checkpoint selected", packageReceipt.source.selectedCheckpointFile === realpathSync(paired.checkpointPath), packageReceipt.source.selectedCheckpointFile),
      slice("real-weight-bytes", "Real adapter bytes copied", Boolean(weights && weights.bytes > 1024), `${weights?.bytes || 0} bytes`),
      slice("weight-checksum", "Checkpoint checksum preserved", weights?.sha256 === paired.releaseCandidate.artifact.checkpointSha256, weights?.sha256 || "missing"),
      slice("manifest-written", "Package manifest written", existsSync(packageReceipt.manifestPath) && statSync(packageReceipt.manifestPath).isFile(), packageReceipt.manifestPath),
      slice("archive-written", "Installable archive written", existsSync(packageReceipt.archivePath) && packageReceipt.archiveBytes > 1024, `${packageReceipt.archiveBytes} bytes`),
      slice("archive-checksum", "Archive checksum", /^[a-f0-9]{64}$/i.test(packageReceipt.archiveSha256), packageReceipt.archiveSha256),
      slice("install-readback", "Install read-back", packageReceipt.readBack.verified && packageReceipt.readBack.installedCheckpointSha256 === weights?.sha256, `${packageReceipt.readBack.extractedFiles} files verified`),
      slice("rollback-secret-scan", "Rollback and secret scan", packageReceipt.readBack.rollbackVerified && packageReceipt.secretScan.status === "passed", `rollback=${packageReceipt.readBack.rollbackVerified}; scan=${packageReceipt.secretScan.status}`),
    );
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Fine-tune quality/export acceptance failed.";
  }

  while (slices.length < 15) {
    slices.push(slice(`acceptance-error-${slices.length + 1}`, "Acceptance interrupted", false, error || "Acceptance did not reach this slice."));
  }
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const blockers = slices
    .filter((entry) => entry.status === "hold")
    .map((entry) => `${entry.label}: ${entry.summary}`);
  const withoutDigest = {
    id,
    generatedAt,
    localStatus: passed === 15 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    slices,
    totals: { slices: 15 as const, passed, held: 15 - passed },
    quality: qualitySummary,
    package: packageSummary,
    disclosure:
      "This receipt binds an existing real local 0.6B three-seed paired evaluation to the exact checkpoint bytes copied into a checksummed archive and verified through install/read-back/rollback. It does not prove a fresh 4B quality run, remote Hub publication, independent worker replay, or production approval.",
    blockers,
    productionBlockers: [
      "Repeat the frozen paired workload with the representative 4B adapter on an independent worker.",
      "Execute verified MLX merge and GGUF quantization adapters before enabling those export formats.",
      "Publish to organization-controlled Hugging Face and ModelScope registries and verify remote read-back digests.",
      "Obtain organization sign-off; production distribution remains HOLD.",
    ],
    error,
  };
  const receipt: FineTuneQualityExportReceipt = {
    ...withoutDigest,
    evidenceDigest: sha256(JSON.stringify(withoutDigest)),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readFineTuneQualityExportEvidence() {
  const receipts = readDurableReceipts<FineTuneQualityExportReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: FINETUNE_QUALITY_EXPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: receipts[0]?.localStatus || ("evidence-needed" as const),
    productionStatus: "hold" as const,
    latest: receipts[0] || null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
    packageRoot: PACKAGE_ROOT,
  };
}
