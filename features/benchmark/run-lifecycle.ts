import {
  clearBenchmarkRunController,
  registerBenchmarkRunController,
} from "@/lib/agent/benchmark-run-control";
import {
  assertBenchmarkRunActive,
  BenchmarkControlError,
} from "@/features/benchmark/run-control";
import {
  buildBenchmarkControlResponsePayload,
  buildBenchmarkFallbackControlResponsePayload,
  type BenchmarkControlResponsePayload,
  type BenchmarkFallbackControlResponsePayload,
} from "@/features/benchmark/run-control-response";
import type { BenchmarkRunPayloadContext } from "@/features/benchmark/run-payload";
import {
  createBenchmarkWorkerHeartbeat,
  failBenchmarkRunProgress,
  finalizeBenchmarkControlProgress,
  type BenchmarkWorkerHeartbeat,
} from "@/features/benchmark/run-progress";
import type { AgentBenchmarkResponse } from "@/lib/agent/types";

export type BenchmarkControlErrorPayload =
  | BenchmarkControlResponsePayload
  | BenchmarkFallbackControlResponsePayload;

export function registerBenchmarkRunLifecycle(runId: string) {
  registerBenchmarkRunController(runId);
}

export function startBenchmarkRunHeartbeat(runId: string, heartbeatMs: number) {
  return createBenchmarkWorkerHeartbeat(runId, heartbeatMs);
}

export function cleanupBenchmarkRunLifecycle({
  runId,
  heartbeatController,
}: {
  runId: string;
  heartbeatController: BenchmarkWorkerHeartbeat | null;
}) {
  heartbeatController?.stop();
  clearBenchmarkRunController(runId);
}

export function buildBenchmarkControlErrorPayload({
  error,
  requestRunId,
  responseContext,
}: {
  error: BenchmarkControlError;
  requestRunId: string;
  responseContext: BenchmarkRunPayloadContext | null;
}): BenchmarkControlErrorPayload {
  finalizeBenchmarkControlProgress({
    runId: requestRunId,
    action: error.action,
    message: error.message,
  });

  return responseContext
    ? buildBenchmarkControlResponsePayload(responseContext, error.message)
    : buildBenchmarkFallbackControlResponsePayload(requestRunId, error.message);
}

export function recordBenchmarkRunFailure(runId: string, message: string) {
  failBenchmarkRunProgress({ runId, message });
}

export type BenchmarkRunLifecycleRuntime = {
  readonly requestRunId: string;
  readonly runId: string;
  readonly responseContext: BenchmarkRunPayloadContext | null;
  readonly heartbeat: BenchmarkWorkerHeartbeat["heartbeat"] | undefined;
  ensureRunId: () => string;
  register: () => void;
  setResponseContext: (context: BenchmarkRunPayloadContext) => void;
  startHeartbeat: (heartbeatMs: number) => void;
  stopHeartbeat: () => void;
  assertActive: () => void;
  buildControlErrorPayload: (
    error: BenchmarkControlError,
  ) => BenchmarkControlErrorPayload;
  recordFailure: (message: string) => void;
  cleanup: () => void;
};

export function normalizeBenchmarkRequestRunId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function createBenchmarkRunLifecycleRuntime(
  rawRunId: unknown,
): BenchmarkRunLifecycleRuntime {
  const requestRunId = normalizeBenchmarkRequestRunId(rawRunId);
  let runId = requestRunId;
  let responseContext: BenchmarkRunPayloadContext | null = null;
  let heartbeatController: BenchmarkWorkerHeartbeat | null = null;

  const ensureRunId = () => {
    if (!runId) {
      runId = globalThis.crypto.randomUUID();
    }
    return runId;
  };

  const runtime: BenchmarkRunLifecycleRuntime = {
    requestRunId,
    get runId() {
      return runId;
    },
    get responseContext() {
      return responseContext;
    },
    get heartbeat() {
      return heartbeatController?.heartbeat;
    },
    ensureRunId,
    register: () => {
      registerBenchmarkRunLifecycle(ensureRunId());
    },
    setResponseContext: (context) => {
      responseContext = context;
    },
    startHeartbeat: (heartbeatMs) => {
      heartbeatController = startBenchmarkRunHeartbeat(ensureRunId(), heartbeatMs);
    },
    stopHeartbeat: () => {
      heartbeatController?.stop();
      heartbeatController = null;
    },
    assertActive: () => {
      assertBenchmarkRunActive(ensureRunId());
    },
    buildControlErrorPayload: (error) =>
      buildBenchmarkControlErrorPayload({
        error,
        requestRunId,
        responseContext,
      }),
    recordFailure: (message) => {
      if (requestRunId) {
        recordBenchmarkRunFailure(requestRunId, message);
      }
    },
    cleanup: () => {
      const cleanupRunId = responseContext?.runId || runId || requestRunId;
      const controller = heartbeatController;
      heartbeatController = null;
      if (cleanupRunId) {
        cleanupBenchmarkRunLifecycle({
          runId: cleanupRunId,
          heartbeatController: controller,
        });
      }
    },
  };

  return runtime;
}

export function buildBenchmarkRunErrorResponse({
  runtime,
  error,
}: {
  runtime: BenchmarkRunLifecycleRuntime | null;
  error: unknown;
}): {
  payload: AgentBenchmarkResponse | BenchmarkControlErrorPayload | { error: string };
  init?: ResponseInit;
} {
  if (runtime && error instanceof BenchmarkControlError && runtime.requestRunId) {
    return {
      payload: runtime.buildControlErrorPayload(error),
    };
  }

  const message = error instanceof Error ? error.message : "Benchmark failed.";
  runtime?.recordFailure(message);
  return {
    payload: { error: message },
    init: { status: 500 },
  };
}
