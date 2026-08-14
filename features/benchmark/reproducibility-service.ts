import { readLatestMath500RunAnalysis } from "@/features/benchmark/math500-run-analysis";
import {
  readLatestMath500Replay,
  runMath500EvaluatorReplay,
} from "@/features/benchmark/math500-replay-service";
import { buildMultimodalExecutionPlan } from "@/features/benchmark/multimodal-execution-readiness";
import {
  MATH500_REPRODUCIBILITY_SCHEMA_VERSION,
  type Math500ReplayReceipt,
  type Math500ReproducibilityReadModel,
} from "@/features/benchmark/reproducibility-contracts";

const globalReplay = globalThis as typeof globalThis & {
  __firstLlmMath500Replay?: Promise<Math500ReplayReceipt>;
};

export function readMath500Reproducibility(): Math500ReproducibilityReadModel {
  const analysis = readLatestMath500RunAnalysis();
  const replay = readLatestMath500Replay(analysis?.runId);
  const multimodalPlan = buildMultimodalExecutionPlan();
  const localStatus =
    analysis?.localStatus === "pass" && replay?.localStatus === "pass"
      ? ("pass" as const)
      : analysis
        ? ("hold" as const)
        : ("evidence-needed" as const);
  return {
    ok: true,
    schemaVersion: MATH500_REPRODUCIBILITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    replayActive: !!globalReplay.__firstLlmMath500Replay,
    analysis,
    replay,
    multimodalPlan,
    localStatus,
    productionStatus: "hold",
    blockers: [
      "The scorer replay runs on the same machine and does not replace independent-worker or external leaderboard reproduction.",
      "Official multimodal assets, compatible model execution, required judges, licensed media, and external submissions remain separate gates.",
    ],
  };
}

export async function replayLatestMath500Run() {
  if (globalReplay.__firstLlmMath500Replay) {
    return globalReplay.__firstLlmMath500Replay;
  }
  const analysis = readLatestMath500RunAnalysis();
  if (!analysis) throw new Error("No complete MATH-500 run is available for replay.");
  const replay = runMath500EvaluatorReplay(analysis.runId);
  globalReplay.__firstLlmMath500Replay = replay;
  try {
    return await replay;
  } finally {
    if (globalReplay.__firstLlmMath500Replay === replay) {
      globalReplay.__firstLlmMath500Replay = undefined;
    }
  }
}
