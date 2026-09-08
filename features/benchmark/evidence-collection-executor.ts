import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import {
  collectDomainEvidenceFromObservation,
  type DomainCollectionObservation,
} from "@/features/evidence/domain-collection";
import { readMultimodalCapabilityRegistry } from "@/features/benchmark/multimodal-capability-registry";

export function readBenchmarkCollectionObservation(): DomainCollectionObservation {
  const evidence = readMultimodalCapabilityRegistry();
  const eligibleTargets = evidence.protocols.reduce(
    (sum, protocol) => sum + protocol.eligibleTargetIds.length,
    0,
  );
  return {
    schemaVersion: evidence.schemaVersion,
    sourceKind: "derived",
    sourceStatus: evidence.sourceStatus,
    localStatus: evidence.localStatus,
    observedAt: evidence.generatedAt,
    evidenceDigest: evidence.registryDigest,
    metrics: {
      samples: 0,
      scored: 0,
      unsupportedSkipped: Math.max(0, evidence.targets.length - eligibleTargets),
    },
    summary: "Capability and evaluator admission are present, without licensed native-media execution.",
    blockers: ["Licensed media manifests, evaluator outputs, and per-sample skip records have not been collected."],
    artifact: {
      protocols: evidence.protocols.map((protocol) => ({
        id: protocol.id,
        evaluatorStatus: protocol.evaluatorStatus,
        eligibleTargets: protocol.eligibleTargetIds.length,
      })),
      conformance: evidence.conformance,
    },
  };
}

export function collectBenchmarkEvidence(
  job: EvidenceCollectionJob,
  readObservation: () => DomainCollectionObservation = readBenchmarkCollectionObservation,
) {
  return collectDomainEvidenceFromObservation(job, readObservation());
}
