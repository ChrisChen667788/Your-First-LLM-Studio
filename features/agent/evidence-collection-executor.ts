import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import {
  collectDomainEvidenceFromObservation,
  type DomainCollectionObservation,
} from "@/features/evidence/domain-collection";
import { readAgentHarnessConformance } from "@/features/agent/harness-conformance";
import { readInteractionCacheEvidence } from "@/features/agent/interaction-cache";
import { readIsolatedAgentTeamEvidence } from "@/features/agent/isolated-team-service";

export function readAgentCollectionObservation(
  milestone: string,
): DomainCollectionObservation {
  if (milestone === "v4.0.3") {
    const evidence = readAgentHarnessConformance();
    return {
      schemaVersion: evidence.schemaVersion,
      sourceKind: "reference",
      sourceStatus: evidence.sourceStatus,
      localStatus: evidence.localStatus,
      observedAt: evidence.generatedAt,
      evidenceDigest: evidence.evidenceDigest,
      metrics: {
        scenarios: evidence.totals.scenarios,
        passed: evidence.totals.passed,
        duplicateEffects: 0,
      },
      summary: "Agent harness reference scenarios are structurally valid.",
      blockers: ["Live provider lifecycle and protected-effect observations have not been imported."],
      artifact: { scenarios: evidence.scenarios },
    };
  }
  if (milestone === "v4.0.4") {
    const evidence = readInteractionCacheEvidence();
    return {
      schemaVersion: evidence.schemaVersion,
      sourceKind: "derived",
      sourceStatus: evidence.sourceStatus,
      localStatus: evidence.localStatus,
      observedAt: evidence.generatedAt,
      evidenceDigest: evidence.attribution.attributionDigest,
      metrics: {
        requests: evidence.attribution.attributed,
        cacheHits: evidence.attribution.hits,
        cachedTokens: evidence.attribution.observedPromptTokensOnHits,
        billedTokens: 0,
      },
      summary: "Local cache observations are available without provider billing attribution.",
      blockers: ["Provider-native billed-token and exception reconciliation observations have not been imported."],
      artifact: { attribution: evidence.attribution },
    };
  }
  if (milestone === "v4.0.5") {
    const evidence = readIsolatedAgentTeamEvidence();
    return {
      schemaVersion: evidence.schemaVersion,
      sourceKind: "reference",
      sourceStatus: evidence.sourceStatus,
      localStatus: evidence.localStatus,
      observedAt: new Date().toISOString(),
      evidenceDigest: evidence.planDigest,
      metrics: {
        workers: evidence.agents.length,
        conflicts: evidence.conflicts.length,
        mergeReviews: 0,
      },
      summary: "The isolated-worktree plan is valid but is not a separate-worker dispatch receipt.",
      blockers: ["Separate worker execution, recovery, and merge-review observations have not been imported."],
      artifact: { checks: evidence.checks, conflicts: evidence.conflicts },
    };
  }
  throw new Error(`Agent collection does not own ${milestone}.`);
}

export function collectAgentEvidence(
  job: EvidenceCollectionJob,
  readObservation: (milestone: string) => DomainCollectionObservation = readAgentCollectionObservation,
) {
  return collectDomainEvidenceFromObservation(job, readObservation(job.sourceMilestone));
}
