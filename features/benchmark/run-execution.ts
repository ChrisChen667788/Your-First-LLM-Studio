import type { BenchmarkRequestBody } from "@/features/benchmark/run-plan";
import {
  runLocalBenchmarkResultGroups,
  runRemoteBenchmarkResultGroups,
} from "@/features/benchmark/run-group-execution";
import { completeBenchmarkRunExecution } from "@/features/benchmark/run-completion-policy";
import {
  advanceRuntimeRecoveryCheckpoint,
  startRuntimeRecoveryCheckpoint,
} from "@/features/models/runtime-recovery-performance";
import {
  buildBenchmarkRunSuccessOutcome,
  buildBenchmarkRunValidationErrorOutcome,
  type BenchmarkRunExecutionOutcome,
} from "@/features/benchmark/run-execution-outcome";
import {
  createBenchmarkRunRequestContext,
  initializeBenchmarkRunRequestProgress,
} from "@/features/benchmark/run-request-context";
import { withTelemetrySpan } from "@/features/telemetry/trace-adapter";
import type { BenchmarkRunLifecycleRuntime } from "@/features/benchmark/run-lifecycle";
import type { AgentBenchmarkResult } from "@/lib/agent/types";

const BENCHMARK_WORKER_HEARTBEAT_MS = 5000;

async function executeBenchmarkResultGroups({
  lifecycle,
  requestContext,
}: {
  lifecycle: BenchmarkRunLifecycleRuntime;
  requestContext: Exclude<
    ReturnType<typeof createBenchmarkRunRequestContext>,
    { error: string }
  >;
}): Promise<AgentBenchmarkResult[]> {
  return [
    ...(await runLocalBenchmarkResultGroups({
      lifecycle,
      runId: requestContext.runId,
      localTargets: requestContext.localTargets,
      requestedProviderProfile: requestContext.requestedProviderProfile,
      resolvedPlan: requestContext.resolvedPlan,
      contextWindow: requestContext.contextWindow,
      profileModes: requestContext.profileModes,
      profileBatchScope: requestContext.profileBatchScope,
      plannedTasks: requestContext.plannedTasks,
      remoteComparisonTasks: requestContext.remoteComparisonTasks,
      comparisonLocalContextWindow:
        requestContext.progressPlan.comparisonLocalContextWindow,
    })),
    ...(await runRemoteBenchmarkResultGroups({
      lifecycle,
      runId: requestContext.runId,
      remoteTargets: requestContext.remoteTargets,
      resolvedPlan: requestContext.resolvedPlan,
      contextWindow: requestContext.contextWindow,
      profileModes: requestContext.profileModes,
      profileBatchScope: requestContext.profileBatchScope,
      plannedTasks: requestContext.plannedTasks,
      remoteComparisonTasks: requestContext.remoteComparisonTasks,
      comparisonLocalContextWindow:
        requestContext.progressPlan.comparisonLocalContextWindow,
    })),
  ];
}

export async function executeBenchmarkRunRequest({
  body,
  lifecycle,
}: {
  body: BenchmarkRequestBody;
  lifecycle: BenchmarkRunLifecycleRuntime;
}): Promise<BenchmarkRunExecutionOutcome> {
  const runId = lifecycle.ensureRunId();
  const requestContext = createBenchmarkRunRequestContext({
    body,
    runId,
  });
  if ("error" in requestContext) {
    return buildBenchmarkRunValidationErrorOutcome(requestContext.error);
  }

  return withTelemetrySpan(
    "benchmark.run",
    {
      "benchmark.run.id": runId,
      "benchmark.target.count": requestContext.targetIds.length,
      "benchmark.task.count": requestContext.plannedTasks.length,
      "benchmark.remote.comparison.enabled":
        requestContext.remoteComparisonTasks.length > 0,
    },
    async () => {
      lifecycle.register();
      lifecycle.setResponseContext(requestContext.responseContext);
      initializeBenchmarkRunRequestProgress(requestContext);
      lifecycle.startHeartbeat(BENCHMARK_WORKER_HEARTBEAT_MS);
      const checkpoint = startRuntimeRecoveryCheckpoint({
        operation: "benchmark",
        targetId: requestContext.targetIds.join(","),
        targetLabel: `Benchmark ${runId}`,
        safeBoundary: {
          kind: "benchmark-run-initialized",
          reference: runId,
          summary: "Benchmark run metadata and progress plan persisted before execution.",
        },
      });

      try {
        const resumed = advanceRuntimeRecoveryCheckpoint({
          checkpointId: checkpoint.id,
          state: "resumed",
          reason: "Benchmark execution began from its persisted run boundary.",
        });
        const results = await executeBenchmarkResultGroups({
          lifecycle,
          requestContext,
        });
        const payload = completeBenchmarkRunExecution({
          responseContext: requestContext.responseContext,
          results,
          targetIds: requestContext.targetIds,
          experimentContext: requestContext.experimentContext,
        });
        advanceRuntimeRecoveryCheckpoint({
          checkpointId: resumed.id,
          state: "completed",
          reason: "Benchmark result groups completed and passed completion policy.",
        });
        return buildBenchmarkRunSuccessOutcome(payload);
      } catch (error) {
        advanceRuntimeRecoveryCheckpoint({
          checkpointId: checkpoint.id,
          state: "failed",
          reason: error instanceof Error ? error.message : "Benchmark execution failed.",
        });
        throw error;
      } finally {
        lifecycle.stopHeartbeat();
      }
    },
  );
}
