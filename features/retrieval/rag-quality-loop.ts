import { createHash } from "node:crypto";

export const RAG_QUALITY_LOOP_SCHEMA_VERSION = "retrieval.rag-quality-loop.v1" as const;

export type RagQualitySample = {
  id: string;
  retrievalRecall: number;
  citationPrecision: number;
  answerScore: number;
  leakage: boolean;
  fresh: boolean;
  humanAccepted: boolean | null;
};

function average(rows: RagQualitySample[], key: "retrievalRecall" | "citationPrecision" | "answerScore") {
  return rows.length
    ? Number((rows.reduce((sum, row) => sum + row[key], 0) / rows.length).toFixed(4))
    : 0;
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildRagQualityDecision(input: {
  baseline: RagQualitySample[];
  candidate: RagQualitySample[];
  minimumSamples?: number;
}) {
  const minimumSamples = input.minimumSamples || 20;
  const baselineById = new Map(input.baseline.map((sample) => [sample.id, sample]));
  const paired = input.candidate.filter((sample) => baselineById.has(sample.id));
  const baselinePaired = paired.map((sample) => baselineById.get(sample.id)!);
  const metrics = {
    pairedSamples: paired.length,
    retrievalRecall: average(paired, "retrievalRecall"),
    citationPrecision: average(paired, "citationPrecision"),
    answerScore: average(paired, "answerScore"),
    answerDelta: Number((average(paired, "answerScore") - average(baselinePaired, "answerScore")).toFixed(4)),
    leakageCount: paired.filter((sample) => sample.leakage).length,
    staleCount: paired.filter((sample) => !sample.fresh).length,
    humanAcceptanceRate: (() => {
      const judged = paired.filter((sample) => sample.humanAccepted !== null);
      return judged.length
        ? Number((judged.filter((sample) => sample.humanAccepted).length / judged.length).toFixed(4))
        : null;
    })(),
  };
  const checks = {
    sampleSize: metrics.pairedSamples >= minimumSamples,
    retrievalRecall: metrics.retrievalRecall >= 0.8,
    citationPrecision: metrics.citationPrecision >= 0.9,
    answerNotRegressed: metrics.answerDelta >= 0,
    noLeakage: metrics.leakageCount === 0,
    freshCorpus: metrics.staleCount === 0,
  };
  const withoutDigest = {
    metrics,
    checks,
    decision: Object.values(checks).every(Boolean) ? "pass" as const : "hold" as const,
  };
  return { ...withoutDigest, decisionDigest: digest(withoutDigest) };
}

export function readRagQualityLoopEvidence() {
  const baseline = Array.from({ length: 20 }, (_, index) => ({
    id: `rag-${index}`,
    retrievalRecall: 0,
    citationPrecision: 0,
    answerScore: 0.55,
    leakage: false,
    fresh: true,
    humanAccepted: null,
  }));
  const candidate = baseline.map((sample) => ({
    ...sample,
    retrievalRecall: 0.9,
    citationPrecision: 0.95,
    answerScore: 0.75,
    humanAccepted: true,
  }));
  const decision = buildRagQualityDecision({ baseline, candidate });
  return {
    ok: true as const,
    schemaVersion: RAG_QUALITY_LOOP_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: decision.decision,
    localStatus: decision.decision,
    productionStatus: "hold" as const,
    decision,
    disclosure:
      "The paired quality gate is implemented with deterministic fixtures. Promotion requires a pinned real corpus, evaluator versions, identity leakage probes, and human feedback receipts.",
  };
}
