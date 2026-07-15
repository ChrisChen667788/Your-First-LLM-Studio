import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import {
  applyProviderOpsEvidenceRetention,
  captureProviderOpsEvidenceSnapshot,
  deleteProviderOpsEvidenceSnapshot,
  readProviderOpsEvidenceSnapshots,
  setProviderOpsEvidenceSnapshotPinned,
  verifyProviderOpsEvidenceSnapshotIntegrity,
} from "./evidence-snapshot-store";
import { readProviderOpsEvidenceSummary } from "./provider-ops-evidence";
import { runProviderReleaseProbe } from "./release-probe";

export type ProviderOpsEvidenceActionInput = {
  action?: string;
  targetId?: string;
  id?: string;
  label?: string;
  reason?: string;
  pinned?: boolean;
  windowHours?: number;
  retention?: {
    maxSnapshots?: number;
    maxAgeDays?: number;
    preservePinned?: boolean;
  };
};

export class ProviderOpsEvidenceApplicationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function readProviderOpsEvidenceApplication(windowHoursInput?: number) {
  const windowHours = Number.isFinite(windowHoursInput) ? windowHoursInput : 24;
  return {
    ok: true,
    summary: readProviderOpsEvidenceSummary({ windowHours }),
    snapshots: readProviderOpsEvidenceSnapshots(),
  };
}

export async function runProviderOpsEvidenceAction(
  input: ProviderOpsEvidenceActionInput,
): Promise<{ payload: unknown; status: number }> {
  if (input.action === "run-release-probe") {
    if (!input.targetId?.trim()) {
      throw new ProviderOpsEvidenceApplicationError("targetId is required.");
    }
    const probe = await runProviderReleaseProbe(input.targetId.trim());
    const snapshotResult = captureProviderOpsEvidenceSnapshot({
      label: `${probe.targetLabel} release probe ${probe.ok ? "PASS" : "FAIL"}`,
      reason: "Automatically captured after an operator-triggered Provider release probe.",
      pinned: false,
      windowHours: 24,
    });
    return {
      payload: {
        ok: probe.ok,
        probe,
        snapshot: snapshotResult.snapshot,
        summary: readProviderOpsEvidenceSummary({ windowHours: 24 }),
        snapshots: snapshotResult.store,
      },
      status: probe.ok ? 200 : 422,
    };
  }

  if (input.action === "capture-snapshot") {
    const result = captureProviderOpsEvidenceSnapshot({
      label: input.label,
      reason: input.reason,
      pinned: input.pinned,
      windowHours: input.windowHours,
    });
    appendExperimentEvent({
      kind: "provider",
      status: "saved",
      title: "Provider Ops evidence snapshot captured",
      summary: `${result.snapshot.label} · ${result.snapshot.qualifiesAsFreshEvidence ? "qualifying" : "non-qualifying"}${result.snapshot.pinned ? " · pinned" : ""}`,
      relatedId: result.snapshot.id,
      artifacts: [{
        kind: "api",
        role: "report",
        label: "Provider evidence snapshot export",
        uri: "/api/admin/provider-health/evidence/export?format=json",
      }],
      metadata: {
        pinned: result.snapshot.pinned,
        qualifies: result.snapshot.qualifiesAsFreshEvidence,
        chatRequests: result.snapshot.summary.totals.totalRequests,
        successfulProbes: result.snapshot.summary.releaseProbe.successCount,
      },
    });
    return { payload: result, status: 200 };
  }

  if (input.action === "set-snapshot-pinned") {
    if (!input.id?.trim()) {
      throw new ProviderOpsEvidenceApplicationError("id is required.");
    }
    return {
      payload: setProviderOpsEvidenceSnapshotPinned({
        id: input.id.trim(),
        pinned: input.pinned === true,
      }),
      status: 200,
    };
  }

  if (input.action === "delete-snapshot") {
    if (!input.id?.trim()) {
      throw new ProviderOpsEvidenceApplicationError("id is required.");
    }
    return {
      payload: deleteProviderOpsEvidenceSnapshot(input.id.trim()),
      status: 200,
    };
  }

  if (input.action === "apply-retention") {
    const retention = applyProviderOpsEvidenceRetention(input.retention);
    appendExperimentEvent({
      kind: "provider",
      status: "completed",
      title: "Provider evidence retention applied",
      summary: `${retention.beforeCount} -> ${retention.afterCount}; removed ${retention.removedCount}; protected ${retention.protectedCount}.`,
      metadata: {
        removed: retention.removedCount,
        protected: retention.protectedCount,
        maxSnapshots: retention.policy.maxSnapshots,
        maxAgeDays: retention.policy.maxAgeDays,
      },
    });
    return {
      payload: {
        ok: true,
        retention,
        snapshots: readProviderOpsEvidenceSnapshots(),
      },
      status: 200,
    };
  }

  if (input.action === "verify-snapshot-integrity") {
    const verification = verifyProviderOpsEvidenceSnapshotIntegrity({
      repairMissing: true,
    });
    appendExperimentEvent({
      kind: "provider",
      status: verification.ok ? "completed" : "failed",
      title: "Provider evidence snapshot integrity verified",
      summary: `${verification.store.integrity.verifiedCount} verified; ${verification.repairedCount} legacy digest(s) added; ${verification.store.integrity.invalidCount} invalid.`,
      metadata: {
        verified: verification.store.integrity.verifiedCount,
        repaired: verification.repairedCount,
        invalid: verification.store.integrity.invalidCount,
      },
    });
    return {
      payload: {
        ok: verification.ok,
        verification,
        snapshots: verification.store,
      },
      status: verification.ok ? 200 : 409,
    };
  }

  throw new ProviderOpsEvidenceApplicationError(
    "Unsupported Provider Ops evidence action.",
  );
}
