import { existsSync } from "fs";
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

function combineStatus(statuses: PromotionGateSourceStatus[]): PromotionGateSourceStatus {
  if (statuses.includes("hold")) return "hold";
  if (statuses.includes("watch")) return "watch";
  return "pass";
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
