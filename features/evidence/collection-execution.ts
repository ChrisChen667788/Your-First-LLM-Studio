import { EvidenceCollectionPolicyError } from "@/features/evidence/collection-policy";
import { evidenceCollectorExecutionStatus } from "@/features/evidence/collection-catalog";
import { claimEvidenceCollection, failEvidenceCollection, submitEvidenceCollectionCandidate } from "@/features/evidence/collection-service";
import { readEvidenceCollectionStore } from "@/features/evidence/collection-store";
import { prependDurableReceipt } from "@/features/persistence/durable-receipt-store";
import { collectProviderCatalogEvidence } from "@/features/providers/catalog-evidence-collector";
import { collectProviderRoutingEvidence } from "@/features/providers/routing-quality-collector";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export async function executeEvidenceCollection(input: {
  jobId: string;
  workerId: string;
  expectedRevision: number;
}) {
  const current = readEvidenceCollectionStore().jobs.find((job) => job.id === input.jobId);
  if (!current) throw new EvidenceCollectionPolicyError("not-found", 404, "Collection job was not found.");
  if (evidenceCollectorExecutionStatus(current.planVersion) !== "implemented") {
    throw new EvidenceCollectionPolicyError("invalid-transition", 409, "This plan has no executable collector yet. Only externally collected receipt import is available.");
  }
  if (current.status === "running" && current.lease && Date.parse(current.lease.expiresAt) > Date.now()) {
    throw new EvidenceCollectionPolicyError("lease-conflict", 409, "Collection is already executing; wait for its lease or result.");
  }
  const job = claimEvidenceCollection({ ...input, ttlMs: 120_000 });
  const owned = { ...input, expectedRevision: job.revision, fenceToken: job.lease!.fenceToken };
  try {
    const collected = job.planVersion === "v4.2.5"
      ? await collectProviderRoutingEvidence(job)
      : await collectProviderCatalogEvidence(job);
    // Artifacts are inert audit data. Only the fenced submission can advance a gate.
    prependDurableReceipt(
      getLocalAgentDataPath("experiments", job.planVersion === "v4.2.5"
        ? "provider-routing-collection-artifacts.json"
        : "provider-catalog-collection-artifacts.json"),
      job.planVersion === "v4.2.5" ? "providers.routing-quality-collection-artifact-store.v1" : "providers.catalog-collection-artifact-store.v1", collected, 500,
      (entry) => entry.artifactDigest === collected.artifactDigest,
    );
    return submitEvidenceCollectionCandidate({ ...owned, receipt: collected.receipt });
  } catch (error) {
    try {
      failEvidenceCollection({ ...owned, reason: "Provider catalog collection did not complete. Check target configuration and connectivity." });
    } catch (leaseError) {
      if (!(leaseError instanceof EvidenceCollectionPolicyError && leaseError.status === 409)) throw leaseError;
    }
    throw error;
  }
}
