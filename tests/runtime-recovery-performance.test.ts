import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRuntimePerformanceReceipt,
  buildRuntimeRecoveryCheckpoint,
  buildRuntimeRecoveryPerformanceReadModel,
  transitionRuntimeRecoveryCheckpoint,
} from "@/features/models/runtime-recovery-performance";

const hardware = { label: "darwin arm64 · 32 GB", digest: "hardware-digest" };
const input = {
  targetId: "local-qwen3-0.6b",
  targetLabel: "Local Qwen3",
  resolvedModel: "qwen3:0.6b",
  execution: "local" as const,
  runtime: { implementation: "Ollama", version: "0.31.1" },
  profile: {
    id: "local-coding-balanced",
    temperature: 0.2,
    contextWindow: 8192,
    enableTools: true,
    enableRetrieval: false,
    thinkingMode: "standard" as const,
    providerProfile: "balanced" as const,
  },
  prompt: { classId: "repeatable-smoke", digest: "prompt-digest", repeatedContext: false },
  metrics: {
    latencyMs: 120,
    firstTokenLatencyMs: 40,
    tokenThroughputTps: 28,
    memoryBytes: 8 * 1024 ** 3,
    queueWaitMs: 0,
    promptTokens: 32,
    completionTokens: 16,
  },
  source: "operator-recorded" as const,
};

function completed(operation: "resume" | "restart" | "load" | "unload" | "benchmark") {
  const checkpoint = buildRuntimeRecoveryCheckpoint({
    operation,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    safeBoundary: { kind: "fixture", reference: operation, summary: `${operation} boundary` },
    now: "2026-08-21T00:00:00.000Z",
  });
  const resumed = transitionRuntimeRecoveryCheckpoint(checkpoint, {
    state: "resumed",
    now: "2026-08-21T00:00:01.000Z",
  });
  return transitionRuntimeRecoveryCheckpoint(resumed, {
    state: "completed",
    now: "2026-08-21T00:00:02.000Z",
  });
}

test("runtime performance only compares two complete same-profile local receipts", () => {
  const first = buildRuntimePerformanceReceipt(input, {
    id: "first",
    generatedAt: "2026-08-21T00:00:00.000Z",
    hardware,
  });
  const second = buildRuntimePerformanceReceipt(input, {
    id: "second",
    generatedAt: "2026-08-21T00:01:00.000Z",
    hardware,
  });
  const checkpoints = [
    buildRuntimeRecoveryCheckpoint({
      operation: "cancel",
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      safeBoundary: { kind: "fixture", reference: "cancel", summary: "cancel boundary" },
      now: "2026-08-21T00:00:00.000Z",
    }),
    completed("resume"),
    completed("restart"),
    completed("load"),
    completed("unload"),
    completed("benchmark"),
  ];
  const evidence = buildRuntimeRecoveryPerformanceReadModel({
    performance: [first, second],
    checkpoints,
    generatedAt: "2026-08-21T00:02:00.000Z",
  });

  assert.equal(first.completionState, "complete");
  assert.equal(first.comparisonKey, second.comparisonKey);
  assert.equal(evidence.performance.comparison.status, "comparable");
  assert.equal(evidence.recovery.restartSafe, true);
  assert.equal(evidence.localStatus, "pass");
  assert.equal(evidence.productionStatus, "hold");
});

test("incomplete metrics and invalid recovery transitions remain fail-closed", () => {
  const incomplete = buildRuntimePerformanceReceipt(
    { ...input, metrics: { ...input.metrics, memoryBytes: null } },
    { id: "incomplete", generatedAt: "2026-08-21T00:00:00.000Z", hardware },
  );
  const checkpoint = buildRuntimeRecoveryCheckpoint({
    operation: "restart",
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    safeBoundary: { kind: "fixture", reference: "restart", summary: "restart boundary" },
    now: "2026-08-21T00:00:00.000Z",
  });
  const evidence = buildRuntimeRecoveryPerformanceReadModel({
    performance: [incomplete],
    checkpoints: [checkpoint],
  });

  assert.equal(incomplete.completionState, "incomplete");
  assert.equal(evidence.performance.comparison.status, "incomplete");
  assert.equal(evidence.localStatus, "hold");
  assert.throws(
    () => transitionRuntimeRecoveryCheckpoint(checkpoint, { state: "completed" }),
    /Cannot transition checkpoint/,
  );
});
