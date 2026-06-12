import type { AgentBenchmarkResponse } from "@/lib/agent/types";

export type BenchmarkRunExecutionOutcome =
  | {
      payload: AgentBenchmarkResponse;
      init?: undefined;
    }
  | {
      payload: { error: string };
      init: { status: 400 };
    };

export function buildBenchmarkRunSuccessOutcome(
  payload: AgentBenchmarkResponse,
): BenchmarkRunExecutionOutcome {
  return { payload };
}

export function buildBenchmarkRunValidationErrorOutcome(
  error: string,
): BenchmarkRunExecutionOutcome {
  return {
    payload: { error },
    init: { status: 400 },
  };
}
