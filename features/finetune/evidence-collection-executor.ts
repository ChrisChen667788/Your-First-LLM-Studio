import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import {
  collectDomainEvidenceFromObservation,
  type DomainCollectionObservation,
} from "@/features/evidence/domain-collection";
import { readFineTuneBackendFederation } from "@/features/finetune/backend-federation";

export function readFineTuneCollectionObservation(): DomainCollectionObservation {
  const evidence = readFineTuneBackendFederation();
  return {
    schemaVersion: evidence.schemaVersion,
    sourceKind: "derived",
    sourceStatus: evidence.sourceStatus,
    localStatus: evidence.localStatus,
    observedAt: evidence.generatedAt,
    evidenceDigest: evidence.federationDigest,
    metrics: {
      workers: evidence.backends.length,
      completedRuns: 0,
      artifactChecksums: 0,
    },
    summary: "Federated backend capability negotiation is available without a comparable non-MLX worker run.",
    blockers: ["A real non-MLX worker dispatch with checkpoint, report, export, and checksum observations is required."],
    artifact: { backends: evidence.backends, policy: evidence.policy },
  };
}

export function collectFineTuneEvidence(
  job: EvidenceCollectionJob,
  readObservation: () => DomainCollectionObservation = readFineTuneCollectionObservation,
) {
  return collectDomainEvidenceFromObservation(job, readObservation());
}
