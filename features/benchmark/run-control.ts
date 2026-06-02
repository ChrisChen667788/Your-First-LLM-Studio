import { readBenchmarkProgress } from "@/lib/agent/benchmark-progress-store";
import { getBenchmarkRunSignal } from "@/lib/agent/benchmark-run-control";

export class BenchmarkControlError extends Error {
  action: "stop" | "abandon";

  constructor(action: "stop" | "abandon") {
    super(action === "stop" ? "Benchmark run stopped." : "Benchmark run abandoned.");
    this.action = action;
    this.name = "BenchmarkControlError";
  }
}

function readRequestedBenchmarkControl(runId: string) {
  const progress = readBenchmarkProgress(runId);
  if (!progress?.controlAction) return null;
  return progress.controlAction === "stop-requested" ? "stop" : "abandon";
}

export function assertBenchmarkRunActive(runId: string) {
  const signal = getBenchmarkRunSignal(runId);
  if (signal?.aborted) {
    throw new BenchmarkControlError(readRequestedBenchmarkControl(runId) || "stop");
  }
  const action = readRequestedBenchmarkControl(runId);
  if (action) {
    throw new BenchmarkControlError(action);
  }
}
