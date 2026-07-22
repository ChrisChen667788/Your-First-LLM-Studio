import { readWorkflowStudioAcceptanceEvidence } from "@/features/workflows/studio-acceptance";

export const WORKFLOW_STUDIO_PROMOTION_SCHEMA_VERSION = "workflows.studio-promotion.v1" as const;

export function buildWorkflowStudioPromotionEvidence() {
  const acceptance = readWorkflowStudioAcceptanceEvidence();
  const latest = acceptance.latestPassing;
  const requiredChecks = [
    "strictGraphValidation",
    "invalidCycleRejected",
    "optimisticConflictRejected",
    "publishedVersionImmutable",
    "approvalBoundaryObserved",
    "protectedSideEffectIdempotent",
    "executionCompleted",
    "replayForkClean",
    "stateDiffPassed",
    "deploymentVersionAuthorized",
    "openAIContractAccepted",
    "versionDiffRecorded",
  ];
  const localBlockers = !latest
    ? ["No passing Workflow Studio acceptance receipt exists."]
    : requiredChecks.filter((check) => !latest.checks[check]).map((check) => `Workflow Studio acceptance check is not passing: ${check}.`);
  const productionBlockers = [
    "Authenticated non-loopback OpenAI-compatible workflow invocation evidence is required.",
    "Distributed worker lease failover and restart recovery evidence is required.",
    "Multi-user draft conflict and audit evidence is required before collaborative authoring promotion.",
  ];
  const localStatus = localBlockers.length ? "evidence-needed" as const : "pass" as const;
  return {
    ok: true as const,
    schemaVersion: WORKFLOW_STUDIO_PROMOTION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    version: "v1.3.1" as const,
    localStatus,
    productionStatus: "blocked" as const,
    status: localStatus === "pass" ? "local-ready" as const : "evidence-needed" as const,
    summary: latest
      ? `Latest local acceptance ${latest.id} passed ${Object.values(latest.checks).filter(Boolean).length}/${Object.keys(latest.checks).length} checks with graph digest ${latest.graph.digest || "missing"}.`
      : "Workflow Studio implementation is present, but a fresh end-to-end acceptance receipt has not been retained.",
    localBlockers,
    productionBlockers,
    blockers: [...localBlockers, ...productionBlockers],
    latestAcceptance: latest,
    evidence: [
      "/workflows",
      "/api/workflows",
      "/api/workflows/acceptance",
      "/api/workflows/promotion",
      "/api/workflows/deploy/[slug]/v1/chat/completions",
    ],
  };
}
