import { appendBenchmarkRunLog } from "@/features/benchmark/run-log";
import {
  buildBenchmarkRunPayload,
  type BenchmarkRunPayloadContext,
} from "@/features/benchmark/run-payload";
import { completeBenchmarkRunProgress } from "@/features/benchmark/run-progress";
import type { AgentBenchmarkResponse, AgentBenchmarkResult } from "@/lib/agent/types";
import type { ExperimentSourceContext } from "@/features/experiments/contracts";

export function completeBenchmarkRunExecution({
  responseContext,
  results,
  targetIds,
  experimentContext,
}: {
  responseContext: BenchmarkRunPayloadContext;
  results: AgentBenchmarkResult[];
  targetIds: string[];
  experimentContext?: ExperimentSourceContext;
}): AgentBenchmarkResponse {
  const payload = buildBenchmarkRunPayload(responseContext, results);
  appendBenchmarkRunLog(payload);
  completeBenchmarkRunProgress({
    runId: responseContext.runId,
    payload,
    targetIds,
    experimentContext,
  });
  return payload;
}
