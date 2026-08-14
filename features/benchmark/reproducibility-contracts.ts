export const MATH500_REPRODUCIBILITY_SCHEMA_VERSION =
  "benchmark.math500-reproducibility.v1" as const;
export const MATH500_REPLAY_STORE_SCHEMA_VERSION =
  "benchmark.math500-replay-store.v1" as const;

export type WilsonInterval = {
  method: "wilson-95";
  low: number;
  high: number;
};

export type Math500Breakdown = {
  key: string;
  total: number;
  correct: number;
  accuracy: number;
  confidence: WilsonInterval;
};

export type Math500ReplayReceipt = {
  id: string;
  generatedAt: string;
  runId: string;
  executionMode: "isolated-python-worker-replay";
  evaluatorId: string;
  evaluatorVersion: string;
  evaluatorConfigId: string;
  requestedSamples: number;
  replayedSamples: number;
  agreementSamples: number;
  disagreementSamples: number;
  unavailableSamples: number;
  agreementRate: number | null;
  disagreementItemIds: string[];
  decisionDigest: string;
  durationMs: number;
  localStatus: "pass" | "hold";
  independentHost: false;
  disclosure: string;
};

export type Math500RunAnalysis = {
  schemaVersion: typeof MATH500_REPRODUCIBILITY_SCHEMA_VERSION;
  generatedAt: string;
  runId: string;
  targetId: string;
  targetLabel: string;
  resolvedModel: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  totals: {
    samples: number;
    successful: number;
    scored: number;
    correct: number;
    incorrect: number;
    resumed: number;
    inferred: number;
  };
  accuracy: number | null;
  confidence: WilsonInterval | null;
  subjects: Math500Breakdown[];
  levels: Math500Breakdown[];
  latencyMs: { p50: number; p95: number; p99: number };
  tokens: {
    promptAndCompletion: number;
    completion: number;
    averageCompletion: number;
  };
  failures: {
    runtime: number;
    unscored: number;
    evaluatorUnavailable: number;
    evaluatorError: number;
    manualReview: number;
  };
  dataset: {
    revision: string;
    sha256: string;
    rowCount: number;
  };
  evaluator: {
    id: string | null;
    version: string | null;
    configId: string | null;
    sourceRevision: string;
    fingerprint: string;
  };
  runDigest: string;
  disclosure: string;
};

export type MultimodalExecutionPlan = {
  schemaVersion: "benchmark.multimodal-execution-plan.v1";
  generatedAt: string;
  localStatus: "ready" | "hold";
  productionStatus: "hold";
  candidateTarget: {
    id: string;
    label: string;
    modalities: string[];
    capabilityStatus: string;
    officialDocsUrl?: string;
  } | null;
  protocols: Array<{
    id: "mmmu" | "mathvista" | "mmbench" | "video-mme-v2";
    label: string;
    requiredModalities: string[];
    adapterStatus: "pass" | "hold";
    executionStatus: "ready" | "hold";
    judgeMode: "deterministic" | "external-required" | "submission-required";
    requirements: string[];
    blockers: string[];
  }>;
  conformance: { total: number; passed: number };
  planDigest: string;
  blockers: string[];
};

export type Math500ReproducibilityReadModel = {
  ok: true;
  schemaVersion: typeof MATH500_REPRODUCIBILITY_SCHEMA_VERSION;
  generatedAt: string;
  replayActive: boolean;
  analysis: Math500RunAnalysis | null;
  replay: Math500ReplayReceipt | null;
  multimodalPlan: MultimodalExecutionPlan;
  localStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  blockers: string[];
};
