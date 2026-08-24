import { createHash, randomUUID } from "node:crypto";

import {
  readBenchmarkDecisionIntelligence,
} from "@/features/benchmark/decision-intelligence-service";
import type { BenchmarkDecisionIntelligence } from "@/features/benchmark/decision-intelligence-contracts";
import { buildMultimodalExecutionPlan } from "@/features/benchmark/multimodal-execution-readiness";
import type { MultimodalExecutionPlan } from "@/features/benchmark/reproducibility-contracts";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import {
  readBenchmarkLogs,
  type StoredBenchmarkLog,
} from "@/lib/agent/log-store";

export const V170_BENCHMARK_CANDIDATE_MULTIMODAL_SCHEMA_VERSION =
  "experiments.v170-benchmark-candidate-multimodal.v1" as const;
const STORE_SCHEMA_VERSION =
  "experiments.v170-benchmark-candidate-multimodal-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.7.0-benchmark-candidate-multimodal.json",
);

type GateStatus = "pass" | "hold" | "evidence-needed";

type Slice = {
  id: string;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

type RunIdentity = {
  runId: string;
  targetId: string;
  targetLabel: string;
  resolvedModel: string;
  totalSamples: number;
  scoredSamples: number;
  runtimeFailures: number;
  evaluatorFingerprint: string | null;
  modelBindingDigest: string;
  runDigest: string;
};

export type V170BenchmarkCandidateMultimodalState = {
  baseline: RunIdentity | null;
  candidate: RunIdentity | null;
  candidatePromotionStatus: GateStatus;
  multimodalExecutionStatus: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: Slice[];
  totals: { slices: 15; passed: number; held: number };
  stateDigest: string;
  blockers: string[];
  disclosure: string;
  candidateTarget: MultimodalExecutionPlan["candidateTarget"];
  multimodalProtocols: Array<{
    id: string;
    label: string;
    adapterStatus: "pass" | "hold";
    executionStatus: "ready" | "hold";
    blockers: string[];
  }>;
};

export type V170BenchmarkCandidateMultimodalReceipt =
  V170BenchmarkCandidateMultimodalState & {
    id: string;
    generatedAt: string;
    evidenceDigest: string;
  };

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function findRun(logs: StoredBenchmarkLog[], runId: string | null | undefined) {
  if (!runId) return null;
  return logs.find((entry) => (entry.runId || entry.id) === runId) || null;
}

function describeRun(log: StoredBenchmarkLog | null): RunIdentity | null {
  if (!log || log.datasetId !== "math-500-qualified") return null;
  const result = log.results[0];
  if (!result) return null;
  const samples = result.samples || [];
  const scored = samples.filter(
    (sample) =>
      sample.evaluation?.status === "scored" && typeof sample.passed === "boolean",
  );
  const evaluator = scored[0]?.evaluation;
  const modelBinding = {
    targetId: result.targetId,
    resolvedModel: result.resolvedModel,
  };
  return {
    runId: log.runId || log.id,
    targetId: result.targetId,
    targetLabel: result.targetLabel,
    resolvedModel: result.resolvedModel,
    totalSamples: samples.length,
    scoredSamples: scored.length,
    runtimeFailures: samples.filter((sample) => !sample.ok).length,
    evaluatorFingerprint: evaluator
      ? digest({
          id: evaluator.evaluatorId,
          version: evaluator.evaluatorVersion,
          configId: evaluator.configId,
        })
      : null,
    modelBindingDigest: digest(modelBinding),
    runDigest: digest({
      ...modelBinding,
      providerProfile: log.providerProfile,
      thinkingMode: log.thinkingMode,
      contextWindow: log.contextWindow,
      samples: samples.map((sample) => ({
        itemId: sample.itemId,
        passed: sample.passed,
        score: sample.score,
        evaluator: sample.evaluation
          ? {
              id: sample.evaluation.evaluatorId,
              version: sample.evaluation.evaluatorVersion,
              configId: sample.evaluation.configId,
              status: sample.evaluation.status,
            }
          : null,
      })),
    }),
  };
}

function slice(id: string, label: string, passed: boolean, summary: string): Slice {
  return { id, label, status: passed ? "pass" : "hold", summary };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function buildV170BenchmarkCandidateMultimodalState(input: {
  decision: BenchmarkDecisionIntelligence;
  multimodalPlan: MultimodalExecutionPlan;
  logs: StoredBenchmarkLog[];
}): V170BenchmarkCandidateMultimodalState {
  const comparison = input.decision.comparison;
  const baseline = describeRun(findRun(input.logs, comparison?.baselineRunId));
  const candidate = describeRun(findRun(input.logs, comparison?.candidateRunId));
  const distinctRun = !!baseline && !!candidate && baseline.runId !== candidate.runId;
  const distinctModelBinding =
    distinctRun &&
    !!baseline &&
    !!candidate &&
    baseline.modelBindingDigest !== candidate.modelBindingDigest;
  const candidateComplete =
    !!candidate && candidate.totalSamples === 500 && candidate.scoredSamples === 500;
  const evaluatorCompatible =
    !!baseline &&
    !!candidate &&
    baseline.evaluatorFingerprint !== null &&
    baseline.evaluatorFingerprint === candidate.evaluatorFingerprint &&
    comparison?.evaluatorCompatible === true;
  const pairedSamples = comparison?.sharedSamples === 500;
  const pairedStatisticsAvailable =
    comparison?.deltaPct != null &&
    comparison.deltaConfidence95 != null &&
    comparison.mcnemarExactPValue != null;
  const nonInferiorityPassed =
    comparison?.deltaConfidence95 != null &&
    comparison.deltaConfidence95.low >= -comparison.nonInferiorityMarginPct;
  const latencyPassed =
    comparison?.latencyP95RegressionPct != null &&
    comparison.latencyP95RegressionPct <= 20;
  const candidateRuntimeHealthy = candidate?.runtimeFailures === 0;
  const conformancePassed =
    input.multimodalPlan.conformance.passed === input.multimodalPlan.conformance.total;
  const nativeTargetReady =
    !!input.multimodalPlan.candidateTarget &&
    input.multimodalPlan.candidateTarget.modalities.includes("image") &&
    input.multimodalPlan.candidateTarget.modalities.includes("video") &&
    input.multimodalPlan.candidateTarget.capabilityStatus === "verified";
  const officialAssetsReady = input.multimodalPlan.protocols.every(
    (protocol) => protocol.executionStatus === "ready",
  );
  const officialExecutionPassed =
    officialAssetsReady &&
    input.multimodalPlan.protocols.every((protocol) => protocol.blockers.length === 0);

  const candidatePromotionStatus: GateStatus = !candidate
    ? "evidence-needed"
    : !distinctModelBinding
      ? "hold"
      : comparison?.promotionDecision || "evidence-needed";
  const multimodalExecutionStatus: "pass" | "hold" = officialExecutionPassed
    ? "pass"
    : "hold";
  const slices = [
    slice(
      "baseline-immutable",
      "Pinned complete baseline",
      !!input.decision.baseline?.runDigest && baseline?.totalSamples === 500,
      baseline
        ? `${baseline.runId} has ${baseline.totalSamples}/500 recorded samples.`
        : "No complete baseline run is bound.",
    ),
    slice(
      "candidate-distinct-run",
      "Distinct candidate run id",
      distinctRun,
      candidate
        ? `${candidate.runId} is ${distinctRun ? "distinct from" : "the same as"} the baseline run id.`
        : "A second complete candidate run is required.",
    ),
    slice(
      "candidate-distinct-binding",
      "Distinct model or adapter binding",
      distinctModelBinding,
      distinctModelBinding
        ? "Candidate target/model binding differs from the baseline."
        : "A duplicate target/model binding is not accepted as a new candidate checkpoint.",
    ),
    slice(
      "candidate-completeness",
      "Candidate 500-item completeness",
      candidateComplete,
      candidate
        ? `${candidate.scoredSamples}/${candidate.totalSamples} samples are scored.`
        : "Candidate execution is absent.",
    ),
    slice(
      "evaluator-compatibility",
      "Evaluator fingerprint compatibility",
      evaluatorCompatible,
      evaluatorCompatible
        ? "Baseline and candidate use the same pinned evaluator identity."
        : "Baseline/candidate evaluator compatibility is missing or mismatched.",
    ),
    slice(
      "paired-item-accounting",
      "Exact paired item accounting",
      pairedSamples,
      `${comparison?.sharedSamples || 0}/500 item ids are paired.`,
    ),
    slice(
      "paired-statistics",
      "Delta confidence and exact McNemar",
      pairedStatisticsAvailable,
      pairedStatisticsAvailable
        ? `Delta ${comparison?.deltaPct ?? 0} pp; exact p=${comparison?.mcnemarExactPValue}.`
        : "Paired confidence or exact McNemar evidence is unavailable.",
    ),
    slice(
      "non-inferiority",
      "Paired non-inferiority boundary",
      nonInferiorityPassed,
      comparison?.deltaConfidence95
        ? `Lower bound ${comparison.deltaConfidence95.low} pp against ${comparison.nonInferiorityMarginPct} pp.`
        : "No paired confidence interval is available.",
    ),
    slice(
      "latency-boundary",
      "P95 latency boundary",
      latencyPassed,
      comparison?.latencyP95RegressionPct !== null &&
      comparison?.latencyP95RegressionPct !== undefined
        ? `${comparison.latencyP95RegressionPct}% p95 regression.`
        : "Candidate p95 latency is unavailable.",
    ),
    slice(
      "candidate-runtime-health",
      "Candidate runtime health",
      candidateRuntimeHealthy === true,
      candidate
        ? `${candidate.runtimeFailures} runtime failures.`
        : "Candidate runtime evidence is absent.",
    ),
    slice(
      "protocol-conformance",
      "Pinned multimodal protocol conformance",
      conformancePassed,
      `${input.multimodalPlan.conformance.passed}/${input.multimodalPlan.conformance.total} protocol fixtures pass.`,
    ),
    slice(
      "native-image-video-target",
      "Verified native image and video target",
      nativeTargetReady,
      nativeTargetReady
        ? `${input.multimodalPlan.candidateTarget?.label} is verified for image and video transport.`
        : "No verified native image/video benchmark target is available.",
    ),
    slice(
      "official-asset-readiness",
      "Official assets and runtime readiness",
      officialAssetsReady,
      officialAssetsReady
        ? "Every official multimodal protocol has an asset/runtime-ready execution plan."
        : "Official image/video assets or compatible runtime evidence are still absent.",
    ),
    slice(
      "official-native-execution",
      "Official native multimodal execution",
      officialExecutionPassed,
      officialExecutionPassed
        ? "Official protocol blockers are cleared by retained native execution evidence."
        : "Configured capability and parser fixtures do not substitute for official native execution.",
    ),
    slice(
      "truth-boundary",
      "Promotion and production truth boundary",
      input.decision.productionStatus === "hold",
      "Candidate and multimodal evidence remain separate from external submission and production approval.",
    ),
  ] satisfies Slice[];
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const blockers = unique([
    ...slices
      .filter((entry) => entry.status === "hold")
      .map((entry) => `v1.7.0 gate failed: ${entry.label}. ${entry.summary}`),
    ...input.decision.blockers,
    ...input.multimodalPlan.blockers,
    "Independent-worker repetition, external evaluator/submission receipts, and organization promotion remain separate gates.",
  ]);
  const withoutDigest = {
    baseline,
    candidate,
    candidatePromotionStatus,
    multimodalExecutionStatus,
    localStatus: passed === 15 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    slices,
    totals: { slices: 15 as const, passed, held: 15 - passed },
    blockers,
    disclosure:
      "A distinct run id alone does not prove a distinct model or adapter candidate. Protocol fixtures and configured native capability do not prove execution against official image/video assets.",
    candidateTarget: input.multimodalPlan.candidateTarget,
    multimodalProtocols: input.multimodalPlan.protocols.map((protocol) => ({
      id: protocol.id,
      label: protocol.label,
      adapterStatus: protocol.adapterStatus,
      executionStatus: protocol.executionStatus,
      blockers: protocol.blockers,
    })),
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState() {
  return buildV170BenchmarkCandidateMultimodalState({
    decision: readBenchmarkDecisionIntelligence(),
    multimodalPlan: buildMultimodalExecutionPlan(),
    logs: readBenchmarkLogs({ limit: 1000 }),
  });
}

export function runV170BenchmarkCandidateMultimodalAcceptance() {
  const state = readCurrentState();
  const withoutDigest = {
    id: `v170-benchmark-candidate-multimodal-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: V170BenchmarkCandidateMultimodalReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readV170BenchmarkCandidateMultimodalEvidence() {
  const receipts = readDurableReceipts<V170BenchmarkCandidateMultimodalReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const current = readCurrentState();
  const latest = receipts[0] || null;
  const linked = latest?.stateDigest === current.stateDigest;
  return {
    ok: true as const,
    schemaVersion: V170_BENCHMARK_CANDIDATE_MULTIMODAL_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: linked ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
