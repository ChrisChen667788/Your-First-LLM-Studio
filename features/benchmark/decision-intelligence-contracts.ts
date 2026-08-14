import type { WilsonInterval } from "@/features/benchmark/reproducibility-contracts";

export const BENCHMARK_DECISION_INTELLIGENCE_SCHEMA_VERSION =
  "benchmark.decision-intelligence.v1" as const;

export type BenchmarkErrorClass =
  | "correct"
  | "semantic-mismatch"
  | "answer-not-extracted"
  | "runtime-failure"
  | "evaluator-unavailable"
  | "evaluator-error"
  | "manual-review";

export type BenchmarkAuditItem = {
  itemId: string;
  subject: string;
  level: number;
  errorClass: BenchmarkErrorClass;
  passed: boolean | null;
  latencyMs: number;
  completionTokens: number;
  resumedFromCheckpoint: boolean;
  predictionPreview: string;
  expectedPreview: string;
  priorityScore: number;
};

export type BenchmarkCohortRisk = {
  key: string;
  kind: "subject" | "difficulty";
  total: number;
  correct: number;
  accuracy: number;
  confidence: WilsonInterval;
  risk: "critical" | "watch" | "stable";
  deltaFromOverallPct: number;
};

export type BenchmarkPowerTarget = {
  effectPct: number;
  requiredSamplesPerRun: number;
  availableSamples: number;
  sufficientlyPowered: boolean;
};

export type BenchmarkRunComparison = {
  status: "pass" | "hold" | "evidence-needed";
  baselineRunId: string;
  candidateRunId: string | null;
  sharedSamples: number;
  baselineAccuracy: number;
  candidateAccuracy: number | null;
  deltaPct: number | null;
  deltaConfidence95: { low: number; high: number } | null;
  discordant: {
    candidateWins: number;
    baselineWins: number;
  };
  mcnemarExactPValue: number | null;
  latencyP95RegressionPct: number | null;
  nonInferiorityMarginPct: number;
  evaluatorCompatible: boolean;
  promotionDecision: "pass" | "hold" | "evidence-needed";
  blockers: string[];
};

export type BenchmarkDecisionIntelligence = {
  ok: true;
  schemaVersion: typeof BENCHMARK_DECISION_INTELLIGENCE_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  baseline: {
    runId: string;
    targetId: string;
    targetLabel: string;
    resolvedModel: string;
    accuracy: number;
    confidence: WilsonInterval;
    samples: number;
    runDigest: string;
  } | null;
  audit: {
    accountedSamples: number;
    extractionCoveragePct: number;
    errorTaxonomy: Array<{ key: BenchmarkErrorClass; count: number; pct: number }>;
    cohortRisks: BenchmarkCohortRisk[];
    latencyOutliers: { thresholdMs: number; count: number };
    tokenOutliers: { thresholdTokens: number; count: number };
    reviewQueue: BenchmarkAuditItem[];
  } | null;
  power: {
    method: "two-independent-proportions-95-80";
    detectableEffectAtAvailableSamplesPct: number;
    targets: BenchmarkPowerTarget[];
    disclosure: string;
  } | null;
  comparison: BenchmarkRunComparison | null;
  eligibleRuns: Array<{
    runId: string;
    generatedAt: string;
    targetId: string;
    resolvedModel: string;
    samples: number;
    scored: number;
  }>;
  decisionDigest: string | null;
  blockers: string[];
  disclosure: string;
};
