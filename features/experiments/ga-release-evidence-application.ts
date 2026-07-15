import { appendExperimentEvent } from "./timeline-service";
import {
  applyGaReleaseEvidenceBundleRetention,
  buildGaReleaseEvidenceBundle,
  readGaReleaseEvidenceBundleHistory,
  readGaReleaseEvidenceBundleVerification,
  writeGaReleaseEvidenceBundle,
} from "./ga-release-evidence-bundle";

export type GaReleaseEvidenceActionInput = {
  action?: string;
  retention?: { maxBundles?: number; maxAgeDays?: number };
};

export class GaReleaseEvidenceApplicationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function readGaReleaseEvidenceApplication() {
  const bundle = buildGaReleaseEvidenceBundle();
  return {
    ok: true,
    bundle,
    history: readGaReleaseEvidenceBundleHistory(),
    verification: readGaReleaseEvidenceBundleVerification(bundle),
  };
}

export function runGaReleaseEvidenceAction(input: GaReleaseEvidenceActionInput) {
  if (input.action === "apply-retention") {
    const retention = applyGaReleaseEvidenceBundleRetention(input.retention);
    return {
      status: 200,
      payload: {
        retention,
        ...readGaReleaseEvidenceApplication(),
      },
    };
  }
  if (input.action === "verify-bundle") {
    const current = readGaReleaseEvidenceApplication();
    return {
      status: current.verification.status === "invalid" ? 409 : 200,
      payload: {
        ...current,
        ok: current.verification.status !== "invalid",
      },
    };
  }
  if (input.action !== "write-bundle") {
    throw new GaReleaseEvidenceApplicationError(
      "Unsupported GA release evidence action.",
    );
  }
  const result = writeGaReleaseEvidenceBundle();
  appendExperimentEvent({
    kind: "provider",
    status: result.bundle.productionReadiness.status === "pass"
      ? "completed"
      : "saved",
    title: "GA release evidence bundle written",
    summary: `Non-cloud ${result.bundle.nonCloudReadiness.status} · production ${result.bundle.productionReadiness.status} · ${result.bundle.totals.blockerCount} blocker(s).`,
    artifacts: [
      {
        kind: "file",
        role: "bundle",
        label: "GA release evidence bundle",
        uri: result.bundle.artifactPath,
        mimeType: "application/json",
      },
      {
        kind: "file",
        role: "bundle",
        label: "GA release evidence archive",
        uri: result.archivePath,
        mimeType: "application/json",
      },
    ],
    metadata: {
      nonCloudStatus: result.bundle.nonCloudReadiness.status,
      productionStatus: result.bundle.productionReadiness.status,
      blockers: result.bundle.totals.blockerCount,
    },
  });
  return {
    status: 200,
    payload: {
      ...result,
      history: readGaReleaseEvidenceBundleHistory(),
      verification: readGaReleaseEvidenceBundleVerification(result.bundle),
    },
  };
}
