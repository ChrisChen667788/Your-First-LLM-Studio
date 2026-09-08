import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import {
  collectDomainEvidenceFromObservation,
  type DomainCollectionObservation,
} from "@/features/evidence/domain-collection";
import { readLocalServerDiagnosticsV3 } from "@/features/models/local-server-diagnostics-v3";
import { readModelHubOperationsV3 } from "@/features/models/model-hub-operations-v3";

export function readModelCollectionObservation(
  milestone: string,
): DomainCollectionObservation {
  if (milestone === "v4.0.8") {
    const evidence = readModelHubOperationsV3();
    return {
      schemaVersion: evidence.schemaVersion,
      sourceKind: "derived",
      sourceStatus: evidence.sourceStatus,
      localStatus: evidence.localStatus,
      observedAt: evidence.generatedAt,
      evidenceDigest: evidence.evidenceDigest,
      metrics: {
        files: evidence.totals.transferSessions,
        bytes: 0,
        checksumsVerified: evidence.actions.filter((action) => action.id === "verify" && action.evidence).length,
      },
      summary: "Model-Hub actions are projected from durable operation read models.",
      blockers: ["A linked transfer manifest with per-file bytes and checksum receipt is required."],
      artifact: { actions: evidence.actions, totals: evidence.totals },
    };
  }
  if (milestone === "v4.0.9") {
    const evidence = readLocalServerDiagnosticsV3();
    return {
      schemaVersion: evidence.schemaVersion,
      sourceKind: "derived",
      sourceStatus: evidence.sourceStatus,
      localStatus: evidence.localStatus,
      observedAt: evidence.generatedAt,
      evidenceDigest: evidence.evidenceDigest,
      metrics: {
        requests: evidence.totals.requests || 0,
        cancelled: evidence.instances.reduce(
          (sum, instance) => sum + instance.cancelled,
          0,
        ),
        drainPasses: evidence.checks.apiConformance && evidence.checks.idleUnload ? 1 : 0,
      },
      summary: "Local Server diagnostics are projected from the request ledger and lifecycle receipts.",
      blockers: ["A linked activation, cancellation, drain, and rollback runtime receipt is required."],
      artifact: { checks: evidence.checks, instances: evidence.instances, totals: evidence.totals },
    };
  }
  throw new Error(`Model collection does not own ${milestone}.`);
}

export function collectModelEvidence(
  job: EvidenceCollectionJob,
  readObservation: (milestone: string) => DomainCollectionObservation = readModelCollectionObservation,
) {
  return collectDomainEvidenceFromObservation(job, readObservation(job.sourceMilestone));
}
