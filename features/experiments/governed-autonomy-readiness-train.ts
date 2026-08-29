import { readDeploymentLifecycleAssuranceTrain } from "@/features/experiments/deployment-lifecycle-assurance-train";
import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import {
  readGovernedAutonomySourceSignals,
  type GovernedAutonomySourceSignalSnapshot,
} from "@/features/experiments/governed-autonomy-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const GOVERNED_AUTONOMY_READINESS_SCHEMA_VERSION =
  "experiments.governed-autonomy-readiness.v1" as const;

export const GOVERNED_AUTONOMY_READINESS_DEFINITIONS: SourceBackedAssuranceDefinition[] = [
  {
    version: "v2.6.0",
    key: "MODEL_SELECTION_POLICY",
    label: "Model Selection Policy",
    schemaVersion: "enterprise.governed-autonomy-model-selection.v1",
    sourceSignalId: "model-selection-policy",
    sourceContracts: ["runtime capability and hardware fit", "qualified benchmark evidence", "explicit fallback and abstention policy"],
    externalBlocker: "Independent model owners must approve the representative model catalog, quality thresholds, risk limits, and abstention behavior.",
    requiredAssertions: ["model-selection-policy-reviewed", "model-abstention-boundary-verified"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.1",
    key: "PROVIDER_ROUTING_SAFETY",
    label: "Provider Routing and Fallback Safety",
    schemaVersion: "enterprise.governed-autonomy-provider-routing.v1",
    sourceSignalId: "provider-routing-safety",
    sourceContracts: ["provider health and traffic evidence", "typed retry and fallback policy", "quota, latency, and cost guardrails"],
    externalBlocker: "Gateway and provider owners must attest real traffic routing, fallback outcomes, quota handling, and billing identity.",
    requiredAssertions: ["provider-routing-observed", "fallback-safety-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.2",
    key: "GROUNDED_CONTEXT_POLICY",
    label: "Grounded Context and Retrieval Policy",
    schemaVersion: "enterprise.governed-autonomy-grounded-context.v1",
    sourceSignalId: "grounded-context-policy",
    sourceContracts: ["corpus and query revision lineage", "citation and reranker diagnostics", "workspace, subject, and deletion filtering"],
    externalBlocker: "Knowledge and security owners must validate representative documents, identities, citations, denial cases, and deletion propagation.",
    requiredAssertions: ["grounded-context-evaluated", "retrieval-access-policy-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.3",
    key: "TOOL_PERMISSION_POLICY",
    label: "Tool Permission and Extension Policy",
    schemaVersion: "enterprise.governed-autonomy-tool-permission.v1",
    sourceSignalId: "tool-permission-policy",
    sourceContracts: ["signed extension manifest", "least-privilege permission scope", "sandbox, quarantine, rollback, and secret policy"],
    externalBlocker: "Security owners must approve publisher trust roots, real secrets, cross-platform sandboxes, and deployed extension permissions.",
    requiredAssertions: ["tool-permissions-reviewed", "extension-isolation-verified"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.4",
    key: "PROTECTED_ACTION_APPROVAL",
    label: "Protected Action Approval",
    schemaVersion: "enterprise.governed-autonomy-protected-action.v1",
    sourceSignalId: "protected-action-approval",
    sourceContracts: ["protected-tool interruption", "human approval and resumable token", "idempotent side-effect reconciliation"],
    externalBlocker: "Independent operators must exercise real protected actions, approval UX, reconnect, denial, and duplicate-side-effect recovery.",
    requiredAssertions: ["protected-actions-approved", "duplicate-side-effects-zero"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.5",
    key: "WORKFLOW_REPLAY_SAFETY",
    label: "Workflow Checkpoint and Replay Safety",
    schemaVersion: "enterprise.governed-autonomy-workflow-replay.v1",
    sourceSignalId: "workflow-replay-safety",
    sourceContracts: ["typed node execution", "checkpoint, breakpoint, and replay", "lease fencing and protected side effects"],
    externalBlocker: "Distributed worker owners must prove recovery, stale-worker fencing, replay isolation, and exactly-once protected effects.",
    requiredAssertions: ["workflow-replay-rehearsed", "stale-worker-fenced"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.6",
    key: "BENCHMARK_QUALITY_POLICY",
    label: "Benchmark-backed Quality Policy",
    schemaVersion: "enterprise.governed-autonomy-benchmark-quality.v1",
    sourceSignalId: "benchmark-quality-policy",
    sourceContracts: ["official immutable dataset", "deterministic evaluator", "baseline, candidate, confidence, and regression thresholds"],
    externalBlocker: "Independent quality owners must approve representative blind sets, model-specific evaluators, and promotion thresholds.",
    requiredAssertions: ["quality-policy-evaluated", "regression-thresholds-approved"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.7",
    key: "ADAPTER_ROLLBACK_POLICY",
    label: "Adapter Selection and Rollback Policy",
    schemaVersion: "enterprise.governed-autonomy-adapter-rollback.v1",
    sourceSignalId: "adapter-rollback-policy",
    sourceContracts: ["paired baseline and adapter quality", "best-checkpoint package binding", "install read-back, rollback, cost, and ROI"],
    externalBlocker: "Model owners must approve representative adapter quality, total training cost, deployment behavior, and rollback drills.",
    requiredAssertions: ["adapter-selection-reviewed", "adapter-rollback-rehearsed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.8",
    key: "AUDIT_PROVENANCE",
    label: "Audit and Provenance Projection",
    schemaVersion: "enterprise.governed-autonomy-audit-provenance.v1",
    sourceSignalId: "audit-provenance",
    sourceContracts: ["workspace and subject action digests", "artifact and policy lineage", "retention, export, and privacy boundary"],
    externalBlocker: "Audit and privacy authorities must reconcile real identities, actions, storage, retention, exports, and deletion against durable systems of record.",
    requiredAssertions: ["audit-lineage-reconciled", "provenance-retention-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.6.9",
    key: "INDEPENDENT_AUTONOMY_REVIEW",
    label: "Independent Governed Autonomy Review",
    schemaVersion: "enterprise.governed-autonomy-independent-review.v1",
    sourceSignalId: "independent-autonomy-review",
    sourceContracts: ["ordered v2.6.0-v2.6.8 evidence", "independent model, security, and operations review", "immutable review archive"],
    externalBlocker: "A distinct assurance authority must review and retain the complete governed-autonomy package outside the Studio.",
    requiredAssertions: ["governed-autonomy-reviewed", "independent-review-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

export function buildGovernedAutonomyReadinessState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: GovernedAutonomySourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: GOVERNED_AUTONOMY_READINESS_DEFINITIONS,
    ...input,
  });
}

export function readGovernedAutonomyReadinessTrain() {
  const lifecycle = readDeploymentLifecycleAssuranceTrain();
  const anchor = lifecycle.versions.find((version) => version.version === "v2.5.4");
  const artifacts = GOVERNED_AUTONOMY_READINESS_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_GOVERNED_AUTONOMY_${definition.key}`),
  );
  return {
    ok: true as const,
    schemaVersion: GOVERNED_AUTONOMY_READINESS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildGovernedAutonomyReadinessState({
      anchor: {
        version: "v2.5.4",
        evidenceStatus: anchor?.evidenceStatus || "missing",
        digest: anchor?.digest || null,
        recordId: anchor?.recordId || null,
        issuerOrganizationId: anchor?.issuerOrganizationId || null,
      },
      artifacts,
      sourceSignals: readGovernedAutonomySourceSignals(),
      now: Date.now(),
    }),
    configuredVersions: GOVERNED_AUTONOMY_READINESS_DEFINITIONS.filter(
      (_, index) => artifacts[index]?.present,
    ).map((definition) => definition.version),
  };
}
