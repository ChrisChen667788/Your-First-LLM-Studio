import assert from "node:assert/strict";
import test from "node:test";
import {
  buildV171V190SourceTrainState,
  V171_V190_SOURCE_TRAIN_SCHEMA_VERSION,
} from "@/features/experiments/v171-v190-source-train";

test("v1.7.1 through v1.9.0 source train exposes ten fail-closed versions", () => {
  const evidence = buildV171V190SourceTrainState({
    enterprise: { status: "blocked", capabilities: { acl: "postgres-rls-subject-groups" } },
    telemetry: { config: { enabled: false, exporter: "disabled" }, totals: { spans: 0, scheduledForExport: 0 } },
    serverAccess: { latestPassing: null, totals: { active: 0 } },
    workflowAccess: { latestPassing: null },
    openAi: { reports: [] },
    hub: { latestPassing: null, sessions: [] },
    hubReconciliation: { latestPassing: null },
    workflow: { localStatus: "evidence-needed" },
    collaboration: { latestPassing: null },
    accessReview: { latestPassing: null },
    qualityCi: { latestPassing: null },
    releaseSecurity: { status: "evidence-needed" },
    desktopData: { latestPassing: null },
    desktopPermissions: { latestPassing: null },
    desktopServices: { latestPassing: null },
    desktopUpdates: { latestPassing: null },
  } as Parameters<typeof buildV171V190SourceTrainState>[0]);
  assert.equal(V171_V190_SOURCE_TRAIN_SCHEMA_VERSION, "experiments.v171-v190-source-train.v1");
  assert.equal(evidence.versions.length, 10);
  assert.equal(evidence.totals.versions, 10);
  assert.equal(evidence.totals.sourceContractsPassed, 10);
  assert.equal(evidence.productionStatus, "hold");
  assert.equal(evidence.localStatus, "hold");
  assert.ok(evidence.versions.every((version) => version.sourceStatus === "pass" && version.externalStatus === "hold" && version.productionStatus === "hold"));
  assert.ok(evidence.versions.some((version) => version.version === "v1.7.1"));
  assert.ok(evidence.versions.some((version) => version.version === "v1.9.0"));
});
