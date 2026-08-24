import assert from "node:assert/strict";
import test from "node:test";

import { buildBenchmarkDecisionIntelligence } from "@/features/benchmark/decision-intelligence-service";
import { buildMultimodalExecutionPlan } from "@/features/benchmark/multimodal-execution-readiness";
import { buildV170BenchmarkCandidateMultimodalState } from "@/features/experiments/v170-benchmark-candidate-multimodal";
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
  unique_id: `v170/item-${index}.json`,
}));

function makeSample(index: number, correctCount: number): AgentBenchmarkSample {
  const passed = index < correctCount;
  return {
    run: 1,
    workloadId: "math-500-qualified",
    itemId: rows[index].unique_id,
    firstTokenLatencyMs: 10,
    latencyMs: 100 + index,
    completionTokens: 20,
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
    ok: true,
  };
}

function makeLog(
  runId: string,
  generatedAt: string,
  correctCount: number,
  targetId = "local-qwen3-0.6b",
): StoredBenchmarkLog {
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
        targetId,
        targetLabel: targetId,
        resolvedModel: targetId,
        contextWindow: 4096,
        runs: 500,
        okRuns: 500,
        avgFirstTokenLatencyMs: 10,
        avgLatencyMs: 350,
        avgTokenThroughputTps: 80,
        firstTokenLatencyPercentiles: { p50: 10, p95: 10, p99: 10 },
        totalLatencyPercentiles: { p50: 350, p95: 575, p99: 595 },
        tokenThroughputPercentiles: { p50: 80, p95: 80, p99: 80 },
        samples: rows.map((_, index) => makeSample(index, correctCount)),
      },
    ],
    ok: true,
  };
}

function stateFor(logs: StoredBenchmarkLog[]) {
  return buildV170BenchmarkCandidateMultimodalState({
    decision: buildBenchmarkDecisionIntelligence({
      logs,
      rows,
      dataset: { revision: "fixture", sha256: "a".repeat(64), rowCount: 500 },
    }),
    multimodalPlan: buildMultimodalExecutionPlan(),
    logs,
  });
}

test("v1.7.0 keeps a single complete baseline evidence-needed", () => {
  const state = stateFor([makeLog("baseline", "2026-08-10T00:00:00.000Z", 160)]);
  assert.equal(state.candidatePromotionStatus, "evidence-needed");
  assert.equal(state.localStatus, "hold");
  assert.equal(state.slices.find((entry) => entry.id === "candidate-distinct-run")?.status, "hold");
});

test("v1.7.0 rejects a duplicate model binding as a new candidate", () => {
  const state = stateFor([
    makeLog("baseline", "2026-08-10T00:00:00.000Z", 160),
    makeLog("same-model-repeat", "2026-08-11T00:00:00.000Z", 170),
  ]);
  assert.equal(state.candidatePromotionStatus, "hold");
  assert.equal(state.slices.find((entry) => entry.id === "candidate-distinct-binding")?.status, "hold");
});

test("v1.7.0 accepts a distinct candidate binding but holds without official native execution", () => {
  const state = stateFor([
    makeLog("baseline", "2026-08-10T00:00:00.000Z", 160),
    makeLog("candidate", "2026-08-11T00:00:00.000Z", 170, "local-qwen3-4b-4bit"),
  ]);
  assert.equal(state.candidatePromotionStatus, "pass");
  assert.equal(state.multimodalExecutionStatus, "hold");
  assert.equal(state.localStatus, "hold");
  assert.equal(state.slices.find((entry) => entry.id === "official-native-execution")?.status, "hold");
});
