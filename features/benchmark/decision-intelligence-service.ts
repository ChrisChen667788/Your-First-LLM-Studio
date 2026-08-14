import { createHash } from "node:crypto";

import {
  BENCHMARK_DECISION_INTELLIGENCE_SCHEMA_VERSION,
  type BenchmarkAuditItem,
  type BenchmarkCohortRisk,
  type BenchmarkDecisionIntelligence,
  type BenchmarkErrorClass,
  type BenchmarkRunComparison,
} from "@/features/benchmark/decision-intelligence-contracts";
import {
  buildMath500RunAnalysis,
  buildWilsonInterval,
} from "@/features/benchmark/math500-run-analysis";
import {
  readBenchmarkQualification,
  readQualifiedMath500Rows,
} from "@/features/benchmark/qualification-service";
import { readBenchmarkLogs, type StoredBenchmarkLog } from "@/lib/agent/log-store";
import type { AgentBenchmarkSample } from "@/lib/agent/types";

type Math500Row = {
  answer: string;
  subject: string;
  level: number;
  unique_id: string;
};

type DatasetBinding = { revision: string; sha256: string; rowCount: number };

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] || 0;
}

export function classifyMath500Sample(sample: AgentBenchmarkSample): BenchmarkErrorClass {
  if (!sample.ok) return "runtime-failure";
  if (sample.evaluation?.status === "unavailable") return "evaluator-unavailable";
  if (sample.evaluation?.status === "error") return "evaluator-error";
  if (sample.evaluation?.status === "manual-review") return "manual-review";
  if (sample.passed === true) return "correct";
  if (!sample.evaluation?.extractedPrediction?.length) return "answer-not-extracted";
  return "semantic-mismatch";
}

function binomialProbability(n: number, k: number) {
  if (n === 0) return 1;
  let coefficient = 1;
  for (let index = 1; index <= k; index += 1) {
    coefficient *= (n - index + 1) / index;
  }
  return coefficient * 0.5 ** n;
}

export function exactMcnemarPValue(candidateWins: number, baselineWins: number) {
  const discordant = candidateWins + baselineWins;
  if (!discordant) return 1;
  const tail = Math.min(candidateWins, baselineWins);
  let cumulative = 0;
  for (let index = 0; index <= tail; index += 1) {
    cumulative += binomialProbability(discordant, index);
  }
  return round(Math.min(1, cumulative * 2), 6);
}

function pairedDeltaConfidence(differences: number[]) {
  if (differences.length < 2) return null;
  const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  const variance =
    differences.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (differences.length - 1);
  const margin = 1.959963984540054 * Math.sqrt(variance / differences.length);
  return {
    low: round((mean - margin) * 100),
    high: round((mean + margin) * 100),
  };
}

function buildCohortRisks(
  breakdowns: Array<{
    key: string;
    total: number;
    correct: number;
    accuracy: number;
    confidence: ReturnType<typeof buildWilsonInterval>;
  }>,
  kind: "subject" | "difficulty",
  overallAccuracy: number,
) {
  return breakdowns.map((entry) => {
    const deltaFromOverallPct = round(entry.accuracy - overallAccuracy);
    const risk =
      entry.confidence.high < overallAccuracy
        ? ("critical" as const)
        : entry.accuracy < overallAccuracy
          ? ("watch" as const)
          : ("stable" as const);
    return { ...entry, kind, risk, deltaFromOverallPct } satisfies BenchmarkCohortRisk;
  });
}

function buildPowerPlan(accuracyPct: number, samples: number) {
  const p = Math.min(0.99, Math.max(0.01, accuracyPct / 100));
  const zSum = 1.959963984540054 + 0.8416212335729143;
  const requiredForEffect = (effectPct: number) =>
    Math.ceil((2 * zSum ** 2 * p * (1 - p)) / (effectPct / 100) ** 2);
  const detectable = Math.sqrt((2 * zSum ** 2 * p * (1 - p)) / samples) * 100;
  return {
    method: "two-independent-proportions-95-80" as const,
    detectableEffectAtAvailableSamplesPct: round(detectable),
    targets: [3, 5, 10].map((effectPct) => {
      const requiredSamplesPerRun = requiredForEffect(effectPct);
      return {
        effectPct,
        requiredSamplesPerRun,
        availableSamples: samples,
        sufficientlyPowered: samples >= requiredSamplesPerRun,
      };
    }),
    disclosure:
      "This is a conservative two-independent-proportions planning approximation at two-sided 95% confidence and 80% power. The paired item-level gate reports its observed paired interval separately.",
  };
}

function buildReviewQueue(samples: AgentBenchmarkSample[], rows: Map<string, Math500Row>) {
  return samples
    .map((sample) => {
      const row = sample.itemId ? rows.get(sample.itemId) : null;
      const errorClass = classifyMath500Sample(sample);
      const priorityScore =
        (errorClass === "answer-not-extracted" ? 100 : 0) +
        (errorClass !== "correct" ? 40 : 0) +
        (row?.level || 0) * 6 +
        Math.min(20, sample.latencyMs / 200);
      return {
        itemId: sample.itemId || "unknown",
        subject: row?.subject || "Unknown",
        level: row?.level || 0,
        errorClass,
        passed: typeof sample.passed === "boolean" ? sample.passed : null,
        latencyMs: sample.latencyMs,
        completionTokens: sample.completionTokens,
        resumedFromCheckpoint: !!sample.resumedFromCheckpoint,
        predictionPreview:
          sample.evaluation?.extractedPrediction?.join(" | ") ||
          sample.outputPreview ||
          sample.outputText?.slice(0, 160) ||
          "--",
        expectedPreview:
          sample.evaluation?.extractedGold?.join(" | ") ||
          sample.expectedAnswerPreview ||
          row?.answer ||
          "--",
        priorityScore: round(priorityScore),
      } satisfies BenchmarkAuditItem;
    })
    .filter((entry) => entry.errorClass !== "correct")
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore || left.itemId.localeCompare(right.itemId),
    )
    .slice(0, 24);
}

function latestCompleteRuns(logs: StoredBenchmarkLog[]) {
  const byRun = new Map<string, StoredBenchmarkLog>();
  for (const log of logs) {
    const result = log.results[0];
    const samples = result?.samples || [];
    const scored = samples.filter(
      (sample) => sample.evaluation?.status === "scored" && typeof sample.passed === "boolean",
    ).length;
    if (log.datasetId !== "math-500-qualified" || samples.length !== 500 || scored !== 500) {
      continue;
    }
    byRun.set(log.runId || log.id, log);
  }
  return [...byRun.values()].sort((left, right) =>
    left.generatedAt.localeCompare(right.generatedAt),
  );
}

function buildComparison(
  baselineLog: StoredBenchmarkLog,
  candidateLog: StoredBenchmarkLog | null,
  rows: Math500Row[],
  dataset: DatasetBinding,
): BenchmarkRunComparison {
  const baseline = buildMath500RunAnalysis(baselineLog, rows, dataset);
  if (!baseline) throw new Error("Baseline MATH-500 analysis is unavailable.");
  if (!candidateLog) {
    return {
      status: "evidence-needed",
      baselineRunId: baseline.runId,
      candidateRunId: null,
      sharedSamples: 0,
      baselineAccuracy: baseline.accuracy || 0,
      candidateAccuracy: null,
      deltaPct: null,
      deltaConfidence95: null,
      discordant: { candidateWins: 0, baselineWins: 0 },
      mcnemarExactPValue: null,
      latencyP95RegressionPct: null,
      nonInferiorityMarginPct: 2,
      evaluatorCompatible: false,
      promotionDecision: "evidence-needed",
      blockers: [
        "A second complete 500-item run with a distinct run id is required for paired candidate comparison.",
      ],
    };
  }
  const candidate = buildMath500RunAnalysis(candidateLog, rows, dataset);
  if (!candidate) throw new Error("Candidate MATH-500 analysis is unavailable.");
  const baselineSamples = new Map(
    (baselineLog.results[0]?.samples || []).map((sample) => [sample.itemId, sample]),
  );
  const candidateSamples = new Map(
    (candidateLog.results[0]?.samples || []).map((sample) => [sample.itemId, sample]),
  );
  const differences: number[] = [];
  let candidateWins = 0;
  let baselineWins = 0;
  for (const [itemId, baselineSample] of baselineSamples) {
    if (!itemId) continue;
    const candidateSample = candidateSamples.get(itemId);
    if (!candidateSample) continue;
    const baselineValue = baselineSample.passed === true ? 1 : 0;
    const candidateValue = candidateSample.passed === true ? 1 : 0;
    differences.push(candidateValue - baselineValue);
    if (candidateValue > baselineValue) candidateWins += 1;
    if (baselineValue > candidateValue) baselineWins += 1;
  }
  const deltaPct = differences.length
    ? round((differences.reduce((sum, value) => sum + value, 0) / differences.length) * 100)
    : null;
  const deltaConfidence95 = pairedDeltaConfidence(differences);
  const latencyP95RegressionPct = baseline.latencyMs.p95
    ? round(((candidate.latencyMs.p95 - baseline.latencyMs.p95) / baseline.latencyMs.p95) * 100)
    : null;
  const evaluatorCompatible = baseline.evaluator.fingerprint === candidate.evaluator.fingerprint;
  const blockers = [
    differences.length === 500 ? null : `Only ${differences.length}/500 item ids are shared.`,
    evaluatorCompatible ? null : "Baseline and candidate evaluator fingerprints differ.",
    deltaConfidence95 && deltaConfidence95.low >= -2
      ? null
      : "The paired 95% delta interval crosses the -2 percentage-point non-inferiority margin.",
    latencyP95RegressionPct !== null && latencyP95RegressionPct <= 20
      ? null
      : "Candidate p95 latency regresses by more than 20% or is unavailable.",
    candidate.failures.runtime === 0 ? null : "Candidate contains runtime failures.",
  ].filter((value): value is string => !!value);
  const passed = blockers.length === 0;
  return {
    status: passed ? "pass" : "hold",
    baselineRunId: baseline.runId,
    candidateRunId: candidate.runId,
    sharedSamples: differences.length,
    baselineAccuracy: baseline.accuracy || 0,
    candidateAccuracy: candidate.accuracy,
    deltaPct,
    deltaConfidence95,
    discordant: { candidateWins, baselineWins },
    mcnemarExactPValue: exactMcnemarPValue(candidateWins, baselineWins),
    latencyP95RegressionPct,
    nonInferiorityMarginPct: 2,
    evaluatorCompatible,
    promotionDecision: passed ? "pass" : "hold",
    blockers,
  };
}

export function buildBenchmarkDecisionIntelligence(input: {
  logs: StoredBenchmarkLog[];
  rows: Math500Row[];
  dataset: DatasetBinding;
  baselineRunId?: string;
  candidateRunId?: string;
}): BenchmarkDecisionIntelligence {
  const completeRuns = latestCompleteRuns(input.logs);
  const requestedCandidate = input.candidateRunId
    ? completeRuns.find((entry) => (entry.runId || entry.id) === input.candidateRunId) || null
    : null;
  const requestedBaseline = input.baselineRunId
    ? completeRuns.find((entry) => (entry.runId || entry.id) === input.baselineRunId) || null
    : null;
  if (input.candidateRunId && !requestedCandidate) {
    throw new Error("Candidate run is not a complete 500-item scored MATH-500 run.");
  }
  if (input.baselineRunId && !requestedBaseline) {
    throw new Error("Baseline run is not a complete 500-item scored MATH-500 run.");
  }
  const selectedCandidate = input.candidateRunId
    ? requestedCandidate
    : completeRuns.length >= 2
      ? completeRuns.at(-1) || null
      : null;
  const selectedBaseline = input.baselineRunId
    ? requestedBaseline
    : selectedCandidate
      ? [...completeRuns]
          .reverse()
          .find((entry) => (entry.runId || entry.id) !== (selectedCandidate.runId || selectedCandidate.id)) || null
      : completeRuns.at(-1) || null;
  if (!selectedBaseline) {
    return {
      ok: true,
      schemaVersion: BENCHMARK_DECISION_INTELLIGENCE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      localStatus: "evidence-needed",
      productionStatus: "hold",
      baseline: null,
      audit: null,
      power: null,
      comparison: null,
      eligibleRuns: [],
      decisionDigest: null,
      blockers: ["No complete 500-item scored MATH-500 run is available."],
      disclosure:
        "Decision intelligence requires a complete pinned run and never substitutes fixtures for model evidence.",
    };
  }
  const analysis = buildMath500RunAnalysis(selectedBaseline, input.rows, input.dataset);
  if (!analysis || analysis.accuracy === null || !analysis.confidence) {
    throw new Error("Complete baseline analysis could not be built.");
  }
  const samples = selectedBaseline.results[0]?.samples || [];
  const rowMap = new Map(input.rows.map((row) => [row.unique_id, row]));
  const classes = samples.map(classifyMath500Sample);
  const taxonomyKeys: BenchmarkErrorClass[] = [
    "correct",
    "semantic-mismatch",
    "answer-not-extracted",
    "runtime-failure",
    "evaluator-unavailable",
    "evaluator-error",
    "manual-review",
  ];
  const latencyThreshold = percentile(samples.map((sample) => sample.latencyMs), 0.95);
  const tokenThreshold = percentile(samples.map((sample) => sample.completionTokens), 0.95);
  const extractionCount = samples.filter(
    (sample) => (sample.evaluation?.extractedPrediction?.length || 0) > 0,
  ).length;
  const comparison = buildComparison(
    selectedBaseline,
    selectedCandidate && selectedCandidate !== selectedBaseline ? selectedCandidate : null,
    input.rows,
    input.dataset,
  );
  const audit = {
    accountedSamples: classes.length,
    extractionCoveragePct: round((extractionCount / samples.length) * 100),
    errorTaxonomy: taxonomyKeys.map((key) => {
      const count = classes.filter((value) => value === key).length;
      return { key, count, pct: round((count / samples.length) * 100) };
    }),
    cohortRisks: [
      ...buildCohortRisks(analysis.subjects, "subject", analysis.accuracy),
      ...buildCohortRisks(analysis.levels, "difficulty", analysis.accuracy),
    ],
    latencyOutliers: {
      thresholdMs: latencyThreshold,
      count: samples.filter((sample) => sample.latencyMs > latencyThreshold).length,
    },
    tokenOutliers: {
      thresholdTokens: tokenThreshold,
      count: samples.filter((sample) => sample.completionTokens > tokenThreshold).length,
    },
    reviewQueue: buildReviewQueue(samples, rowMap),
  };
  const power = buildPowerPlan(analysis.accuracy, samples.length);
  const baseline = {
    runId: analysis.runId,
    targetId: analysis.targetId,
    targetLabel: analysis.targetLabel,
    resolvedModel: analysis.resolvedModel,
    accuracy: analysis.accuracy,
    confidence: analysis.confidence,
    samples: analysis.totals.samples,
    runDigest: analysis.runDigest,
  };
  const decisionDigest = digest({ baseline, audit, power, comparison });
  return {
    ok: true,
    schemaVersion: BENCHMARK_DECISION_INTELLIGENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus:
      audit.accountedSamples === 500 &&
      audit.errorTaxonomy.reduce((sum, entry) => sum + entry.count, 0) === 500
        ? "pass"
        : "hold",
    productionStatus: "hold",
    baseline,
    audit,
    power,
    comparison,
    eligibleRuns: completeRuns.map((log) => {
      const result = log.results[0];
      const samplesForRun = result?.samples || [];
      return {
        runId: log.runId || log.id,
        generatedAt: log.generatedAt,
        targetId: result?.targetId || "unknown",
        resolvedModel: result?.resolvedModel || "unknown",
        samples: samplesForRun.length,
        scored: samplesForRun.filter(
          (sample) => sample.evaluation?.status === "scored" && typeof sample.passed === "boolean",
        ).length,
      };
    }),
    decisionDigest,
    blockers: [
      ...comparison.blockers,
      "Independent-host repetition, official multimodal runs, external leaderboard receipts, and organization promotion remain separate gates.",
    ],
    disclosure:
      "The audit and power analysis describe one real local MATH-500 run. A candidate promotion requires a second distinct complete run; local statistical evidence is not an external leaderboard or production sign-off.",
  };
}

export function readBenchmarkDecisionIntelligence(options?: {
  baselineRunId?: string;
  candidateRunId?: string;
}) {
  const rows = readQualifiedMath500Rows();
  const qualification = readBenchmarkQualification();
  const dataset = qualification.qualifiedDataset;
  if (!rows || !dataset) {
    return buildBenchmarkDecisionIntelligence({
      logs: [],
      rows: [],
      dataset: { revision: "unavailable", sha256: "", rowCount: 0 },
      ...options,
    });
  }
  return buildBenchmarkDecisionIntelligence({
    logs: readBenchmarkLogs({ limit: 1000 }),
    rows,
    dataset: {
      revision: dataset.revision,
      sha256: dataset.sha256,
      rowCount: dataset.sampleCount,
    },
    ...options,
  });
}
