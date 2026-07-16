import { readArtifactLocalRegistry } from "@/features/artifacts/local-registry";
import { readArtifactRegistryAdapterCatalog } from "@/features/artifacts/registry-adapters";
import { readDesktopOnboardingRelease } from "@/features/desktop/onboarding-release";
import { readHaFinOpsReadiness } from "@/features/deployment/ha-finops-readiness";
import { readTrainingCapabilityRegistry } from "@/features/finetune/training-capabilities";
import { readTrainingExecutionPlanCatalog } from "@/features/finetune/training-execution-plan";
import { readIdentityProvisioningReadiness } from "@/features/governance/identity-provisioning";
import { readPostgresRlsEvidence } from "@/features/governance/postgres-rls-evidence";
import { readRuntimeAdapterConformance } from "@/features/runtime/adapter-conformance";
import { readOllamaConformanceEvidence } from "@/features/runtime/ollama-conformance";

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
  const adapters = readRuntimeAdapterConformance();
  const ollama = readOllamaConformanceEvidence();
  const postgresRls = readPostgresRlsEvidence();
  const identity = readIdentityProvisioningReadiness();
  const training = readTrainingCapabilityRegistry();
  const trainingPlans = readTrainingExecutionPlanCatalog();
  const artifacts = readArtifactLocalRegistry();
  const registryAdapters = readArtifactRegistryAdapterCatalog();
  const haFinOps = readHaFinOpsReadiness();

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
      summary: "Model acquisition, source manifest, migration, deduplication, removal, compatibility, and Benchmark handoff contracts are executable.",
      evidence: ["/api/models/acquisitions", "/api/models/source-manifests"],
    },
    "v1.2.0": {
      ready: true,
      summary: "Server registry, lifecycle, access, network, switch, idle-unload, logs, and request accounting contracts are executable.",
      evidence: ["/api/models/server-instances", "/api/models/server-instances/actions"],
    },
    "v1.2.1": {
      ready: Boolean(ollama.latestPassing && adapters.totals.conformant >= 2),
      summary: `${adapters.totals.conformant}/${adapters.totals.adapters} runtime descriptors satisfy the shared capability contract; live Ollama evidence is ${ollama.latestPassing ? "passing" : "missing"}.`,
      evidence: ["/api/runtime/adapters", "/api/runtime/ollama/conformance"],
    },
    "v1.3.0": {
      ready: true,
      summary: "Signed install, dependency, sandbox, secret scope, permission grant, rollback, and quarantine review contracts are executable.",
      evidence: ["/api/extensions", "/api/extensions/installations"],
    },
    "v1.3.1": {
      ready: true,
      summary: "Versioned graph, breakpoint, worker, replay, state diff, Retrieval deployment, and deploy access contracts are executable.",
      evidence: ["/workflows", "/api/workflows"],
    },
    "v1.4.0": {
      ready: Boolean(postgresRls.latestPassing),
      summary: `Database tenant isolation is ${postgresRls.latestPassing ? "passing" : "missing"}; external identity remains separate.`,
      evidence: ["/api/governance", postgresRls.path],
    },
    "v1.4.1": {
      ready: Boolean(training.sampleCompatibility.supported && trainingPlans.sample.executable),
      summary: `${training.totals.implemented} backend can execute and ${training.totals.preview} backend has a fail-closed preview plan; unsupported combinations cannot reach a worker.`,
      evidence: ["/api/finetune/training-capabilities", "/api/finetune/training-execution-plan", "/api/evaluation/regression-suite"],
    },
    "v1.5.0": {
      ready: artifacts.totals.verified > 0,
      summary: `${artifacts.totals.verified}/${artifacts.totals.records} local package(s) are verified; ${registryAdapters.totals.preview}/${registryAdapters.totals.targets} remote targets have non-mutating staging plans.`,
      evidence: ["/api/artifacts/packages", "/api/artifacts/registry", "/api/artifacts/registry-adapters"],
    },
    "v1.5.1": {
      ready: haFinOps.localReadiness.blockers.length === 0,
      summary: `Local HA/FinOps readiness is ${haFinOps.localReadiness.blockers.length === 0 ? "pass" : "evidence-needed"}; cloud production readiness is ${haFinOps.productionReadiness.blockers.length === 0 ? "pass" : "blocked"}.`,
      evidence: ["/api/deployment", "/api/deployment/usage-settlement"],
    },
  };

  const productionBlockers: Record<string, string[]> = {
    "v1.1.0": desktop.gaBlockers,
    "v1.1.1": ["A real authenticated Hub multi-file transfer and physical external-disk migration receipt are still required."],
    "v1.2.0": ["Live concurrent traffic, authenticated LAN access, and long-running idle eviction evidence are still required."],
    "v1.2.1": adapters.totals.planned
      ? [`${adapters.totals.planned} runtime adapter(s) remain planned and require backend-owned conformance evidence.`]
      : [],
    "v1.3.0": ["A real community registry package and OS-enforced sandbox acceptance receipt are still required."],
    "v1.3.1": [],
    "v1.4.0": identity.blockers,
    "v1.4.1": training.totals.preview || training.totals.planned
      ? [`${training.totals.preview} training backend is preview-only and ${training.totals.planned} remains planned.`]
      : [],
    "v1.5.0": ["GitHub, ModelScope, and Hugging Face staging publish/install round trips are still required."],
    "v1.5.1": haFinOps.blockers,
  };

  const externallyBlocked = new Set(["v1.1.0", "v1.4.0", "v1.5.1"]);
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
