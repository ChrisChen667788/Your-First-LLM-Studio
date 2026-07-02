import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { buildBenchmarkReleaseEvidenceSummary } from "@/features/benchmark/release-evidence-summary";
import type {
  PromotionGateResponse,
  PromotionGateSource,
  PromotionGateSourceStatus,
} from "@/features/experiments/contracts";
import { RELEASE_TRAIN_ACTIVE_VERSION } from "@/features/experiments/release-train";
import { readProviderOpsEvidenceSummary } from "@/features/providers/provider-ops-evidence";
import { readFineTuneSummary } from "@/lib/finetune/store";

const PROMOTION_GATE_SCHEMA_VERSION = "experiments.promotion-gate.v1" as const;
const REAL_LORA_EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs",
  "release-evidence",
  "finetune-qwen4b-lora-2026-07-01",
);
const DOCS_FRESHNESS_WINDOW_DAYS = 14;
const ADAPTER_EXPORT_REQUIRED_FILES = [
  {
    label: "Adapter export manifest",
    relativePath: "adapter-export-manifest.json",
    minBytes: 200,
  },
  {
    label: "Model card",
    relativePath: "MODEL_CARD.md",
    minBytes: 200,
  },
  {
    label: "Publish checklist",
    relativePath: "PUBLISH_CHECKLIST.md",
    minBytes: 200,
  },
] as const;
const DOCS_SCREENSHOT_EVIDENCE_FILES = [
  {
    label: "v0.4.2 release notes",
    relativePath: "docs/releases/v0.4.2_2026-07-02.md",
    minBytes: 1000,
  },
  {
    label: "Release train",
    relativePath: "docs/next-10-release-train.md",
    minBytes: 1000,
  },
  {
    label: "Development roadmap",
    relativePath: "docs/development-roadmap.md",
    minBytes: 1000,
  },
  {
    label: "Fine-tune studio screenshot",
    relativePath: "docs/assets/screenshots/fine-tune-studio.png",
    minBytes: 150_000,
  },
  {
    label: "LoRA chart screenshot",
    relativePath: "docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png",
    minBytes: 150_000,
  },
  {
    label: "Training curve screenshot",
    relativePath: "docs/assets/screenshots/fine-tune-training-curve.png",
    minBytes: 150_000,
  },
  {
    label: "Benchmark run evidence screenshot",
    relativePath: "docs/assets/screenshots/benchmark-run-evidence.png",
    minBytes: 150_000,
  },
  {
    label: "Models studio screenshot",
    relativePath: "docs/assets/screenshots/models-studio.png",
    minBytes: 150_000,
  },
] as const;

type EvidenceFileCheck = {
  label: string;
  relativePath: string;
  filePath: string;
  exists: boolean;
  sizeBytes: number;
  minBytes: number;
  updatedAt: string | null;
  lfsPointer: boolean;
  ok: boolean;
};

function combineStatus(statuses: PromotionGateSourceStatus[]): PromotionGateSourceStatus {
  if (statuses.includes("hold")) return "hold";
  if (statuses.includes("watch")) return "watch";
  return "pass";
}

function readMetadataString(
  metadata: Record<string, number | string | boolean | null | string[]> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readJsonFile(filePath: string) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isGitLfsPointer(filePath: string) {
  try {
    const prefix = readFileSync(filePath).subarray(0, 128).toString("utf8");
    return prefix.startsWith("version https://git-lfs.github.com/spec/");
  } catch {
    return false;
  }
}

function checkEvidenceFile(input: {
  label: string;
  relativePath: string;
  filePath: string;
  minBytes: number;
}): EvidenceFileCheck {
  if (!existsSync(input.filePath)) {
    return {
      ...input,
      exists: false,
      sizeBytes: 0,
      updatedAt: null,
      lfsPointer: false,
      ok: false,
    };
  }
  try {
    const stats = statSync(input.filePath);
    const lfsPointer = isGitLfsPointer(input.filePath);
    return {
      ...input,
      exists: true,
      sizeBytes: stats.size,
      updatedAt: new Date(stats.mtimeMs).toISOString(),
      lfsPointer,
      ok: !lfsPointer && stats.size >= input.minBytes,
    };
  } catch {
    return {
      ...input,
      exists: false,
      sizeBytes: 0,
      updatedAt: null,
      lfsPointer: false,
      ok: false,
    };
  }
}

function countStaleFiles(checks: EvidenceFileCheck[]) {
  const cutoffMs = Date.now() - DOCS_FRESHNESS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return checks.filter((check) => {
    if (!check.updatedAt || !check.ok) return false;
    return new Date(check.updatedAt).getTime() < cutoffMs;
  }).length;
}

function buildBenchmarkSource(): PromotionGateSource {
  const summary = buildBenchmarkReleaseEvidenceSummary();
  const blockers: string[] = [];
  if (summary.totals.evidenceCount === 0) {
    blockers.push("No pinned benchmark release evidence is available.");
  }
  if (summary.totals.missingRunCount > 0) {
    blockers.push(`${summary.totals.missingRunCount} pinned benchmark evidence item(s) reference missing runs.`);
  }
  if (summary.totals.failedRuns > 0 || summary.totals.skippedRuns > 0) {
    blockers.push(`${summary.totals.failedRuns} failed and ${summary.totals.skippedRuns} skipped benchmark sample(s) need review.`);
  }
  const status: PromotionGateSourceStatus =
    summary.totals.evidenceCount === 0 || summary.totals.missingRunCount > 0
      ? "hold"
      : summary.totals.failedRuns > 0 || summary.totals.skippedRuns > 0
        ? "watch"
        : "pass";
  return {
    id: "benchmark",
    label: "Benchmark release evidence",
    status,
    summary: `${summary.totals.evidenceCount} pinned evidence item(s), ${summary.totals.groupCount} group(s), ${summary.totals.successRatePct}% sample success.`,
    metrics: {
      evidenceCount: summary.totals.evidenceCount,
      matchedRunCount: summary.totals.matchedRunCount,
      groupCount: summary.totals.groupCount,
      successRatePct: summary.totals.successRatePct,
      failedRuns: summary.totals.failedRuns,
      skippedRuns: summary.totals.skippedRuns,
    },
    evidence: [
      "/api/admin/benchmark/evidence",
      "benchmark.release-evidence-summary.v1",
    ],
    blockers,
    releaseNoteDraft: summary.releaseNoteDraft,
  };
}

function buildProviderOpsSource(): PromotionGateSource {
  const summary = readProviderOpsEvidenceSummary({ windowHours: 24 });
  const blockers: string[] = [];
  if (summary.totals.totalRequests === 0) {
    blockers.push("No remote provider requests were observed in the 24h promotion evidence window.");
  }
  if (summary.totals.actionRequiredCount > 0) {
    blockers.push(`${summary.totals.actionRequiredCount} provider(s) require action before promotion.`);
  }
  if (summary.totals.authFailureCount > 0 || summary.totals.rateLimitCount > 0) {
    blockers.push("Authentication or quota/rate-limit failures are present in Provider Ops evidence.");
  }
  const status: PromotionGateSourceStatus =
    summary.totals.actionRequiredCount > 0 ||
    summary.totals.authFailureCount > 0 ||
    summary.totals.rateLimitCount > 0
      ? "hold"
      : summary.totals.totalRequests === 0 || summary.totals.watchCount > 0 || summary.totals.successRatePct < 95
        ? "watch"
        : "pass";
  return {
    id: "provider-ops",
    label: "Provider Ops evidence",
    status,
    summary: `${summary.totals.providerCount} provider target(s), ${summary.totals.totalRequests} request(s), ${summary.totals.successRatePct}% success.`,
    metrics: {
      providerCount: summary.totals.providerCount,
      totalRequests: summary.totals.totalRequests,
      successRatePct: summary.totals.successRatePct,
      actionRequiredCount: summary.totals.actionRequiredCount,
      watchCount: summary.totals.watchCount,
      totalTokens: summary.totals.totalTokens,
      estimatedCostUsd: summary.totals.estimatedCostUsd,
    },
    evidence: [
      "/api/admin/provider-health/evidence",
      "provider.ops-evidence-summary.v1",
    ],
    blockers,
    releaseNoteDraft: summary.releaseNoteDraft,
  };
}

function buildAdapterExportSource(): PromotionGateSource {
  const summary = readFineTuneSummary();
  const exportOperations = summary.operations
    .filter((operation) => operation.kind === "export-adapter" && operation.status === "completed")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const latestOperation = exportOperations[0];
  const blockers: string[] = [];
  if (!latestOperation) {
    blockers.push("No completed adapter export operation is available for promotion.");
  }

  const manifestArtifact = latestOperation?.artifacts.find(
    (artifact) =>
      artifact.filePath.endsWith("adapter-export-manifest.json") ||
      artifact.label.toLowerCase().includes("adapter export manifest"),
  );
  const exportDir =
    readMetadataString(latestOperation?.metadata, "exportDir") ||
    (manifestArtifact ? path.dirname(manifestArtifact.filePath) : "") ||
    latestOperation?.outputDir ||
    "";
  const manifestPath = exportDir
    ? path.join(exportDir, "adapter-export-manifest.json")
    : "";
  const manifest = manifestPath ? readJsonFile(manifestPath) : null;
  const datasetCardRequired =
    manifest?.includeDatasetCard === true ||
    Boolean(
      latestOperation?.artifacts.some(
        (artifact) =>
          artifact.filePath.endsWith("DATASET_CARD.md") ||
          artifact.label.toLowerCase().includes("dataset card"),
      ),
    );
  const requiredFiles = datasetCardRequired
    ? [
        ...ADAPTER_EXPORT_REQUIRED_FILES,
        {
          label: "Dataset card",
          relativePath: "DATASET_CARD.md",
          minBytes: 80,
        },
      ]
    : ADAPTER_EXPORT_REQUIRED_FILES;
  const checks = exportDir
    ? requiredFiles.map((file) =>
        checkEvidenceFile({
          ...file,
          filePath: path.join(exportDir, file.relativePath),
        }),
      )
    : [];
  const missingFiles = checks.filter((check) => !check.exists);
  const undersizedFiles = checks.filter((check) => check.exists && check.sizeBytes < check.minBytes);
  const lfsPointerFiles = checks.filter((check) => check.lfsPointer);
  if (latestOperation && !exportDir) {
    blockers.push("Latest adapter export operation does not expose an export directory.");
  }
  missingFiles.forEach((file) => blockers.push(`Missing ${file.label}: ${file.relativePath}.`));
  undersizedFiles.forEach((file) =>
    blockers.push(`${file.label} is below the required evidence size (${file.sizeBytes}/${file.minBytes} bytes).`),
  );
  lfsPointerFiles.forEach((file) => blockers.push(`${file.label} is still a Git LFS pointer.`));

  const checklistStatus = readMetadataString(latestOperation?.metadata, "publishChecklistStatus") || "UNKNOWN";
  const packageComplete = Boolean(latestOperation) && checks.length > 0 && checks.every((check) => check.ok);
  const status: PromotionGateSourceStatus = !latestOperation || !packageComplete
    ? "hold"
    : checklistStatus === "PASS"
      ? "pass"
      : "watch";

  return {
    id: "adapter-export",
    label: "Adapter Export package",
    status,
    summary: latestOperation
      ? `${exportOperations.length} completed export operation(s); ${checks.filter((check) => check.ok).length}/${checks.length} required package file(s) verified.`
      : "No completed adapter export operation is available.",
    metrics: {
      completedExportOperations: exportOperations.length,
      requiredFileCount: checks.length,
      verifiedFileCount: checks.filter((check) => check.ok).length,
      missingFileCount: missingFiles.length,
      lfsPointerFileCount: lfsPointerFiles.length,
      latestExportDir: exportDir || null,
      publishChecklistStatus: checklistStatus,
      datasetCardRequired,
    },
    evidence: [
      "/api/finetune",
      exportDir || "adapter-export-directory-missing",
      latestOperation?.id || "adapter-export-operation-missing",
    ],
    blockers,
    releaseNoteDraft: [
      latestOperation
        ? `Adapter Export package gate checked ${checks.length} required file(s) for ${latestOperation.title}.`
        : "Adapter Export package gate is blocked until a completed export operation exists.",
      `Publish checklist status: ${checklistStatus}; verified files: ${checks.filter((check) => check.ok).length}/${checks.length}.`,
    ],
  };
}

function buildDocsScreenshotsSource(): PromotionGateSource {
  const checks = DOCS_SCREENSHOT_EVIDENCE_FILES.map((file) =>
    checkEvidenceFile({
      ...file,
      filePath: path.join(process.cwd(), file.relativePath),
    }),
  );
  const missingFiles = checks.filter((check) => !check.exists);
  const undersizedFiles = checks.filter((check) => check.exists && check.sizeBytes < check.minBytes);
  const lfsPointerFiles = checks.filter((check) => check.lfsPointer);
  const staleFileCount = countStaleFiles(checks);
  const blockers = [
    ...missingFiles.map((file) => `Missing release evidence file: ${file.relativePath}.`),
    ...undersizedFiles.map(
      (file) => `${file.label} is below the minimum freshness size (${file.sizeBytes}/${file.minBytes} bytes).`,
    ),
    ...lfsPointerFiles.map((file) => `${file.label} is still a Git LFS pointer.`),
  ];
  const latestUpdatedAt = checks
    .map((check) => check.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null;
  const status: PromotionGateSourceStatus = blockers.length > 0
    ? "hold"
    : staleFileCount > 0
      ? "watch"
      : "pass";

  return {
    id: "docs-screenshots",
    label: "Docs and screenshot freshness",
    status,
    summary: `${checks.filter((check) => check.ok).length}/${checks.length} release doc and screenshot evidence file(s) verified.`,
    metrics: {
      checkedFiles: checks.length,
      verifiedFiles: checks.filter((check) => check.ok).length,
      missingFiles: missingFiles.length,
      undersizedFiles: undersizedFiles.length,
      lfsPointerFiles: lfsPointerFiles.length,
      staleFiles: staleFileCount,
      freshnessWindowDays: DOCS_FRESHNESS_WINDOW_DAYS,
      totalBytes: checks.reduce((sum, check) => sum + check.sizeBytes, 0),
      latestUpdatedAt,
    },
    evidence: checks.map((check) => check.relativePath),
    blockers,
    releaseNoteDraft: [
      `Release docs/screenshots gate verified ${checks.filter((check) => check.ok).length}/${checks.length} file(s).`,
      latestUpdatedAt
        ? `Latest screenshot/docs evidence timestamp: ${latestUpdatedAt}.`
        : "No screenshot/docs evidence timestamp is available.",
    ],
  };
}

function buildFineTuneSource(): PromotionGateSource {
  const summary = readFineTuneSummary();
  const readyAdapters = summary.adapters.filter((adapter) => adapter.status === "ready");
  const completedJobs = summary.jobs.filter((job) => job.status === "completed");
  const exportOperations = summary.operations.filter(
    (operation) => operation.kind === "export-adapter" && operation.status === "completed",
  );
  const hasRealLoraEvidence =
    existsSync(path.join(REAL_LORA_EVIDENCE_DIR, "README.md")) &&
    existsSync(path.join(REAL_LORA_EVIDENCE_DIR, "training-report.md"));
  const adaptersWithBestCheckpoint = readyAdapters.filter((adapter) => adapter.bestCheckpoint);
  const blockers: string[] = [];
  if (!hasRealLoraEvidence) {
    blockers.push("Real Qwen 4B LoRA release evidence files are missing.");
  }
  if (!readyAdapters.length && !completedJobs.length) {
    blockers.push("No completed fine-tune job or ready adapter is present in the local summary.");
  }
  const status: PromotionGateSourceStatus =
    hasRealLoraEvidence && (readyAdapters.length > 0 || completedJobs.length > 0)
      ? adaptersWithBestCheckpoint.length || completedJobs.some((job) => job.bestCheckpoint)
        ? "pass"
        : "watch"
      : hasRealLoraEvidence
        ? "watch"
        : "hold";
  return {
    id: "fine-tune",
    label: "Fine-tune LoRA evidence",
    status,
    summary: `${completedJobs.length} completed job(s), ${readyAdapters.length} ready adapter(s), ${exportOperations.length} completed export operation(s).`,
    metrics: {
      datasetCount: summary.datasets.length,
      recipeCount: summary.recipes.length,
      completedJobs: completedJobs.length,
      readyAdapters: readyAdapters.length,
      adaptersWithBestCheckpoint: adaptersWithBestCheckpoint.length,
      completedExportOperations: exportOperations.length,
      realLoraEvidence: hasRealLoraEvidence,
    },
    evidence: [
      "/api/finetune",
      "docs/release-evidence/finetune-qwen4b-lora-2026-07-01",
    ],
    blockers,
    releaseNoteDraft: [
      hasRealLoraEvidence
        ? "Real Qwen 4B LoRA release evidence is present with README and training report."
        : "Real Qwen 4B LoRA release evidence is missing.",
      `${completedJobs.length} completed fine-tune job(s), ${readyAdapters.length} ready adapter(s), ${adaptersWithBestCheckpoint.length} adapter(s) with best-checkpoint metadata.`,
    ],
  };
}

export function readPromotionGate(): PromotionGateResponse {
  const sources = [
    buildBenchmarkSource(),
    buildProviderOpsSource(),
    buildFineTuneSource(),
    buildAdapterExportSource(),
    buildDocsScreenshotsSource(),
  ];
  const blockers = sources.flatMap((source) =>
    source.blockers.map((blocker) => `${source.label}: ${blocker}`),
  );
  return {
    ok: true,
    schemaVersion: PROMOTION_GATE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    activeVersion: RELEASE_TRAIN_ACTIVE_VERSION,
    overallStatus: combineStatus(sources.map((source) => source.status)),
    sources,
    blockers,
    releaseNoteDraft: sources.flatMap((source) => source.releaseNoteDraft.slice(0, 3)),
  };
}
