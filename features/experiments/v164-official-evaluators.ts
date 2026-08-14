import { createHash, randomUUID } from "node:crypto";

import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { readBenchmarkLogs } from "@/lib/agent/log-store";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import {
  evaluateMathEquivalence,
  inspectMathVerifyRuntime,
  MATH_VERIFY_SOURCE_REVISION,
} from "@/features/benchmark/math-evaluator-port";
import {
  MULTIMODAL_EVALUATOR_REVISIONS,
  runMultimodalEvaluatorConformance,
} from "@/features/benchmark/multimodal-official-evaluators";
import { readOfficialBenchmarkRun } from "@/features/benchmark/official-run-service";

export const V164_OFFICIAL_EVALUATORS_SCHEMA_VERSION =
  "experiments.v164-official-evaluators.v1" as const;
const STORE_SCHEMA_VERSION =
  "experiments.v164-official-evaluators-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v1.6.4-official-evaluators.json",
);

type EvaluatorSlice = {
  id: string;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type V164OfficialEvaluatorReceipt = {
  id: string;
  generatedAt: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: EvaluatorSlice[];
  totals: { slices: number; passed: number; held: number };
  revisions: {
    mathVerify: string;
    multimodal: typeof MULTIMODAL_EVALUATOR_REVISIONS;
  };
  evidenceDigest: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function runV164OfficialEvaluatorAcceptance() {
  const mathRuntime = inspectMathVerifyRuntime();
  const mathCases = mathRuntime.available
    ? await Promise.all([
        evaluateMathEquivalence(
          String.raw`\boxed{\frac{1}{2}}`,
          String.raw`The final answer is $\boxed{0.5}$.`,
        ),
        evaluateMathEquivalence(
          String.raw`\boxed{2}`,
          String.raw`The final answer is $\boxed{3}$.`,
        ),
        evaluateMathEquivalence(
          String.raw`\boxed{\{1,2,3\}}`,
          String.raw`Thus the result is $\boxed{\{3,2,1\}}$.`,
        ),
      ])
    : [];
  const multimodal = runMultimodalEvaluatorConformance();
  const slices: EvaluatorSlice[] = [
    {
      id: "math-verify-runtime",
      label: "Pinned Math-Verify runtime",
      status: mathRuntime.available ? "pass" : "hold",
      summary: mathRuntime.available
        ? `math-verify 0.9.0 is available at the isolated Python runtime.`
        : mathRuntime.error || "Pinned evaluator runtime is unavailable.",
    },
    {
      id: "math-equivalent-fraction",
      label: "Fraction equivalence",
      status: mathCases[0]?.passed === true ? "pass" : "hold",
      summary: "The MATH-500 metric accepts 1/2 and 0.5 as equivalent.",
    },
    {
      id: "math-negative-control",
      label: "Negative control",
      status: mathCases[1]?.passed === false ? "pass" : "hold",
      summary: "The evaluator rejects a deliberately incorrect final answer.",
    },
    {
      id: "math-set-equivalence",
      label: "Set equivalence",
      status: mathCases[2]?.passed === true ? "pass" : "hold",
      summary: "The evaluator compares finite sets independent of element order.",
    },
    ...multimodal.checks.map((check) => ({
      id: check.id,
      label: check.id.replaceAll("-", " "),
      status: check.passed ? ("pass" as const) : ("hold" as const),
      summary: check.passed
        ? "Pinned official protocol fixture passed."
        : "Protocol fixture did not match the pinned upstream behavior.",
    })),
  ];
  const passed = slices.filter((slice) => slice.status === "pass").length;
  const receiptWithoutDigest = {
    id: `v164-official-evaluators-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    localStatus: passed === slices.length ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    slices,
    totals: { slices: slices.length, passed, held: slices.length - passed },
    revisions: {
      mathVerify: MATH_VERIFY_SOURCE_REVISION,
      multimodal: MULTIMODAL_EVALUATOR_REVISIONS,
    },
  };
  const receipt: V164OfficialEvaluatorReceipt = {
    ...receiptWithoutDigest,
    evidenceDigest: digest(receiptWithoutDigest),
  };
  prependDurableReceipt(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
    receipt,
    30,
  );
  return receipt;
}

export function readV164OfficialEvaluatorEvidence() {
  const latest = readDurableReceipts<V164OfficialEvaluatorReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  )[0] || null;
  const runtime = inspectMathVerifyRuntime();
  const officialRun = readOfficialBenchmarkRun();
  const checkpointRun = readBenchmarkLogs({ limit: 1000 })
    .filter((entry) => entry.datasetId === "math-500-qualified")
    .reverse()
    .find((entry) =>
      entry.results.some((result) =>
        result.samples.some((sample) => sample.resumedFromCheckpoint === true),
      ),
    );
  const acceptanceSlices: EvaluatorSlice[] = [
    ...(latest?.slices || Array.from({ length: 13 }, (_, index) => ({
      id: `evaluator-check-${index + 1}`,
      label: `Evaluator check ${index + 1}`,
      status: "hold" as const,
      summary: "Evaluator conformance has not been run.",
    }))),
    {
      id: "sample-checkpoint-resume",
      label: "Sample checkpoint resume",
      status: checkpointRun ? "pass" : "hold",
      summary: checkpointRun
        ? `A repeated real run resumed a scored sample without model inference (${checkpointRun.runId}).`
        : "No real checkpoint-resume evidence exists yet.",
    },
    {
      id: "math-500-full-run",
      label: "MATH-500 full run",
      status: officialRun.latestEvidence?.complete ? "pass" : "hold",
      summary: officialRun.latestEvidence?.complete
        ? `${officialRun.latestEvidence.scoredSamples}/500 samples were scored by ${officialRun.latestEvidence.evaluatorId}.`
        : "A complete 500/500 scored run has not finished yet.",
    },
  ];
  const acceptancePassed = acceptanceSlices.filter(
    (slice) => slice.status === "pass",
  ).length;
  return {
    ok: true,
    schemaVersion: V164_OFFICIAL_EVALUATORS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus:
      acceptancePassed === acceptanceSlices.length
        ? ("pass" as const)
        : latest
          ? ("hold" as const)
          : ("evidence-needed" as const),
    conformanceStatus: latest?.localStatus || "evidence-needed",
    productionStatus: "hold" as const,
    latest,
    mathRuntime: runtime,
    officialRun,
    acceptance: {
      slices: acceptanceSlices,
      totals: {
        slices: acceptanceSlices.length,
        passed: acceptancePassed,
        held: acceptanceSlices.length - acceptancePassed,
      },
      checkpointRunId: checkpointRun?.runId || null,
    },
    protocols: [
      {
        id: "mmmu",
        label: "MMMU",
        adapterStatus: "pass",
        executionStatus: "hold",
        detail: "Official choice/open parsing and normalization are pinned. The upstream random-guess fallback is deliberately replaced with fail-closed unscorable output; full image assets and model execution remain required.",
      },
      {
        id: "mathvista",
        label: "MathVista",
        adapterStatus: "pass",
        executionStatus: "hold",
        detail: "Official normalizer is pinned; general free-form extraction still requires the configured judge pipeline.",
      },
      {
        id: "mmbench",
        label: "MMBench",
        adapterStatus: "pass",
        executionStatus: "hold",
        detail: "Circular all-pass scoring is pinned; ChatGPT fallback and official test submission remain external gates.",
      },
      {
        id: "video-mme-v2",
        label: "Video-MME v2",
        adapterStatus: "pass",
        executionStatus: "hold",
        detail: "A-H extraction and grouped nonlinear scoring are pinned; licensed videos and a compatible video runtime are not installed.",
      },
    ],
    productionBlockers: [
      "Full multimodal datasets and licensed media have not been executed on a compatible model.",
      "MathVista judge extraction, MMBench external submission, and independent reproduction remain external evidence gates.",
      "Production promotion remains HOLD even when local evaluator conformance and MATH-500 execution pass.",
    ],
    receiptPath: RECEIPT_PATH,
  };
}
