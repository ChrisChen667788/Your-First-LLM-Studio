import type {
  ExperimentEvent,
  ExperimentRetentionPolicy,
  ExperimentRetentionResult,
} from "@/features/experiments/contracts";
import {
  readExperimentTimeline,
  rewriteExperimentTimeline,
} from "@/features/experiments/timeline-service";

export const DEFAULT_EXPERIMENT_RETENTION_POLICY: ExperimentRetentionPolicy = {
  maxEvents: 500,
  maxAgeDays: 90,
  preserveFailures: true,
  preserveArtifacts: true,
};

export function normalizeExperimentRetentionPolicy(
  input?: Partial<ExperimentRetentionPolicy>,
): ExperimentRetentionPolicy {
  return {
    maxEvents: Math.max(50, Math.min(Math.trunc(input?.maxEvents || 500), 5000)),
    maxAgeDays: Math.max(7, Math.min(Math.trunc(input?.maxAgeDays || 90), 730)),
    preserveFailures: input?.preserveFailures !== false,
    preserveArtifacts: input?.preserveArtifacts !== false,
  };
}

function isProtectedEvent(
  event: ExperimentEvent,
  policy: ExperimentRetentionPolicy,
) {
  if (
    policy.preserveFailures &&
    ["failed", "conflict"].includes(event.status)
  ) {
    return true;
  }
  return policy.preserveArtifacts && Boolean(event.artifacts?.length);
}

export function applyExperimentRetention(
  input?: Partial<ExperimentRetentionPolicy>,
): ExperimentRetentionResult {
  const policy = normalizeExperimentRetentionPolicy(input);
  const events = readExperimentTimeline();
  const cutoff = Date.now() - policy.maxAgeDays * 24 * 60 * 60 * 1000;
  const protectedEvents = events.filter((event) => isProtectedEvent(event, policy));
  const protectedIds = new Set(protectedEvents.map((event) => event.id));
  const retainedRecent = events
    .filter((event) => !protectedIds.has(event.id))
    .filter((event) => {
      const timestamp = Date.parse(event.at);
      return Number.isNaN(timestamp) || timestamp >= cutoff;
    })
    .slice(0, policy.maxEvents);
  const retained = [...protectedEvents, ...retainedRecent]
    .filter(
      (event, index, all) =>
        all.findIndex((candidate) => candidate.id === event.id) === index,
    )
    .sort((left, right) => right.at.localeCompare(left.at));

  rewriteExperimentTimeline(retained);
  return {
    beforeCount: events.length,
    afterCount: retained.length,
    removedCount: Math.max(0, events.length - retained.length),
    protectedCount: protectedEvents.length,
    appliedAt: new Date().toISOString(),
    policy,
  };
}
