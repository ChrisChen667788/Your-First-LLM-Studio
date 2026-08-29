import { createHash } from "node:crypto";

import { readAssuranceClosureTrain } from "@/features/experiments/assurance-closure-train";
import {
  buildExternalAssuranceChainState,
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
  type ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import {
  readOperationalSourceSignals,
  type OperationalSourceSignalId,
  type OperationalSourceSignalSnapshot,
} from "@/features/experiments/operational-source-signals";

export const AI_OPERATIONS_INTELLIGENCE_SCHEMA_VERSION =
  "experiments.ai-operations-intelligence.v1" as const;

export type AiOperationsDefinition = ExternalAssuranceDefinition & {
  sourceSignalId: OperationalSourceSignalId;
};

export const AI_OPERATIONS_INTELLIGENCE_DEFINITIONS: AiOperationsDefinition[] = [
  {
    version: "v2.4.0",
    key: "RUNTIME_FLEET",
    label: "Runtime Fleet Intelligence",
    schemaVersion: "enterprise.ai-operations-runtime-fleet.v1",
    sourceSignalId: "runtime-fleet",
    sourceContracts: ["backend-neutral runtime inventory", "load, unload, health, stream, and tool conformance", "hardware and endpoint projection without mutation"],
    externalBlocker: "The production runtime authority must reconcile deployed nodes, versions, capacity, and health from its managed inventory.",
    requiredAssertions: ["runtime-inventory-reconciled", "runtime-conformance-observed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.1",
    key: "PROVIDER_RELIABILITY",
    label: "Provider Reliability Baseline",
    schemaVersion: "enterprise.ai-operations-provider-reliability.v1",
    sourceSignalId: "provider-reliability",
    sourceContracts: ["provider health and release-probe read model", "auth, rate-limit, timeout, and network failure taxonomy", "fallback policy evidence"],
    externalBlocker: "The managed gateway and provider owners must attest production traffic, failures, fallbacks, and billing identity for the observation window.",
    requiredAssertions: ["provider-traffic-observed", "fallback-path-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.2",
    key: "WORKLOAD_SLO",
    label: "Workload SLO and Tail Latency",
    schemaVersion: "enterprise.ai-operations-workload-slo.v1",
    sourceSignalId: "workload-slo",
    sourceContracts: ["request and trace observation contract", "error-budget and tail-latency projection", "stale-signal-safe health classification"],
    externalBlocker: "Managed telemetry and service owners must supply representative production latency, availability, and error-budget evidence.",
    requiredAssertions: ["workload-slo-measured", "tail-latency-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.3",
    key: "TOKEN_COST",
    label: "Token and Cost Reconciliation",
    schemaVersion: "enterprise.ai-operations-token-cost.v1",
    sourceSignalId: "token-cost",
    sourceContracts: ["provider token and cost accounting", "durable usage outbox projection", "idempotent billing reconciliation boundary"],
    externalBlocker: "The billing authority must reconcile gateway usage, provider invoices, credits, and customer exports from durable systems of record.",
    requiredAssertions: ["token-ledger-reconciled", "billing-export-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.4",
    key: "BENCHMARK_DRIFT",
    label: "Benchmark Quality Drift",
    schemaVersion: "enterprise.ai-operations-benchmark-drift.v1",
    sourceSignalId: "benchmark-drift",
    sourceContracts: ["qualified official dataset revision", "deterministic evaluator and immutable snapshot", "baseline and candidate drift evidence"],
    externalBlocker: "Independent quality owners must approve representative deployed-model drift thresholds, blind sets, and remediation decisions.",
    requiredAssertions: ["benchmark-revision-pinned", "quality-drift-reviewed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.5",
    key: "RETRIEVAL_DRIFT",
    label: "Retrieval and Citation Drift",
    schemaVersion: "enterprise.ai-operations-retrieval-drift.v1",
    sourceSignalId: "retrieval-drift",
    sourceContracts: ["query replay and corpus revision lineage", "citation diagnostics and deletion checks", "workspace and subject ACL rehearsal"],
    externalBlocker: "The managed knowledge platform must prove corpus propagation, citation quality, access filtering, and deletion SLOs on real identities and documents.",
    requiredAssertions: ["retrieval-drift-measured", "citation-acl-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.6",
    key: "AGENT_ACTION_SAFETY",
    label: "Agent Action Safety",
    schemaVersion: "enterprise.ai-operations-agent-action-safety.v1",
    sourceSignalId: "agent-action-safety",
    sourceContracts: ["protected-tool interrupt and resume evidence", "duplicate side-effect detection", "side-effect-free replay and state diff"],
    externalBlocker: "Independent security and operations owners must review real protected actions, approval usability, reconnect behavior, and side-effect reconciliation.",
    requiredAssertions: ["protected-actions-rehearsed", "duplicate-side-effects-zero"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.7",
    key: "WORKFLOW_RECOVERY",
    label: "Workflow Recovery Reliability",
    schemaVersion: "enterprise.ai-operations-workflow-recovery.v1",
    sourceSignalId: "workflow-recovery",
    sourceContracts: ["typed executor and breakpoint contracts", "lease, replay, and recovery evidence", "protected side-effect boundary"],
    externalBlocker: "Distributed worker owners must attest production leases, retries, failover, breakpoint recovery, and exactly-once side-effect handling.",
    requiredAssertions: ["workflow-recovery-rehearsed", "worker-failover-reviewed"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.8",
    key: "FINETUNE_ROI",
    label: "Fine-tune Quality and Adapter ROI",
    schemaVersion: "enterprise.ai-operations-finetune-roi.v1",
    sourceSignalId: "finetune-roi",
    sourceContracts: ["paired baseline and adapter quality", "best-checkpoint package and read-back", "cost, quality, and rollback decision evidence"],
    externalBlocker: "Model owners must approve representative blind evaluation, independent worker replay, total training cost, and deployment ROI.",
    requiredAssertions: ["adapter-quality-measured", "adapter-roi-reviewed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.4.9",
    key: "INDEPENDENT_AI_OPS_REVIEW",
    label: "Independent AI Operations Review",
    schemaVersion: "enterprise.ai-operations-independent-review.v1",
    sourceSignalId: "independent-ops-review",
    sourceContracts: ["ordered v2.4.0-v2.4.8 evidence review", "distinct AI operations reviewer", "terminal no-transition projection"],
    externalBlocker: "A distinct external AI operations authority must review and sign the complete ordered operational chain.",
    requiredAssertions: ["ai-operations-chain-reviewed", "reviewer-independent"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

function projectionDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildAiOperationsIntelligenceState(input: {
  anchor: Parameters<typeof buildExternalAssuranceChainState>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: OperationalSourceSignalSnapshot;
  now: number;
}) {
  const assurance = buildExternalAssuranceChainState({
    definitions: AI_OPERATIONS_INTELLIGENCE_DEFINITIONS,
    anchor: input.anchor,
    artifacts: input.artifacts,
    now: input.now,
  });
  const signals = new Map(input.sourceSignals.signals.map((entry) => [entry.id, entry]));
  const versions = assurance.versions.map((version, index) => ({
    ...version,
    sourceSignal: signals.get(
      AI_OPERATIONS_INTELLIGENCE_DEFINITIONS[index]!.sourceSignalId,
    ) || null,
  }));
  const selectedSignals = versions.flatMap((version) =>
    version.sourceSignal ? [version.sourceSignal] : [],
  );
  const sourceOwnedSignals = selectedSignals.filter(
    (entry) => entry.status !== "external-only",
  );
  const sourceSummary = {
    totalSignals: selectedSignals.length,
    sourceOwnedSignals: sourceOwnedSignals.length,
    passingSignals: selectedSignals.filter((entry) => entry.status === "pass").length,
    attentionSignals: selectedSignals.filter((entry) => entry.status === "attention").length,
    unavailableSignals: selectedSignals.filter((entry) => entry.status === "unavailable").length,
    externalOnlySignals: selectedSignals.filter((entry) => entry.status === "external-only").length,
  };
  const withoutDigest = {
    ...assurance,
    versions,
    localStatus: sourceOwnedSignals.every((entry) => entry.status === "pass")
      ? ("pass" as const)
      : ("attention" as const),
    sourceSummary,
    sourceSignalDigest: projectionDigest(selectedSignals),
    assuranceStateDigest: assurance.stateDigest,
  };
  return { ...withoutDigest, projectionDigest: projectionDigest(withoutDigest) };
}

export function readAiOperationsIntelligenceTrain() {
  const closure = readAssuranceClosureTrain();
  const anchorVersion = closure.versions.find((version) => version.version === "v2.3.4");
  const artifacts = AI_OPERATIONS_INTELLIGENCE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_AI_OPERATIONS_${definition.key}`),
  );
  return {
    ok: true as const,
    schemaVersion: AI_OPERATIONS_INTELLIGENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildAiOperationsIntelligenceState({
      anchor: {
        version: "v2.3.4",
        evidenceStatus: anchorVersion?.evidenceStatus || "missing",
        digest: anchorVersion?.digest || null,
        recordId: anchorVersion?.recordId || null,
        issuerOrganizationId: anchorVersion?.issuerOrganizationId || null,
      },
      artifacts,
      sourceSignals: readOperationalSourceSignals(),
      now: Date.now(),
    }),
    configuredVersions: AI_OPERATIONS_INTELLIGENCE_DEFINITIONS.filter(
      (_, index) => artifacts[index]?.present,
    ).map((definition) => definition.version),
  };
}
