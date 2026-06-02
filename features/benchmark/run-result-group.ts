import { evaluateBenchmarkDatasetOutput } from "@/lib/agent/benchmark-evaluation";
import { normalizeContextWindow } from "@/lib/agent/metrics";
import { resolveTargetWithMode } from "@/lib/agent/providers";
import {
  buildGroupKey,
  clampBenchmarkContextWindowForTarget,
  groupBenchmarkTasksByWorkload,
  type BenchmarkPlan,
  type PlannedSampleTask,
} from "@/features/benchmark/run-plan";
import { assertBenchmarkRunActive } from "@/features/benchmark/run-control";
import {
  prewarmTarget,
  restartLocalBenchmarkGateway,
} from "@/features/benchmark/run-local-prewarm";
import { runBenchmarkTasksWithConcurrency } from "@/features/benchmark/run-concurrency";
import {
  buildBenchmarkResultFromSamples,
  createSkippedBenchmarkSample,
} from "@/features/benchmark/run-result-builders";
import {
  isFatalLocalBenchmarkSampleFailure,
  isRetryableLocalBenchmarkSampleFailure,
  runBenchmarkSample,
} from "@/features/benchmark/run-sample-orchestration";
import {
  advanceBenchmarkRunSampleProgress,
  completeBenchmarkRunGroup,
  startBenchmarkRunGroup,
} from "@/features/benchmark/run-progress";
import type {
  AgentBenchmarkProfileBatchScope,
  AgentBenchmarkResult,
  AgentBenchmarkSample,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";

const LOCAL_BENCHMARK_MAX_CONSECUTIVE_FATAL_FAILURES = 3;
const LOCAL_BENCHMARK_MAX_CONSECUTIVE_FATAL_FAILURES_PER_WORKLOAD = 2;
const REMOTE_BENCHMARK_SAMPLE_CONCURRENCY = 1;

export type BenchmarkResultGroupMode = {
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
};

export type BenchmarkResultGroupInput = {
  runId: string;
  target: AgentTarget;
  mode: BenchmarkResultGroupMode;
  resolvedPlan: BenchmarkPlan;
  contextWindow: number;
  profileModes: BenchmarkResultGroupMode[];
  profileBatchScope: AgentBenchmarkProfileBatchScope;
  plannedTasks: PlannedSampleTask[];
  remoteComparisonTasks: PlannedSampleTask[];
  comparisonLocalContextWindow: number | null;
  heartbeat?: (phase: string) => void;
};

function resolveTasksForBenchmarkGroup(input: BenchmarkResultGroupInput) {
  if (
    input.target.execution === "remote" &&
    input.profileModes.length > 1 &&
    input.profileBatchScope === "comparison-subset"
  ) {
    return input.remoteComparisonTasks;
  }
  return input.plannedTasks;
}

function resolveContextWindowForBenchmarkGroup(input: BenchmarkResultGroupInput) {
  if (input.target.execution === "remote" && input.comparisonLocalContextWindow) {
    return Math.min(
      normalizeContextWindow(input.contextWindow, 8192),
      input.comparisonLocalContextWindow,
    );
  }
  return clampBenchmarkContextWindowForTarget(input.target.id, input.contextWindow);
}

export async function runBenchmarkResultGroup(
  input: BenchmarkResultGroupInput,
): Promise<AgentBenchmarkResult> {
  const { runId, target, mode } = input;
  assertBenchmarkRunActive(runId);
  input.heartbeat?.(`running-group:${target.id}:${mode.providerProfile}:${mode.thinkingMode}`);

  const resolvedTarget = resolveTargetWithMode(target.id, mode.thinkingMode);
  const effectiveContextWindow = resolveContextWindowForBenchmarkGroup(input);
  const groupKey = buildGroupKey(target.id, mode.providerProfile, mode.thinkingMode);
  const tasksForGroup = resolveTasksForBenchmarkGroup(input);

  startBenchmarkRunGroup(runId, {
    key: groupKey,
    targetLabel: target.label,
    providerProfile: mode.providerProfile,
    thinkingMode: mode.thinkingMode,
    execution: target.execution,
    sampleCount: tasksForGroup.length,
  });

  const runPlannedSample = async (task: PlannedSampleTask) => {
    assertBenchmarkRunActive(runId);
    input.heartbeat?.(`running-sample:${target.id}:${task.workloadId}`);
    let sample = await runBenchmarkSample(
      resolvedTarget,
      effectiveContextWindow,
      task.maxTokens,
      task.prompt,
      mode.providerProfile,
      {
        ensureGateway: false,
        workloadId: task.workloadId,
        thinkingMode: mode.thinkingMode,
        runId,
      },
    );

    if (target.execution === "local" && isRetryableLocalBenchmarkSampleFailure(sample)) {
      const restarted = await restartLocalBenchmarkGateway(resolvedTarget.resolvedBaseUrl);
      if (restarted) {
        try {
          await prewarmTarget(target.id, runId);
          sample = await runBenchmarkSample(
            resolvedTarget,
            effectiveContextWindow,
            task.maxTokens,
            task.prompt,
            mode.providerProfile,
            {
              ensureGateway: false,
              workloadId: task.workloadId,
              thinkingMode: mode.thinkingMode,
              runId,
            },
          );
        } catch {
          // Keep the original failed sample if recovery also failed.
        }
      }
    }

    const evaluation =
      sample.ok && task.evaluator
        ? evaluateBenchmarkDatasetOutput(
            {
              id: task.itemId,
              prompt: task.prompt,
              evaluator: task.evaluator,
              expectedAnswerPreview: task.expectedAnswerPreview,
            },
            sample.outputText || sample.outputPreview || "",
          )
        : null;

    const finalSample = {
      ...sample,
      run: task.sampleRun,
      workloadId: task.workloadId,
      workloadLabel: task.workloadLabel,
      itemId: task.itemId,
      expectedAnswerPreview: task.expectedAnswerPreview,
      score: evaluation?.score ?? null,
      passed: evaluation?.passed ?? null,
      warning:
        sample.warning ||
        (evaluation && evaluation.passed === false ? evaluation.rationale : undefined),
    };

    advanceBenchmarkRunSampleProgress(runId, {
      ok: finalSample.ok,
      targetLabel: target.label,
      providerProfile: mode.providerProfile,
      thinkingMode: mode.thinkingMode,
      workloadLabel: task.workloadLabel,
    });

    return finalSample;
  };

  let samples: AgentBenchmarkSample[];
  if (target.execution === "remote") {
    samples = await runBenchmarkTasksWithConcurrency(
      tasksForGroup,
      REMOTE_BENCHMARK_SAMPLE_CONCURRENCY,
      runPlannedSample,
      {
        beforeEach: () => assertBenchmarkRunActive(runId),
      },
    );
  } else {
    samples = await runLocalBenchmarkResultGroupSamples({
      runId,
      target,
      resolvedPlan: input.resolvedPlan,
      tasksForGroup,
      runPlannedSample,
      mode,
    });
  }

  const result = buildBenchmarkResultFromSamples({
    target,
    resolvedTarget,
    contextWindow: effectiveContextWindow,
    providerProfile: mode.providerProfile,
    thinkingMode: mode.thinkingMode,
    samples,
  });
  completeBenchmarkRunGroup(runId, groupKey);
  return result;
}

async function runLocalBenchmarkResultGroupSamples(input: {
  runId: string;
  target: AgentTarget;
  resolvedPlan: BenchmarkPlan;
  tasksForGroup: PlannedSampleTask[];
  runPlannedSample: (task: PlannedSampleTask) => Promise<AgentBenchmarkSample>;
  mode: BenchmarkResultGroupMode;
}) {
  let localSamples: AgentBenchmarkSample[] | null = null;
  const collected: AgentBenchmarkSample[] = [];
  const workloadGroups =
    input.resolvedPlan.benchmarkMode === "suite"
      ? groupBenchmarkTasksByWorkload(input.tasksForGroup)
      : [{ workloadId: "default", workloadLabel: "default", tasks: input.tasksForGroup }];
  let consecutiveFatalFailures = 0;

  for (let groupIndex = 0; groupIndex < workloadGroups.length; groupIndex += 1) {
    const workloadGroup = workloadGroups[groupIndex];
    let consecutiveFatalFailuresInWorkload = 0;

    if (groupIndex > 0 && input.resolvedPlan.benchmarkMode === "suite") {
      try {
        await prewarmTarget(input.target.id, input.runId);
      } catch {
        // Let the first sample in the next workload surface the failure; do not abort the whole run here.
      }
    }

    for (let taskIndex = 0; taskIndex < workloadGroup.tasks.length; taskIndex += 1) {
      assertBenchmarkRunActive(input.runId);
      const task = workloadGroup.tasks[taskIndex];
      const sample = await input.runPlannedSample(task);
      collected.push(sample);

      if (isFatalLocalBenchmarkSampleFailure(sample)) {
        consecutiveFatalFailures += 1;
        consecutiveFatalFailuresInWorkload += 1;
      } else {
        consecutiveFatalFailures = 0;
        consecutiveFatalFailuresInWorkload = 0;
      }

      if (
        input.resolvedPlan.benchmarkMode === "suite" &&
        consecutiveFatalFailuresInWorkload >= LOCAL_BENCHMARK_MAX_CONSECUTIVE_FATAL_FAILURES_PER_WORKLOAD
      ) {
        const remainingTasksInWorkload = workloadGroup.tasks.slice(taskIndex + 1);
        const warning = `Skipped remaining ${workloadGroup.workloadLabel} samples after repeated fatal local runtime failures.`;
        for (const skippedTask of remainingTasksInWorkload) {
          const skippedSample = createSkippedBenchmarkSample(skippedTask, warning);
          collected.push(skippedSample);
          advanceBenchmarkRunSampleProgress(input.runId, {
            ok: false,
            targetLabel: input.target.label,
            providerProfile: input.mode.providerProfile,
            thinkingMode: input.mode.thinkingMode,
            workloadLabel: skippedTask.workloadLabel,
          });
        }
        consecutiveFatalFailures = 0;
        consecutiveFatalFailuresInWorkload = 0;
        break;
      }

      if (consecutiveFatalFailures >= LOCAL_BENCHMARK_MAX_CONSECUTIVE_FATAL_FAILURES) {
        const remainingWorkloadTasks = workloadGroup.tasks.slice(taskIndex + 1);
        const remainingTasks = [
          ...remainingWorkloadTasks,
          ...workloadGroups.slice(groupIndex + 1).flatMap((group) => group.tasks),
        ];
        const warning = "Local benchmark group stopped early after repeated fatal local runtime failures.";
        for (const skippedTask of remainingTasks) {
          const skippedSample = createSkippedBenchmarkSample(skippedTask, warning);
          collected.push(skippedSample);
          advanceBenchmarkRunSampleProgress(input.runId, {
            ok: false,
            targetLabel: input.target.label,
            providerProfile: input.mode.providerProfile,
            thinkingMode: input.mode.thinkingMode,
            workloadLabel: skippedTask.workloadLabel,
          });
        }
        localSamples = collected;
        break;
      }
    }

    if (localSamples) {
      break;
    }
  }

  return localSamples || collected;
}
