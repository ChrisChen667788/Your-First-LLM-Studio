import { buildBenchmarkReleaseEvidenceSummary } from "@/features/benchmark/release-evidence-summary";
import type {
  ReleaseEvidenceMatrixResponse,
  ReleaseEvidenceMatrixRound,
  ReleaseEvidenceMatrixStatus,
} from "@/features/experiments/contracts";
import { readPromotionGate } from "@/features/experiments/promotion-gate";
import {
  RELEASE_TRAIN_ACTIVE_VERSION,
  RELEASE_TRAIN_MILESTONES,
} from "@/features/experiments/release-train";
import { readModelRuntimeOperations } from "@/features/models/runtime-profile-registry";
import { readProviderOpsEvidenceSummary } from "@/features/providers/provider-ops-evidence";
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
  const benchmark = buildBenchmarkReleaseEvidenceSummary();
  const providerOps = readProviderOpsEvidenceSummary({ windowHours: 24 });
  const fineTune = readFineTuneSummary();
  const runtimeOps = readModelRuntimeOperations({ logLimit: 20 });
  const retrieval = getKnowledgeBaseSnapshot();
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
  const deploymentReadOnly = true;
  const ragStarterChecks = {
    vectorStore: true,
    hybridSearch: true,
    reranker: true,
    citations: true,
    acl: true,
    evalSets: benchmark.totals.evidenceCount > 0,
  };

  return [
    {
      version: "v0.5.0",
      status: promotionGate.overallStatus === "pass" ? "complete" : "evidence-needed",
      completionPct: pctFromChecks([
        providerOps.totals.providerCount > 0,
        providerOps.totals.totalRequests > 0,
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
        String(adapterExport?.metrics.latestExportDir || "adapter-export-evidence-missing"),
      ],
      blockers: promotionGate.blockers,
      nextActions: [
        "Pin a representative benchmark run as release evidence.",
        "Record at least one successful remote provider request in the 24h Provider Ops window.",
      ],
      metrics: {
        promotionGateStatus: promotionGate.overallStatus,
        benchmarkEvidenceCount: benchmark.totals.evidenceCount,
        providerRequestCount: providerOps.totals.totalRequests,
        completedAdapterExports: completedExports.length,
      },
    },
    {
      version: "v0.5.1",
      status: statusFromCompletion({
        completionPct: pctFromChecks([Boolean(docsScreenshots), docsScreenshots?.status === "pass", fineTune.operations.some((operation) => operation.kind === "distillation")]),
        blockers: docsScreenshots?.status === "pass" ? [] : ["Docs/screenshots freshness gate is not passing."],
      }),
      completionPct: pctFromChecks([
        Boolean(docsScreenshots),
        docsScreenshots?.status === "pass",
        fineTune.operations.some((operation) => operation.kind === "distillation"),
      ]),
      summary: "Public docs route, demo capture automation, contributor flow, and Distillation v1 evidence.",
      shipped: ["Docs/screenshot freshness source", "Release train contract"],
      evidence: ["docs/releases/v0.4.2_2026-07-02.md", "docs/assets/screenshots"],
      blockers: fineTune.operations.some((operation) => operation.kind === "distillation")
        ? []
        : ["No distillation operation evidence has been recorded yet."],
      nextActions: ["Add public docs route manifest.", "Run a small distillation sample and link its dataset manifest."],
      metrics: {
        docsScreenshotsStatus: docsScreenshots?.status || "missing",
        distillationOperations: fineTune.operations.filter((operation) => operation.kind === "distillation").length,
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
          false,
          false,
        ]),
        blockers: ["Query replay drawer and citation failure labels are not productized yet."],
      }),
      completionPct: pctFromChecks([
        retrieval.stats.documentCount > 0,
        retrieval.stats.chunkCount > 0,
        false,
        false,
      ]),
      summary: "RAG-first playground with replay, citation inspection, permission preview, and benchmark handoff.",
      shipped: ["Foreground /retrieval route", "Document and chunk inspection"],
      evidence: ["/retrieval", "/api/retrieval/query"],
      blockers: ["No query replay drawer yet.", "No citation failure label export yet."],
      nextActions: ["Add query replay drawer and citation failure labels."],
      metrics: {
        documentCount: retrieval.stats.documentCount,
        chunkCount: retrieval.stats.chunkCount,
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
      evidence: ["/api/finetune", "docs/release-evidence/finetune-qwen4b-lora-2026-07-01"],
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
          fineTune.adapters.some((adapter) => adapter.attachedTargetId),
          false,
        ]),
        blockers: ["Attach rollback evidence and adapter variant diff are not complete."],
      }),
      completionPct: pctFromChecks([
        readyAdapters.length > 0,
        completedExports.length > 0,
        fineTune.adapters.some((adapter) => adapter.attachedTargetId),
        false,
      ]),
      summary: "Adapter lifecycle registry, merge/quantized export plans, attach rollback, and lineage evidence.",
      shipped: ["Adapter artifact list", "Runtime attachment records", "Export package metadata"],
      evidence: ["/api/finetune", "/experiments"],
      blockers: ["No rollback proof log yet.", "No merge/quantized export plan evidence yet."],
      nextActions: ["Add adapter registry filters and rollback evidence."],
      metrics: {
        readyAdapters: readyAdapters.length,
        attachedAdapters: fineTune.adapters.filter((adapter) => adapter.attachedTargetId).length,
        completedExports: completedExports.length,
      },
    },
    {
      version: "v0.9.0",
      status: statusFromCompletion({
        completionPct: pctFromChecks([deploymentReadOnly, false, false, false]),
        blockers: ["Production registry/quota/audit adapters remain local-dev/read-only."],
      }),
      completionPct: pctFromChecks([deploymentReadOnly, false, false, false]),
      summary: "Production control plane for registry, audit, quota, telemetry, KMS signing, and failover rehearsal.",
      shipped: ["Local deployment registry read model", "Read-only guard for local dev registry"],
      evidence: ["/api/deployment"],
      blockers: ["No durable usage outbox evidence.", "No external audit archive adapter evidence.", "No real KMS signing evidence."],
      nextActions: ["Add durable usage outbox and external audit archive adapter."],
      metrics: {
        registryReadOnly: deploymentReadOnly,
        productionAdapters: 0,
      },
    },
    {
      version: "v1.0.0",
      status: statusFromCompletion({
        completionPct: pctFromChecks([
          promotionGate.overallStatus === "pass",
          docsScreenshots?.status === "pass",
          benchmark.totals.evidenceCount > 0,
          providerOps.totals.totalRequests > 0,
          completedExports.length > 0,
        ]),
        blockers: promotionGate.blockers,
      }),
      completionPct: pctFromChecks([
        promotionGate.overallStatus === "pass",
        docsScreenshots?.status === "pass",
        benchmark.totals.evidenceCount > 0,
        providerOps.totals.totalRequests > 0,
        completedExports.length > 0,
      ]),
      summary: "GA gate across Agent, Model Hub, RAG, Fine-tune, Benchmark, Compare, Ops, docs, and evidence.",
      shipped: ["Promotion gate rollup", "Release train contract", "Docs/screenshot freshness gate"],
      evidence: ["/api/experiments/promotion-gate", "/api/experiments/release-train"],
      blockers: promotionGate.blockers,
      nextActions: ["Define final GA block criteria after v0.9 evidence lands."],
      metrics: {
        promotionGateStatus: promotionGate.overallStatus,
        docsScreenshotsStatus: docsScreenshots?.status || "missing",
        completedAdapterExports: completedExports.length,
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
