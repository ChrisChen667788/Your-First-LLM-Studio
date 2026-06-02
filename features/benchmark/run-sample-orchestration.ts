import { runLocalBenchmarkSample } from "@/features/benchmark/local-sample-runner";
import { runRemoteBenchmarkSample } from "@/features/benchmark/remote-sample-runner";
import type {
  AgentBenchmarkSample,
  AgentProviderProfile,
  AgentThinkingMode,
  ResolvedTarget,
} from "@/lib/agent/types";

export type BenchmarkSampleRunnerOptions = {
  ensureGateway?: boolean;
  workloadId?: string;
  thinkingMode?: AgentThinkingMode;
  runId?: string;
};

export function runBenchmarkSample(
  target: ResolvedTarget,
  contextWindow: number,
  maxTokens: number,
  prompt: string,
  providerProfile: AgentProviderProfile,
  options?: BenchmarkSampleRunnerOptions,
) {
  return target.execution === "local"
    ? runLocalBenchmarkSample(target, contextWindow, maxTokens, prompt, providerProfile, options)
    : runRemoteBenchmarkSample(target, contextWindow, maxTokens, prompt, providerProfile, options);
}

export function isRetryableLocalBenchmarkSampleFailure(sample: AgentBenchmarkSample) {
  if (sample.ok) return false;
  const warning = (sample.warning || "").toLowerCase();
  return (
    warning.includes("fetch failed") ||
    warning.includes("terminated") ||
    warning.includes("gateway") ||
    warning.includes("timed out") ||
    warning.includes("network") ||
    warning.includes("address already in use")
  );
}

export function isFatalLocalBenchmarkSampleFailure(sample: AgentBenchmarkSample) {
  if (sample.ok) return false;
  const warning = (sample.warning || "").toLowerCase();
  return (
    warning.includes("still loading") ||
    warning.includes("prewarm failed") ||
    warning.includes("gateway unavailable") ||
    warning.includes("request timed out") ||
    warning.includes("offline")
  );
}
