import type { EvidenceOperationMilestoneSpec } from "@/features/evidence/operational-receipts";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { readConnectorIndexLifecycleEvidence } from "@/features/retrieval/connector-index-lifecycle";
import { readRagQualityLoopEvidence } from "@/features/retrieval/rag-quality-loop";

export function readRetrievalEvidenceOperationSpecs(): EvidenceOperationMilestoneSpec[] {
  const lifecycle = readConnectorIndexLifecycleEvidence();
  const quality = readRagQualityLoopEvidence();
  return [
    {
      version: "v4.1.0",
      label: "Managed RAG Corpus Lifecycle",
      owner: "features/retrieval",
      track: "rag",
      contract: "retrieval.managed-corpus-lifecycle.v1",
      requiredMetrics: ["documents", "deletedDocuments", "leakageFailures"],
      currentSignal: {
        status: "hold",
        summary: `${lifecycle.lifecycle.status} reference lifecycle; managed connector, index, ACL, deletion, and citation reconciliation are absent.`,
        evidenceDigest: operationalEvidenceDigest(lifecycle),
      },
      localGate: "Rehearse real connector sync, parser/index revisions, ACL-filtered query, deletion propagation, rollback, and citation read-back.",
      externalGate: "Managed database, identity, retention, legal-hold, and data-owner approval remain external.",
    },
    {
      version: "v4.1.1",
      label: "RAG Feedback Promotion",
      owner: "features/retrieval",
      track: "rag",
      contract: "retrieval.feedback-promotion-receipts.v1",
      requiredMetrics: ["pairedSamples", "citationFailures", "humanReviews"],
      currentSignal: {
        status: "hold",
        summary: `${quality.decision.metrics.pairedSamples} deterministic paired fixture(s); pinned real corpus and human review evidence are absent.`,
        evidenceDigest: quality.decision.decisionDigest,
      },
      localGate: "Run paired retrieval, answer, citation, leakage, freshness, and human-feedback evaluation on a pinned corpus revision.",
      externalGate: "Data-owner review, independent leakage testing, and promotion authority remain external.",
    },
  ];
}
