import { readArtifactLocalRegistry } from "@/features/artifacts/local-registry";
import { readDesktopOnboardingRelease } from "@/features/desktop/onboarding-release";
import { readHaFinOpsReadiness } from "@/features/deployment/ha-finops-readiness";
import { buildModelHubPromotionEvidence } from "@/features/models/model-hub-promotion-evidence";
import { buildLocalServerPromotionEvidence } from "@/features/models/local-server-promotion-evidence";
import { readTrainingCapabilityRegistry } from "@/features/finetune/training-capabilities";
import { readTrainingExecutionPlanCatalog } from "@/features/finetune/training-execution-plan";
import { readIdentityProvisioningReadiness } from "@/features/governance/identity-provisioning";
import { readPostgresRlsEvidence } from "@/features/governance/postgres-rls-evidence";
import { buildRuntimeFabricPromotionEvidence } from "@/features/runtime/runtime-fabric-promotion";
import { buildExtensionEcosystemPromotionEvidence } from "@/features/extensions/extension-ecosystem-promotion";
import { buildWorkflowStudioPromotionEvidence } from "@/features/workflows/studio-promotion";
import { readV14AcceptanceBatchEvidence } from "@/features/experiments/v14-acceptance-batch";
import { readV15AcceptanceBatchEvidence } from "@/features/experiments/v15-acceptance-batch";
import { readReleaseCandidateAcceptanceEvidence } from "@/features/evaluation/release-candidate-acceptance";

import { readPostV1AcceptanceEvidence } from "@/features/experiments/post-v1-acceptance";
import { readPostV1HardeningEvidence } from "@/features/experiments/post-v1-hardening";
import { readPostV1LifecycleEvidence } from "@/features/experiments/post-v1-lifecycle";
import { RELEASE_TRAIN_MILESTONES } from "@/features/experiments/release-train";

export const POST_V1_PROMOTION_GATE_SCHEMA_VERSION =
  "experiments.post-v1-promotion-gate.v1" as const;

export type PostV1PromotionStatus =
  | "complete"
  | "local-ready"
  | "in-progress"
  | "externally-blocked";

type EvidenceSlice = {
  id: string;
  version: string;
  label: string;
  status: "ready" | "partial" | "blocked";
  completionPct: number;
  summary: string;
  evidence: string[];
  blockers: string[];
  layer: "hardening" | "acceptance" | "lifecycle";
};

const POST_V1_VERSIONS = RELEASE_TRAIN_MILESTONES.filter((milestone) =>
  /^v1\.[1-5]\./.test(milestone.version),
);

const ROUTES: Record<string, string> = {
  "v1.1.0": "/experiments",
  "v1.1.1": "/models",
  "v1.2.0": "/models",
  "v1.2.1": "/models",
  "v1.3.0": "/experiments",
  "v1.3.1": "/workflows",
  "v1.4.0": "/experiments",
  "v1.4.1": "/fine-tune",
  "v1.5.0": "/release",
  "v1.5.1": "/experiments",
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sliceMatchesVersion(sliceVersion: string, version: string) {
  return sliceVersion.split("-").includes(version);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function readPostV1PromotionGate() {
  const hardening = readPostV1HardeningEvidence();
  const acceptance = readPostV1AcceptanceEvidence();
  const lifecycle = readPostV1LifecycleEvidence();
  const desktop = readDesktopOnboardingRelease();
  const postgresRls = readPostgresRlsEvidence();
  const identity = readIdentityProvisioningReadiness();
  const training = readTrainingCapabilityRegistry();
  const trainingPlans = readTrainingExecutionPlanCatalog();
  const artifacts = readArtifactLocalRegistry();
  const haFinOps = readHaFinOpsReadiness();
  const modelHub = buildModelHubPromotionEvidence();
  const localServer = buildLocalServerPromotionEvidence();
  const runtimeFabric = buildRuntimeFabricPromotionEvidence();
  const extensionEcosystem = buildExtensionEcosystemPromotionEvidence();
  const workflowStudio = buildWorkflowStudioPromotionEvidence();
  const v14Acceptance = readV14AcceptanceBatchEvidence();
  const v15Acceptance = readV15AcceptanceBatchEvidence();
  const releaseCandidate = readReleaseCandidateAcceptanceEvidence();

  const slices: EvidenceSlice[] = [
    ...hardening.slices.map((entry) => ({ ...entry, layer: "hardening" as const })),
    ...acceptance.slices.map((entry) => ({ ...entry, layer: "acceptance" as const })),
    ...lifecycle.slices.map((entry) => ({ ...entry, layer: "lifecycle" as const })),
  ];

  const foundationChecks: Record<string, { ready: boolean; summary: string; evidence: string[] }> = {
    "v1.1.0": {
      ready: desktop.localRcReady,
      summary: `Desktop onboarding is ${desktop.status}.`,
      evidence: ["/api/desktop/onboarding-release"],
    },
    "v1.1.1": {
      ready: true,
      summary: `Model Hub lifecycle contracts are executable; authenticated physical promotion evidence is ${modelHub.status}.`,
      evidence: ["/api/models/acquisitions", "/api/models/source-manifests", "/api/models/promotion-evidence"],
    },
    "v1.2.0": {
      ready: true,
      summary: `Real Local Server acceptance is ${localServer.localStatus}; production promotion remains ${localServer.productionStatus}.`,
      evidence: ["/api/models/server-instances", "/api/models/local-server-acceptance", "/api/models/local-server-promotion"],
    },
    "v1.2.1": {
      ready: runtimeFabric.localStatus === "pass",
      summary: `Runtime Fabric local acceptance is ${runtimeFabric.localStatus}; production promotion remains ${runtimeFabric.productionStatus}.`,
      evidence: [
        "/api/runtime/adapters",
        "/api/runtime/fabric-acceptance",
        "/api/runtime/fabric-promotion",
      ],
    },
    "v1.3.0": {
      ready: extensionEcosystem.localStatus === "pass",
      summary: `Extension ecosystem local acceptance is ${extensionEcosystem.localStatus}; production promotion remains ${extensionEcosystem.productionStatus}.`,
      evidence: [
        "/api/extensions",
        "/api/extensions/mcp-servers",
        "/api/extensions/acceptance",
        "/api/extensions/promotion",
      ],
    },
    "v1.3.1": {
      ready: workflowStudio.localStatus === "pass" && Boolean(v14Acceptance.latestPassing),
      summary: `Workflow Studio local acceptance is ${workflowStudio.localStatus}; distributed lease/fencing checks are ${v14Acceptance.latestPassing ? "passing" : "missing"}; production promotion remains ${workflowStudio.productionStatus}.`,
      evidence: [...workflowStudio.evidence, "/api/experiments/v14-acceptance"],
    },
    "v1.4.0": {
      ready: Boolean(postgresRls.latestPassing && v14Acceptance.latestPassing),
      summary: `Database tenant isolation is ${postgresRls.latestPassing ? "passing" : "missing"}; the five local enterprise identity checks are ${v14Acceptance.latestPassing ? "passing" : "missing"}; external identity remains separate.`,
      evidence: [
        "/api/governance",
        "/api/governance/workspaces/resources",
        "/api/governance/identity-events",
        "/api/experiments/v14-acceptance",
        "docs/release-evidence/v1.4.0-postgres-workspace-rls-2026-07-23.json",
        postgresRls.path,
      ],
    },
    "v1.4.1": {
      ready: Boolean(training.sampleCompatibility.supported && trainingPlans.sample.executable && v14Acceptance.latestPassing && releaseCandidate.latestPassing),
      summary: `${training.totals.implemented} backend can execute, ${training.totals.preview} backend has a fail-closed preview plan, and ${releaseCandidate.latestPassing?.workload.pairedSamples || 0} real paired release-candidate samples are bound to Quality CI.`,
      evidence: ["/api/finetune/training-capabilities", "/api/finetune/training-execution-plan", "/api/evaluation/regression-suite", "/api/evaluation/release-candidate", "/api/experiments/v14-acceptance"],
    },
    "v1.5.0": {
      ready: artifacts.totals.verified > 0 && Boolean(v15Acceptance.latestPassing && releaseCandidate.latestPassing),
      summary: `${artifacts.totals.verified}/${artifacts.totals.records} local package(s) are verified; the 15-slice trusted artifact train is ${v15Acceptance.latestPassing ? "passing" : "missing"}; the real adapter release candidate is ${releaseCandidate.latestPassing ? "passing" : "missing"}.`,
      evidence: ["/api/artifacts/packages", "/api/artifacts/registry", "/api/artifacts/registry-adapters", "/api/evaluation/release-candidate", "/api/experiments/v15-acceptance"],
    },
    "v1.5.1": {
      ready: haFinOps.localReadiness.blockers.length === 0 && Boolean(v15Acceptance.latestPassing && releaseCandidate.latestPassing),
      summary: `Local HA/FinOps readiness is ${haFinOps.localReadiness.blockers.length === 0 ? "pass" : "evidence-needed"}; the release-candidate control receipt has ${Object.values(releaseCandidate.latestPassing?.checks || {}).filter(Boolean).length} passing checks; cloud production readiness is ${haFinOps.productionReadiness.blockers.length === 0 ? "pass" : "blocked"}.`,
      evidence: ["/api/deployment", "/api/deployment/usage-settlement", "/api/deployment/durable-outbox", "/api/evaluation/release-candidate", "/api/experiments/v15-acceptance"],
    },
  };

  const productionBlockers: Record<string, string[]> = {
    "v1.1.0": desktop.gaBlockers,
    "v1.1.1": modelHub.status === "pass" ? [] : modelHub.blockers,
    "v1.2.0": [...localServer.localBlockers, ...localServer.productionBlockers],
    "v1.2.1": [
      ...runtimeFabric.localBlockers,
      ...runtimeFabric.productionBlockers,
    ],
    "v1.3.0": [
      ...extensionEcosystem.localBlockers,
      ...extensionEcosystem.productionBlockers,
    ],
    "v1.3.1": [...workflowStudio.localBlockers, ...workflowStudio.productionBlockers, ...v14Acceptance.domainProductionBlockers.workflow],
    "v1.4.0": [...identity.blockers, ...v14Acceptance.domainProductionBlockers.governance],
    "v1.4.1": training.totals.preview || training.totals.planned
      ? [`${training.totals.preview} training backend is preview-only and ${training.totals.planned} remains planned.`, ...v14Acceptance.domainProductionBlockers.evaluation]
      : v14Acceptance.domainProductionBlockers.evaluation,
    "v1.5.0": v15Acceptance.productionBlockers,
    "v1.5.1": unique([...haFinOps.blockers, ...v15Acceptance.productionBlockers]),
  };

  const externallyBlocked = new Set(["v1.1.0", "v1.1.1", "v1.3.1", "v1.4.0", "v1.4.1", "v1.5.1"]);
  const versions = POST_V1_VERSIONS.map((milestone) => {
    const versionSlices = slices.filter((entry) => sliceMatchesVersion(entry.version, milestone.version));
    const foundation = foundationChecks[milestone.version];
    const localBlockers = unique([
      ...(foundation?.ready ? [] : [foundation?.summary || "Foundation evidence is missing."]),
      ...versionSlices.filter((entry) => entry.status !== "ready").flatMap((entry) => entry.blockers),
    ]);
    const localReady = Boolean(foundation?.ready && versionSlices.length > 0 && versionSlices.every((entry) => entry.status === "ready"));
    const externalBlockers = unique(productionBlockers[milestone.version] || []);
    const productionReady = localReady && externalBlockers.length === 0;
    const localCompletionPct = clamp(
      ((foundation?.ready ? 100 : 40) + versionSlices.reduce((sum, entry) => sum + entry.completionPct, 0)) /
        Math.max(1, versionSlices.length + 1),
    );
    const status: PostV1PromotionStatus = productionReady
      ? "complete"
      : localReady && externallyBlocked.has(milestone.version)
        ? "externally-blocked"
        : localReady
          ? "local-ready"
          : "in-progress";
    const releaseCompletionPct = status === "complete" ? 100 : localReady ? Math.max(90, localCompletionPct) : localCompletionPct;
    return {
      version: milestone.version,
      label: milestone.label,
      track: milestone.track,
      targetWindow: milestone.targetWindow,
      status,
      localReady,
      productionReady,
      localCompletionPct,
      releaseCompletionPct,
      route: ROUTES[milestone.version] || "/experiments",
      summary: foundation?.summary || milestone.objective,
      layers: {
        hardening: versionSlices.filter((entry) => entry.layer === "hardening" && entry.status === "ready").length,
        acceptance: versionSlices.filter((entry) => entry.layer === "acceptance" && entry.status === "ready").length,
        lifecycle: versionSlices.filter((entry) => entry.layer === "lifecycle" && entry.status === "ready").length,
        total: versionSlices.length,
        ready: versionSlices.filter((entry) => entry.status === "ready").length,
      },
      localBlockers,
      externalBlockers,
      evidence: unique([...(foundation?.evidence || []), ...versionSlices.flatMap((entry) => entry.evidence)]),
      nextActions: productionReady ? ["Retain fresh release evidence and regression coverage."] : externalBlockers.length ? externalBlockers : localBlockers,
      slices: versionSlices.map((entry) => ({
        id: entry.id,
        layer: entry.layer,
        label: entry.label,
        status: entry.status,
        completionPct: entry.completionPct,
        summary: entry.summary,
      })),
    };
  });

  return {
    ok: true as const,
    schemaVersion: POST_V1_PROMOTION_GATE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    versions,
    totals: {
      versions: versions.length,
      complete: versions.filter((entry) => entry.status === "complete").length,
      localReady: versions.filter((entry) => entry.status === "local-ready").length,
      inProgress: versions.filter((entry) => entry.status === "in-progress").length,
      externallyBlocked: versions.filter((entry) => entry.status === "externally-blocked").length,
      locallyReadyVersions: versions.filter((entry) => entry.localReady).length,
      productionReadyVersions: versions.filter((entry) => entry.productionReady).length,
      averageLocalCompletionPct: clamp(versions.reduce((sum, entry) => sum + entry.localCompletionPct, 0) / versions.length),
      averageReleaseCompletionPct: clamp(versions.reduce((sum, entry) => sum + entry.releaseCompletionPct, 0) / versions.length),
    },
    evidenceLayers: {
      hardening: hardening.totals,
      acceptance: acceptance.totals,
      lifecycle: lifecycle.totals,
    },
  };
}
