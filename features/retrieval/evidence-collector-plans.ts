import type { EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";

export function readRetrievalEvidenceCollectorPlans(): EvidenceCollectionPlan[] {
  return [
    {
      version: "v4.3.0",
      label: "Managed Corpus Lifecycle Collector",
      owner: "features/retrieval",
      track: "rag",
      kind: "collector",
      mode: "operator-assisted",
      sourceMilestones: ["v4.1.0"],
      requiredInputs: ["managed connector", "corpus revision", "identity ACL", "retention policy"],
      artifactKinds: ["connector lineage", "ACL query ledger", "deletion propagation", "rollback report"],
      executionSteps: ["sync and parse corpus", "build lexical and vector indexes", "query with ACL", "delete, verify and rollback"],
      timeoutMs: 60 * 60_000,
      retryPolicy: { maxAttempts: 2, baseDelayMs: 10_000, maxDelayMs: 60_000 },
      localGate: "Connector, index, ACL, deletion, citation, cache, and rollback revisions reconcile for one managed corpus.",
      externalGate: "Managed database, identity, legal hold, and data-owner approval remain external.",
    },
    {
      version: "v4.3.1",
      label: "RAG Feedback Review Collector",
      owner: "features/retrieval",
      track: "rag",
      kind: "collector",
      mode: "operator-assisted",
      sourceMilestones: ["v4.1.1"],
      requiredInputs: ["pinned corpus", "paired evaluation set", "evaluator revisions", "reviewer assignments"],
      artifactKinds: ["paired quality report", "citation failures", "leakage probes", "human review ledger"],
      executionSteps: ["run paired retrieval", "score answer and citation", "probe leakage and freshness", "collect blinded review"],
      timeoutMs: 60 * 60_000,
      retryPolicy: { maxAttempts: 2, baseDelayMs: 10_000, maxDelayMs: 60_000 },
      localGate: "Promotion uses paired retrieval, answer, citation, leakage, freshness, and distinct human-review evidence.",
      externalGate: "Data-owner review and independent leakage testing remain external.",
    },
  ];
}
