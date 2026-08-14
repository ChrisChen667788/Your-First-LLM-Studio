import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataDirectory = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-benchmark-standards-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;

after(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("standards catalog pins authoritative sources and evaluator protocols", async () => {
  const { benchmarkStandardsCatalog } = await import(
    "@/features/benchmark/standards-catalog"
  );
  assert.ok(benchmarkStandardsCatalog.length >= 10);
  assert.equal(
    new Set(benchmarkStandardsCatalog.map((entry) => entry.id)).size,
    benchmarkStandardsCatalog.length,
  );
  for (const entry of benchmarkStandardsCatalog) {
    assert.match(entry.sourceUrl, /^https:\/\//u);
    assert.match(entry.updateUrl, /^https:\/\//u);
    assert.ok(entry.protocol.length > 30);
    assert.ok(entry.modalities.includes("text"));
  }
  assert.ok(
    benchmarkStandardsCatalog.some((entry) => entry.modalities.includes("image")),
  );
  assert.ok(
    benchmarkStandardsCatalog.some((entry) => entry.modalities.includes("video")),
  );
});

test("MiniMax M3 is the only currently verified native image and video target", async () => {
  const { agentTargets } = await import("@/lib/agent/catalog");
  const {
    assessBenchmarkTargetModality,
    getBenchmarkTargetCapability,
  } = await import("@/features/benchmark/model-capabilities");
  const minimax = agentTargets.find((target) => target.id === "minimax-m3");
  const local = agentTargets.find((target) => target.execution === "local");
  assert.ok(minimax);
  assert.ok(local);

  const capability = getBenchmarkTargetCapability(minimax);
  assert.equal(capability.evidenceStatus, "verified");
  assert.deepEqual(capability.effectiveModalities, ["text", "image", "video"]);
  assert.equal(assessBenchmarkTargetModality(minimax, "video").supported, true);
  assert.equal(assessBenchmarkTargetModality(local, "image").supported, false);
});

test("multimodal prompt plan preserves media and emits MiniMax message parts", async () => {
  const { buildPlan, expandPlanTasks } = await import(
    "@/features/benchmark/run-plan"
  );
  const { buildRemoteBenchmarkUserContent } = await import(
    "@/features/benchmark/remote-sample-runner"
  );
  const plan = buildPlan(
    {
      benchmarkMode: "prompt",
      prompt: "Describe the evidence in this image.",
      media: [
        {
          type: "image",
          url: "https://example.com/evidence.png",
          detail: "high",
        },
      ],
    },
    1,
  );
  assert.ok(!("error" in plan));
  if ("error" in plan) return;
  const [task] = expandPlanTasks(plan, 4096, 128);
  assert.deepEqual(task.requiredModalities, ["text", "image"]);
  assert.equal(task.media?.[0]?.url, "https://example.com/evidence.png");
  assert.deepEqual(buildRemoteBenchmarkUserContent(task.prompt, task.media), [
    { type: "text", text: "Describe the evidence in this image." },
    {
      type: "image_url",
      image_url: {
        url: "https://example.com/evidence.png",
        detail: "high",
      },
    },
  ]);
});

test("unsafe media paths fail validation and capability skips are non-fatal", async () => {
  const { buildPlan } = await import("@/features/benchmark/run-plan");
  const { isFatalRemoteBenchmarkSampleFailure } = await import(
    "@/features/benchmark/run-sample-orchestration"
  );
  const plan = buildPlan(
    {
      benchmarkMode: "prompt",
      prompt: "Inspect this image.",
      media: [{ type: "image", url: "/tmp/private.png" }],
    },
    1,
  );
  assert.ok("error" in plan);
  assert.equal(
    isFatalRemoteBenchmarkSampleFailure({
      run: 1,
      firstTokenLatencyMs: null,
      latencyMs: 0,
      completionTokens: 0,
      totalTokens: 0,
      tokenThroughputTps: null,
      ok: false,
      warning: "Skipped target: image input is not verified.",
    }),
    false,
  );
});

test("standards read model distinguishes official registry from starter adapters", async () => {
  const { buildBenchmarkStandardsReadModel } = await import(
    "@/features/benchmark/standards-service"
  );
  const model = buildBenchmarkStandardsReadModel();
  assert.equal(model.ok, true);
  assert.equal(model.totals.standards, model.standards.length);
  assert.ok(model.stale);
  assert.match(model.disclosure, /not official full benchmark snapshots/i);
});

test("an all-capability-skip run completes without being reported as a crashed process", async () => {
  const { buildBenchmarkRunPayload, createBenchmarkRunPayloadContext } = await import(
    "@/features/benchmark/run-payload"
  );
  const plan = {
    benchmarkMode: "prompt" as const,
    prompt: "Inspect the image.",
    items: [],
  };
  const context = createBenchmarkRunPayloadContext({
    runId: "skip-only-run",
    plan,
    contextWindow: 4096,
    runs: 1,
    profileBatchScope: "full-suite",
    profileModes: [{ providerProfile: "speed", thinkingMode: "standard" }],
  });
  const payload = buildBenchmarkRunPayload(context, [
    {
      targetId: "local-test",
      targetLabel: "Local test",
      resolvedModel: "local-test",
      contextWindow: 4096,
      runs: 1,
      okRuns: 0,
      skippedRuns: 1,
      avgFirstTokenLatencyMs: 0,
      avgLatencyMs: 0,
      avgTokenThroughputTps: 0,
      firstTokenLatencyPercentiles: { p50: 0, p95: 0, p99: 0 },
      totalLatencyPercentiles: { p50: 0, p95: 0, p99: 0 },
      tokenThroughputPercentiles: { p50: 0, p95: 0, p99: 0 },
      samples: [],
    },
  ]);
  assert.equal(payload.ok, true);
  assert.match(payload.warning || "", /completed with skips/i);
});
