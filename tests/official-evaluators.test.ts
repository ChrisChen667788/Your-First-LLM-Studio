import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataDirectory = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-official-evaluators-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;

after(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("multimodal protocol fixtures match all pinned evaluator adapters", async () => {
  const { runMultimodalEvaluatorConformance } = await import(
    "@/features/benchmark/multimodal-official-evaluators"
  );
  const result = runMultimodalEvaluatorConformance();
  assert.equal(result.total, 9);
  assert.equal(result.passed, result.total);
  assert.ok(result.checks.every((check) => check.passed));
});

test("MMBench circular scoring fails the whole item on one shifted miss", async () => {
  const { evaluateMmbenchCircular } = await import(
    "@/features/benchmark/multimodal-official-evaluators"
  );
  const result = evaluateMmbenchCircular({
    expectedByPass: ["A", "D", "C", "B"],
    extractedByPass: ["A", "D", "A", "B"],
  });
  assert.equal(result.complete, true);
  assert.equal(result.passed, false);
  assert.deepEqual(result.passResults, [true, true, false, true]);
});

test("benchmark sample checkpoints resume only an identical evaluator task", async () => {
  const {
    persistBenchmarkSampleCheckpoint,
    readBenchmarkSampleCheckpoint,
  } = await import("@/features/benchmark/run-sample-checkpoint");
  const task = {
    sampleRun: 1,
    prompt: "Solve 1/2 + 1/2.",
    workloadId: "math-500-qualified",
    workloadLabel: "MATH-500",
    itemId: "test/algebra/1.json",
    evaluator: {
      kind: "math-equivalence" as const,
      gold: "1",
      evaluatorId: "huggingface-math-verify" as const,
      evaluatorVersion: "0.9.0" as const,
      configId: "math-500-v1" as const,
    },
    requiredModalities: ["text" as const],
    contextWindow: 8192,
    maxTokens: 512,
  };
  const sample = {
    run: 1,
    workloadId: task.workloadId,
    itemId: task.itemId,
    firstTokenLatencyMs: 10,
    latencyMs: 20,
    completionTokens: 5,
    totalTokens: 10,
    tokenThroughputTps: 250,
    score: 100,
    passed: true,
    ok: true,
  };
  persistBenchmarkSampleCheckpoint({
    runId: "math500-full-test",
    groupKey: "target:balanced:standard",
    task,
    sample,
  });
  assert.deepEqual(
    readBenchmarkSampleCheckpoint(
      "math500-full-test",
      "target:balanced:standard",
      task,
    ),
    sample,
  );
  assert.equal(
    readBenchmarkSampleCheckpoint(
      "math500-full-test",
      "target:balanced:standard",
      { ...task, maxTokens: 1024 },
    ),
    null,
  );
});

test("legacy synchronous evaluators remain available through the async port", async () => {
  const { evaluateBenchmarkDatasetOutput } = await import(
    "@/lib/agent/benchmark-evaluation"
  );
  const result = await evaluateBenchmarkDatasetOutput(
    {
      id: "choice",
      prompt: "Pick B",
      evaluator: { kind: "choice-exact", answer: "B" },
    },
    "B",
  );
  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
});

test("MATH-500 escaped currency gold remains scorable", async () => {
  const { inspectMathVerifyRuntime } = await import(
    "@/features/benchmark/math-evaluator-port"
  );
  const runtime = inspectMathVerifyRuntime();
  assert.equal(runtime.available, true);
  const worker = spawnSync(
    runtime.python,
    [path.join(process.cwd(), "scripts", "math_verify_worker.py")],
    {
      encoding: "utf8",
      input: `${JSON.stringify({
        requestId: "currency-regression",
        gold: String.raw`\$36`,
        prediction: String.raw`The final answer is $\boxed{24}$.`,
      })}\n`,
    },
  );
  assert.equal(worker.status, 0, worker.stderr);
  const result = JSON.parse(worker.stdout.trim()) as {
    ok: boolean;
    passed: boolean;
    extractedGold: string[];
  };
  assert.equal(result.ok, true);
  assert.equal(result.passed, false);
  assert.deepEqual(result.extractedGold.slice(0, 1), ["36"]);
});

test("benchmark progress can be rebuilt after optional fields are omitted", async () => {
  const {
    completeBenchmarkProgress,
    createBenchmarkProgress,
    readBenchmarkProgress,
  } = await import("@/lib/agent/benchmark-progress-store");
  const runId = "math500-progress-validator-regression";
  createBenchmarkProgress({ runId, totalGroups: 1, totalSamples: 1 });
  completeBenchmarkProgress(runId);
  createBenchmarkProgress({ runId, totalGroups: 1, totalSamples: 1 });
  assert.equal(readBenchmarkProgress(runId)?.status, "pending");
});

test("MATH-500 analysis produces stable scorecards and Wilson confidence", async () => {
  const { buildMath500RunAnalysis } = await import(
    "@/features/benchmark/math500-run-analysis"
  );
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
  const samples = rows.map((row, index) => ({
    run: 1,
    workloadId: "math-500-qualified",
    itemId: row.unique_id,
    firstTokenLatencyMs: 10,
    latencyMs: 20 + index,
    completionTokens: 5,
    totalTokens: 10,
    tokenThroughputTps: 100,
    outputText: `\\boxed{${index}}`,
    score: index < 160 ? 100 : 0,
    passed: index < 160,
    evaluation: {
      evaluatorId: "huggingface-math-verify",
      evaluatorVersion: "0.9.0",
      configId: "math-500-v1",
      status: "scored" as const,
      rationale: "fixture",
    },
    resumedFromCheckpoint: index < 497,
    ok: true,
  }));
  const analysis = buildMath500RunAnalysis(
    {
      kind: "benchmark",
      id: "fixture",
      runId: "math500-full-fixture",
      generatedAt: "2026-08-10T00:00:00.000Z",
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
          avgLatencyMs: 20,
          avgTokenThroughputTps: 100,
          firstTokenLatencyPercentiles: { p50: 10, p95: 10, p99: 10 },
          totalLatencyPercentiles: { p50: 20, p95: 20, p99: 20 },
          tokenThroughputPercentiles: { p50: 100, p95: 100, p99: 100 },
          samples,
        },
      ],
      ok: true,
    },
    rows,
    { revision: "fixture-revision", sha256: "a".repeat(64), rowCount: 500 },
  );
  assert.ok(analysis);
  assert.equal(analysis.localStatus, "pass");
  assert.equal(analysis.accuracy, 32);
  assert.deepEqual(analysis.confidence, {
    method: "wilson-95",
    low: 28.06,
    high: 36.21,
  });
  assert.equal(analysis.subjects.length, 7);
  assert.equal(analysis.levels.length, 5);
  assert.equal(analysis.totals.resumed, 497);
  assert.equal(analysis.totals.inferred, 3);
  assert.match(analysis.runDigest, /^[a-f0-9]{64}$/);
});

test("multimodal execution plan is actionable while full runs remain gated", async () => {
  const { buildMultimodalExecutionPlan } = await import(
    "@/features/benchmark/multimodal-execution-readiness"
  );
  const plan = buildMultimodalExecutionPlan();
  assert.equal(plan.protocols.length, 4);
  assert.equal(plan.conformance.passed, plan.conformance.total);
  assert.equal(plan.candidateTarget?.id, "minimax-m3");
  assert.ok(plan.candidateTarget?.modalities.includes("image"));
  assert.ok(plan.candidateTarget?.modalities.includes("video"));
  assert.ok(plan.protocols.every((protocol) => protocol.adapterStatus === "pass"));
  assert.ok(plan.protocols.every((protocol) => protocol.executionStatus === "hold"));
  assert.ok(plan.blockers.length > 0);
});
