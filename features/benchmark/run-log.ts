import crypto from "crypto";
import { appendBenchmarkLog } from "@/lib/agent/log-store";
import type { AgentBenchmarkResponse } from "@/lib/agent/types";

export function appendBenchmarkRunLog(payload: AgentBenchmarkResponse) {
  appendBenchmarkLog({
    kind: "benchmark",
    id: crypto.randomUUID(),
    ...payload,
  });
}
