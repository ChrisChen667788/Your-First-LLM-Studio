import { EvidenceCollectionPolicyError } from "@/features/evidence/collection-policy";
import { evidenceCollectorExecutionStatus } from "@/features/evidence/collection-catalog";
import { claimEvidenceCollection, failEvidenceCollection, submitEvidenceCollectionCandidate } from "@/features/evidence/collection-service";
import { readEvidenceCollectionStore } from "@/features/evidence/collection-store";
import { prependDurableReceipt } from "@/features/persistence/durable-receipt-store";
import { collectProviderCatalogEvidence } from "@/features/providers/catalog-evidence-collector";
import { collectProviderRoutingEvidence } from "@/features/providers/routing-quality-collector";
import { collectAgentEvidence } from "@/features/agent/evidence-collection-executor";
import { collectBenchmarkEvidence } from "@/features/benchmark/evidence-collection-executor";
import { collectFineTuneEvidence } from "@/features/finetune/evidence-collection-executor";
import { collectGovernanceEvidence } from "@/features/governance/evidence-collection-executor";
import { collectModelEvidence } from "@/features/models/evidence-collection-executor";
import { collectRetrievalEvidence } from "@/features/retrieval/evidence-collection-executor";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

function collectForPlan(job: ReturnType<typeof claimEvidenceCollection>) {
  switch (job.planVersion) {
    case "v4.2.4": return collectProviderCatalogEvidence(job);
    case "v4.2.5": return collectProviderRoutingEvidence(job);
    case "v4.2.6":
    case "v4.2.7": return Promise.resolve(collectAgentEvidence(job));
    case "v4.2.8": return Promise.resolve(collectBenchmarkEvidence(job));
    case "v4.2.9": return Promise.resolve(collectModelEvidence(job));
    case "v4.3.0":
    case "v4.3.1": return Promise.resolve(collectRetrievalEvidence(job));
    case "v4.3.2": return Promise.resolve(collectFineTuneEvidence(job));
    case "v4.3.3": return Promise.resolve(collectGovernanceEvidence(job));
    default: throw new EvidenceCollectionPolicyError("invalid-transition", 409, `No collector dispatch exists for ${job.planVersion}.`);
  }
}

function artifactStore(job: ReturnType<typeof claimEvidenceCollection>) {
  if (job.planVersion === "v4.2.4") {
    return { path: getLocalAgentDataPath("experiments", "provider-catalog-collection-artifacts.json"), schemaVersion: "providers.catalog-collection-artifact-store.v1" };
  }
  if (job.planVersion === "v4.2.5") {
    return { path: getLocalAgentDataPath("experiments", "provider-routing-collection-artifacts.json"), schemaVersion: "providers.routing-quality-collection-artifact-store.v1" };
  }
  return {
    path: getLocalAgentDataPath("experiments", `${job.planVersion}-collection-artifacts.json`),
    schemaVersion: "evidence.domain-collection-artifact-store.v1",
  };
}

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
    const collected = await collectForPlan(job);
    // Artifacts are inert audit data. Only the fenced submission can advance a gate.
    prependDurableReceipt(
      artifactStore(job).path,
      artifactStore(job).schemaVersion, collected, 500,
      (entry) => entry.artifactDigest === collected.artifactDigest,
    );
    return submitEvidenceCollectionCandidate({ ...owned, receipt: collected.receipt });
  } catch (error) {
    try {
      failEvidenceCollection({ ...owned, reason: `${job.planVersion} collection did not complete. Check the plan-specific live evidence prerequisites.` });
    } catch (leaseError) {
      if (!(leaseError instanceof EvidenceCollectionPolicyError && leaseError.status === 409)) throw leaseError;
    }
    throw error;
  }
}
