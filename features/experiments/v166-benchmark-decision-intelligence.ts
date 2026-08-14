import { createHash, randomUUID } from "node:crypto";

import { readBenchmarkDecisionIntelligence } from "@/features/benchmark/decision-intelligence-service";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const V166_BENCHMARK_DECISION_SCHEMA_VERSION =
  "experiments.v166-benchmark-decision-intelligence.v1" as const;
const STORE_SCHEMA_VERSION =
  "experiments.v166-benchmark-decision-intelligence-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.6.6-benchmark-decision-intelligence.json",
);

type Slice = {
  id: string;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type V166BenchmarkDecisionReceipt = {
  id: string;
  generatedAt: string;
  baselineRunId: string | null;
  candidateRunId: string | null;
  localStatus: "pass" | "hold";
  candidatePromotionStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  slices: Slice[];
  totals: { slices: 15; passed: number; held: number };
  decisionDigest: string | null;
  evidenceDigest: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slice(id: string, label: string, passed: boolean, summary: string): Slice {
  return { id, label, status: passed ? "pass" : "hold", summary };
}

function buildSlices(evidence: ReturnType<typeof readBenchmarkDecisionIntelligence>) {
  const audit = evidence.audit;
  const comparison = evidence.comparison;
  const taxonomyTotal =
    audit?.errorTaxonomy.reduce((sum, entry) => sum + entry.count, 0) || 0;
  const subjectRisks = audit?.cohortRisks.filter((entry) => entry.kind === "subject") || [];
  const difficultyRisks =
    audit?.cohortRisks.filter((entry) => entry.kind === "difficulty") || [];
  return [
    slice("baseline-complete", "Complete baseline", evidence.baseline?.samples === 500, evidence.baseline ? `${evidence.baseline.samples}/500 samples.` : "No complete baseline."),
    slice("run-digest", "Immutable run digest", !!evidence.baseline?.runDigest && evidence.baseline.runDigest.length === 64, evidence.baseline ? evidence.baseline.runDigest.slice(0, 16) : "Digest unavailable."),
    slice("item-accounting", "Per-item audit accounting", audit?.accountedSamples === 500, `${audit?.accountedSamples || 0}/500 items accounted.`),
    slice("error-taxonomy", "Error taxonomy balance", taxonomyTotal === 500, `${taxonomyTotal}/500 classified.`),
    slice("answer-extraction", "Answer extraction coverage", typeof audit?.extractionCoveragePct === "number", `${audit?.extractionCoveragePct ?? 0}% extraction coverage.`),
    slice("subject-risk", "Subject risk stratification", subjectRisks.length === 7, `${subjectRisks.length}/7 subject cohorts.`),
    slice("difficulty-risk", "Difficulty risk stratification", difficultyRisks.length === 5, `${difficultyRisks.length}/5 difficulty cohorts.`),
    slice("risk-policy", "Confidence-bound risk policy", audit?.cohortRisks.every((entry) => ["critical", "watch", "stable"].includes(entry.risk)) === true, "Every cohort has an explicit confidence-aware risk state."),
    slice("latency-outliers", "Latency outlier policy", (audit?.latencyOutliers.thresholdMs || 0) > 0, audit ? `${audit.latencyOutliers.count} samples above ${audit.latencyOutliers.thresholdMs} ms.` : "Latency policy unavailable."),
    slice("token-outliers", "Token outlier policy", (audit?.tokenOutliers.thresholdTokens || 0) > 0, audit ? `${audit.tokenOutliers.count} samples above ${audit.tokenOutliers.thresholdTokens} tokens.` : "Token policy unavailable."),
    slice("review-queue", "Bounded review queue", !!audit && audit.reviewQueue.length > 0 && audit.reviewQueue.length <= 24, `${audit?.reviewQueue.length || 0}/24 prioritized items.`),
    slice("power-targets", "Statistical power targets", evidence.power?.targets.length === 3, `${evidence.power?.targets.length || 0}/3 effect targets.`),
    slice("minimum-detectable-effect", "Minimum detectable effect", (evidence.power?.detectableEffectAtAvailableSamplesPct || 0) > 0, evidence.power ? `${evidence.power.detectableEffectAtAvailableSamplesPct} percentage points at the available sample size.` : "Power plan unavailable."),
    slice("candidate-fail-closed", "Candidate comparison fail-closed", !!comparison && (comparison.candidateRunId ? comparison.sharedSamples === 500 : comparison.status === "evidence-needed" && comparison.blockers.length > 0), comparison?.candidateRunId ? `${comparison.sharedSamples}/500 paired items.` : "No second distinct full run; promotion remains evidence-needed."),
    slice("truth-boundary", "Promotion truth boundary", evidence.localStatus === "pass" && evidence.productionStatus === "hold" && evidence.disclosure.includes("second distinct complete run"), "Local audit readiness is separated from candidate and production promotion."),
  ] satisfies Slice[];
}

export function runV166BenchmarkDecisionAcceptance() {
  const evidence = readBenchmarkDecisionIntelligence();
  const slices = buildSlices(evidence);
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const withoutDigest = {
    id: `v166-benchmark-decision-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    baselineRunId: evidence.baseline?.runId || null,
    candidateRunId: evidence.comparison?.candidateRunId || null,
    localStatus: passed === 15 ? ("pass" as const) : ("hold" as const),
    candidatePromotionStatus:
      evidence.comparison?.promotionDecision || ("evidence-needed" as const),
    productionStatus: "hold" as const,
    slices,
    totals: { slices: 15 as const, passed, held: 15 - passed },
    decisionDigest: evidence.decisionDigest,
  };
  const receipt: V166BenchmarkDecisionReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readV166BenchmarkDecisionEvidence() {
  const receipts = readDurableReceipts<V166BenchmarkDecisionReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  const decisionIntelligence = readBenchmarkDecisionIntelligence();
  const linked =
    !!latest &&
    latest.baselineRunId === decisionIntelligence.baseline?.runId &&
    latest.decisionDigest === decisionIntelligence.decisionDigest;
  return {
    ok: true as const,
    schemaVersion: V166_BENCHMARK_DECISION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus:
      linked && latest?.localStatus === "pass"
        ? ("pass" as const)
        : latest
          ? ("hold" as const)
          : ("evidence-needed" as const),
    candidatePromotionStatus:
      decisionIntelligence.comparison?.promotionDecision || ("evidence-needed" as const),
    productionStatus: "hold" as const,
    latest,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    decisionIntelligence,
    receiptPath: RECEIPT_PATH,
  };
}
