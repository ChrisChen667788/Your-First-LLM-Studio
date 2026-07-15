import { buildBenchmarkReleaseEvidenceSummary } from "@/features/benchmark/release-evidence-summary";
import { readAdminCompatibilitySunsetEvidence } from "@/features/admin/compatibility-sunset";
import { readDeploymentControlPlane } from "@/features/deployment/control-plane";
import type {
  ReleaseEvidenceMatrixResponse,
  ReleaseEvidenceMatrixRound,
  ReleaseEvidenceMatrixStatus,
} from "@/features/experiments/contracts";
import { readPromotionGate } from "@/features/experiments/promotion-gate";
import { readPublicReleaseEvidence } from "@/features/experiments/public-release-evidence";
import { readRouteSmokeEvidence } from "@/features/experiments/route-smoke-evidence";
import {
  buildGaReleaseEvidenceBundle,
  readGaReleaseEvidenceBundleVerification,
} from "@/features/experiments/ga-release-evidence-bundle";
import { readReleaseSecurityEvidence } from "@/features/experiments/release-security-evidence";
import { readAdminCompatibilityDeletionSignoffs } from "@/features/admin/compatibility-deletion-signoff";
import { readAdminCompatibilityDeletionManifest } from "@/features/admin/compatibility-deletion-manifest";
import {
  RELEASE_TRAIN_ACTIVE_VERSION,
  RELEASE_TRAIN_MILESTONES,
} from "@/features/experiments/release-train";
import { readModelRuntimeOperations } from "@/features/models/runtime-profile-registry";
import { readProviderOpsEvidenceSummary } from "@/features/providers/provider-ops-evidence";
import { readLatestPinnedProviderOpsEvidenceSnapshot } from "@/features/providers/evidence-snapshot-store";
import { readRetrievalQueryReplaySummary } from "@/features/retrieval/query-replay-store";
import { getKnowledgeBaseSnapshot } from "@/lib/agent/retrieval-store";
import { readFineTuneSummary } from "@/lib/finetune/store";

const RELEASE_EVIDENCE_MATRIX_SCHEMA_VERSION =
  "experiments.release-evidence-matrix.v1" as const;

type RoundDraft = Pick<
  ReleaseEvidenceMatrixRound,
  "version" | "status" | "completionPct" | "summary" | "shipped" | "evidence" | "blockers" | "nextActions" | "metrics"
>;

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusFromCompletion(input: {
  completionPct: number;
  blockers?: string[];
  planned?: boolean;
}): ReleaseEvidenceMatrixStatus {
  if (input.planned && input.completionPct <= 0) return "planned";
  if (input.blockers?.length && input.completionPct < 35) return "blocked";
  if (input.blockers?.length) return "evidence-needed";
  if (input.completionPct >= 90) return "complete";
  if (input.completionPct > 0) return "in-progress";
  return "planned";
}

function pctFromChecks(checks: boolean[]) {
  if (!checks.length) return 0;
  return clampPct((checks.filter(Boolean).length / checks.length) * 100);
}

function buildRoundDrafts(): RoundDraft[] {
  const promotionGate = readPromotionGate();
  const publicRelease = readPublicReleaseEvidence();
  const routeSmoke = readRouteSmokeEvidence();
  const gaBundle = buildGaReleaseEvidenceBundle();
  const gaBundleVerification = readGaReleaseEvidenceBundleVerification(gaBundle);
  const compatibilitySunset = readAdminCompatibilitySunsetEvidence();
  const compatibilityDeletionManifest = readAdminCompatibilityDeletionManifest();
  const compatibilitySignoffs = readAdminCompatibilityDeletionSignoffs();
  const releaseSecurity = readReleaseSecurityEvidence();
  const benchmark = buildBenchmarkReleaseEvidenceSummary();
  const providerOps = readProviderOpsEvidenceSummary({ windowHours: 24 });
  const providerPinnedSnapshot = readLatestPinnedProviderOpsEvidenceSnapshot({
    maxAgeHours: 24,
  });
  const providerFreshEvidence =
    providerOps.totals.successCount > 0 ||
    providerOps.releaseProbe.successCount > 0 ||
    providerPinnedSnapshot.fresh;
  const deployment = readDeploymentControlPlane();
  const fineTune = readFineTuneSummary();
  const runtimeOps = readModelRuntimeOperations({ logLimit: 20 });
  const retrieval = getKnowledgeBaseSnapshot();
  const retrievalReplay = readRetrievalQueryReplaySummary({ limit: 20 });
  const adapterExport = promotionGate.sources.find((source) => source.id === "adapter-export");
  const docsScreenshots = promotionGate.sources.find((source) => source.id === "docs-screenshots");
  const modelHubTargets = runtimeOps.targetCards;
  const localActionTargetCount = modelHubTargets.filter((target) => target.serverActions.length > 0).length;
  const runtimeProfiles = runtimeOps.registry.profiles;
  const readyAdapters = fineTune.adapters.filter((adapter) => adapter.status === "ready");
  const completedExports = fineTune.operations.filter(
    (operation) => operation.kind === "export-adapter" && operation.status === "completed",
  );
  const completedFineTuneJobs = fineTune.jobs.filter((job) => job.status === "completed");
  const bestCheckpointCount = readyAdapters.filter((adapter) => adapter.bestCheckpoint).length;
  const lifecycle = fineTune.lifecycle;
  const lifecycleBlockers = [
    ...(lifecycle?.totals.rollbackProofs
      ? []
      : ["No rollback proof log yet."]),
    ...(lifecycle?.totals.variantDiffs
      ? []
      : ["No adapter variant diff evidence yet."]),
    ...(lifecycle?.totals.exportPlans
      ? []
      : ["No merge/quantized export plan evidence yet."]),
    ...(lifecycle?.totals.lifecycleActions
      ? []
      : ["No lifecycle registry action has been recorded yet."]),
  ];
  const gaBlockers = Array.from(
    new Set([
      ...promotionGate.blockers,
      ...routeSmoke.blockers,
      ...compatibilitySunset.blockers,
      ...deployment.productionReadiness.blockers,
      ...releaseSecurity.blockers,
      ...(gaBundle.persistedAt
        ? []
        : ["GA release evidence bundle has not been persisted yet."]),
      ...(gaBundleVerification.status === "in-sync"
        ? []
        : [`Persisted GA evidence bundle is ${gaBundleVerification.status}.`]),
    ]),
  );
  const gaNextActions = [
    ...(!routeSmoke.ok || docsScreenshots?.status !== "pass" || !publicRelease.demoCapture.ok
      ? ["Refresh route smoke and screenshot evidence before GA sign-off."]
      : []),
    ...(compatibilitySunset.totals.runtimeHitCount > 0
      ? ["Migrate source-tagged runtime callers still using deprecated Admin APIs."]
      : []),
    ...(compatibilitySunset.totals.legacyUnclassifiedHitCount > 0
      ? ["Archive and clear historical unclassified compatibility hits after confirming runtime callers are zero."]
      : []),
    ...(!providerFreshEvidence
      ? ["Run one successful remote Provider release probe inside the 24-hour evidence window."]
      : []),
    ...(compatibilitySunset.daysUntilSunset > 0
      ? ["Archive final zero-hit compatibility evidence after the 2026-09-30 sunset date."]
      : []),
    ...(deployment.productionReadiness.blockers.length
      ? ["Run the fail-closed cloud production rehearsal after workload identity, KMS, and immutable archive configuration are available."]
      : []),
  ];
  const ragStarterChecks = {
    vectorStore: true,
    hybridSearch: true,
    reranker: true,
    citations: true,
    acl: true,
    evalSets: benchmark.totals.evidenceCount > 0,
  };
  const v050NextActions = promotionGate.blockers.length
    ? [
        benchmark.totals.evidenceCount > 0
          ? "Keep representative benchmark evidence pinned."
          : "Pin a representative benchmark run as release evidence.",
        providerFreshEvidence
          ? "Keep a fresh successful remote provider request or release probe in the 24h Provider Ops window."
          : "Record at least one successful remote provider request or release probe in the 24h Provider Ops window.",
      ]
    : ["Promotion evidence is complete; draft the v0.5.0 release note and tag candidate."];

  return [
    {
      version: "v0.5.0",
      status: promotionGate.overallStatus === "pass" ? "complete" : "evidence-needed",
      completionPct: pctFromChecks([
        providerOps.totals.providerCount > 0,
        providerFreshEvidence,
        benchmark.totals.evidenceCount > 0,
        adapterExport?.status === "pass",
        docsScreenshots?.status === "pass",
      ]),
      summary: "Provider Ops, release evidence grouping, Adapter Export, and promotion gate closure.",
      shipped: [
        "Provider Ops evidence summary",
        "Benchmark release evidence summary",
        "Adapter Export package gate",
        "Docs/screenshots freshness gate",
      ],
      evidence: [
        "/api/experiments/promotion-gate",
        "/api/admin/provider-health/evidence",
        "/api/admin/benchmark/evidence",
        "docs/release-evidence/v0.5.0-v0.5.1-refresh-2026-07-07.md",
        String(adapterExport?.metrics.latestExportDir || "adapter-export-evidence-missing"),
      ],
      blockers: promotionGate.blockers,
      nextActions: v050NextActions,
      metrics: {
        promotionGateStatus: promotionGate.overallStatus,
        benchmarkEvidenceCount: benchmark.totals.evidenceCount,
        providerRequestCount: providerOps.totals.totalRequests,
        providerReleaseProbeCount: providerOps.releaseProbe.totalCount,
        providerSuccessfulReleaseProbeCount: providerOps.releaseProbe.successCount,
        providerPinnedSnapshotId: providerPinnedSnapshot.snapshot?.id || null,
        providerPinnedSnapshotFresh: providerPinnedSnapshot.fresh,
        providerPinnedSnapshotAgeHours: providerPinnedSnapshot.ageHours,
        completedAdapterExports: completedExports.length,
      },
    },
    {
      version: "v0.5.1",
      status: statusFromCompletion({
        completionPct: publicRelease.totals.completionPct,
        blockers: publicRelease.blockers,
      }),
      completionPct: publicRelease.totals.completionPct,
      summary: "Public docs route, demo capture automation, contributor flow, and Distillation v1 evidence.",
      shipped: [
        "Public release evidence contract",
        "Demo capture manifest",
        "Distillation operation evidence check",
      ],
      evidence: [
        "/release",
        "/api/experiments/public-release-evidence",
        publicRelease.demoCapture.manifestPath,
        "docs/release-evidence/v0.5.0-v0.5.1-refresh-2026-07-07.md",
        publicRelease.distillation.latestManifestPath || "distillation-operation-evidence-missing",
      ],
      blockers: publicRelease.blockers,
      nextActions: publicRelease.blockers.length
        ? ["Refresh demo screenshots with screenshots:release.", "Run a small distillation sample and link its dataset manifest."]
        : ["Promote public docs/demo capture to the v0.5.1 release note."],
      metrics: {
        docsScreenshotsStatus: docsScreenshots?.status || "missing",
        publicReleaseCompletionPct: publicRelease.totals.completionPct,
        publicReleaseBlockers: publicRelease.totals.blockerCount,
        verifiedDemoFlows: publicRelease.demoCapture.verifiedFlowCount,
        distillationOperations: publicRelease.distillation.completedOperationCount,
      },
    },
    {
      version: "v0.6.0",
      status: statusFromCompletion({
        completionPct: pctFromChecks([
          modelHubTargets.length > 0,
          localActionTargetCount > 0,
          runtimeOps.capabilities.includes("server-actions"),
          runtimeOps.capabilities.includes("openai-compatible-server"),
        ]),
      }),
      completionPct: pctFromChecks([
        modelHubTargets.length > 0,
        localActionTargetCount > 0,
        runtimeOps.capabilities.includes("server-actions"),
        runtimeOps.capabilities.includes("openai-compatible-server"),
      ]),
      summary: "Unified Model Hub with install, verification, runtime state, hardware fit, and server controls.",
      shipped: ["Runtime target cards", "Hot-switch/unload/restart/log descriptors", "Developer API endpoints on model cards"],
      evidence: ["/api/models/runtime-operations", "/models"],
      blockers: localActionTargetCount > 0 ? [] : ["No local model target exposes server actions."],
      nextActions: ["Move install verification actions into the same primary model card action row."],
      metrics: {
        targetCards: modelHubTargets.length,
        localActionTargetCount,
      },
    },
    {
      version: "v0.6.1",
      status: statusFromCompletion({
        completionPct: pctFromChecks([
          runtimeProfiles.length > 0,
          runtimeOps.capabilities.includes("runtime-profiles"),
          runtimeOps.capabilities.includes("developer-api"),
          runtimeOps.capabilities.includes("token-accounting"),
          runtimeOps.requestLogs.entries.length > 0,
        ]),
        blockers: runtimeOps.requestLogs.entries.length ? [] : ["No request log entries are available for profile/token evidence."],
      }),
      completionPct: pctFromChecks([
        runtimeProfiles.length > 0,
        runtimeOps.capabilities.includes("runtime-profiles"),
        runtimeOps.capabilities.includes("developer-api"),
        runtimeOps.capabilities.includes("token-accounting"),
        runtimeOps.requestLogs.entries.length > 0,
      ]),
      summary: "Durable runtime profiles, profile apply contract, Developer API, token and latency accounting.",
      shipped: ["Backend runtime profile registry", "Developer API guide", "Request log drawer"],
      evidence: ["/api/models/runtime-operations", "/api/models/runtime-profiles"],
      blockers: runtimeOps.requestLogs.entries.length ? [] : ["Run a real Agent request to populate request log evidence."],
      nextActions: ["Wire profile apply into Agent target selection and Compare lane recipes."],
      metrics: {
        runtimeProfiles: runtimeProfiles.length,
        requestLogEntries: runtimeOps.requestLogs.entries.length,
        totalTokens: runtimeOps.requestLogs.totalTokens,
      },
    },
    {
      version: "v0.7.0",
      status: statusFromCompletion({
        completionPct: pctFromChecks(Object.values(ragStarterChecks)),
        blockers: ragStarterChecks.evalSets ? [] : ["RAG eval set evidence is still missing."],
      }),
      completionPct: pctFromChecks(Object.values(ragStarterChecks)),
      summary: "Enterprise RAG Starter with vector adapter, hybrid recall, reranker, citations, ACL, and eval sets.",
      shipped: ["Retrieval vector index", "Hybrid rerank path", "Citation enforcement", "Enterprise starter contract"],
      evidence: ["/api/retrieval", "/api/retrieval/enterprise"],
      blockers: ragStarterChecks.evalSets ? [] : ["Add a RAG-specific eval set and report."],
      nextActions: ["Add database-level ACL migration tests and reranker eval evidence."],
      metrics: {
        documentCount: retrieval.stats.documentCount,
        chunkCount: retrieval.stats.chunkCount,
        ragEvalEvidence: ragStarterChecks.evalSets,
      },
    },
    {
      version: "v0.7.1",
      status: statusFromCompletion({
        completionPct: pctFromChecks([
          retrieval.stats.documentCount > 0,
          retrieval.stats.chunkCount > 0,
          retrievalReplay.totals.entryCount > 0,
          retrievalReplay.totals.diagnosticLabelCount > 0,
        ]),
        blockers: [
          ...(retrievalReplay.totals.entryCount > 0 ? [] : ["No retrieval query replay evidence has been recorded yet."]),
          ...(retrievalReplay.totals.diagnosticLabelCount > 0 ? [] : ["No citation diagnostic labels are available for retrieval replay."]),
        ],
      }),
      completionPct: pctFromChecks([
        retrieval.stats.documentCount > 0,
        retrieval.stats.chunkCount > 0,
        retrievalReplay.totals.entryCount > 0,
        retrievalReplay.totals.diagnosticLabelCount > 0,
      ]),
      summary: "RAG-first playground with replay, citation inspection, permission preview, and benchmark handoff.",
      shipped: ["Foreground /retrieval route", "Document and chunk inspection", "Query replay drawer", "Citation diagnostic labels"],
      evidence: [
        "/retrieval",
        "/api/retrieval/query",
        retrievalReplay.path,
        "docs/release-evidence/v0.7.1-rag-playground-2026-07-06.md",
      ],
      blockers: [
        ...(retrievalReplay.totals.entryCount > 0 ? [] : ["No retrieval query replay evidence has been recorded yet."]),
        ...(retrievalReplay.totals.diagnosticLabelCount > 0 ? [] : ["No citation diagnostic labels are available for retrieval replay."]),
      ],
      nextActions: retrievalReplay.totals.entryCount > 0
        ? ["Promote replay-to-benchmark handoff and permission preview evidence."]
        : ["Run a retrieval query to create replay and citation diagnostic evidence."],
      metrics: {
        documentCount: retrieval.stats.documentCount,
        chunkCount: retrieval.stats.chunkCount,
        replayEntries: retrievalReplay.totals.entryCount,
        diagnosticLabels: retrievalReplay.totals.diagnosticLabelCount,
        watchLabels: retrievalReplay.totals.watchLabelCount,
        failLabels: retrievalReplay.totals.failLabelCount,
      },
    },
    {
      version: "v0.8.0",
      status: statusFromCompletion({
        completionPct: pctFromChecks([
          fineTune.recipes.length > 0,
          completedFineTuneJobs.length > 0,
          readyAdapters.length > 0,
          bestCheckpointCount > 0,
          completedExports.length > 0,
        ]),
        blockers: bestCheckpointCount ? [] : ["Ready adapters do not yet expose best-checkpoint metadata."],
      }),
      completionPct: pctFromChecks([
        fineTune.recipes.length > 0,
        completedFineTuneJobs.length > 0,
        readyAdapters.length > 0,
        bestCheckpointCount > 0,
        completedExports.length > 0,
      ]),
      summary: "Professional LoRA loop from recipe contract to eval, best checkpoint, charts, export, and adapter attach.",
      shipped: ["Durable LoRA recipe contract", "Real LoRA evidence", "Adapter Export package"],
      evidence: [
        "/api/finetune",
        "docs/release-evidence/finetune-qwen4b-lora-2026-07-01",
        "docs/release-evidence/v0.8.0-finetune-best-checkpoints-2026-07-07.md",
      ],
      blockers: bestCheckpointCount ? [] : ["Backfill best-checkpoint markers for existing ready adapters."],
      nextActions: ["Promote Evaluate & Predict and Chat Adapter into dedicated foreground tabs."],
      metrics: {
        recipes: fineTune.recipes.length,
        completedJobs: completedFineTuneJobs.length,
        readyAdapters: readyAdapters.length,
        bestCheckpointAdapters: bestCheckpointCount,
        completedExports: completedExports.length,
      },
    },
    {
      version: "v0.8.1",
      status: statusFromCompletion({
        completionPct: pctFromChecks([
          readyAdapters.length > 0,
          completedExports.length > 0,
          Boolean(lifecycle?.totals.variantDiffs),
          Boolean(lifecycle?.totals.exportPlans),
          Boolean(lifecycle?.totals.rollbackProofs),
          Boolean(lifecycle?.totals.lifecycleActions),
        ]),
        blockers: lifecycleBlockers,
      }),
      completionPct: pctFromChecks([
        readyAdapters.length > 0,
        completedExports.length > 0,
        Boolean(lifecycle?.totals.variantDiffs),
        Boolean(lifecycle?.totals.exportPlans),
        Boolean(lifecycle?.totals.rollbackProofs),
        Boolean(lifecycle?.totals.lifecycleActions),
      ]),
      summary: "Adapter lifecycle registry, merge/quantized export plans, attach rollback, lineage evidence, and registry inspection UI.",
      shipped: [
        "Adapter artifact list",
        "Runtime attachment records",
        "Export package metadata",
        "Lifecycle registry read-model",
        "Lifecycle filters and variant detail drawer",
      ],
      evidence: [
        "/api/finetune",
        "/experiments",
        lifecycle?.registryPath || "adapter-lifecycle-registry-missing",
        "docs/release-evidence/v0.8.1-adapter-lifecycle-2026-07-07.md",
      ],
      blockers: lifecycleBlockers,
      nextActions: lifecycleBlockers.length
        ? ["Record an adapter export plan and run rollback proof from Fine-tune Assets."]
        : [],
      metrics: {
        readyAdapters: readyAdapters.length,
        attachedAdapters: fineTune.adapters.filter((adapter) => adapter.attachedTargetId).length,
        completedExports: completedExports.length,
        lifecycleVariants: lifecycle?.totals.variants || 0,
        variantDiffs: lifecycle?.totals.variantDiffs || 0,
        exportPlans: lifecycle?.totals.exportPlans || 0,
        rollbackProofs: lifecycle?.totals.rollbackProofs || 0,
        lifecycleActions: lifecycle?.totals.lifecycleActions || 0,
      },
    },
    {
      version: "v0.9.0",
      status: statusFromCompletion({
        completionPct: deployment.productionReadiness.completionPct,
        blockers: deployment.productionReadiness.blockers,
      }),
      completionPct: deployment.productionReadiness.completionPct,
      summary: "Production control plane for registry, audit, quota, telemetry, KMS signing, and failover rehearsal.",
      shipped: [
        "Local deployment registry read model",
        "Durable usage outbox",
        "AWS S3 Object Lock archive adapter",
        "AWS KMS Sign/Verify adapter",
        "Failover rehearsal read-model",
      ],
      evidence: [
        "/api/deployment",
        "docs/release-evidence/v0.9.0-production-control-plane-2026-07-08.md",
        "docs/release-evidence/v0.9.0-cloud-kms-object-lock-adapter-2026-07-08.md",
        ...deployment.evidence,
      ],
      blockers: deployment.productionReadiness.blockers,
      nextActions: deployment.productionReadiness.blockers.length
        ? [
            deployment.controlPlane.cloud.configured
              ? "Run /api/deployment action=rehearse-production-control-plane with requireCloud=true to generate cloud production-control evidence."
              : "Configure FIRST_LLM_AWS_KMS_KEY_ID and FIRST_LLM_AUDIT_S3_BUCKET with S3 Object Lock enabled, then run the cloud rehearsal.",
          ]
        : ["Cloud KMS/Object Lock evidence is complete; move to GA compatibility sunset and external audit retention evidence."],
      metrics: {
        registryReadOnly: deployment.controlPlane.registry.readOnly,
        cloudConfigured: deployment.controlPlane.cloud.configured,
        cloudProvider: deployment.controlPlane.cloud.provider,
        localReadinessPct: deployment.localReadiness.completionPct,
        productionReadinessPct: deployment.productionReadiness.completionPct,
        usageOutboxRecords: deployment.controlPlane.usageOutbox.records,
        auditArchiveEvents: deployment.controlPlane.auditArchive.archivedEvents,
        immutableArchiveEvents: deployment.controlPlane.auditArchive.immutableArchivedEvents,
        verifiedKmsReceipts: deployment.controlPlane.kmsSigning.verifiedReceipts,
        verifiedCloudKmsReceipts: deployment.controlPlane.kmsSigning.verifiedCloudReceipts,
        failoverRehearsals: deployment.controlPlane.failover.rehearsals,
        latestRpoMs: deployment.controlPlane.failover.latestRpoMs || 0,
        latestRtoMs: deployment.controlPlane.failover.latestRtoMs || 0,
        kmsSignerMode: deployment.controlPlane.kmsSigning.signerMode,
        archiveProvider: deployment.controlPlane.auditArchive.provider,
      },
    },
    {
      version: "v1.0.0",
      status: statusFromCompletion({
        completionPct: pctFromChecks([
          promotionGate.overallStatus === "pass",
          docsScreenshots?.status === "pass",
          publicRelease.demoCapture.ok,
          routeSmoke.ok,
          compatibilitySunset.totals.coveredSmokeRouteCount ===
            compatibilitySunset.totals.requiredSmokeRouteCount,
          compatibilitySunset.totals.runtimeHitCount === 0,
          compatibilitySunset.totals.legacyUnclassifiedHitCount === 0,
          benchmark.totals.evidenceCount > 0,
          providerFreshEvidence,
          completedExports.length > 0,
          Boolean(gaBundle.persistedAt),
          releaseSecurity.status === "pass",
          gaBundleVerification.status === "in-sync",
        ]),
        blockers: gaBlockers,
      }),
      completionPct: pctFromChecks([
        promotionGate.overallStatus === "pass",
        docsScreenshots?.status === "pass",
        publicRelease.demoCapture.ok,
        routeSmoke.ok,
        compatibilitySunset.totals.coveredSmokeRouteCount ===
          compatibilitySunset.totals.requiredSmokeRouteCount,
        compatibilitySunset.totals.runtimeHitCount === 0,
        compatibilitySunset.totals.legacyUnclassifiedHitCount === 0,
        benchmark.totals.evidenceCount > 0,
        providerFreshEvidence,
        completedExports.length > 0,
        Boolean(gaBundle.persistedAt),
        releaseSecurity.status === "pass",
        gaBundleVerification.status === "in-sync",
      ]),
      summary: "GA gate across Agent, Model Hub, RAG, Fine-tune, Benchmark, Compare, Ops, docs, and evidence.",
      shipped: [
        "Promotion gate rollup",
        "Release train contract",
        "Docs/screenshot freshness gate",
        "Nine-flow 2x DPR cross-surface demo capture",
        "Route smoke evidence artifact",
        "Admin compatibility sunset evidence",
        "Pre-sunset compatibility deletion rehearsal",
        "Feature-owned Agent state, Admin operations, Benchmark detail, and local runtime health boundaries",
      ],
      evidence: [
        "/api/experiments/promotion-gate",
        "/api/experiments/release-train",
        "/api/admin/compatibility-usage",
        "/api/experiments/ga-release-evidence",
        "/api/experiments/release-security-evidence",
        gaBundle.artifactPath,
        routeSmoke.reportPath,
      ],
      blockers: gaBlockers,
      nextActions: gaBlockers.length
        ? gaNextActions
        : ["GA evidence is ready for final release note and tag candidate."],
      metrics: {
        promotionGateStatus: promotionGate.overallStatus,
        docsScreenshotsStatus: docsScreenshots?.status || "missing",
        publicReleaseCompletionPct: publicRelease.totals.completionPct,
        routeSmokeStatus: routeSmoke.ok ? "pass" : "needs-refresh",
        routeSmokeChecks: routeSmoke.totals.checkCount,
        routeSmokeFailures: routeSmoke.totals.failureCount,
        routeSmokeHistoryCount: routeSmoke.history.reportCount,
        routeSmokeConsecutivePasses: routeSmoke.history.consecutivePassCount,
        compatibilityRuntimeHits: compatibilitySunset.totals.runtimeHitCount,
        compatibilityLegacyUnclassifiedHits:
          compatibilitySunset.totals.legacyUnclassifiedHitCount,
        compatibilityArchiveCount:
          compatibilitySunset.historicalArchives.archiveCount,
        compatibilityArchivedHistoricalHits:
          compatibilitySunset.historicalArchives.archivedLegacyUnclassifiedHits,
        compatibilitySmokeCoverage: `${compatibilitySunset.totals.coveredSmokeRouteCount}/${compatibilitySunset.totals.requiredSmokeRouteCount}`,
        compatibilityDeletionReadiness: compatibilitySunset.deletionReadiness,
        compatibilityPreSunsetStatus: compatibilityDeletionManifest.preSunsetStatus,
        compatibilityPreSunsetReadyRoutes:
          compatibilityDeletionManifest.totals.preSunsetReadyCount,
        completedAdapterExports: completedExports.length,
        gaNonCloudStatus: gaBundle.nonCloudReadiness.status,
        gaProductionStatus: gaBundle.productionReadiness.status,
        gaBundlePersisted: Boolean(gaBundle.persistedAt),
        gaBundleIntegrity: gaBundle.integrity.verified,
        gaBundlePersistedState: gaBundleVerification.status,
        gaBundleChangedSources: gaBundleVerification.changedSourceIds.length,
        releaseSecurityStatus: releaseSecurity.status,
        releaseSecurityIntegrity: releaseSecurity.integrity.status,
        releaseSecurityHistoryVerified: releaseSecurity.history.verifiedCount,
        secretScanFindings: releaseSecurity.secretScan.findingCount,
        productionAuditVulnerabilities:
          releaseSecurity.packageAudit.vulnerabilities.total,
        compatibilityCurrentSignoffs: compatibilitySignoffs.currentCount,
        routeSmokeIntegrity: routeSmoke.integrity.status,
        routeSmokeHistoryVerified: routeSmoke.history.verifiedCount,
      },
    },
  ];
}

export function readReleaseEvidenceMatrix(): ReleaseEvidenceMatrixResponse {
  const drafts = buildRoundDrafts();
  const byVersion = new Map(drafts.map((draft) => [draft.version, draft]));
  const rounds = RELEASE_TRAIN_MILESTONES.map((milestone) => {
    const draft = byVersion.get(milestone.version);
    return {
      version: milestone.version,
      label: milestone.label,
      track: milestone.track,
      targetWindow: milestone.targetWindow,
      status: draft?.status || "planned",
      completionPct: clampPct(draft?.completionPct || 0),
      summary: draft?.summary || milestone.objective,
      shipped: draft?.shipped || [],
      evidence: draft?.evidence || milestone.evidence,
      blockers: draft?.blockers || [],
      nextActions: draft?.nextActions || [milestone.nextSlice],
      metrics: draft?.metrics || {},
    } satisfies ReleaseEvidenceMatrixRound;
  });
  const totals = {
    roundCount: rounds.length,
    completeCount: rounds.filter((round) => round.status === "complete").length,
    inProgressCount: rounds.filter((round) => round.status === "in-progress").length,
    evidenceNeededCount: rounds.filter((round) => round.status === "evidence-needed").length,
    blockedCount: rounds.filter((round) => round.status === "blocked").length,
    plannedCount: rounds.filter((round) => round.status === "planned").length,
    averageCompletionPct: clampPct(
      rounds.reduce((sum, round) => sum + round.completionPct, 0) / Math.max(1, rounds.length),
    ),
  };
  return {
    ok: true,
    schemaVersion: RELEASE_EVIDENCE_MATRIX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    activeVersion: RELEASE_TRAIN_ACTIVE_VERSION,
    rounds,
    totals,
  };
}
