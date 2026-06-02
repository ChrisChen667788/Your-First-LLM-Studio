import { buildBenchmarkRunPayload, type BenchmarkRunPayloadContext } from "./run-payload";
import type { AgentBenchmarkResponse } from "@/lib/agent/types";

export type BenchmarkControlResponsePayload = AgentBenchmarkResponse & {
  warning: string;
};

export type BenchmarkFallbackControlResponsePayload = {
  ok: false;
  runId: string;
  warning: string;
};

export function buildBenchmarkControlResponsePayload(
  context: BenchmarkRunPayloadContext,
  warning: string,
): BenchmarkControlResponsePayload {
  return {
    ...buildBenchmarkRunPayload(context),
    warning,
  };
}

export function buildBenchmarkFallbackControlResponsePayload(
  runId: string,
  warning: string,
): BenchmarkFallbackControlResponsePayload {
  return {
    ok: false,
    runId,
    warning,
  };
}
