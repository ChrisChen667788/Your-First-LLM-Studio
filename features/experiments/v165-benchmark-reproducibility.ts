import { createHash, randomUUID } from "node:crypto";

import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import {
  readMath500Reproducibility,
  replayLatestMath500Run,
} from "@/features/benchmark/reproducibility-service";

export const V165_BENCHMARK_REPRODUCIBILITY_SCHEMA_VERSION =
  "experiments.v165-benchmark-reproducibility.v1" as const;
const STORE_SCHEMA_VERSION =
  "experiments.v165-benchmark-reproducibility-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.6.5-benchmark-reproducibility.json",
);

type Slice = {
  id: string;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type V165BenchmarkReproducibilityReceipt = {
  id: string;
  generatedAt: string;
  runId: string | null;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: Slice[];
  totals: { slices: 15; passed: number; held: number };
  analysisDigest: string | null;
  replayReceiptId: string | null;
  multimodalPlanDigest: string;
  evidenceDigest: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slice(id: string, label: string, passed: boolean, summary: string): Slice {
  return { id, label, status: passed ? "pass" : "hold", summary };
}

function buildSlices(evidence: ReturnType<typeof readMath500Reproducibility>) {
  const analysis = evidence.analysis;
  const replay = evidence.replay;
  const plan = evidence.multimodalPlan;
  const failureTotal = analysis
    ? Object.values(analysis.failures).reduce((sum, value) => sum + value, 0)
    : -1;
  return [
    slice("dataset-provenance", "Pinned dataset provenance", !!analysis?.dataset.sha256 && analysis.dataset.rowCount === 500, analysis ? `${analysis.dataset.rowCount} rows at ${analysis.dataset.revision.slice(0, 12)}.` : "No qualified dataset."),
    slice("run-completeness", "Full-run completeness", analysis?.totals.samples === 500 && analysis.totals.successful === 500, analysis ? `${analysis.totals.successful}/${analysis.totals.samples} successful.` : "No full run."),
    slice("score-completeness", "Score completeness", analysis?.totals.scored === 500, analysis ? `${analysis.totals.scored}/500 scored.` : "No scorecard."),
    slice("runtime-failure-policy", "Runtime failure policy", analysis?.failures.runtime === 0, analysis ? `${analysis.failures.runtime} runtime failures.` : "Failure taxonomy unavailable."),
    slice("evaluator-fingerprint", "Evaluator fingerprint", !!analysis?.evaluator.fingerprint && analysis.evaluator.version === "0.9.0", analysis ? `Fingerprint ${analysis.evaluator.fingerprint.slice(0, 16)}.` : "Evaluator fingerprint unavailable."),
    slice("run-content-digest", "Run content digest", !!analysis?.runDigest, analysis ? `Digest ${analysis.runDigest.slice(0, 16)}.` : "Run digest unavailable."),
    slice("subject-coverage", "Subject scorecard", analysis?.subjects.length === 7 && analysis.subjects.reduce((sum, entry) => sum + entry.total, 0) === 500, analysis ? `${analysis.subjects.length}/7 subjects, 500 scored rows.` : "Subject scorecard unavailable."),
    slice("difficulty-coverage", "Difficulty scorecard", analysis?.levels.length === 5 && analysis.levels.reduce((sum, entry) => sum + entry.total, 0) === 500, analysis ? `${analysis.levels.length}/5 difficulty levels.` : "Difficulty scorecard unavailable."),
    slice("wilson-confidence", "Wilson confidence interval", analysis?.confidence?.method === "wilson-95" && analysis.confidence.high >= analysis.confidence.low, analysis?.confidence ? `${analysis.confidence.low}% to ${analysis.confidence.high}%.` : "Confidence interval unavailable."),
    slice("checkpoint-accounting", "Checkpoint accounting", analysis ? analysis.totals.resumed + analysis.totals.inferred === 500 : false, analysis ? `${analysis.totals.resumed} resumed and ${analysis.totals.inferred} inferred.` : "Checkpoint accounting unavailable."),
    slice("isolated-replay-completeness", "Isolated replay completeness", replay?.replayedSamples === 500 && replay.unavailableSamples === 0, replay ? `${replay.replayedSamples}/500 replayed.` : "Replay not run."),
    slice("isolated-replay-agreement", "Replay decision agreement", replay?.agreementSamples === 500 && replay.disagreementSamples === 0, replay ? `${replay.agreementSamples}/500 decisions agree.` : "Replay agreement unavailable."),
    slice("failure-taxonomy", "Failure taxonomy", failureTotal === 0, analysis ? `${failureTotal} runtime/evaluator/manual-review failures.` : "Failure taxonomy unavailable."),
    slice("multimodal-execution-plan", "Multimodal execution plan", plan.localStatus === "ready" && plan.protocols.length === 4 && plan.conformance.passed === plan.conformance.total, `${plan.protocols.length} protocols; ${plan.conformance.passed}/${plan.conformance.total} fixtures pass.`),
    slice("truth-boundary", "Fail-closed truth boundary", evidence.productionStatus === "hold" && evidence.blockers.length >= 2 && replay?.independentHost === false, "Local replay is separated from independent-host, external submission, and production evidence."),
  ] satisfies Slice[];
}

export async function runV165BenchmarkReproducibilityAcceptance() {
  await replayLatestMath500Run();
  const evidence = readMath500Reproducibility();
  const slices = buildSlices(evidence);
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const withoutDigest = {
    id: `v165-benchmark-reproducibility-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    runId: evidence.analysis?.runId || null,
    localStatus: passed === 15 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    slices,
    totals: { slices: 15 as const, passed, held: 15 - passed },
    analysisDigest: evidence.analysis?.runDigest || null,
    replayReceiptId: evidence.replay?.id || null,
    multimodalPlanDigest: evidence.multimodalPlan.planDigest,
  };
  const receipt: V165BenchmarkReproducibilityReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readV165BenchmarkReproducibilityEvidence() {
  const receipts = readDurableReceipts<V165BenchmarkReproducibilityReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  const reproducibility = readMath500Reproducibility();
  const linked =
    !!latest &&
    latest.runId === reproducibility.analysis?.runId &&
    latest.replayReceiptId === reproducibility.replay?.id;
  return {
    ok: true as const,
    schemaVersion: V165_BENCHMARK_REPRODUCIBILITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus:
      linked && latest?.localStatus === "pass"
        ? ("pass" as const)
        : latest
          ? ("hold" as const)
          : ("evidence-needed" as const),
    productionStatus: "hold" as const,
    latest,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    reproducibility,
    productionBlockers: reproducibility.blockers,
    receiptPath: RECEIPT_PATH,
  };
}
