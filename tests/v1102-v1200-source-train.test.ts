import assert from "node:assert/strict";
import test from "node:test";

import {
  buildV1102V1200SourceTrainState,
  V1102_V1200_SOURCE_TRAIN_SCHEMA_VERSION,
} from "@/features/experiments/v1102-v1200-source-train";

test("v1.10.2 through v1.12.0 source train exposes ten fail-closed versions", () => {
  const evidence = buildV1102V1200SourceTrainState({
    runtime: { registry: { profiles: [] }, targetCards: [], requestLogs: { total: 0 } },
    runtimeRecoveryPerformance: {
      localStatus: "hold",
      performance: { completeReceipts: 0, comparison: { status: "baseline-needed" } },
      recovery: { observedOperations: [], restartSafe: false },
    },
    workspace: { mode: "loopback-local", signedProxyConfigured: false },
    workspaceProvenance: { localStatus: "hold", latestPassing: null },
    agentActionTrust: {
      localStatus: "hold",
      summary: { shadowPassingRuns: 0, duplicateSideEffects: 0, replayReceiptId: null, stateDiffReceiptId: null },
    },
    agentShadow: { summary: { passingRuns: 0, duplicateSideEffects: 0 } },
    workflowReplay: { latestPassing: null },
    workflowClosure: { localStatus: "evidence-needed" },
    workflowDebugger: {
      localStatus: "hold",
      replayBoundary: { replay: null, stateDiff: null },
    },
    artifactCatalog: {
      totals: { targets: 0, digestVerified: 0 },
      policy: { remoteRoundTripReceiptRequired: true },
    },
    artifactTrust: { ok: true },
    artifactFederation: {
      localStatus: "hold",
      summary: { activeTrustRoots: 0, revokedTrustRoots: 0, signedReadBackReceiptId: null },
    },
    hub: { latestPassing: null, sessions: [] },
    hubReconciliation: { latestPassing: null },
    modelDeduplication: { latestPassing: null },
    modelSupplyChain: {
      localStatus: "hold",
      summary: { hubReceiptId: null, verifiedHubChecksums: 0, hubFiles: 0, reconciliationReceiptId: null },
    },
    enterpriseRetrieval: { status: "blocked" },
    retrievalReplay: { totals: { entryCount: 0, replayableCount: 0 } },
    ragGovernance: {
      localStatus: "hold",
      summary: { enterpriseStatus: "blocked", replayEntries: 0, replayableEntries: 0 },
    },
    training: {
      totals: { implemented: 0 },
      sampleCompatibility: { supported: false },
    },
    fineTuneQuality: { localStatus: "evidence-needed" },
    trainingRecipes: {
      localStatus: "hold",
      summary: {
        implementedBackends: 0,
        samplePlanMode: "preview-only",
        qualityExportStatus: "evidence-needed",
      },
    },
    qualityCi: { latestPassing: null },
    qualityArtifact: { latestPassing: null },
    regression: { latestPassing: null },
    qualitySafety: {
      localStatus: "hold",
      summary: {
        qualityCiReceiptId: null,
        artifactBindingReceiptId: null,
        regressionReceiptId: null,
      },
    },
    deployment: { revision: "local" },
    enterpriseControlPlane: {
      localStatus: "hold",
      summary: {
        deploymentRevision: "local",
        localReadinessPct: 0,
        cloudConfigured: false,
        releaseSecurityStatus: "evidence-needed",
      },
    },
    haFinOps: { checks: [] },
    enterpriseIdentity: { latestPassing: null },
    releaseSecurity: { status: "evidence-needed" },
  } as Parameters<typeof buildV1102V1200SourceTrainState>[0]);

  assert.equal(
    V1102_V1200_SOURCE_TRAIN_SCHEMA_VERSION,
    "experiments.v1102-v1200-source-train.v1",
  );
  assert.equal(evidence.versions.length, 10);
  assert.equal(evidence.totals.versions, 10);
  assert.equal(evidence.totals.sourceContractsPassed, 10);
  assert.equal(evidence.productionStatus, "hold");
  assert.equal(evidence.localStatus, "hold");
  assert.ok(
    evidence.versions.every(
      (version) =>
        version.sourceStatus === "pass" &&
        version.externalStatus === "hold" &&
        version.productionStatus === "hold",
    ),
  );
  assert.ok(evidence.versions.some((version) => version.version === "v1.10.2"));
  assert.ok(evidence.versions.some((version) => version.version === "v1.12.0"));
});
