import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { readBenchmarkLogs } from "@/lib/agent/log-store";
import {
  readRecipes,
  readStoredDatasets,
  readStoredJobs,
} from "@/lib/finetune/repository";
import { readArtifactLocalRegistry } from "@/features/artifacts/local-registry";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const QUALITY_ARTIFACT_BINDING_SCHEMA_VERSION =
  "evaluation.quality-artifact-binding.v2" as const;

export type QualityArtifactBindingCandidate = {
  artifactId: string;
  artifactVersion: string;
  registryRecordId: string;
  adapterId: string;
  adapterTargetId: string;
  baseTargetId: string;
  trainingJobId: string;
  datasetId: string;
  recipeId: string;
  checkpointPath: string;
  checkpointSha256: string;
  evaluationProtocol: "deterministic" | "judge-calibrated";
};

type ReleaseManifest = {
  kind?: string;
  generatedAt?: string;
  jobId?: string;
  status?: string;
  baseModel?: string;
  dataset?: { id?: string; sampleCount?: number };
  recipe?: { adapterName?: string };
  qualityEvidence?: {
    promotionStatus?: string;
    taskQualityValidated?: boolean;
    externalBlindEval?: boolean;
    multiSeedValidated?: boolean;
    baselineComparable?: boolean;
    blockers?: string[];
  };
  publicArtifacts?: {
    runtimeArtifactsPublished?: boolean;
    excludedRuntimeArtifacts?: string[];
  };
  bestCheckpoint?: { path?: string; step?: number; metric?: string; value?: number };
  artifacts?: Record<string, string>;
};

export type QualityArtifactBindingReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  productionStatus: "hold";
  scope: "real-artifact-binding";
  selected: {
    trainingJobId: string | null;
    trainingManifestPath: string | null;
    artifactId: string | null;
    artifactVersion: string | null;
    registryRecordId: string | null;
    adapterId: string | null;
    adapterTargetId: string | null;
    baseTargetId: string | null;
    checkpointPath: string | null;
    baselineBenchmarkRunId: string | null;
    adapterBenchmarkRunIds: string[];
  };
  inventory: {
    benchmarkRuns: number;
    scoredBenchmarkRuns: number;
    fineTuneJobs: number;
    fineTuneDatasets: number;
    fineTuneRecipes: number;
    completedRuntimeJobs: number;
    completedReleaseManifests: number;
    matchedAdapterRuns: number;
    pairedScoredSamples: number;
    pairedSeeds: number;
  };
  digests: {
    trainingManifest: string | null;
    benchmarkRun: string | null;
    datasetRecord: string | null;
    recipeRecord: string | null;
    adapterArtifact: string | null;
    registryRecord: string | null;
  };
  checks: {
    runtimeRepositoriesRead: boolean;
    completedTrainingManifestFound: boolean;
    trainingManifestPinned: boolean;
    adapterArtifactPublished: boolean;
    scoredBaselineBenchmarkFound: boolean;
    adapterBenchmarkFound: boolean;
    pairedScoredSamplesSufficient: boolean;
    multiSeedCoverage: boolean;
    evaluationProtocolQualified: boolean;
  };
  blockers: string[];
  productionBlockers: string[];
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
const STORE_FILE = path.join(DATA_DIR, "evaluation-quality-artifact-binding-v2.json");

function digest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function digestJson(value: unknown) {
  return digest(JSON.stringify(value));
}

function releaseEvidenceRoot() {
  const configured = process.env.FIRST_LLM_RELEASE_EVIDENCE_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), "docs", "release-evidence");
}

function findReleaseManifests() {
  const root = releaseEvidenceRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || !entry.name.startsWith("finetune-")) return [];
    const manifestPath = path.join(root, entry.name, "run-manifest.json");
    if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) return [];
    try {
      const raw = readFileSync(manifestPath);
      const manifest = JSON.parse(raw.toString("utf8")) as ReleaseManifest;
      if (manifest.status !== "completed") return [];
      return [{ path: manifestPath, raw, manifest }];
    } catch {
      return [];
    }
  }).sort((left, right) =>
    String(right.manifest.generatedAt || "").localeCompare(
      String(left.manifest.generatedAt || ""),
    ),
  );
}

function readJsonArray<T>(filePath: string) {
  if (!existsSync(filePath)) return [] as T[];
  try {
    const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [] as T[];
  }
}

function readJsonLines<T>(filePath: string) {
  if (!existsSync(filePath)) return [] as T[];
  return readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

function readQualitySourceRepositories() {
  const sourceRoot = process.env.FIRST_LLM_QUALITY_SOURCE_DATA_DIR?.trim();
  if (!sourceRoot) {
    return {
      logs: readBenchmarkLogs(),
      jobs: readStoredJobs(),
      datasets: readStoredDatasets(),
      recipes: readRecipes(),
    };
  }
  return {
    logs: readJsonLines<ReturnType<typeof readBenchmarkLogs>[number]>(
      path.join(sourceRoot, "benchmark-history.jsonl"),
    ),
    jobs: readJsonArray<ReturnType<typeof readStoredJobs>[number]>(
      path.join(sourceRoot, "finetune", "jobs.json"),
    ),
    datasets: readJsonArray<ReturnType<typeof readStoredDatasets>[number]>(
      path.join(sourceRoot, "finetune", "datasets.json"),
    ),
    recipes: readJsonArray<ReturnType<typeof readRecipes>[number]>(
      path.join(sourceRoot, "finetune", "recipes.json"),
    ),
  };
}

function scoredSamples(result: { samples: Array<{ score?: number | null }> }) {
  return result.samples.filter((sample) => Number.isFinite(sample.score)).length;
}

function pairedAdapterEvidence(
  logs: ReturnType<typeof readBenchmarkLogs>,
  selector?: Pick<
    QualityArtifactBindingCandidate,
    "adapterTargetId" | "baseTargetId"
  >,
) {
  const adapterRuns = logs.filter((log) =>
    log.results.some((result) =>
      selector
        ? result.targetId === selector.adapterTargetId
        : result.targetId.startsWith("local-ft-"),
    ),
  );
  const groups = adapterRuns.flatMap((log) => {
    const adapterResult = log.results.find((result) =>
      selector
        ? result.targetId === selector.adapterTargetId
        : result.targetId.startsWith("local-ft-"),
    );
    const baseline = log.results.find((result) =>
      selector
        ? result.targetId === selector.baseTargetId
        : !result.targetId.startsWith("local-ft-") && result.execution === "local",
    );
    if (!adapterResult || !baseline) return [];
    const baselineByItem = new Map(
      baseline.samples
        .filter((sample) => sample.itemId && Number.isFinite(sample.score))
        .map((sample) => [sample.itemId as string, sample.score as number]),
    );
    const pairs = adapterResult.samples.flatMap((sample) => {
      if (!sample.itemId || !Number.isFinite(sample.score)) return [];
      const baselineScore = baselineByItem.get(sample.itemId);
      return Number.isFinite(baselineScore)
        ? [{ baseline: baselineScore as number, candidate: sample.score as number }]
        : [];
    });
    return pairs.length ? [{ id: log.id, pairs }] : [];
  });
  return { adapterRuns, groups };
}

export function bindQualityCiToRealArtifacts(input?: {
  candidate?: QualityArtifactBindingCandidate;
}) {
  const candidate = input?.candidate;
  const source = readQualitySourceRepositories();
  const { logs, jobs, datasets, recipes } = source;
  const releaseManifests = findReleaseManifests();
  const selectedManifest = releaseManifests[0] || null;
  const scoredLogs = logs.filter((log) =>
    log.results.some((result) => scoredSamples(result) > 0),
  );
  const paired = pairedAdapterEvidence(logs, candidate);
  const pairedRunIds = new Set(paired.groups.map((group) => group.id));
  const baselineLog = candidate
    ? logs.find((log) => pairedRunIds.has(log.id)) || null
    : scoredLogs.at(-1) || null;
  const pairedScoredSamples = paired.groups.reduce(
    (sum, group) => sum + group.pairs.length,
    0,
  );
  const selectedDataset = candidate
    ? datasets.find((dataset) => dataset.id === candidate.datasetId) || null
    : selectedManifest
      ? datasets.find((dataset) => dataset.id === selectedManifest.manifest.dataset?.id) || null
      : null;
  const selectedRecipe = candidate
    ? recipes.find((recipe) => recipe.id === candidate.recipeId) || null
    : selectedManifest
      ? recipes.find((recipe) =>
        recipe.adapterName === selectedManifest.manifest.recipe?.adapterName,
      ) ||
      recipes.find((recipe) =>
        recipe.datasetId === selectedManifest.manifest.dataset?.id,
      ) ||
      null
      : null;
  const selectedJob = candidate
    ? jobs.find((job) => job.id === candidate.trainingJobId) || null
    : null;
  const registryRecord = candidate
    ? readArtifactLocalRegistry().records.find(
        (record) =>
          record.id === candidate.registryRecordId &&
          record.artifactId === candidate.artifactId &&
          record.version === candidate.artifactVersion &&
          record.roundTripVerified,
      ) || null
    : null;
  const adapterArtifactPublished = candidate
    ? Boolean(registryRecord)
    : Boolean(selectedManifest?.manifest.publicArtifacts?.runtimeArtifactsPublished);
  const trainingBindingDigest = candidate
    ? digestJson({
        job: selectedJob,
        dataset: selectedDataset,
        recipe: selectedRecipe,
        checkpointSha256: candidate.checkpointSha256,
      })
    : selectedManifest
      ? digest(selectedManifest.raw)
      : null;
  const checks = {
    runtimeRepositoriesRead: logs.length > 0 && datasets.length > 0 && recipes.length > 0,
    completedTrainingManifestFound: candidate
      ? Boolean(selectedJob && selectedDataset && selectedRecipe)
      : Boolean(selectedManifest),
    trainingManifestPinned: Boolean(trainingBindingDigest),
    adapterArtifactPublished,
    scoredBaselineBenchmarkFound: Boolean(baselineLog),
    adapterBenchmarkFound: paired.adapterRuns.length > 0,
    pairedScoredSamplesSufficient: pairedScoredSamples >= 30,
    multiSeedCoverage: paired.groups.length >= 3,
    evaluationProtocolQualified:
      candidate?.evaluationProtocol === "deterministic" ||
      candidate?.evaluationProtocol === "judge-calibrated",
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Real artifact Quality CI check failed: ${check}.`);
  const receipt: QualityArtifactBindingReceipt = {
    id: `quality-artifact-binding-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "hold" : "pass",
    productionStatus: "hold",
    scope: "real-artifact-binding",
    selected: {
      trainingJobId:
        candidate?.trainingJobId || selectedManifest?.manifest.jobId || null,
      trainingManifestPath:
        candidate?.checkpointPath || selectedManifest?.path || null,
      artifactId: candidate?.artifactId || null,
      artifactVersion: candidate?.artifactVersion || null,
      registryRecordId: registryRecord?.id || null,
      adapterId: candidate?.adapterId || null,
      adapterTargetId: candidate?.adapterTargetId || null,
      baseTargetId: candidate?.baseTargetId || null,
      checkpointPath: candidate?.checkpointPath || null,
      baselineBenchmarkRunId: baselineLog?.id || null,
      adapterBenchmarkRunIds: paired.adapterRuns.map((log) => log.id),
    },
    inventory: {
      benchmarkRuns: logs.length,
      scoredBenchmarkRuns: scoredLogs.length,
      fineTuneJobs: jobs.length,
      fineTuneDatasets: datasets.length,
      fineTuneRecipes: recipes.length,
      completedRuntimeJobs: jobs.filter((job) => job.status === "completed").length,
      completedReleaseManifests: releaseManifests.length,
      matchedAdapterRuns: paired.adapterRuns.length,
      pairedScoredSamples,
      pairedSeeds: paired.groups.length,
    },
    digests: {
      trainingManifest: trainingBindingDigest,
      benchmarkRun: baselineLog ? digestJson(baselineLog) : null,
      datasetRecord: selectedDataset
        ? digestJson(selectedDataset)
        : selectedManifest?.manifest.dataset
          ? digestJson(selectedManifest.manifest.dataset)
          : null,
      recipeRecord: selectedRecipe
        ? digestJson(selectedRecipe)
        : selectedManifest?.manifest.recipe
          ? digestJson(selectedManifest.manifest.recipe)
          : null,
      adapterArtifact: candidate?.checkpointSha256 ||
        (adapterArtifactPublished && selectedManifest
          ? digestJson(selectedManifest.manifest.bestCheckpoint || selectedManifest.manifest.artifacts)
          : null),
      registryRecord: registryRecord ? digestJson(registryRecord) : null,
    },
    checks,
    blockers,
    productionBlockers: [
      "Promote the locally verified adapter package to an independently controlled remote registry.",
      "Repeat the paired release-candidate workload with frozen blind seeds on an independent worker.",
      candidate?.evaluationProtocol === "deterministic"
        ? "The deterministic evaluator needs organization release sign-off; no subjective judge is used for this claim."
        : "Attach organization-approved human judge calibration and a release-candidate worker receipt.",
    ],
  };
  prependDurableReceipt(
    STORE_FILE,
    QUALITY_ARTIFACT_BINDING_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readQualityArtifactBindingEvidence() {
  const receipts = readDurableReceipts<QualityArtifactBindingReceipt>(
    STORE_FILE,
    QUALITY_ARTIFACT_BINDING_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: QUALITY_ARTIFACT_BINDING_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    latest: receipts[0] || null,
    latestPassing: receipts.find((receipt) => receipt.status === "pass") || null,
    receipts,
    productionStatus: "hold" as const,
    productionBlockers: receipts[0]?.productionBlockers || [
      "Real Benchmark and Fine-tune artifacts have not been bound to Quality CI.",
    ],
    path: STORE_FILE,
  };
}
