import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import { readOpenEcosystemInteroperabilityTrain } from "@/features/experiments/open-ecosystem-interoperability-train";
import {
  readOperationalSustainabilitySourceSignals,
  type OperationalSustainabilitySourceSignalId,
  type OperationalSustainabilitySourceSignalSnapshot,
} from "@/features/experiments/operational-sustainability-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const OPERATIONAL_REMEDIATION_EFFICIENCY_SCHEMA_VERSION =
  "experiments.operational-remediation-efficiency.v1" as const;

export const OPERATIONAL_REMEDIATION_EFFICIENCY_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<OperationalSustainabilitySourceSignalId>
> = [
  {
    version: "v2.8.0", key: "PROVIDER_TRAFFIC_RECONCILIATION", label: "Provider Traffic and Fallback Reconciliation", schemaVersion: "enterprise.operational-remediation-provider-traffic.v1", sourceSignalId: "provider-traffic-reconciliation",
    sourceContracts: ["observed provider traffic and request outcomes", "release probes, retry, fallback, quota, and cost", "pinned snapshot integrity and retention"],
    externalBlocker: "Gateway, provider, and billing owners must reconcile deployed traffic, fallback outcomes, quotas, and invoice identity.", requiredAssertions: ["provider-traffic-reconciled", "fallback-cost-reviewed"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.1", key: "RETRIEVAL_FRESHNESS_REMEDIATION", label: "Retrieval Freshness and ACL Remediation", schemaVersion: "enterprise.operational-remediation-retrieval.v1", sourceSignalId: "retrieval-freshness-remediation",
    sourceContracts: ["corpus revision and replay freshness", "citation, deletion, and reranker diagnostics", "workspace and subject ACL denials"],
    externalBlocker: "Knowledge, identity, and database owners must repeat freshness, deletion, citation, and leakage probes on managed corpora.", requiredAssertions: ["retrieval-freshness-observed", "retrieval-acl-remediated"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.2", key: "MODEL_SUPPLY_CHAIN_RECONCILIATION", label: "Model Supply-chain Reconciliation", schemaVersion: "enterprise.operational-remediation-model-supply-chain.v1", sourceSignalId: "model-supply-chain-reconciliation",
    sourceContracts: ["authenticated immutable Hub revision", "multi-file destination checksums", "migration, compatibility, removal, activation, and rollback"],
    externalBlocker: "Hub, storage, runtime, license, and security owners must reconcile representative model bytes across managed systems.", requiredAssertions: ["model-source-reconciled", "model-bytes-readback-verified"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.3", key: "WORKSPACE_AUDIT_COMPLETENESS", label: "Workspace Audit Completeness", schemaVersion: "enterprise.operational-remediation-workspace-audit.v1", sourceSignalId: "workspace-audit-completeness",
    sourceContracts: ["database-enforced workspace ACL", "request and action provenance digests", "audit event coverage without raw identity leakage"],
    externalBlocker: "Organization identity, database, audit, and privacy owners must reconcile real multi-user actions against durable systems of record.", requiredAssertions: ["workspace-audit-complete", "privacy-boundary-reviewed"], minObservationWindowHours: 168, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.4", key: "RUNTIME_RECOVERY_EFFICIENCY", label: "Runtime Recovery and Capacity Efficiency", schemaVersion: "enterprise.operational-remediation-runtime-efficiency.v1", sourceSignalId: "runtime-recovery-efficiency",
    sourceContracts: ["comparable latency, throughput, memory, queue, and token receipts", "cancel, resume, restart, load, unload, and benchmark checkpoints", "safe-boundary restart and recovery"],
    externalBlocker: "Independent runtime operators must repeat capacity, energy, restart, and recovery workloads on representative hardware.", requiredAssertions: ["runtime-capacity-compared", "runtime-recovery-rehearsed"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.5", key: "AGENT_SESSION_RECOVERY", label: "Agent Action and Session Recovery", schemaVersion: "enterprise.operational-remediation-agent-session.v1", sourceSignalId: "agent-session-recovery",
    sourceContracts: ["protected-action interruption and approval", "idempotent resume and replay", "duplicate side-effect detection and state diff"],
    externalBlocker: "Operators must exercise real multi-client reconnect, approval, denial, replay, and protected tool effects.", requiredAssertions: ["agent-session-recovered", "agent-duplicate-effects-zero"], minObservationWindowHours: 168, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.6", key: "WORKFLOW_QUEUE_FAILOVER", label: "Workflow Queue and Failover Efficiency", schemaVersion: "enterprise.operational-remediation-workflow-queue.v1", sourceSignalId: "workflow-queue-failover",
    sourceContracts: ["durable worker receipts and queue outcomes", "lease heartbeat, fencing, and release", "process-isolated failover and stale-worker rejection"],
    externalBlocker: "Independent worker hosts must repeat queue, partition, lease, fencing, and protected-side-effect failover workloads.", requiredAssertions: ["workflow-queue-drained", "workflow-failover-rehearsed"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.7", key: "BENCHMARK_COST_QUALITY", label: "Benchmark Cost-quality Decision Gate", schemaVersion: "enterprise.operational-remediation-benchmark-decision.v1", sourceSignalId: "benchmark-cost-quality",
    sourceContracts: ["complete qualified baseline and candidate", "confidence, non-inferiority, latency, token, and error taxonomy", "immutable decision digest and review queue"],
    externalBlocker: "Independent quality owners must approve representative blind sets, latency/cost budgets, evaluator versions, and promotion thresholds.", requiredAssertions: ["benchmark-cost-quality-compared", "benchmark-decision-reviewed"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.8", key: "FINETUNE_COST_QUALITY_EXPORT", label: "Fine-tune Cost-quality and Export Gate", schemaVersion: "enterprise.operational-remediation-finetune-export.v1", sourceSignalId: "finetune-cost-quality-export",
    sourceContracts: ["paired baseline and adapter quality", "best checkpoint and exact package byte binding", "install read-back, rollback, cost, and ROI"],
    externalBlocker: "Model owners must repeat the representative adapter workload and verify remote registry publication, read-back, rollback, and total cost.", requiredAssertions: ["finetune-quality-cost-reviewed", "adapter-package-readback-verified"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v2.8.9", key: "INDEPENDENT_REMEDIATION_REVIEW", label: "Independent Operational Remediation Review", schemaVersion: "enterprise.operational-remediation-independent-review.v1", sourceSignalId: "independent-remediation-review",
    sourceContracts: ["ordered v2.8.0-v2.8.8 remediation evidence", "distinct operations, quality, security, and privacy reviewers", "immutable terminal review archive"],
    externalBlocker: "A distinct assurance authority must review and retain the complete operational remediation package outside the Studio.", requiredAssertions: ["operational-remediation-reviewed", "independent-remediation-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true, finalReview: true,
  },
];

export function buildOperationalRemediationEfficiencyState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: OperationalSustainabilitySourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: OPERATIONAL_REMEDIATION_EFFICIENCY_DEFINITIONS,
    ...input,
  });
}

export function readOperationalRemediationEfficiencyTrain() {
  const interoperability = readOpenEcosystemInteroperabilityTrain();
  const anchor = interoperability.versions.find((version) => version.version === "v2.7.4");
  const artifacts = OPERATIONAL_REMEDIATION_EFFICIENCY_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_OPERATIONAL_REMEDIATION_${definition.key}`),
  );
  return {
    ok: true as const,
    schemaVersion: OPERATIONAL_REMEDIATION_EFFICIENCY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildOperationalRemediationEfficiencyState({
      anchor: { version: "v2.7.4", evidenceStatus: anchor?.evidenceStatus || "missing", digest: anchor?.digest || null, recordId: anchor?.recordId || null, issuerOrganizationId: anchor?.issuerOrganizationId || null },
      artifacts,
      sourceSignals: readOperationalSustainabilitySourceSignals(),
      now: Date.now(),
    }),
    configuredVersions: OPERATIONAL_REMEDIATION_EFFICIENCY_DEFINITIONS.filter((_, index) => artifacts[index]?.present).map((definition) => definition.version),
  };
}
