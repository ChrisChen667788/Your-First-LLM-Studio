import { createHash } from "node:crypto";

import { readAiOperationsIntelligenceTrain } from "@/features/experiments/ai-operations-intelligence-train";
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

export const DEPLOYMENT_LIFECYCLE_ASSURANCE_SCHEMA_VERSION =
  "experiments.deployment-lifecycle-assurance.v1" as const;

export type DeploymentLifecycleDefinition = ExternalAssuranceDefinition & {
  sourceSignalId: OperationalSourceSignalId;
};

export const DEPLOYMENT_LIFECYCLE_ASSURANCE_DEFINITIONS: DeploymentLifecycleDefinition[] = [
  {
    version: "v2.5.0",
    key: "PORTABLE_DEPLOYMENT",
    label: "Portable Deployment Manifest",
    schemaVersion: "enterprise.deployment-lifecycle-portability.v1",
    sourceSignalId: "deployment-portability",
    sourceContracts: ["runtime and artifact inventory manifest", "environment-independent configuration projection", "destination import and read-back boundary"],
    externalBlocker: "An independent destination operator must import, start, verify, and read back the declared deployment without repository-owned credentials.",
    requiredAssertions: ["deployment-manifest-imported", "destination-readback-verified"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.5.1",
    key: "DATA_SOVEREIGNTY",
    label: "Data Residency and Sovereignty",
    schemaVersion: "enterprise.deployment-lifecycle-data-sovereignty.v1",
    sourceSignalId: "data-sovereignty",
    sourceContracts: ["workspace-scoped data inventory", "storage, embedding, reranker, trace, and backup residency map", "deletion and export evidence boundary"],
    externalBlocker: "Data owners and hosting authorities must attest real storage, processing, backup, telemetry, export, and deletion locations for each jurisdiction.",
    requiredAssertions: ["data-residency-reconciled", "sovereignty-controls-reviewed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.5.2",
    key: "CUSTOMER_KEYS",
    label: "Customer-controlled Keys and Secrets",
    schemaVersion: "enterprise.deployment-lifecycle-customer-keys.v1",
    sourceSignalId: "customer-keys",
    sourceContracts: ["secret-free portable manifest", "signer identity and receipt verification", "customer key rotation and revocation boundary"],
    externalBlocker: "The customer KMS or HSM authority must prove workload identity, key ownership, rotation, revocation, audit retention, and recovery.",
    requiredAssertions: ["customer-key-ownership-verified", "key-rotation-rehearsed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.5.3",
    key: "CONTINUITY_EXIT",
    label: "Service Continuity and Exit Rehearsal",
    schemaVersion: "enterprise.deployment-lifecycle-continuity-exit.v1",
    sourceSignalId: "continuity-exit",
    sourceContracts: ["fenced primary and standby promotion evidence", "measured RPO and RTO", "customer data, model, adapter, workflow, and audit export plan"],
    externalBlocker: "Independent operators must execute a clean-environment continuity and customer-exit rehearsal against real managed storage and traffic ingress.",
    requiredAssertions: ["continuity-rehearsal-passed", "customer-exit-verified"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.5.4",
    key: "INDEPENDENT_LIFECYCLE_REVIEW",
    label: "Independent Deployment Lifecycle Closure",
    schemaVersion: "enterprise.deployment-lifecycle-independent-closure.v1",
    sourceSignalId: "independent-lifecycle-review",
    sourceContracts: ["ordered v2.5.0-v2.5.3 lifecycle review", "independent customer and operator sign-off", "immutable terminal archive"],
    externalBlocker: "A distinct customer, operator, and assurance authority must sign and retain the complete lifecycle package outside the Studio.",
    requiredAssertions: ["deployment-lifecycle-reviewed", "immutable-closure-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

function projectionDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildDeploymentLifecycleAssuranceState(input: {
  anchor: Parameters<typeof buildExternalAssuranceChainState>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: OperationalSourceSignalSnapshot;
  now: number;
}) {
  const assurance = buildExternalAssuranceChainState({
    definitions: DEPLOYMENT_LIFECYCLE_ASSURANCE_DEFINITIONS,
    anchor: input.anchor,
    artifacts: input.artifacts,
    now: input.now,
  });
  const signals = new Map(input.sourceSignals.signals.map((entry) => [entry.id, entry]));
  const versions = assurance.versions.map((version, index) => ({
    ...version,
    sourceSignal: signals.get(
      DEPLOYMENT_LIFECYCLE_ASSURANCE_DEFINITIONS[index]!.sourceSignalId,
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

export function readDeploymentLifecycleAssuranceTrain() {
  const aiOperations = readAiOperationsIntelligenceTrain();
  const anchorVersion = aiOperations.versions.find(
    (version) => version.version === "v2.4.9",
  );
  const artifacts = DEPLOYMENT_LIFECYCLE_ASSURANCE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_DEPLOYMENT_LIFECYCLE_${definition.key}`),
  );
  return {
    ok: true as const,
    schemaVersion: DEPLOYMENT_LIFECYCLE_ASSURANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildDeploymentLifecycleAssuranceState({
      anchor: {
        version: "v2.4.9",
        evidenceStatus: anchorVersion?.evidenceStatus || "missing",
        digest: anchorVersion?.digest || null,
        recordId: anchorVersion?.recordId || null,
        issuerOrganizationId: anchorVersion?.issuerOrganizationId || null,
      },
      artifacts,
      sourceSignals: readOperationalSourceSignals(),
      now: Date.now(),
    }),
    configuredVersions: DEPLOYMENT_LIFECYCLE_ASSURANCE_DEFINITIONS.filter(
      (_, index) => artifacts[index]?.present,
    ).map((definition) => definition.version),
  };
}
