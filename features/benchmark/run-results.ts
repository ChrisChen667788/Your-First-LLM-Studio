import { percentile } from "@/lib/agent/metrics";
import { readBenchmarkLogs } from "@/lib/agent/log-store";
import type {
  AgentBenchmarkProfileBatchScope,
  AgentBenchmarkResult,
} from "@/lib/agent/types";
import {
  matchesBenchmarkWorkload,
  type BenchmarkWorkload,
} from "@/features/benchmark/run-plan";

export function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!filtered.length) return 0;
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(2));
}

export function averageNullable(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!filtered.length) return null;
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(2));
}

export function buildPercentiles(values: Array<number | null | undefined>) {
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
  };
}

export function computeComparisonsToLast(
  results: AgentBenchmarkResult[],
  contextWindow: number,
  workload: BenchmarkWorkload & { profileBatchScope?: AgentBenchmarkProfileBatchScope },
) {
  const previousLogs = readBenchmarkLogs({ limit: 500 });

  return results.map((result) => {
    const previousMatch = [...previousLogs]
      .reverse()
      .filter((entry) => matchesBenchmarkWorkload(entry, workload))
      .flatMap((entry) =>
        entry.results
          .filter((candidate) => candidate.targetId === result.targetId)
          .filter((candidate) => entry.contextWindow === contextWindow)
          .filter(
            (candidate) =>
              (candidate.providerProfile || entry.providerProfile || "default") ===
              (result.providerProfile || "default"),
          )
          .filter(
            (candidate) =>
              (candidate.thinkingMode || entry.thinkingMode || "standard") ===
              (result.thinkingMode || "standard"),
          )
          .map((candidate) => ({
            generatedAt: entry.generatedAt,
            result: candidate,
          })),
      )[0];

    const currentSuccessRate = result.runs > 0 ? Number(((result.okRuns / result.runs) * 100).toFixed(2)) : 0;
    const previousSuccessRate = previousMatch
      ? Number((((previousMatch.result.okRuns / Math.max(previousMatch.result.runs, 1)) || 0) * 100).toFixed(2))
      : null;

    return {
      targetId: result.targetId,
      targetLabel: result.targetLabel,
      providerProfile: result.providerProfile || "balanced",
      thinkingMode: result.thinkingMode || "standard",
      execution: result.execution,
      resolvedModel: result.resolvedModel,
      previousGeneratedAt: previousMatch?.generatedAt,
      previousSuccessRate,
      currentSuccessRate,
      deltaSuccessRate:
        previousSuccessRate === null ? null : Number((currentSuccessRate - previousSuccessRate).toFixed(2)),
      deltaFirstTokenLatencyMs: previousMatch
        ? Number((result.avgFirstTokenLatencyMs - previousMatch.result.avgFirstTokenLatencyMs).toFixed(2))
        : null,
      deltaLatencyMs: previousMatch
        ? Number((result.avgLatencyMs - previousMatch.result.avgLatencyMs).toFixed(2))
        : null,
      deltaTokenThroughputTps: previousMatch
        ? Number((result.avgTokenThroughputTps - previousMatch.result.avgTokenThroughputTps).toFixed(2))
        : null,
    };
  });
}
