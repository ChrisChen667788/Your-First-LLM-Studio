import crypto from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import path from "path";
import { readAdminCompatibilityDeletionManifest } from "@/features/admin/compatibility-deletion-manifest";
import { readAdminCompatibilityDeletionSignoffs } from "@/features/admin/compatibility-deletion-signoff";
import { readAdminCompatibilitySunsetEvidence } from "@/features/admin/compatibility-sunset";
import { readDeploymentControlPlane } from "@/features/deployment/control-plane";
import { readProviderOpsEvidenceSnapshots } from "@/features/providers/evidence-snapshot-store";
import type {
  GaReleaseEvidenceBundle,
  GaReleaseEvidenceBundleHistory,
  GaReleaseEvidenceBundleRetentionResult,
  GaReleaseEvidenceBundleSource,
  GaReleaseEvidenceBundleVerification,
  GaReleaseEvidenceBundleStatus,
} from "./contracts";
import { readPromotionGate } from "./promotion-gate";
import { readPublicReleaseEvidence } from "./public-release-evidence";
import { readRouteSmokeEvidence } from "./route-smoke-evidence";
import { readReleaseSecurityEvidence } from "./release-security-evidence";
import { readScreenshotIntegrityEvidence } from "./screenshot-integrity-evidence";

const BUNDLE_DIR = path.join(process.cwd(), "output", "release-evidence");
const BUNDLE_HISTORY_DIR = path.join(BUNDLE_DIR, "history");
const BUNDLE_PATH = path.join(BUNDLE_DIR, "ga-release-evidence-latest.json");

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function bundleDigest(bundle: Omit<GaReleaseEvidenceBundle, "integrity">) {
  const { persistedAt: _persistedAt, ...immutableBundle } = bundle;
  return sha256(immutableBundle);
}

function bundleStateDigest(
  bundle: Omit<GaReleaseEvidenceBundle, "integrity"> | GaReleaseEvidenceBundle,
) {
  const {
    generatedAt: _generatedAt,
    persistedAt: _persistedAt,
    integrity: _integrity,
    ...state
  } = bundle as GaReleaseEvidenceBundle;
  return sha256(state);
}

function withSourceDigests(
  sources: Array<Omit<GaReleaseEvidenceBundleSource, "digest">>,
): GaReleaseEvidenceBundleSource[] {
  return sources.map((source) => ({
    ...source,
    digest: sha256(source),
  }));
}

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusFromBlockers(
  blockers: string[],
  options?: { blocked?: boolean },
): GaReleaseEvidenceBundleStatus {
  if (!blockers.length) return "pass";
  return options?.blocked ? "blocked" : "evidence-needed";
}

function persistedAt() {
  if (!existsSync(BUNDLE_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(BUNDLE_PATH, "utf8")) as {
      generatedAt?: string;
    };
    return parsed.generatedAt || new Date(statSync(BUNDLE_PATH).mtimeMs).toISOString();
  } catch {
    return new Date(statSync(BUNDLE_PATH).mtimeMs).toISOString();
  }
}

export function buildGaReleaseEvidenceBundle(): GaReleaseEvidenceBundle {
  const promotion = readPromotionGate();
  const routeSmoke = readRouteSmokeEvidence();
  const compatibility = readAdminCompatibilitySunsetEvidence();
  const deletionManifest = readAdminCompatibilityDeletionManifest();
  const deletionSignoffs = readAdminCompatibilityDeletionSignoffs();
  const providerSnapshots = readProviderOpsEvidenceSnapshots({ limit: 200 });
  const publicRelease = readPublicReleaseEvidence();
  const deployment = readDeploymentControlPlane();
  const security = readReleaseSecurityEvidence();
  const screenshotIntegrity = readScreenshotIntegrityEvidence();
  const localClosureEvidencePath = path.join(
    process.cwd(),
    "docs",
    "release-evidence",
    "v1.0.0-local-ga-closure-2026-07-11.md",
  );

  const promotionBlockers = promotion.blockers;
  const routeBlockers = routeSmoke.blockers;
  const compatibilityBlockers = [
    ...compatibility.blockers,
    ...(deletionManifest.status === "ready" && deletionSignoffs.currentCount === 0
      ? ["Admin compatibility deletion manifest requires a current operator sign-off."]
      : []),
  ];
  const docsBlockers = publicRelease.blockers;
  const securityBlockers = security.blockers;
  const deploymentBlockers = deployment.productionReadiness.blockers;
  const localClosureBlockers = [
    ...(existsSync(localClosureEvidencePath)
      ? []
      : ["v1.0 local GA closure evidence document is missing."]),
    ...(deletionManifest.preSunsetStatus === "ready"
      ? []
      : deletionManifest.preSunsetBlockers),
    ...routeBlockers,
    ...docsBlockers,
    ...securityBlockers,
    ...screenshotIntegrity.blockers,
  ];
  const nonCloudBlockers = [
    ...promotionBlockers,
    ...routeBlockers,
    ...compatibilityBlockers,
    ...docsBlockers,
    ...securityBlockers,
  ];
  const productionBlockers = [...nonCloudBlockers, ...deploymentBlockers];

  const sources = withSourceDigests([
    {
      id: "promotion-gate",
      label: "Promotion gate",
      status: statusFromBlockers(promotionBlockers),
      evidence: ["/api/experiments/promotion-gate"],
      blockers: promotionBlockers,
      metrics: {
        status: promotion.overallStatus,
        sourceCount: promotion.sources.length,
      },
    },
    {
      id: "route-smoke",
      label: "Cross-surface route smoke",
      status: statusFromBlockers(routeBlockers),
      evidence: [routeSmoke.reportPath, routeSmoke.history.historyDir],
      blockers: routeBlockers,
      metrics: {
        currentStatus: routeSmoke.ok ? "pass" : "fail",
        integrity: routeSmoke.integrity.status,
        checks: routeSmoke.totals.checkCount,
        historyCount: routeSmoke.history.reportCount,
        consecutivePasses: routeSmoke.history.consecutivePassCount,
        verifiedHistoryCount: routeSmoke.history.verifiedCount,
      },
    },
    {
      id: "compatibility-sunset",
      label: "Admin compatibility sunset",
      status: statusFromBlockers(compatibilityBlockers),
      evidence: [
        "/api/admin/compatibility-usage",
        compatibility.historicalArchives.archivePath,
      ],
      blockers: compatibilityBlockers,
      metrics: {
        runtimeHits: compatibility.totals.runtimeHitCount,
        historicalHits: compatibility.totals.legacyUnclassifiedHitCount,
        deletionReadiness: compatibility.deletionReadiness,
        deleteReadyRoutes: deletionManifest.totals.deleteReadyCount,
        preSunsetStatus: deletionManifest.preSunsetStatus,
        preSunsetReadyRoutes: deletionManifest.totals.preSunsetReadyCount,
        currentDeletionSignoffs: deletionSignoffs.currentCount,
      },
    },
    {
      id: "provider-snapshots",
      label: "Provider Ops evidence snapshots",
      status: statusFromBlockers(promotionBlockers.filter((blocker) => blocker.includes("Provider Ops"))),
      evidence: [
        "/api/admin/provider-health/evidence",
        "/api/admin/provider-health/evidence/export?format=json",
        providerSnapshots.path,
      ],
      blockers: promotionBlockers.filter((blocker) => blocker.includes("Provider Ops")),
      metrics: {
        snapshots: providerSnapshots.totalCount,
        pinned: providerSnapshots.pinnedCount,
        qualifying: providerSnapshots.qualifyingCount,
      },
    },
    {
      id: "public-release",
      label: "Public docs and demo evidence",
      status: statusFromBlockers(docsBlockers),
      evidence: ["/release", "/api/experiments/public-release-evidence"],
      blockers: docsBlockers,
      metrics: {
        completionPct: publicRelease.totals.completionPct,
        docsFiles: publicRelease.docsFiles.length,
        screenshots: publicRelease.demoCapture.verifiedFlowCount,
      },
    },
    {
      id: "release-security",
      label: "Release security preflight",
      status: security.status,
      evidence: [
        "/api/experiments/release-security-evidence",
        security.reportPath,
      ],
      blockers: security.blockers,
      metrics: {
        fresh: security.fresh,
        integrity: security.integrity.status,
        secretFindings: security.secretScan.findingCount,
        auditedProductionVulnerabilities:
          security.packageAudit.vulnerabilities.total,
        auditAvailable: security.packageAudit.available,
        verifiedHistoryCount: security.history.verifiedCount,
      },
    },
    {
      id: "local-ga-closure",
      label: "v1.0 local GA closure",
      status: statusFromBlockers(localClosureBlockers),
      evidence: [
        path.relative(process.cwd(), localClosureEvidencePath),
        screenshotIntegrity.reportPath,
        "/api/admin/compatibility-usage/rehearsal/export?format=json",
      ],
      blockers: localClosureBlockers,
      metrics: {
        preSunsetStatus: deletionManifest.preSunsetStatus,
        preSunsetReadyRoutes: deletionManifest.totals.preSunsetReadyCount,
        screenshotFlows: screenshotIntegrity.metrics.flowCount,
        screenshotVerified: screenshotIntegrity.metrics.verifiedCount,
        screenshotManifestInSync: screenshotIntegrity.metrics.manifestInSync,
        routeSmokeChecks: routeSmoke.totals.checkCount,
        releaseSecurityStatus: security.status,
      },
    },
    {
      id: "production-control-plane",
      label: "Production control plane",
      status: statusFromBlockers(deploymentBlockers, { blocked: true }),
      evidence: ["/api/deployment"],
      blockers: deploymentBlockers,
      metrics: {
        completionPct: deployment.productionReadiness.completionPct,
        localCompletionPct: deployment.localReadiness.completionPct,
        cloudConfigured: deployment.controlPlane.cloud.configured,
      },
    },
  ]);
  const nonCloudSourceCount = sources.filter(
    (source) => source.id !== "production-control-plane",
  ).length;
  const nonCloudPassingCount = sources.filter(
    (source) => source.id !== "production-control-plane" && source.status === "pass",
  ).length;
  const productionPassingCount = sources.filter(
    (source) => source.status === "pass",
  ).length;
  const bundle: Omit<GaReleaseEvidenceBundle, "integrity"> = {
    schemaVersion: "experiments.ga-release-evidence-bundle.v1",
    generatedAt: new Date().toISOString(),
    version: "v1.0.0",
    scope: "ga-release",
    artifactPath: path.relative(process.cwd(), BUNDLE_PATH),
    persistedAt: persistedAt(),
    nonCloudReadiness: {
      status: statusFromBlockers(nonCloudBlockers),
      completionPct: clampPct((nonCloudPassingCount / Math.max(1, nonCloudSourceCount)) * 100),
      blockers: nonCloudBlockers,
    },
    productionReadiness: {
      status: statusFromBlockers(productionBlockers, {
        blocked: deploymentBlockers.length > 0,
      }),
      completionPct: clampPct((productionPassingCount / Math.max(1, sources.length)) * 100),
      blockers: productionBlockers,
    },
    sources,
    totals: {
      sourceCount: sources.length,
      passingSourceCount: productionPassingCount,
      blockerCount: productionBlockers.length,
      routeSmokeHistoryCount: routeSmoke.history.reportCount,
      providerSnapshotCount: providerSnapshots.totalCount,
      compatibilityDeleteReadyCount: deletionManifest.totals.deleteReadyCount,
    },
  };
  return {
    ...bundle,
    integrity: {
      algorithm: "sha256",
      digest: bundleDigest(bundle),
      stateDigest: bundleStateDigest(bundle),
      verified: true,
      sourceDigestCount: bundle.sources.length,
    },
  };
}

export function verifyGaReleaseEvidenceBundle(
  bundle: GaReleaseEvidenceBundle,
) {
  const { integrity, ...payload } = bundle;
  const expectedDigest = bundleDigest(payload);
  const invalidSourceIds = bundle.sources
    .filter((source) => {
      const { digest, ...sourcePayload } = source;
      return digest !== sha256(sourcePayload);
    })
    .map((source) => source.id);
  return {
    ok:
      integrity?.algorithm === "sha256" &&
      integrity.digest === expectedDigest &&
      invalidSourceIds.length === 0,
    expectedDigest,
    storedDigest: integrity?.digest || null,
    invalidSourceIds,
  };
}

export function readGaReleaseEvidenceBundleVerification(
  liveBundle = buildGaReleaseEvidenceBundle(),
): GaReleaseEvidenceBundleVerification {
  const persisted = existsSync(BUNDLE_PATH)
    ? readPersistedBundle(BUNDLE_PATH)
    : null;
  const persistedVerification = persisted?.integrity
    ? verifyGaReleaseEvidenceBundle(persisted)
    : null;
  const liveStateDigest = bundleStateDigest(liveBundle);
  const persistedStateDigest = persisted
    ? persisted.integrity?.stateDigest || bundleStateDigest(persisted)
    : null;
  const persistedSources = new Map(
    (persisted?.sources || []).map((source) => [source.id, source.digest]),
  );
  const changedSourceIds = liveBundle.sources
    .filter((source) => persistedSources.get(source.id) !== source.digest)
    .map((source) => source.id);
  for (const source of persisted?.sources || []) {
    if (!liveBundle.sources.some((liveSource) => liveSource.id === source.id)) {
      changedSourceIds.push(source.id);
    }
  }
  const status = !persisted
    ? "missing"
    : !persistedVerification?.ok
      ? "invalid"
      : persistedStateDigest === liveStateDigest
        ? "in-sync"
        : "drifted";
  return {
    generatedAt: new Date().toISOString(),
    status,
    persistedPath: path.relative(process.cwd(), BUNDLE_PATH),
    persistedGeneratedAt: persisted?.generatedAt || null,
    persistedDigest: persisted?.integrity?.digest || null,
    liveStateDigest,
    persistedStateDigest,
    changedSourceIds: Array.from(new Set(changedSourceIds)),
    persistedIntegrityOk: persistedVerification?.ok === true,
    invalidSourceIds: persistedVerification?.invalidSourceIds || [],
  };
}

function readPersistedBundle(filePath: string) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as GaReleaseEvidenceBundle;
  } catch {
    return null;
  }
}

export function readGaReleaseEvidenceBundleHistory(options?: {
  limit?: number;
}): GaReleaseEvidenceBundleHistory {
  const limit = Math.max(1, Math.min(options?.limit || 30, 200));
  const entries = existsSync(BUNDLE_HISTORY_DIR)
    ? readdirSync(BUNDLE_HISTORY_DIR)
        .filter((name) => name.startsWith("ga-release-evidence-") && name.endsWith(".json"))
        .map((name) => {
          const filePath = path.join(BUNDLE_HISTORY_DIR, name);
          const bundle = readPersistedBundle(filePath);
          const verification = bundle?.integrity
            ? verifyGaReleaseEvidenceBundle(bundle)
            : null;
          return {
            file: path.relative(process.cwd(), filePath),
            generatedAt: bundle?.generatedAt || null,
            nonCloudStatus: bundle?.nonCloudReadiness?.status || "unknown" as const,
            productionStatus: bundle?.productionReadiness?.status || "unknown" as const,
            integrityStatus: !bundle?.integrity
              ? "missing" as const
              : verification?.ok
                ? "verified" as const
                : "invalid" as const,
            digest: bundle?.integrity?.digest || null,
            sizeBytes: statSync(filePath).size,
          };
        })
        .sort((left, right) =>
          (right.generatedAt || "").localeCompare(left.generatedAt || ""),
        )
    : [];
  return {
    generatedAt: new Date().toISOString(),
    historyDir: path.relative(process.cwd(), BUNDLE_HISTORY_DIR),
    totalCount: entries.length,
    verifiedCount: entries.filter((entry) => entry.integrityStatus === "verified").length,
    invalidCount: entries.filter((entry) => entry.integrityStatus === "invalid").length,
    latestAt: entries[0]?.generatedAt || null,
    entries: entries.slice(0, limit),
  };
}

export function applyGaReleaseEvidenceBundleRetention(input?: {
  maxBundles?: number;
  maxAgeDays?: number;
}): GaReleaseEvidenceBundleRetentionResult {
  const policy = {
    maxBundles: Math.max(5, Math.min(input?.maxBundles || 50, 200)),
    maxAgeDays: Math.max(7, Math.min(input?.maxAgeDays || 180, 730)),
  };
  const history = readGaReleaseEvidenceBundleHistory({ limit: 200 });
  const cutoffMs = Date.now() - policy.maxAgeDays * 86_400_000;
  const retainedFiles = new Set(
    history.entries
      .filter((entry, index) => {
        if (index === 0) return true;
        const generatedMs = entry.generatedAt
          ? new Date(entry.generatedAt).getTime()
          : Number.NaN;
        return index < policy.maxBundles &&
          Number.isFinite(generatedMs) &&
          generatedMs >= cutoffMs;
      })
      .map((entry) => entry.file),
  );
  for (const entry of history.entries) {
    if (!retainedFiles.has(entry.file)) {
      unlinkSync(path.join(process.cwd(), entry.file));
    }
  }
  const after = readGaReleaseEvidenceBundleHistory({ limit: 200 });
  return {
    appliedAt: new Date().toISOString(),
    beforeCount: history.totalCount,
    afterCount: after.totalCount,
    removedCount: history.totalCount - after.totalCount,
    protectedLatest: history.totalCount > 0,
    policy,
  };
}

export function writeGaReleaseEvidenceBundle() {
  const bundle = buildGaReleaseEvidenceBundle();
  mkdirSync(BUNDLE_HISTORY_DIR, { recursive: true });
  const timestamp = bundle.generatedAt.replace(/[:.]/g, "-");
  const archivePath = path.join(
    BUNDLE_HISTORY_DIR,
    `ga-release-evidence-${timestamp}.json`,
  );
  const content = `${JSON.stringify(bundle, null, 2)}\n`;
  writeFileSync(BUNDLE_PATH, content, "utf8");
  writeFileSync(archivePath, content, "utf8");
  return {
    ok: true,
    bundle: {
      ...bundle,
      persistedAt: bundle.generatedAt,
    },
    archivePath: path.relative(process.cwd(), archivePath),
  };
}

export function serializeGaReleaseEvidenceBundleAsMarkdown(
  bundle = buildGaReleaseEvidenceBundle(),
) {
  return [
    "# GA Release Evidence Bundle",
    "",
    `Generated: ${bundle.generatedAt}`,
    `Version: ${bundle.version}`,
    `Integrity: ${bundle.integrity.verified ? "verified" : "invalid"}`,
    `SHA-256: ${bundle.integrity.digest}`,
    `Non-cloud: ${bundle.nonCloudReadiness.status} (${bundle.nonCloudReadiness.completionPct}%)`,
    `Production: ${bundle.productionReadiness.status} (${bundle.productionReadiness.completionPct}%)`,
    "",
    ...bundle.sources.flatMap((source) => [
      `## ${source.label}`,
      "",
      `- Status: ${source.status}`,
      `- SHA-256: ${source.digest}`,
      `- Blockers: ${source.blockers.length ? source.blockers.join("; ") : "none"}`,
      "",
    ]),
  ].join("\n");
}
