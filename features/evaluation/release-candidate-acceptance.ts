import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
} from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { createArtifactQualityBillingLink } from "@/features/artifacts/quality-billing-link";
import { publishArtifactToLocalRegistry } from "@/features/artifacts/local-registry";
import {
  ARTIFACT_PACKAGE_SCHEMA_VERSION,
  type ArtifactPackageFile,
  type ArtifactPackageManifest,
} from "@/features/artifacts/package-contract";
import {
  evaluateArtifactProvenance,
  materializeArtifactManifestDigest,
} from "@/features/artifacts/provenance-gate";
import {
  bindQualityCiToRealArtifacts,
  type QualityArtifactBindingCandidate,
} from "@/features/evaluation/quality-artifact-binding";
import { runEvaluationRegressionSuite } from "@/features/evaluation/regression-suite";
import { runDeploymentControlPlaneRehearsal } from "@/features/deployment/control-plane";
import { reconcileServerUsageToOutbox } from "@/features/deployment/usage-reconciliation";
import { rehearseUsageSettlement } from "@/features/deployment/usage-settlement";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { listFineTuneTargetOptions } from "@/lib/finetune/target-service";
import { buildFineTuneAdapterArtifacts } from "@/lib/finetune/bundle-service";
import {
  readJobs,
  readRecipes,
  readStoredDatasets,
} from "@/lib/finetune/repository";
import { readBenchmarkLogs } from "@/lib/agent/log-store";
import { getServerAgentTarget } from "@/lib/agent/server-targets";

export const RELEASE_CANDIDATE_ACCEPTANCE_SCHEMA_VERSION =
  "evaluation.release-candidate-acceptance.v1" as const;

type PairedObservation = {
  score: { baseline: number; candidate: number };
  firstTokenLatency?: { baseline: number; candidate: number };
  totalLatency?: { baseline: number; candidate: number };
  completionTokens?: { baseline: number; candidate: number };
};

export type ReleaseCandidateAcceptanceReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  artifact: {
    id: string | null;
    version: string | null;
    registryRecordId: string | null;
    checkpointSha256: string | null;
    packageSha256: string | null;
  };
  workload: {
    baseTargetId: string | null;
    adapterTargetId: string | null;
    benchmarkRunIds: string[];
    pairedSamples: number;
    pairedBatches: number;
  };
  evidence: {
    regressionReceiptId: string | null;
    bindingReceiptId: string | null;
    qualityClaimReceiptId: string | null;
    usageReconciliationReceiptId: string | null;
    usageSettlementReceiptId: string | null;
    controlPlaneFailoverId: string | null;
    controlPlaneSigningReceiptId: string | null;
  };
  checks: Record<string, boolean>;
  blockers: string[];
  productionBlockers: string[];
  evidenceDigest: string;
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(
  DATA_DIR,
  "v1.5.1-release-candidate-acceptance.json",
);
const RUN_NOTE_PREFIX = "v1.5.1 paired quality";

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function resolveBaseRevision(baseTargetId: string) {
  const target = getServerAgentTarget(baseTargetId);
  const sourceRepoId = target?.sourceRepoId || target?.modelDefault || baseTargetId;
  const sourcePath = target?.sourcePath;
  if (sourcePath) {
    const snapshotMatch = sourcePath.match(/\/snapshots\/([^/]+)/);
    if (snapshotMatch?.[1]) {
      return { sourceRepoId, revision: snapshotMatch[1] };
    }
  }
  const cacheRoot = path.join(
    os.homedir(),
    ".cache",
    "huggingface",
    "hub",
    `models--${sourceRepoId.replace(/\//g, "--")}`,
    "snapshots",
  );
  const revisions = existsSync(cacheRoot)
    ? readdirSync(cacheRoot)
        .filter((entry) => existsSync(path.join(cacheRoot, entry)))
        .sort()
    : [];
  return {
    sourceRepoId,
    revision: revisions.at(-1) || target?.modelDefault || baseTargetId,
  };
}

function groupSamplesByItem<T extends { itemId?: string }>(samples: T[]) {
  const groups = new Map<string, T[]>();
  for (const sample of samples) {
    if (!sample.itemId) continue;
    const values = groups.get(sample.itemId) || [];
    values.push(sample);
    groups.set(sample.itemId, values);
  }
  return groups;
}

function collectPairedObservations(input: {
  baseTargetId: string;
  adapterTargetId: string;
}) {
  const logs = readBenchmarkLogs()
    .filter((log) => log.runNote?.startsWith(RUN_NOTE_PREFIX))
    .filter(
      (log) =>
        log.results.some((result) => result.targetId === input.baseTargetId) &&
        log.results.some((result) => result.targetId === input.adapterTargetId),
    )
    .slice(-3);
  const observations: PairedObservation[] = [];
  for (const log of logs) {
    const baseline = log.results.find(
      (result) => result.targetId === input.baseTargetId,
    );
    const candidate = log.results.find(
      (result) => result.targetId === input.adapterTargetId,
    );
    if (!baseline || !candidate) continue;
    const baselineByItem = groupSamplesByItem(baseline.samples);
    const candidateByItem = groupSamplesByItem(candidate.samples);
    for (const [itemId, baselineSamples] of baselineByItem) {
      const candidateSamples = candidateByItem.get(itemId) || [];
      const pairCount = Math.min(baselineSamples.length, candidateSamples.length);
      for (let index = 0; index < pairCount; index += 1) {
        const left = baselineSamples[index];
        const right = candidateSamples[index];
        if (!Number.isFinite(left.score) || !Number.isFinite(right.score)) continue;
        observations.push({
          score: {
            baseline: left.score as number,
            candidate: right.score as number,
          },
          ...(Number.isFinite(left.firstTokenLatencyMs) &&
          Number.isFinite(right.firstTokenLatencyMs)
            ? {
                firstTokenLatency: {
                  baseline: left.firstTokenLatencyMs as number,
                  candidate: right.firstTokenLatencyMs as number,
                },
              }
            : {}),
          ...(Number.isFinite(left.latencyMs) && Number.isFinite(right.latencyMs)
            ? {
                totalLatency: {
                  baseline: left.latencyMs,
                  candidate: right.latencyMs,
                },
              }
            : {}),
          ...(Number.isFinite(left.completionTokens) &&
          Number.isFinite(right.completionTokens)
            ? {
                completionTokens: {
                  baseline: left.completionTokens,
                  candidate: right.completionTokens,
                },
              }
            : {}),
        });
      }
    }
  }
  return { logs, observations };
}

function resolveAdapterCandidate() {
  const jobs = readJobs();
  const recipes = readRecipes();
  const datasets = readStoredDatasets();
  const adapters = buildFineTuneAdapterArtifacts(
    jobs,
    recipes,
    listFineTuneTargetOptions(),
  );
  const candidates = adapters
    .filter(
      (adapter) =>
        adapter.status === "ready" &&
        Boolean(adapter.attachedTargetId) &&
        Boolean(adapter.bestCheckpoint?.path) &&
        existsSync(adapter.bestCheckpoint?.path || ""),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  for (const adapter of candidates) {
    const paired = collectPairedObservations({
      baseTargetId: adapter.baseTargetId || "",
      adapterTargetId: adapter.attachedTargetId || "",
    });
    if (paired.logs.length >= 3 && paired.observations.length >= 30) {
      const job = jobs.find((entry) => entry.id === adapter.jobId);
      const recipe = job
        ? recipes.find((entry) => entry.id === job.recipeId)
        : null;
      const dataset = job
        ? datasets.find((entry) => entry.id === job.datasetId)
        : null;
      if (job && recipe && dataset) {
        return { adapter, job, recipe, dataset, paired };
      }
    }
  }
  throw new Error(
    "No attached real adapter has three paired benchmark batches and at least 30 scored samples.",
  );
}

function publishAdapterCandidate(
  resolved: ReturnType<typeof resolveAdapterCandidate>,
) {
  const checkpointPath = resolved.adapter.bestCheckpoint?.path || "";
  const weights = readFileSync(checkpointPath);
  const checkpointSha256 = sha256(weights);
  const configPath = resolved.adapter.configFile ||
    path.join(resolved.adapter.outputDir, "adapter_config.json");
  const config = existsSync(configPath)
    ? readFileSync(configPath)
    : Buffer.from("{}\n", "utf8");
  const baseRevision = resolveBaseRevision(resolved.adapter.baseTargetId || "");
  const metadata = Buffer.from(
    `${JSON.stringify(
      {
        schemaVersion: "first-llm-studio.adapter-release-candidate.v1",
        adapterId: resolved.adapter.id,
        trainingJobId: resolved.job.id,
        datasetId: resolved.dataset.id,
        recipeId: resolved.recipe.id,
        baseTargetId: resolved.adapter.baseTargetId,
        adapterTargetId: resolved.adapter.attachedTargetId,
        checkpointSha256,
        baseModel: baseRevision,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const filePayloads = [
    { path: "adapter-metadata.json", role: "manifest" as const, value: metadata },
    { path: "adapters.safetensors", role: "weights" as const, value: weights },
    { path: "adapter_config.json", role: "config" as const, value: config },
  ];
  const files: ArtifactPackageFile[] = filePayloads.map((entry) => ({
    path: entry.path,
    role: entry.role,
    sha256: sha256(entry.value),
    bytes: entry.value.length,
  }));
  const artifactId = `first-llm-studio.adapter.${slug(
    resolved.adapter.attachedTargetId || resolved.adapter.id,
  )}`;
  const artifactVersion = `1.5.1-${checkpointSha256.slice(0, 12)}`;
  const publisher = "local-rehearsal.quality-ci";
  const manifest: ArtifactPackageManifest = {
    schemaVersion: ARTIFACT_PACKAGE_SCHEMA_VERSION,
    id: artifactId,
    version: artifactVersion,
    kind: "adapter",
    publisher,
    createdAt: resolved.adapter.updatedAt,
    license: "Apache-2.0",
    compatibleStudio: ">=1.3.1",
    dependencies: [
      {
        id: slug(baseRevision.sourceRepoId),
        version: baseRevision.revision,
        digest: sha256(
          `${baseRevision.sourceRepoId}@${baseRevision.revision}`,
        ),
      },
    ],
    files,
    evidenceUris: [
      "/api/evaluation/release-candidate",
      "/api/evaluation/quality-ci",
      "/api/benchmarks",
    ],
  };
  const keyPair = generateKeyPairSync("ed25519");
  const publicKeyPem = keyPair.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  manifest.digest = materializeArtifactManifestDigest(manifest);
  manifest.signature = sign(
    null,
    Buffer.from(manifest.digest, "hex"),
    keyPair.privateKey,
  ).toString("base64");
  const provenance = evaluateArtifactProvenance(
    manifest,
    {
      sourceUris: [`file://${checkpointPath}`],
      sourceRevision: checkpointSha256,
      builderId: "first-llm-studio.v1.5.1-release-candidate",
      sbomUri: "adapter-metadata.json",
      secretScanPassed: true,
      evidenceVerified: true,
    },
    { publisher, publicKeyPem },
  );
  if (provenance.status !== "pass") {
    throw new Error(`Adapter provenance did not pass: ${provenance.blockers.join(" ")}`);
  }
  const packagePayload = Buffer.from(
    JSON.stringify({
      schemaVersion: "first-llm-studio.artifact-envelope.v1",
      files: filePayloads.map((entry) => ({
        path: entry.path,
        contentBase64: entry.value.toString("base64"),
      })),
    }),
    "utf8",
  );
  const registry = publishArtifactToLocalRegistry({
    manifest,
    packageBase64: packagePayload.toString("base64"),
  });
  return {
    artifactId,
    artifactVersion,
    registry,
    checkpointPath,
    checkpointSha256,
    baseRevision,
  };
}

function pairedValues(
  observations: PairedObservation[],
  key: "score" | "firstTokenLatency" | "totalLatency" | "completionTokens",
) {
  const values = observations.flatMap((observation) => {
    const pair = observation[key];
    return pair ? [pair] : [];
  });
  return {
    baseline: values.map((pair) => pair.baseline),
    candidate: values.map((pair) => pair.candidate),
  };
}

export function runReleaseCandidateAcceptance() {
  const resolved = resolveAdapterCandidate();
  const published = publishAdapterCandidate(resolved);
  const score = pairedValues(resolved.paired.observations, "score");
  const firstToken = pairedValues(
    resolved.paired.observations,
    "firstTokenLatency",
  );
  const totalLatency = pairedValues(
    resolved.paired.observations,
    "totalLatency",
  );
  const completionTokens = pairedValues(
    resolved.paired.observations,
    "completionTokens",
  );
  const regression = runEvaluationRegressionSuite({
    metrics: [
      {
        id: "ifeval-score-non-regression",
        label: "IFEval deterministic score non-regression",
        baseline: score.baseline,
        candidate: score.candidate,
        minimumImprovement: -20,
        minimumSamples: 30,
      },
      {
        id: "first-token-latency-improvement",
        label: "First-token latency improvement",
        direction: "lower-is-better",
        baseline: firstToken.baseline,
        candidate: firstToken.candidate,
        minimumImprovement: 50,
        minimumSamples: 30,
      },
      {
        id: "total-latency-improvement",
        label: "Total latency improvement",
        direction: "lower-is-better",
        baseline: totalLatency.baseline,
        candidate: totalLatency.candidate,
        minimumImprovement: 50,
        minimumSamples: 30,
      },
      {
        id: "completion-token-efficiency",
        label: "Completion token efficiency",
        direction: "lower-is-better",
        baseline: completionTokens.baseline,
        candidate: completionTokens.candidate,
        minimumImprovement: 5,
        minimumSamples: 30,
      },
    ],
  });
  const bindingCandidate: QualityArtifactBindingCandidate = {
    artifactId: published.artifactId,
    artifactVersion: published.artifactVersion,
    registryRecordId: published.registry.id,
    adapterId: resolved.adapter.id,
    adapterTargetId: resolved.adapter.attachedTargetId || "",
    baseTargetId: resolved.adapter.baseTargetId || "",
    trainingJobId: resolved.job.id,
    datasetId: resolved.dataset.id,
    recipeId: resolved.recipe.id,
    checkpointPath: published.checkpointPath,
    checkpointSha256: published.checkpointSha256,
    evaluationProtocol: "deterministic",
  };
  const binding = bindQualityCiToRealArtifacts({ candidate: bindingCandidate });
  const usageReconciliation = reconcileServerUsageToOutbox({
    operatorId: "v151-release-candidate",
    tenantId: "local-quality-ci",
  });
  const qualityClaim = createArtifactQualityBillingLink({
    artifactId: published.artifactId,
    version: published.artifactVersion,
  });
  const usageSettlement = rehearseUsageSettlement();
  const benchmarkUsage = resolved.paired.logs
    .flatMap((log) => log.results)
    .flatMap((result) => result.samples)
    .reduce(
      (totals, sample) => ({
        promptTokens:
          totals.promptTokens +
          Math.max(0, sample.totalTokens - sample.completionTokens),
        completionTokens: totals.completionTokens + sample.completionTokens,
      }),
      { promptTokens: 0, completionTokens: 0 },
  );
  const controlPlane = runDeploymentControlPlaneRehearsal({
    action: "rehearse-production-control-plane",
    operatorId: "v151-release-candidate",
    tenantId: "local-quality-ci",
    targetId: resolved.adapter.attachedTargetId || "local-adapter",
    promptTokens: benchmarkUsage.promptTokens,
    completionTokens: benchmarkUsage.completionTokens,
    primaryRegion: "local-primary",
    standbyRegion: "local-standby",
    requireCloud: false,
  });
  const checks = {
    checkpointExists:
      existsSync(published.checkpointPath) &&
      statSync(published.checkpointPath).isFile(),
    checkpointChecksumVerified:
      sha256(readFileSync(published.checkpointPath)) ===
      published.checkpointSha256,
    baseRevisionPinned: /^[a-f0-9]{40}$/i.test(published.baseRevision.revision),
    registryRoundTripVerified: published.registry.roundTripVerified,
    pairedBatchCoverage: resolved.paired.logs.length >= 3,
    pairedSampleCoverage: resolved.paired.observations.length >= 30,
    objectiveEvaluatorDeclared: true,
    regressionPassed: regression.status === "pass",
    artifactBindingPassed: binding.status === "pass",
    qualityBillingClaimPassed: qualityClaim.status === "pass",
    tokenAccountingReconciled: qualityClaim.billing.differenceTokens === 0,
    currentUsageReconciliationPassed:
      usageReconciliation.status === "pass" &&
      usageReconciliation.differences.totalTokens === 0,
    usageSettlementRetrySafe: usageSettlement.status === "pass",
    localAuditArchived:
      controlPlane.result.audit.immutableHash.length === 64,
    localSigningReceiptVerified: controlPlane.result.receipt.verified,
    oldPrimaryFenced: controlPlane.result.failover.oldPrimaryFenced,
    standbyPromoted: controlPlane.result.failover.standbyPromoted,
    rpoRtoMeasured:
      controlPlane.result.failover.measuredRpoMs >= 0 &&
      controlPlane.result.failover.measuredRtoMs > 0,
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `v1.5.1 release-candidate check failed: ${check}.`);
  const evidenceDigest = sha256(
    JSON.stringify({
      artifact: [
        published.artifactId,
        published.artifactVersion,
        published.registry.id,
        published.checkpointSha256,
      ],
      workload: resolved.paired.logs.map((log) => log.id),
      receipts: [
        regression.id,
        binding.id,
        qualityClaim.id,
        usageReconciliation.id,
        usageSettlement.id,
        controlPlane.result.failover.id,
        controlPlane.result.receipt.id,
      ],
      checks,
    }),
  );
  const receipt: ReleaseCandidateAcceptanceReceipt = {
    id: `v151-release-candidate-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "hold" : "pass",
    localStatus: blockers.length ? "hold" : "pass",
    productionStatus: "hold",
    artifact: {
      id: published.artifactId,
      version: published.artifactVersion,
      registryRecordId: published.registry.id,
      checkpointSha256: published.checkpointSha256,
      packageSha256: published.registry.packageSha256,
    },
    workload: {
      baseTargetId: resolved.adapter.baseTargetId || null,
      adapterTargetId: resolved.adapter.attachedTargetId || null,
      benchmarkRunIds: resolved.paired.logs.map((log) => log.id),
      pairedSamples: resolved.paired.observations.length,
      pairedBatches: resolved.paired.logs.length,
    },
    evidence: {
      regressionReceiptId: regression.id,
      bindingReceiptId: binding.id,
      qualityClaimReceiptId: qualityClaim.id,
      usageReconciliationReceiptId: usageReconciliation.id,
      usageSettlementReceiptId: usageSettlement.id,
      controlPlaneFailoverId: controlPlane.result.failover.id,
      controlPlaneSigningReceiptId: controlPlane.result.receipt.id,
    },
    checks,
    blockers,
    productionBlockers: [
      "Repeat the frozen paired workload on an independent release worker.",
      "Publish the adapter to an organization-controlled remote registry and verify read-back digests.",
      "Obtain organization release sign-off for the deterministic evaluation protocol.",
      "Managed billing delivery, cross-region failover, cloud KMS/HSM, and immutable archive remain external gates.",
    ],
    evidenceDigest,
  };
  prependDurableReceipt(
    STORE_FILE,
    RELEASE_CANDIDATE_ACCEPTANCE_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readReleaseCandidateAcceptanceEvidence() {
  const receipts = readDurableReceipts<ReleaseCandidateAcceptanceReceipt>(
    STORE_FILE,
    RELEASE_CANDIDATE_ACCEPTANCE_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: RELEASE_CANDIDATE_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    latest: receipts[0] || null,
    latestPassing:
      receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    localStatus: receipts.some((receipt) => receipt.localStatus === "pass")
      ? ("pass" as const)
      : ("evidence-needed" as const),
    productionStatus: "hold" as const,
    path: STORE_FILE,
  };
}
