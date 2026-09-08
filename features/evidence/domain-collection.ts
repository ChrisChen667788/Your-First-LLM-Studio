import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import { EvidenceCollectionPolicyError } from "@/features/evidence/collection-policy";
import {
  OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION,
  operationalEvidenceDigest,
  type OperationalEvidenceReceipt,
} from "@/features/evidence/operational-receipts";
import { readEvidenceOperationSpecs } from "@/features/experiments/evidence-operations-train";

export type DomainCollectionObservation = {
  schemaVersion: string;
  sourceKind: "live" | "derived" | "reference";
  sourceStatus: "pass" | "hold";
  localStatus: "pass" | "hold";
  environment?: "local" | "managed" | "independent";
  observedAt: string;
  evidenceDigest: string;
  metrics: Record<string, number>;
  summary: string;
  blockers: string[];
  artifact: Record<string, unknown>;
};

export type DomainCollectionResult = {
  artifact: Record<string, unknown>;
  artifactDigest: string;
  receipt: OperationalEvidenceReceipt;
};

function isDigest(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}

function assertEligibleObservation(
  job: EvidenceCollectionJob,
  observation: DomainCollectionObservation,
) {
  const spec = readEvidenceOperationSpecs().find(
    (entry) => entry.version === job.sourceMilestone,
  );
  if (!spec) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      400,
      `No evidence-operation contract exists for ${job.sourceMilestone}.`,
    );
  }
  const missingMetrics = spec.requiredMetrics.filter(
    (metric) => !Object.hasOwn(observation.metrics, metric),
  );
  const metricValuesValid = Object.values(observation.metrics).every(
    (value) => Number.isFinite(value) && value >= 0,
  );
  const now = Date.now();
  const observedAt = Date.parse(observation.observedAt);
  const observationFresh =
    Number.isFinite(observedAt) &&
    observedAt <= now + 5 * 60 * 1000 &&
    now - observedAt <= 7 * 24 * 60 * 60 * 1000;
  const blockers = [
    ...(observation.sourceKind === "live"
      ? []
      : [
          "A live workload observation is required; reference, fixture, and derived read models cannot become an operational receipt.",
        ]),
    ...(observation.sourceStatus === "pass" ? [] : ["The feature source observation is not passing."]),
    ...(observation.localStatus === "pass" ? [] : ["The feature local observation is not passing."]),
    ...(Number.isFinite(observedAt) ? [] : ["The observation timestamp is invalid."]),
    ...(observationFresh ? [] : ["The live observation is stale or too far in the future."]),
    ...(isDigest(observation.evidenceDigest) ? [] : ["The observation evidence digest is invalid."]),
    ...(missingMetrics.length
      ? [`Missing required metrics: ${missingMetrics.join(", ")}.`]
      : []),
    ...(metricValuesValid ? [] : ["Observation metrics must be finite non-negative numbers."]),
    ...observation.blockers,
  ];
  if (blockers.length) {
    throw new EvidenceCollectionPolicyError(
      "invalid-input",
      409,
      `${job.planVersion} collection is not eligible: ${blockers.join(" ")}`,
    );
  }
  return spec;
}

export function collectDomainEvidenceFromObservation(
  job: EvidenceCollectionJob,
  observation: DomainCollectionObservation,
): DomainCollectionResult {
  const spec = assertEligibleObservation(job, observation);
  const startedAt = new Date().toISOString();
  const completedAt = new Date().toISOString();
  const artifact = {
    schemaVersion: "evidence.domain-collection-artifact.v1",
    planVersion: job.planVersion,
    sourceMilestone: job.sourceMilestone,
    jobId: job.id,
    attempt: job.attempt,
    subjectId: job.subjectId,
    observation: {
      schemaVersion: observation.schemaVersion,
      sourceKind: observation.sourceKind,
      environment: observation.environment || "local",
      observedAt: observation.observedAt,
      evidenceDigest: observation.evidenceDigest,
      summary: observation.summary,
      metrics: observation.metrics,
    },
    featureArtifact: observation.artifact,
    collectedAt: completedAt,
  };
  const artifactDigest = operationalEvidenceDigest(artifact);
  return {
    artifact,
    artifactDigest,
    receipt: {
      schemaVersion: OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION,
      milestone: spec.version,
      subjectId: job.subjectId,
      environment: observation.environment || "local",
      workloadDigest: operationalEvidenceDigest({
        planVersion: job.planVersion,
        sourceMilestone: job.sourceMilestone,
        subjectId: job.subjectId,
        observationDigest: observation.evidenceDigest,
      }),
      artifactDigests: [artifactDigest],
      startedAt,
      completedAt,
      outcome: "pass",
      metrics: observation.metrics,
      operator: {
        organizationId: job.organizationId,
        operatorId: job.operatorId,
      },
    },
  };
}
