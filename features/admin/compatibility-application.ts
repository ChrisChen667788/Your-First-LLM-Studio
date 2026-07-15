import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import { readAdminCompatibilityDeletionManifest } from "./compatibility-deletion-manifest";
import {
  createAdminCompatibilityDeletionSignoff,
  readAdminCompatibilityDeletionSignoffs,
} from "./compatibility-deletion-signoff";
import { readAdminCompatibilitySunsetEvidence } from "./compatibility-sunset";
import {
  archiveHistoricalAdminCompatibilityUsage,
  clearAdminCompatibilityUsageSummary,
  readAdminCompatibilityUsageSummary,
} from "./compatibility-usage";

export type AdminCompatibilityActionInput = {
  action?: string;
  reason?: string;
  clear?: boolean;
  operatorId?: string;
};

export class AdminCompatibilityApplicationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function readAdminCompatibilityApplication() {
  return {
    ok: true,
    summary: readAdminCompatibilityUsageSummary(),
    sunset: readAdminCompatibilitySunsetEvidence(),
    deletionManifest: readAdminCompatibilityDeletionManifest(),
    deletionSignoffs: readAdminCompatibilityDeletionSignoffs(),
  };
}

export function runAdminCompatibilityAction(
  input: AdminCompatibilityActionInput,
) {
  if (input.action === "sign-off-deletion") {
    try {
      const result = createAdminCompatibilityDeletionSignoff({
        operatorId: input.operatorId,
        reason: input.reason,
      });
      appendExperimentEvent({
        kind: "provider",
        status: "completed",
        title: "Admin compatibility deletion signed off",
        summary: `${result.signoff.operatorId} signed manifest ${result.signoff.manifestDigest.slice(0, 12)}.`,
        metadata: {
          operatorId: result.signoff.operatorId,
          manifestDigest: result.signoff.manifestDigest,
          created: result.created,
        },
      });
      return result;
    } catch (error) {
      throw new AdminCompatibilityApplicationError(
        error instanceof Error
          ? error.message
          : "Compatibility deletion sign-off failed.",
        409,
      );
    }
  }
  if (input.action !== "archive-historical-unclassified") {
    throw new AdminCompatibilityApplicationError(
      "Unsupported compatibility usage action.",
    );
  }
  try {
    const result = archiveHistoricalAdminCompatibilityUsage({
      reason: input.reason,
      clear: input.clear,
    });
    appendExperimentEvent({
      kind: "provider",
      status: "completed",
      title: "Admin compatibility historical usage archived",
      summary: result.archived
        ? `Archived ${result.archive?.legacyUnclassifiedHitsArchived || 0} historical Admin compatibility hit(s) across ${result.archive?.routeCount || 0} route(s).`
        : "No historical Admin compatibility hits required archiving.",
      artifacts: [
        {
          kind: "api",
          role: "manifest",
          label: "Admin compatibility usage",
          uri: "/api/admin/compatibility-usage",
        },
        {
          kind: "file",
          role: "manifest",
          label: "Admin compatibility archive",
          uri: result.archiveSummary.archivePath,
        },
      ],
      metadata: {
        archived: result.archived,
        cleared: result.cleared,
        archivedHits: result.archive?.legacyUnclassifiedHitsArchived || 0,
        previousRuntimeHits: result.before.runtimeHits,
        previousLegacyUnclassifiedHits: result.before.legacyUnclassifiedHits,
        remainingLegacyUnclassifiedHits: result.after.legacyUnclassifiedHits,
      },
    });
    return result;
  } catch (error) {
    throw new AdminCompatibilityApplicationError(
      error instanceof Error
        ? error.message
        : "Failed to archive historical compatibility usage.",
      409,
    );
  }
}

export function clearAdminCompatibilityApplication() {
  const result = clearAdminCompatibilityUsageSummary();
  appendExperimentEvent({
    kind: "provider",
    status: "completed",
    title: "Admin compatibility usage cleared",
    summary: `Cleared ${result.before.totalHits} deprecated Admin compatibility API hit${result.before.totalHits === 1 ? "" : "s"} across ${result.before.routeCount} route${result.before.routeCount === 1 ? "" : "s"}.`,
    artifacts: [{
      kind: "api",
      role: "manifest",
      label: "Admin compatibility usage",
      uri: "/api/admin/compatibility-usage",
    }],
    metadata: {
      previousHits: result.before.totalHits,
      previousRoutes: result.before.routeCount,
      clearedAt: result.clearedAt,
    },
  });
  return result;
}
