import { resolveTargetWithMode } from "@/lib/agent/providers";
import {
  prewarmTarget,
  releaseLocalBenchmarkRuntime,
  setLocalBenchmarkPrewarmState,
} from "@/features/benchmark/run-local-prewarm";
import type { AgentTarget } from "@/lib/agent/types";

export async function prepareLocalBenchmarkRuntime({
  runId,
  target,
}: {
  runId: string;
  target: AgentTarget;
}) {
  const benchmarkBaseUrl = resolveTargetWithMode(target.id, "standard").resolvedBaseUrl;
  setLocalBenchmarkPrewarmState(runId, {
    targetId: target.id,
    targetLabel: target.label,
    phase: "releasing-runtime",
    message: `Releasing local runtime before prewarming ${target.label}.`,
    loadingAlias: null,
    startedAt: new Date().toISOString(),
    elapsedMs: 0,
  });
  await releaseLocalBenchmarkRuntime(benchmarkBaseUrl);
  await prewarmTarget(target.id, runId);
  return { benchmarkBaseUrl };
}

export async function releasePreparedLocalBenchmarkRuntime({
  runId,
  benchmarkBaseUrl,
}: {
  runId: string;
  benchmarkBaseUrl: string;
}) {
  setLocalBenchmarkPrewarmState(runId, null);
  await releaseLocalBenchmarkRuntime(benchmarkBaseUrl);
}

export function clearLocalBenchmarkRuntimePrewarmState(runId: string) {
  setLocalBenchmarkPrewarmState(runId, null);
}
