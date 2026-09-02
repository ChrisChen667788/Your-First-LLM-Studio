import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAgentHarnessScenario } from "@/features/agent/harness-conformance";
import { buildInteractionCacheAttribution } from "@/features/agent/interaction-cache";
import { buildIsolatedAgentTeamPlan } from "@/features/agent/isolated-team-service";
import { getBenchmarkTargetCapability } from "@/features/benchmark/model-capabilities";
import { readCompetitiveProductTrainEvidence } from "@/features/experiments/competitive-product-train";
import { evaluateSandboxWorkload } from "@/features/extensions/secure-sandbox-fabric";
import { buildTrainingExecutionPlan } from "@/features/finetune/training-execution-plan";
import { evaluateMarketplaceInstall } from "@/features/governance/team-studio-marketplace";
import { buildWorkloadRoutingScorecard } from "@/features/providers/workload-routing";
import { evaluateConnectorIndexLifecycle } from "@/features/retrieval/connector-index-lifecycle";
import { buildRagQualityDecision } from "@/features/retrieval/rag-quality-loop";
import { agentTargets } from "@/lib/agent/catalog";

test("routing fails closed without measured workload quality", () => {
  const scorecard = buildWorkloadRoutingScorecard({
    workload: "agent-tools",
    candidates: [{
      targetId: "remote-a",
      execution: "remote",
      qualityStatus: "missing",
      qualityScore: null,
      sampleCount: 0,
      successRatePct: 100,
      latencyMs: 50,
      estimatedCostUsdPer1k: 0.001,
      capabilities: { vision: true, tools: true, thinking: true },
    }],
    policy: { requireTools: true },
  });
  assert.equal(scorecard.selectedTargetId, null);
  assert.equal(scorecard.failClosed, true);
});

test("agent harness rejects duplicate protected effects", () => {
  const result = evaluateAgentHarnessScenario({
    id: "duplicate-effect",
    events: [
      { id: "e1", type: "turn-started" },
      { id: "e2", type: "tool-requested" },
      { id: "e3", type: "tool-completed", idempotencyKey: "same-effect" },
      { id: "e4", type: "tool-completed", idempotencyKey: "same-effect" },
      { id: "e5", type: "usage-recorded", promptTokens: 1, completionTokens: 1 },
    ],
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.idempotentEffects, false);
});

test("cache attribution reports observations without inventing financial savings", () => {
  const attribution = buildInteractionCacheAttribution([
    { id: "a", targetId: "local", resolvedModel: "model", cacheHit: true, cacheMode: "prompt", latencyMs: 20, usage: { promptTokens: 40, completionTokens: 10, totalTokens: 50 } },
    { id: "b", targetId: "local", resolvedModel: "model", cacheHit: false, cacheMode: "prompt", latencyMs: 80, usage: { promptTokens: 40, completionTokens: 10, totalTokens: 50 } },
  ]);
  assert.equal(attribution.hitRatePct, 50);
  assert.equal(attribution.observedPromptTokensOnHits, 40);
  assert.equal(attribution.hitLatencyMs, 20);
  assert.equal(attribution.missLatencyMs, 80);
});

test("isolated team plans detect file ownership conflicts", () => {
  const plan = buildIsolatedAgentTeamPlan({
    teamId: "team",
    repositoryRoot: "/repo",
    agents: [
      { id: "a", role: "builder", workspacePath: "/worktrees/a", branchName: "codex/a", tokenBudget: 100, timeBudgetSeconds: 30, claimedFiles: ["same.ts"] },
      { id: "b", role: "reviewer", workspacePath: "/worktrees/b", branchName: "codex/b", tokenBudget: 100, timeBudgetSeconds: 30, claimedFiles: ["same.ts"] },
    ],
  });
  assert.equal(plan.dispatchAllowed, true);
  assert.equal(plan.automaticMergeAllowed, false);
  assert.equal(plan.mergePolicy, "review-required");
});

test("sandbox and marketplace policies deny unbrokered or cross-workspace work", () => {
  const sandbox = evaluateSandboxWorkload({
    workloadId: "unsafe",
    filesystemReadPaths: ["/etc/passwd"],
    filesystemWritePaths: ["/tmp/output"],
    networkHosts: ["api.example.com"],
    secretRefs: ["provider-key"],
    cpuLimit: 2,
    memoryMb: 512,
    timeoutSeconds: 30,
  });
  const marketplace = evaluateMarketplaceInstall({
    workspaceId: "a",
    actorWorkspaceId: "b",
    actorRole: "builder",
    assetType: "extension",
    publisherVerified: false,
    signatureVerified: false,
    revoked: true,
  });
  assert.equal(sandbox.executionAllowed, false);
  assert.equal(marketplace.allowed, false);
});

test("connector lifecycle requires deletion propagation and rollback lineage", () => {
  const lifecycle = evaluateConnectorIndexLifecycle({
    activeRevisionId: "r2",
    indexedDocumentIds: ["keep"],
    revisions: [
      { id: "r1", parentId: null, connectorId: "c", parserVersion: "p1", documentIds: ["keep", "remove"], deletedDocumentIds: [], indexVersion: "i1", state: "staged" },
      { id: "r2", parentId: "r1", connectorId: "c", parserVersion: "p2", documentIds: ["keep"], deletedDocumentIds: ["remove"], indexVersion: "i2", state: "active" },
    ],
  });
  assert.equal(lifecycle.status, "pass");
  assert.equal(lifecycle.checks.deletionsPropagated, true);
  assert.equal(lifecycle.checks.rollbackAvailable, true);
});

test("RAG quality requires paired, cited, fresh and leakage-free evidence", () => {
  const baseline = Array.from({ length: 20 }, (_, index) => ({ id: String(index), retrievalRecall: 0, citationPrecision: 0, answerScore: 0.5, leakage: false, fresh: true, humanAccepted: null }));
  const candidate = baseline.map((sample) => ({ ...sample, retrievalRecall: 0.9, citationPrecision: 0.95, answerScore: 0.7, humanAccepted: true }));
  const result = buildRagQualityDecision({ baseline, candidate });
  assert.equal(result.decision, "pass");
  assert.equal(result.metrics.pairedSamples, 20);
});

test("ModelScope SWIFT produces a validated preview plan but cannot execute", () => {
  const plan = buildTrainingExecutionPlan({
    backendId: "modelscope-swift",
    modelId: "Qwen/Qwen3-8B",
    modelFamily: "qwen",
    datasetPath: "data/train.jsonl",
    outputDir: "output/swift",
    method: "lora",
    quantizationBits: 4,
    scheduler: "cosine",
    learningRate: 1e-5,
    epochs: 3,
    batchSize: 1,
    gradientAccumulationSteps: 8,
    warmupRatio: 0.03,
    targetModules: ["q_proj", "v_proj"],
    packingPolicy: "disabled",
    saveEverySteps: 100,
    evalEverySteps: 100,
    totalSteps: 1000,
    bestCheckpointMetric: "eval_loss",
    loadBestCheckpointAtEnd: true,
    seed: 42,
  });
  assert.equal(plan.planSupported, true);
  assert.equal(plan.executable, false);
  assert.equal(plan.executionMode, "preview-only");
  assert.deepEqual(plan.argv.slice(0, 2), ["swift", "sft"]);
});

test("MiniMax account aliases fail closed for unverified multimodal work", () => {
  const target = agentTargets.find((entry) => entry.id === "minimax-m3");
  assert.ok(target);
  const capability = getBenchmarkTargetCapability(target);
  assert.equal(capability.evidenceStatus, "unverified");
  assert.deepEqual(capability.effectiveModalities, ["text"]);
  assert.ok(capability.officialDocsUrl);
});

test("competitive product train exposes fifteen source contracts without production promotion", () => {
  const evidence = readCompetitiveProductTrainEvidence();
  assert.equal(evidence.versions.length, 15);
  assert.equal(evidence.totals.sourcePassed, 15);
  assert.equal(evidence.productionStatus, "hold");
  assert.ok(evidence.versions.every((version) => version.sourceStatus === "pass"));
  assert.ok(evidence.versions.every((version) => version.externalStatus === "hold"));
});
