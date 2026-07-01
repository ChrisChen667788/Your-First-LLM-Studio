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

export function isFatalRemoteBenchmarkSampleFailure(sample: AgentBenchmarkSample) {
  if (sample.ok) return false;
  const warning = (sample.warning || "").toLowerCase();
  return (
    (warning.includes("missing") && warning.includes("api") && warning.includes("key")) ||
    warning.includes("not configured") ||
    warning.includes("invalid api key") ||
    warning.includes("invalid_api_key") ||
    warning.includes("unauthorized") ||
    warning.includes("authentication") ||
    warning.includes("401") ||
    warning.includes("403") ||
    warning.includes("404") ||
    warning.includes("model not found") ||
    warning.includes("model_not_found") ||
    warning.includes("does not exist") ||
    warning.includes("unsupported model") ||
    warning.includes("insufficient quota") ||
    warning.includes("insufficient_quota") ||
    warning.includes("billing") ||
    warning.includes("account balance")
  );
}
