import {
  average,
  averageNullable,
  buildPercentiles,
} from "@/features/benchmark/run-results";
import type { PlannedSampleTask } from "@/features/benchmark/run-plan";
import type {
  AgentBenchmarkResult,
  AgentBenchmarkSample,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
  ResolvedTarget,
} from "@/lib/agent/types";

export function createSkippedBenchmarkSample(
  task: PlannedSampleTask,
  warning: string,
): AgentBenchmarkSample {
  return {
    run: task.sampleRun,
    workloadId: task.workloadId,
    workloadLabel: task.workloadLabel,
    itemId: task.itemId,
    expectedAnswerPreview: task.expectedAnswerPreview,
    firstTokenLatencyMs: null,
    latencyMs: 0,
    completionTokens: 0,
    totalTokens: 0,
    tokenThroughputTps: null,
    outputPreview: "",
    ok: false,
    warning,
  };
}

export function buildBenchmarkResultFromSamples(input: {
  target: AgentTarget;
  resolvedTarget: ResolvedTarget;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  samples: AgentBenchmarkSample[];
}): AgentBenchmarkResult {
  const okSamples = input.samples.filter((sample) => sample.ok);
  const scoredSamples = input.samples.filter((sample) => typeof sample.score === "number");
  const passSamples = input.samples.filter((sample) => typeof sample.passed === "boolean");
  const skippedSamples = input.samples.filter((sample) =>
    !sample.ok &&
    sample.latencyMs === 0 &&
    (sample.warning || "").toLowerCase().includes("skipped")
  );
  const firstSkipWarning = skippedSamples.find((sample) => sample.warning)?.warning || null;

  return {
    targetId: input.target.id,
    targetLabel: input.target.label,
    providerLabel: input.target.providerLabel,
    execution: input.target.execution,
    resolvedModel: input.resolvedTarget.resolvedModel,
    contextWindow: input.contextWindow,
    providerProfile: input.providerProfile,
    thinkingMode: input.thinkingMode,
    runs: input.samples.length,
    okRuns: okSamples.length,
    skippedRuns: skippedSamples.length,
    skipSummary: firstSkipWarning,
    avgFirstTokenLatencyMs: average(okSamples.map((sample) => sample.firstTokenLatencyMs)),
    avgLatencyMs: average(okSamples.map((sample) => sample.latencyMs)),
    avgTokenThroughputTps: average(okSamples.map((sample) => sample.tokenThroughputTps)),
    avgScore: averageNullable(scoredSamples.map((sample) => sample.score)),
    passRate: passSamples.length
      ? Number(((passSamples.filter((sample) => sample.passed).length / passSamples.length) * 100).toFixed(2))
      : null,
    scoredSamples: scoredSamples.length,
    firstTokenLatencyPercentiles: buildPercentiles(okSamples.map((sample) => sample.firstTokenLatencyMs)),
    totalLatencyPercentiles: buildPercentiles(okSamples.map((sample) => sample.latencyMs)),
    tokenThroughputPercentiles: buildPercentiles(okSamples.map((sample) => sample.tokenThroughputTps)),
    samples: input.samples,
  };
}

export function buildFailedBenchmarkResult(input: {
  target: AgentTarget;
  resolvedModel: string;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  tasks: PlannedSampleTask[];
  warning: string;
}): AgentBenchmarkResult {
  return {
    targetId: input.target.id,
    targetLabel: input.target.label,
    providerLabel: input.target.providerLabel,
    execution: input.target.execution,
    resolvedModel: input.resolvedModel,
    contextWindow: input.contextWindow,
    providerProfile: input.providerProfile,
    thinkingMode: input.thinkingMode,
    runs: input.tasks.length,
    okRuns: 0,
    skippedRuns: input.tasks.length,
    skipSummary: input.warning,
    avgFirstTokenLatencyMs: 0,
    avgLatencyMs: 0,
    avgTokenThroughputTps: 0,
    firstTokenLatencyPercentiles: buildPercentiles([]),
    totalLatencyPercentiles: buildPercentiles([]),
    tokenThroughputPercentiles: buildPercentiles([]),
    samples: input.tasks.map((task) => createSkippedBenchmarkSample(task, input.warning)),
  };
}
