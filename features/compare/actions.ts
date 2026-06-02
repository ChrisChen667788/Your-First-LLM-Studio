import type {
  AgentBenchmarkMode,
  AgentBenchmarkResponse,
  AgentCompareLaneProgress,
  AgentCompareProgress,
  AgentCompareRequest,
  AgentCompareResponse,
  AgentProviderProfile,
  AgentRuntimeActionResponse,
  AgentThinkingMode,
} from "@/lib/agent/types";

export type CompareProgressPatch = {
  requestId: string;
  targetId: string;
  phase: AgentCompareLaneProgress["phase"];
  detail: string;
  loadingElapsedMs?: number | null;
  recoveryThresholdMs?: number | null;
  recoveryAction?: string;
  recoveryTriggeredAt?: string | null;
  recoveryTriggerElapsedMs?: number | null;
  warning?: string;
  recordTimeline?: boolean;
};

export type CompareBenchmarkHandoffRequest = {
  targetIds: string[];
  benchmarkMode: AgentBenchmarkMode;
  prompt: string;
  runNote?: string;
  runs: number;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
};

export async function runCompareRequest(
  input: AgentCompareRequest,
): Promise<AgentCompareResponse> {
  const response = await fetch("/api/agent/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as AgentCompareResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Compare run failed.");
  }
  return payload;
}

export async function patchCompareProgress(
  input: CompareProgressPatch,
): Promise<AgentCompareProgress> {
  const response = await fetch("/api/agent/compare/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as AgentCompareProgress & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Failed to update compare progress.");
  }
  return payload;
}

export async function restartCompareRuntime(
  targetId: string,
): Promise<AgentRuntimeActionResponse> {
  const response = await fetch("/api/agent/runtime/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetId,
      action: "restart",
    }),
  });
  const payload = (await response.json()) as AgentRuntimeActionResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error || payload.message || "Manual local recovery failed.",
    );
  }
  return payload;
}

export async function sendCompareBenchmarkHandoff(
  input: CompareBenchmarkHandoffRequest,
): Promise<AgentBenchmarkResponse> {
  const response = await fetch("/api/admin/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as AgentBenchmarkResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Benchmark handoff failed.");
  }
  return payload;
}
