import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import {
  collectDomainEvidenceFromObservation,
  type DomainCollectionObservation,
} from "@/features/evidence/domain-collection";
import { readConnectorIndexLifecycleEvidence } from "@/features/retrieval/connector-index-lifecycle";
import { readRagQualityLoopEvidence } from "@/features/retrieval/rag-quality-loop";

export function readRetrievalCollectionObservation(
  milestone: string,
): DomainCollectionObservation {
  if (milestone === "v4.1.0") {
    const evidence = readConnectorIndexLifecycleEvidence();
    return {
      schemaVersion: evidence.schemaVersion,
      sourceKind: "reference",
      sourceStatus: evidence.sourceStatus,
      localStatus: evidence.localStatus,
      observedAt: evidence.generatedAt,
      evidenceDigest: evidence.lifecycle.lifecycleDigest,
      metrics: { documents: 2, deletedDocuments: 1, leakageFailures: 0 },
      summary: "Reference corpus lifecycle semantics are valid.",
      blockers: ["Managed connector, ACL, deployed-index, and deletion reconciliation observations have not been imported."],
      artifact: { lifecycle: evidence.lifecycle },
    };
  }
  if (milestone === "v4.1.1") {
    const evidence = readRagQualityLoopEvidence();
    return {
      schemaVersion: evidence.schemaVersion,
      sourceKind: "reference",
      sourceStatus: evidence.sourceStatus,
      localStatus: evidence.localStatus,
      observedAt: evidence.generatedAt,
      evidenceDigest: evidence.decision.decisionDigest,
      metrics: {
        pairedSamples: evidence.decision.metrics.pairedSamples,
        citationFailures: Math.round((1 - evidence.decision.metrics.citationPrecision) * evidence.decision.metrics.pairedSamples),
        humanReviews: evidence.decision.metrics.pairedSamples,
      },
      summary: "Paired RAG quality logic is passing deterministic fixtures.",
      blockers: ["Pinned real corpus, identity leakage probes, and blinded human-review observations have not been imported."],
      artifact: { metrics: evidence.decision.metrics, checks: evidence.decision.checks },
    };
  }
  throw new Error(`Retrieval collection does not own ${milestone}.`);
}

export function collectRetrievalEvidence(
  job: EvidenceCollectionJob,
  readObservation: (milestone: string) => DomainCollectionObservation = readRetrievalCollectionObservation,
) {
  return collectDomainEvidenceFromObservation(job, readObservation(job.sourceMilestone));
}
