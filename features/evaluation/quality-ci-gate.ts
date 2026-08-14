import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const QUALITY_CI_GATE_SCHEMA_VERSION =
  "evaluation.quality-ci-gate.v1" as const;

export type QualityCiGateInput = {
  baselineId: string;
  candidateId: string;
  manifest: {
    modelDigest: string;
    adapterDigest: string;
    datasetDigest: string;
    promptDigest: string;
    scorerVersion: string;
    judgeVersion: string;
  };
  runs: Array<{
    seed: number;
    baseline: number[];
    candidate: number[];
  }>;
  judgeCalibration: {
    reference: Array<0 | 1>;
    predicted: Array<0 | 1>;
    minimumAgreement: number;
  };
  minimumDelta: number;
  minimumSeeds?: number;
  minimumSamples?: number;
  expectedDecisionDigest: string;
};

export type QualityCiGateReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold" | "invalid";
  scope: "local-frozen-fixture" | "provided-evidence";
  baselineId: string;
  candidateId: string;
  decisionDigest: string;
  checks: {
    frozenManifestPinned: boolean;
    multiSeedCoverage: boolean;
    pairedConfidencePass: boolean;
    judgeCalibrated: boolean;
    ciDecisionReproducible: boolean;
  };
  statistics: {
    seeds: number;
    samples: number;
    pairedDelta: number;
    confidence95: { lower: number; upper: number };
    judgeAgreement: number;
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
const STORE_FILE = path.join(DATA_DIR, "evaluation-quality-ci-gates.json");

function mean(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function sampleDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1),
  );
}

function isDigest(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}

function normalizedDecisionInput(input: QualityCiGateInput) {
  return {
    baselineId: input.baselineId,
    candidateId: input.candidateId,
    manifest: input.manifest,
    minimumDelta: input.minimumDelta,
    minimumSeeds: input.minimumSeeds ?? 3,
    minimumSamples: input.minimumSamples ?? 30,
    runs: [...input.runs]
      .sort((left, right) => left.seed - right.seed)
      .map((run) => ({
        seed: run.seed,
        baseline: run.baseline,
        candidate: run.candidate,
      })),
    judgeCalibration: input.judgeCalibration,
  };
}

export function qualityCiDecisionDigest(
  input: Omit<QualityCiGateInput, "expectedDecisionDigest"> | QualityCiGateInput,
) {
  return createHash("sha256")
    .update(JSON.stringify(normalizedDecisionInput(input as QualityCiGateInput)))
    .digest("hex");
}

export function evaluateQualityCiGate(
  input: QualityCiGateInput,
  scope: QualityCiGateReceipt["scope"] = "provided-evidence",
) {
  const minimumSeeds = Math.max(2, input.minimumSeeds ?? 3);
  const minimumSamples = Math.max(10, input.minimumSamples ?? 30);
  const uniqueSeeds = new Set(
    input.runs.map((run) => run.seed).filter(Number.isInteger),
  );
  const pairedRunsValid = input.runs.every(
    (run) =>
      run.baseline.length > 0 &&
      run.baseline.length === run.candidate.length &&
      run.baseline.every(Number.isFinite) &&
      run.candidate.every(Number.isFinite),
  );
  const differences = input.runs.flatMap((run) =>
    run.candidate.map((candidate, index) => candidate - run.baseline[index]),
  );
  const pairedDelta = mean(differences);
  const standardError = differences.length
    ? sampleDeviation(differences) / Math.sqrt(differences.length)
    : 0;
  const confidence95 = {
    lower: pairedDelta - 1.96 * standardError,
    upper: pairedDelta + 1.96 * standardError,
  };
  const calibrationSamples = Math.min(
    input.judgeCalibration.reference.length,
    input.judgeCalibration.predicted.length,
  );
  const agreements = input.judgeCalibration.reference
    .slice(0, calibrationSamples)
    .filter(
      (expected, index) =>
        expected === input.judgeCalibration.predicted[index],
    ).length;
  const judgeAgreement = calibrationSamples ? agreements / calibrationSamples : 0;
  const decisionDigest = qualityCiDecisionDigest(input);
  const checks = {
    frozenManifestPinned:
      [
        input.manifest.modelDigest,
        input.manifest.adapterDigest,
        input.manifest.datasetDigest,
        input.manifest.promptDigest,
      ].every(isDigest) &&
      Boolean(input.manifest.scorerVersion && input.manifest.judgeVersion),
    multiSeedCoverage:
      uniqueSeeds.size >= minimumSeeds &&
      uniqueSeeds.size === input.runs.length &&
      pairedRunsValid,
    pairedConfidencePass:
      differences.length >= minimumSamples &&
      confidence95.lower >= input.minimumDelta,
    judgeCalibrated:
      calibrationSamples >= 20 &&
      input.judgeCalibration.reference.length ===
        input.judgeCalibration.predicted.length &&
      judgeAgreement >= input.judgeCalibration.minimumAgreement,
    ciDecisionReproducible:
      isDigest(input.expectedDecisionDigest) &&
      input.expectedDecisionDigest === decisionDigest,
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Quality CI check failed: ${check}.`);
  const invalid = !pairedRunsValid || !input.baselineId || !input.candidateId;
  const receipt: QualityCiGateReceipt = {
    id: `quality-ci-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: invalid ? "invalid" : blockers.length ? "hold" : "pass",
    scope,
    baselineId: input.baselineId,
    candidateId: input.candidateId,
    decisionDigest,
    checks,
    statistics: {
      seeds: uniqueSeeds.size,
      samples: differences.length,
      pairedDelta,
      confidence95,
      judgeAgreement,
    },
    blockers,
    productionBlockers: [
      "A frozen task baseline and immutable production dataset receipt are required.",
      "Blind multi-seed evaluation must be run against the release candidate worker.",
      "Judge calibration must use organization-approved human labels and a pinned remote or local judge artifact.",
    ],
  };
  prependDurableReceipt(
    STORE_FILE,
    QUALITY_CI_GATE_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function runQualityCiGateRehearsal() {
  const seeds = [17, 29, 43];
  const inputWithoutDigest: Omit<QualityCiGateInput, "expectedDecisionDigest"> = {
    baselineId: "qwen3-4b-frozen-baseline-v1",
    candidateId: "qwen3-4b-lora-candidate-v2",
    manifest: {
      modelDigest: digest("qwen3-4b-4bit"),
      adapterDigest: digest("qwen3-4b-lora-candidate-v2"),
      datasetDigest: digest("quality-ci-fixture-v1"),
      promptDigest: digest("quality-ci-prompts-v3"),
      scorerVersion: "first-llm-scorer@1.1.0",
      judgeVersion: "judge-calibration-fixture@1",
    },
    runs: seeds.map((seed, seedIndex) => ({
      seed,
      baseline: Array.from(
        { length: 12 },
        (_, index) => 0.7 + ((index + seedIndex) % 5) * 0.01,
      ),
      candidate: Array.from(
        { length: 12 },
        (_, index) =>
          0.755 + ((index + seedIndex) % 5) * 0.01 + (index % 2) * 0.005,
      ),
    })),
    judgeCalibration: {
      reference: [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1],
      predicted: [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1],
      minimumAgreement: 0.85,
    },
    minimumDelta: 0.04,
    minimumSeeds: 3,
    minimumSamples: 30,
  };
  return evaluateQualityCiGate(
    {
      ...inputWithoutDigest,
      expectedDecisionDigest: qualityCiDecisionDigest(inputWithoutDigest),
    },
    "local-frozen-fixture",
  );
}

export function readQualityCiGateEvidence() {
  const receipts = readDurableReceipts<QualityCiGateReceipt>(
    STORE_FILE,
    QUALITY_CI_GATE_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: QUALITY_CI_GATE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latestPassing: receipts.find((receipt) => receipt.status === "pass") || null,
    productionBlockers:
      receipts[0]?.productionBlockers || [
        "Quality CI acceptance has not been rehearsed locally.",
      ],
    path: STORE_FILE,
  };
}
