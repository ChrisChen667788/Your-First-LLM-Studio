import { NextResponse } from "next/server";
import type { BenchmarkRequestBody } from "@/features/benchmark/run-plan";
import {
  buildBenchmarkRunErrorResponse,
  createBenchmarkRunLifecycleRuntime,
  type BenchmarkRunLifecycleRuntime,
} from "@/features/benchmark/run-lifecycle";
import { buildBenchmarkRunPayload } from "@/features/benchmark/run-payload";
import {
  runLocalBenchmarkResultGroups,
  runRemoteBenchmarkResultGroups,
} from "@/features/benchmark/run-group-execution";
import {
  completeBenchmarkRunProgress,
} from "@/features/benchmark/run-progress";
import { appendBenchmarkRunLog } from "@/features/benchmark/run-log";
import {
  createBenchmarkRunRequestContext,
  initializeBenchmarkRunRequestProgress,
} from "@/features/benchmark/run-request-context";

const BENCHMARK_WORKER_HEARTBEAT_MS = 5000;

export async function POST(request: Request) {
  let lifecycle: BenchmarkRunLifecycleRuntime | null = null;
  try {
    const body = (await request.json()) as BenchmarkRequestBody;
    const runLifecycle = createBenchmarkRunLifecycleRuntime(body.runId);
    lifecycle = runLifecycle;
    const runId = runLifecycle.ensureRunId();

    const requestContext = createBenchmarkRunRequestContext({
      body,
      runId,
    });
    if ("error" in requestContext) {
      return NextResponse.json({ error: requestContext.error }, { status: 400 });
    }

    runLifecycle.register();
    runLifecycle.setResponseContext(requestContext.responseContext);
    const { results } = requestContext.responseContext;

    initializeBenchmarkRunRequestProgress(requestContext);
    runLifecycle.startHeartbeat(BENCHMARK_WORKER_HEARTBEAT_MS);

    results.push(
      ...(await runLocalBenchmarkResultGroups({
        lifecycle: runLifecycle,
        runId,
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
    );

    results.push(
      ...(await runRemoteBenchmarkResultGroups({
        lifecycle: runLifecycle,
        runId,
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
    );

    const payload = buildBenchmarkRunPayload(requestContext.responseContext, results);

    appendBenchmarkRunLog(payload);
    completeBenchmarkRunProgress({
      runId,
      payload,
      targetIds: requestContext.targetIds,
    });
    runLifecycle.stopHeartbeat();

    return NextResponse.json(payload);
  } catch (error) {
    const response = buildBenchmarkRunErrorResponse({ runtime: lifecycle, error });
    return NextResponse.json(response.payload, response.init);
  } finally {
    lifecycle?.cleanup();
  }
}
