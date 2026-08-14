import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBenchmarkDecisionIntelligence,
  classifyMath500Sample,
  exactMcnemarPValue,
} from "@/features/benchmark/decision-intelligence-service";
import type { StoredBenchmarkLog } from "@/lib/agent/log-store";
import type { AgentBenchmarkSample } from "@/lib/agent/types";

const subjects = [
  "Algebra",
  "Counting & Probability",
  "Geometry",
  "Intermediate Algebra",
  "Number Theory",
  "Prealgebra",
  "Precalculus",
];

const rows = Array.from({ length: 500 }, (_, index) => ({
  answer: String(index),
  subject: subjects[index % subjects.length],
  level: (index % 5) + 1,
  unique_id: `test/item-${index}.json`,
}));

function makeSample(index: number, correctCount: number): AgentBenchmarkSample {
  const passed = index < correctCount;
  return {
    run: 1,
    workloadId: "math-500-qualified",
    itemId: rows[index].unique_id,
    firstTokenLatencyMs: 10,
    latencyMs: 100 + index,
    completionTokens: 20 + (index % 40),
    totalTokens: 100,
    tokenThroughputTps: 80,
    outputText: `\\boxed{${passed ? index : index + 1}}`,
    score: passed ? 100 : 0,
    passed,
    evaluation: {
      evaluatorId: "huggingface-math-verify",
      evaluatorVersion: "0.9.0",
      configId: "math-500-v1",
      status: "scored",
      rationale: "fixture",
      extractedGold: [String(index)],
      extractedPrediction: [String(passed ? index : index + 1)],
    },
    resumedFromCheckpoint: index < 490,
    ok: true,
  };
}

function makeLog(runId: string, generatedAt: string, correctCount: number): StoredBenchmarkLog {
  const samples = rows.map((_, index) => makeSample(index, correctCount));
  return {
    kind: "benchmark",
    id: runId,
    runId,
    generatedAt,
    benchmarkMode: "dataset",
    prompt: "",
    datasetId: "math-500-qualified",
    contextWindow: 4096,
    runs: 1,
    providerProfile: "balanced",
    thinkingMode: "standard",
    results: [
      {
        targetId: "local-qwen3-0.6b",
        targetLabel: "Local Qwen3 0.6B",
        resolvedModel: "local-qwen3-0.6b",
        contextWindow: 4096,
        runs: 500,
        okRuns: 500,
        avgFirstTokenLatencyMs: 10,
        avgLatencyMs: 350,
        avgTokenThroughputTps: 80,
        firstTokenLatencyPercentiles: { p50: 10, p95: 10, p99: 10 },
        totalLatencyPercentiles: { p50: 350, p95: 575, p99: 595 },
        tokenThroughputPercentiles: { p50: 80, p95: 80, p99: 80 },
        samples,
      },
    ],
    ok: true,
  };
}

test("decision intelligence audits one full run without inventing a candidate", () => {
  const evidence = buildBenchmarkDecisionIntelligence({
    logs: [makeLog("baseline", "2026-08-10T00:00:00.000Z", 160)],
    rows,
    dataset: { revision: "fixture", sha256: "a".repeat(64), rowCount: 500 },
  });
  assert.equal(evidence.localStatus, "pass");
  assert.equal(evidence.audit?.accountedSamples, 500);
  assert.equal(evidence.audit?.extractionCoveragePct, 100);
  assert.equal(evidence.audit?.errorTaxonomy.find((entry) => entry.key === "correct")?.count, 160);
  assert.equal(evidence.audit?.errorTaxonomy.find((entry) => entry.key === "semantic-mismatch")?.count, 340);
  assert.equal(evidence.comparison?.promotionDecision, "evidence-needed");
  assert.equal(evidence.eligibleRuns.length, 1);
  assert.equal(evidence.power?.targets.length, 3);
});

test("paired candidate comparison applies McNemar and non-inferiority gates", () => {
  const evidence = buildBenchmarkDecisionIntelligence({
    logs: [
      makeLog("baseline", "2026-08-10T00:00:00.000Z", 160),
      makeLog("candidate", "2026-08-11T00:00:00.000Z", 170),
    ],
    rows,
    dataset: { revision: "fixture", sha256: "a".repeat(64), rowCount: 500 },
  });
  assert.equal(evidence.comparison?.sharedSamples, 500);
  assert.equal(evidence.comparison?.discordant.candidateWins, 10);
  assert.equal(evidence.comparison?.discordant.baselineWins, 0);
  assert.equal(evidence.comparison?.deltaPct, 2);
  assert.equal(evidence.comparison?.mcnemarExactPValue, 0.001953);
  assert.equal(evidence.comparison?.promotionDecision, "pass");
});

test("error taxonomy distinguishes extraction and runtime failures", () => {
  const sample = makeSample(200, 160);
  assert.equal(classifyMath500Sample(sample), "semantic-mismatch");
  assert.equal(
    classifyMath500Sample({ ...sample, evaluation: { ...sample.evaluation!, extractedPrediction: [] } }),
    "answer-not-extracted",
  );
  assert.equal(classifyMath500Sample({ ...sample, ok: false }), "runtime-failure");
  assert.equal(exactMcnemarPValue(10, 0), 0.001953);
});
