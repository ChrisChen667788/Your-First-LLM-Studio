import { createHash } from "node:crypto";

import {
  MATH_VERIFY_SOURCE_REVISION,
} from "@/features/benchmark/math-evaluator-port";
import {
  MATH500_REPRODUCIBILITY_SCHEMA_VERSION,
  type Math500Breakdown,
  type Math500RunAnalysis,
  type WilsonInterval,
} from "@/features/benchmark/reproducibility-contracts";
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

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function buildWilsonInterval(correct: number, total: number): WilsonInterval {
  if (total <= 0) return { method: "wilson-95", low: 0, high: 0 };
  const z = 1.959963984540054;
  const p = correct / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin =
    (z / denominator) *
    Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return {
    method: "wilson-95",
    low: round(Math.max(0, (center - margin) * 100)),
    high: round(Math.min(1, center + margin) * 100),
  };
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] || 0);
}

function breakdown(
  samples: AgentBenchmarkSample[],
  rows: Map<string, Math500Row>,
  select: (row: Math500Row) => string,
) {
  const groups = new Map<string, { total: number; correct: number }>();
  for (const sample of samples) {
    if (sample.evaluation?.status !== "scored" || typeof sample.passed !== "boolean") continue;
    const row = sample.itemId ? rows.get(sample.itemId) : null;
    if (!row) continue;
    const key = select(row);
    const current = groups.get(key) || { total: 0, correct: 0 };
    current.total += 1;
    current.correct += sample.passed ? 1 : 0;
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      total: value.total,
      correct: value.correct,
      accuracy: round((value.correct / value.total) * 100),
      confidence: buildWilsonInterval(value.correct, value.total),
    }))
    .sort((left, right) => left.key.localeCompare(right.key, undefined, { numeric: true })) satisfies Math500Breakdown[];
}

export function findMath500Run(runId?: string) {
  const logs = readBenchmarkLogs({ limit: 1000 }).filter(
    (entry) =>
      entry.datasetId === "math-500-qualified" &&
      (!runId || entry.runId === runId),
  );
  return logs.at(-1) || null;
}

export function buildMath500RunAnalysis(
  log: StoredBenchmarkLog,
  rawRows: Math500Row[],
  dataset: { revision: string; sha256: string; rowCount: number },
): Math500RunAnalysis | null {
  const result = log.results[0];
  if (!result || log.datasetId !== "math-500-qualified") return null;
  const samples = result.samples || [];
  const rows = new Map(rawRows.map((row) => [row.unique_id, row]));
  const scored = samples.filter(
    (sample) => sample.evaluation?.status === "scored" && typeof sample.passed === "boolean",
  );
  const correct = scored.filter((sample) => sample.passed === true);
  const evaluator = scored[0]?.evaluation;
  const evaluatorFingerprint = digest({
    id: evaluator?.evaluatorId || null,
    version: evaluator?.evaluatorVersion || null,
    configId: evaluator?.configId || null,
    sourceRevision: MATH_VERIFY_SOURCE_REVISION,
  });
  const runDigest = digest(
    samples.map((sample) => ({
      itemId: sample.itemId || null,
      ok: sample.ok,
      score: sample.score ?? null,
      passed: sample.passed ?? null,
      outputDigest: digest(sample.outputText || sample.outputPreview || ""),
      evaluator: sample.evaluation
        ? {
            id: sample.evaluation.evaluatorId,
            version: sample.evaluation.evaluatorVersion,
            configId: sample.evaluation.configId,
            status: sample.evaluation.status,
          }
        : null,
    })),
  );
  const complete =
    samples.length === 500 &&
    new Set(samples.map((sample) => sample.itemId).filter(Boolean)).size === 500 &&
    scored.length === 500 &&
    rawRows.length === 500;
  const totalTokens = samples.reduce((sum, sample) => sum + sample.totalTokens, 0);
  const completionTokens = samples.reduce(
    (sum, sample) => sum + sample.completionTokens,
    0,
  );
  return {
    schemaVersion: MATH500_REPRODUCIBILITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    runId: log.runId || log.id,
    targetId: result.targetId,
    targetLabel: result.targetLabel,
    resolvedModel: result.resolvedModel,
    localStatus: complete ? "pass" : "hold",
    productionStatus: "hold",
    totals: {
      samples: samples.length,
      successful: samples.filter((sample) => sample.ok).length,
      scored: scored.length,
      correct: correct.length,
      incorrect: scored.length - correct.length,
      resumed: samples.filter((sample) => sample.resumedFromCheckpoint).length,
      inferred: samples.filter((sample) => !sample.resumedFromCheckpoint).length,
    },
    accuracy: scored.length ? round((correct.length / scored.length) * 100) : null,
    confidence: scored.length ? buildWilsonInterval(correct.length, scored.length) : null,
    subjects: breakdown(scored, rows, (row) => row.subject),
    levels: breakdown(scored, rows, (row) => `Level ${row.level}`),
    latencyMs: {
      p50: percentile(samples.map((sample) => sample.latencyMs), 0.5),
      p95: percentile(samples.map((sample) => sample.latencyMs), 0.95),
      p99: percentile(samples.map((sample) => sample.latencyMs), 0.99),
    },
    tokens: {
      promptAndCompletion: totalTokens,
      completion: completionTokens,
      averageCompletion: samples.length ? round(completionTokens / samples.length) : 0,
    },
    failures: {
      runtime: samples.filter((sample) => !sample.ok).length,
      unscored: samples.filter((sample) => sample.ok && !sample.evaluation).length,
      evaluatorUnavailable: samples.filter(
        (sample) => sample.evaluation?.status === "unavailable",
      ).length,
      evaluatorError: samples.filter((sample) => sample.evaluation?.status === "error").length,
      manualReview: samples.filter(
        (sample) => sample.evaluation?.status === "manual-review",
      ).length,
    },
    dataset,
    evaluator: {
      id: evaluator?.evaluatorId || null,
      version: evaluator?.evaluatorVersion || null,
      configId: evaluator?.configId || null,
      sourceRevision: MATH_VERIFY_SOURCE_REVISION,
      fingerprint: evaluatorFingerprint,
    },
    runDigest,
    disclosure:
      "This scorecard analyzes one complete local run. Confidence intervals quantify sampling uncertainty; they do not establish external leaderboard equivalence or independent-host reproducibility.",
  };
}

export function readLatestMath500RunAnalysis(runId?: string) {
  const log = findMath500Run(runId);
  const rows = readQualifiedMath500Rows();
  const qualification = readBenchmarkQualification();
  const dataset = qualification.qualifiedDataset;
  if (!log || !rows || !dataset) return null;
  return buildMath500RunAnalysis(log, rows, {
    revision: dataset.revision,
    sha256: dataset.sha256,
    rowCount: dataset.sampleCount,
  });
}
