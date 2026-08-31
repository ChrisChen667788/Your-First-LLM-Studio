import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import {
  readRemediationExecutionSourceSignals,
  type RemediationExecutionSourceSignalId,
  type RemediationExecutionSourceSignalSnapshot,
} from "@/features/experiments/remediation-execution-source-signals";
import { readServiceReadinessTrain } from "@/features/experiments/service-readiness-train";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const REMEDIATION_EXECUTION_TRAIN_SCHEMA_VERSION =
  "experiments.remediation-execution-train.v1" as const;

export const REMEDIATION_EXECUTION_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<RemediationExecutionSourceSignalId>
> = [
  {
    version: "v3.2.0",
    key: "PROVIDER_REMEDIATION_EXECUTION",
    label: "Provider Remediation Execution",
    schemaVersion: "enterprise.remediation-execution-provider.v1",
    sourceSignalId: "provider-remediation-execution",
    sourceContracts: ["idempotent release probe plan", "provider, quota, cost, and fallback reconciliation", "rollback-bound traffic receipt"],
    externalBlocker: "Provider, gateway, and billing operators must execute representative traffic with authorized credentials.",
    requiredAssertions: ["provider-remediation-executed", "provider-rollback-reconciled"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.1",
    key: "RETRIEVAL_REMEDIATION_EXECUTION",
    label: "Retrieval Remediation Execution",
    schemaVersion: "enterprise.remediation-execution-retrieval.v1",
    sourceSignalId: "retrieval-remediation-execution",
    sourceContracts: ["managed dependency rehearsal", "frozen freshness, deletion, citation, and ACL probes", "corpus and index rollback"],
    externalBlocker: "Knowledge, identity, and database operators must run the managed corpus workload.",
    requiredAssertions: ["retrieval-remediation-executed", "retrieval-rollback-reconciled"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.2",
    key: "MODEL_SUPPLY_CHAIN_REMEDIATION_EXECUTION",
    label: "Model Supply-chain Remediation Execution",
    schemaVersion: "enterprise.remediation-execution-model-supply-chain.v1",
    sourceSignalId: "model-supply-chain-remediation-execution",
    sourceContracts: ["authenticated immutable Hub transfer", "destination checksum read-back", "activation rollback receipt"],
    externalBlocker: "Hub, storage, runtime, license, and security operators must perform an authenticated immutable transfer.",
    requiredAssertions: ["model-transfer-executed", "model-activation-rollback-reconciled"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.3",
    key: "WORKSPACE_AUDIT_REMEDIATION_EXECUTION",
    label: "Workspace Audit Remediation Execution",
    schemaVersion: "enterprise.remediation-execution-workspace-audit.v1",
    sourceSignalId: "workspace-audit-remediation-execution",
    sourceContracts: ["trusted operator identity", "signed action provenance", "database audit and compensation reconciliation"],
    externalBlocker: "Identity, database, audit, and privacy operators must execute real multi-user actions.",
    requiredAssertions: ["workspace-action-executed", "workspace-compensation-reconciled"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.4",
    key: "RUNTIME_CAPACITY_REMEDIATION_EXECUTION",
    label: "Runtime Capacity Remediation Execution",
    schemaVersion: "enterprise.remediation-execution-runtime-capacity.v1",
    sourceSignalId: "runtime-capacity-remediation-execution",
    sourceContracts: ["same-profile comparable receipts", "six-operation recovery rehearsal", "last-known-good activation rollback"],
    externalBlocker: "Independent runtime operators must repeat the workload on representative hardware and models.",
    requiredAssertions: ["runtime-recovery-executed", "runtime-rollback-reconciled"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.5",
    key: "BENCHMARK_CANDIDATE_REMEDIATION_EXECUTION",
    label: "Benchmark Candidate Remediation Execution",
    schemaVersion: "enterprise.remediation-execution-benchmark-candidate.v1",
    sourceSignalId: "benchmark-candidate-remediation-execution",
    sourceContracts: ["distinct complete candidate", "paired confidence and non-inferiority decision", "baseline-preserving rollback"],
    externalBlocker: "Independent quality operators must approve blind sets, evaluator identity, cost budgets, and thresholds.",
    requiredAssertions: ["benchmark-candidate-executed", "benchmark-decision-reconciled"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.6",
    key: "TELEMETRY_EXPORT_REMEDIATION_EXECUTION",
    label: "Telemetry Export Remediation Execution",
    schemaVersion: "enterprise.remediation-execution-telemetry-export.v1",
    sourceSignalId: "telemetry-export-remediation-execution",
    sourceContracts: ["real OTLP or Langfuse trace", "usage and cost reconciliation", "secret-safe exporter rollback"],
    externalBlocker: "Observability, infrastructure, and finance operators must validate deployed exporter traces and retention.",
    requiredAssertions: ["telemetry-export-executed", "telemetry-rollback-reconciled"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.7",
    key: "EXECUTION_LEASE_AND_FENCING",
    label: "Execution Lease and Fencing",
    schemaVersion: "enterprise.remediation-execution-lease-fencing.v1",
    sourceSignalId: "execution-lease-and-fencing",
    sourceContracts: ["deterministic idempotency keys", "bounded execution leases", "stale-writer fencing and dependency order"],
    externalBlocker: "Production operators must verify the lease store and stale-writer rejection under failover.",
    requiredAssertions: ["execution-lease-verified", "stale-writer-rejected"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.8",
    key: "ROLLBACK_EVIDENCE_PACKAGE",
    label: "Rollback Evidence Package",
    schemaVersion: "enterprise.remediation-execution-rollback-package.v1",
    sourceSignalId: "rollback-evidence-package",
    sourceContracts: ["rollback instruction per owner action", "upstream evidence fingerprints", "deterministic queue and package digests"],
    externalBlocker: "A separately operated archive must verify rollback package bytes and destination retention.",
    requiredAssertions: ["rollback-package-readback", "rollback-package-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v3.2.9",
    key: "INDEPENDENT_EXECUTION_ACCEPTANCE",
    label: "Independent Execution Acceptance",
    schemaVersion: "enterprise.remediation-execution-independent-acceptance.v1",
    sourceSignalId: "independent-execution-acceptance",
    sourceContracts: ["ordered v3.2.0-v3.2.8 package", "distinct operations and quality review", "immutable terminal receipt"],
    externalBlocker: "A distinct assurance authority must accept and retain the execution package outside the Studio.",
    requiredAssertions: ["remediation-execution-accepted", "remediation-execution-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

export function buildRemediationExecutionTrainState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: RemediationExecutionSourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: REMEDIATION_EXECUTION_DEFINITIONS,
    ...input,
  });
}

export function readRemediationExecutionTrain() {
  const predecessor = readServiceReadinessTrain();
  const anchor = predecessor.versions.find((version) => version.version === "v3.1.4");
  const artifacts = REMEDIATION_EXECUTION_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_REMEDIATION_EXECUTION_${definition.key}`),
  );
  const sourceSignals = readRemediationExecutionSourceSignals();
  return {
    ok: true as const,
    schemaVersion: REMEDIATION_EXECUTION_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildRemediationExecutionTrainState({
      anchor: {
        version: "v3.1.4",
        evidenceStatus: anchor?.evidenceStatus || "missing",
        digest: anchor?.digest || null,
        recordId: anchor?.recordId || null,
        issuerOrganizationId: anchor?.issuerOrganizationId || null,
      },
      artifacts,
      sourceSignals,
      now: Date.now(),
    }),
    remediationControlPlane: sourceSignals.remediationControlPlane,
    remediationExecutionPlan: sourceSignals.remediationExecutionPlan,
    configuredVersions: REMEDIATION_EXECUTION_DEFINITIONS.filter((_, index) => artifacts[index]?.present).map((definition) => definition.version),
  };
}
