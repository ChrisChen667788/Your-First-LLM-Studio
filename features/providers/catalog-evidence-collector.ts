import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import { OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION, operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { probeProviderCapabilityTarget } from "@/features/providers/capability-application";

export async function collectProviderCatalogEvidence(
  job: EvidenceCollectionJob,
  probe: typeof probeProviderCapabilityTarget = probeProviderCapabilityTarget,
) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const result = await probe({ targetId: job.subjectId, freshProbe: true });
  const probeLatencyMs = Math.round(performance.now() - started);
  if (result.state !== "probed" || !result.route?.probed || !result.route.advertisedModels.length) {
    throw new Error("A fresh, non-empty provider model catalog is required; configuration, fallback and local registry results are not evidence.");
  }
  const advertisedModels = [...new Set(result.route.advertisedModels)].sort();
  const artifact = {
    schemaVersion: "providers.catalog-collection-artifact.v1",
    jobId: job.id,
    attempt: job.attempt,
    targetId: job.subjectId,
    advertisedModels,
    selectedModel: result.route.selectedModel,
    selectedModelAdvertised: advertisedModels.includes(result.route.selectedModel),
    fallbackModels: result.route.fallbackModels,
    deprecatedModels: result.target.deprecatedModels.filter((model) => advertisedModels.includes(model)),
    sourceUrl: result.route.sourceUrl,
    startedAt,
    completedAt: new Date().toISOString(),
    probeLatencyMs,
  };
  const artifactDigest = operationalEvidenceDigest(artifact);
  return {
    artifact,
    artifactDigest,
    receipt: {
      schemaVersion: OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION,
      milestone: job.sourceMilestone,
      subjectId: job.subjectId,
      environment: "local" as const,
      workloadDigest: operationalEvidenceDigest({ targetId: job.subjectId, operation: "fresh-model-list", organizationId: job.organizationId }),
      artifactDigests: [artifactDigest],
      startedAt,
      completedAt: artifact.completedAt,
      outcome: "pass" as const,
      metrics: { advertisedModelCount: advertisedModels.length, probeLatencyMs },
      operator: { organizationId: job.organizationId, operatorId: job.operatorId },
    },
  };
}
