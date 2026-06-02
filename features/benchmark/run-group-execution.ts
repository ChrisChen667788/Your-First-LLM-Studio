import {
  clearLocalBenchmarkRuntimePrewarmState,
  prepareLocalBenchmarkRuntime,
  releasePreparedLocalBenchmarkRuntime,
} from "@/features/benchmark/run-local-runtime-lifecycle";
import { recordLocalBenchmarkPrewarmFailure } from "@/features/benchmark/run-local-prewarm-failure";
import { runWithConcurrency } from "@/features/benchmark/run-concurrency";
import {
  runBenchmarkResultGroup,
  type BenchmarkResultGroupMode,
} from "@/features/benchmark/run-result-group";
import type { BenchmarkRunLifecycleRuntime } from "@/features/benchmark/run-lifecycle";
import type { BenchmarkPlan, PlannedSampleTask } from "@/features/benchmark/run-plan";
import type {
  AgentBenchmarkProfileBatchScope,
  AgentBenchmarkResult,
  AgentProviderProfile,
  AgentTarget,
} from "@/lib/agent/types";

const REMOTE_BENCHMARK_GROUP_CONCURRENCY = 2;

type BenchmarkGroupExecutionInput = {
  lifecycle: BenchmarkRunLifecycleRuntime;
  runId: string;
  resolvedPlan: BenchmarkPlan;
  contextWindow: number;
  profileModes: BenchmarkResultGroupMode[];
  profileBatchScope: AgentBenchmarkProfileBatchScope;
  plannedTasks: PlannedSampleTask[];
  remoteComparisonTasks: PlannedSampleTask[];
  comparisonLocalContextWindow: number | null;
};

export async function runLocalBenchmarkResultGroups({
  lifecycle,
  runId,
  localTargets,
  requestedProviderProfile,
  resolvedPlan,
  contextWindow,
  profileModes,
  profileBatchScope,
  plannedTasks,
  remoteComparisonTasks,
  comparisonLocalContextWindow,
}: BenchmarkGroupExecutionInput & {
  localTargets: AgentTarget[];
  requestedProviderProfile: AgentProviderProfile;
}): Promise<AgentBenchmarkResult[]> {
  const results: AgentBenchmarkResult[] = [];

  for (const target of localTargets) {
    lifecycle.assertActive();
    let benchmarkBaseUrl = "";
    try {
      ({ benchmarkBaseUrl } = await prepareLocalBenchmarkRuntime({
        runId,
        target,
      }));
    } catch (error) {
      clearLocalBenchmarkRuntimePrewarmState(runId);
      results.push(
        recordLocalBenchmarkPrewarmFailure({
          runId,
          target,
          contextWindow,
          providerProfile: requestedProviderProfile,
          thinkingMode: "standard",
          tasks: plannedTasks,
          warning: error instanceof Error ? error.message : "Prewarm failed.",
        }),
      );
      continue;
    }

    try {
      results.push(
        await runBenchmarkResultGroup({
          runId,
          target,
          mode: {
            providerProfile: requestedProviderProfile,
            thinkingMode: "standard",
          },
          resolvedPlan,
          contextWindow,
          profileModes,
          profileBatchScope,
          plannedTasks,
          remoteComparisonTasks,
          comparisonLocalContextWindow,
          heartbeat: lifecycle.heartbeat,
        }),
      );
    } finally {
      await releasePreparedLocalBenchmarkRuntime({
        runId,
        benchmarkBaseUrl,
      });
    }
  }

  return results;
}

export async function runRemoteBenchmarkResultGroups({
  lifecycle,
  runId,
  remoteTargets,
  resolvedPlan,
  contextWindow,
  profileModes,
  profileBatchScope,
  plannedTasks,
  remoteComparisonTasks,
  comparisonLocalContextWindow,
}: BenchmarkGroupExecutionInput & {
  remoteTargets: AgentTarget[];
}): Promise<AgentBenchmarkResult[]> {
  return runWithConcurrency(
    remoteTargets.flatMap((target) =>
      profileModes.map((mode) => () =>
        runBenchmarkResultGroup({
          runId,
          target,
          mode,
          resolvedPlan,
          contextWindow,
          profileModes,
          profileBatchScope,
          plannedTasks,
          remoteComparisonTasks,
          comparisonLocalContextWindow,
          heartbeat: lifecycle.heartbeat,
        }),
      ),
    ),
    REMOTE_BENCHMARK_GROUP_CONCURRENCY,
    {
      beforeEach: () => lifecycle.assertActive(),
    },
  );
}
