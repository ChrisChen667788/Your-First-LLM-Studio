import { createHash } from "node:crypto";

export const FINETUNE_PAIRED_QUALITY_SCHEMA_VERSION =
  "finetune.paired-quality.v1" as const;

export type FineTunePairedQualityObservation = {
  sampleId: string;
  seed: number;
  baselineScore: number;
  adapterScore: number;
};

export type FineTunePairedQualityInput = {
  datasetId: string;
  datasetRevision: string;
  promptSetSha256: string;
  baseModelId: string;
  baseModelRevision: string;
  adapterId: string;
  checkpointSha256: string;
  evaluatorId: string;
  evaluatorVersion: string;
  seeds: number[];
  observations: FineTunePairedQualityObservation[];
  minimumImprovement?: number;
  confidenceLevel?: 0.95;
};

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[], average: number) {
  if (values.length < 2) return 0;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1),
  );
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function evaluateFineTunePairedQuality(input: FineTunePairedQualityInput) {
  const seeds = [...new Set(input.seeds.map((seed) => Math.round(seed)))].sort(
    (left, right) => left - right,
  );
  if (seeds.length < 3) {
    throw new Error("Paired quality requires at least three distinct seeds.");
  }
  if (!/^[a-f0-9]{64}$/i.test(input.promptSetSha256)) {
    throw new Error("Paired quality requires a frozen prompt-set SHA-256.");
  }
  if (!/^[a-f0-9]{64}$/i.test(input.checkpointSha256)) {
    throw new Error("Paired quality requires a checkpoint SHA-256.");
  }
  const observations = input.observations.filter(
    (entry) =>
      seeds.includes(Math.round(entry.seed)) &&
      Number.isFinite(entry.baselineScore) &&
      Number.isFinite(entry.adapterScore),
  );
  const missingSeeds = seeds.filter(
    (seed) => !observations.some((entry) => Math.round(entry.seed) === seed),
  );
  if (missingSeeds.length) {
    throw new Error(`Paired quality has no observations for seeds: ${missingSeeds.join(", ")}.`);
  }
  const sampleIds = [...new Set(observations.map((entry) => entry.sampleId))];
  if (!sampleIds.length) throw new Error("Paired quality has no scored samples.");

  const differences = observations.map(
    (entry) => entry.adapterScore - entry.baselineScore,
  );
  const averageDifference = mean(differences);
  const standardDeviation = sampleStandardDeviation(
    differences,
    averageDifference,
  );
  const standardError = standardDeviation / Math.sqrt(differences.length);
  const margin = 1.96 * standardError;
  const confidenceInterval95 = {
    lower: averageDifference - margin,
    upper: averageDifference + margin,
  };
  const minimumImprovement = input.minimumImprovement ?? 0;
  const decision =
    confidenceInterval95.lower >= minimumImprovement
      ? ("promote" as const)
      : confidenceInterval95.upper < minimumImprovement
        ? ("reject" as const)
        : ("hold" as const);
  const contract = {
    schemaVersion: FINETUNE_PAIRED_QUALITY_SCHEMA_VERSION,
    frozenInputs: {
      datasetId: input.datasetId,
      datasetRevision: input.datasetRevision,
      promptSetSha256: input.promptSetSha256,
      baseModelId: input.baseModelId,
      baseModelRevision: input.baseModelRevision,
      adapterId: input.adapterId,
      checkpointSha256: input.checkpointSha256,
      evaluatorId: input.evaluatorId,
      evaluatorVersion: input.evaluatorVersion,
      seeds,
    },
    coverage: {
      observations: observations.length,
      samples: sampleIds.length,
      seeds: seeds.length,
    },
    statistics: {
      baselineMean: mean(observations.map((entry) => entry.baselineScore)),
      adapterMean: mean(observations.map((entry) => entry.adapterScore)),
      pairedMeanDifference: averageDifference,
      standardDeviation,
      standardError,
      confidenceLevel: input.confidenceLevel || 0.95,
      confidenceInterval95,
      minimumImprovement,
    },
    decision,
  };
  return { ...contract, evidenceDigest: sha256(contract) };
}
