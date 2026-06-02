import { computeComparisonsToLast } from "@/features/benchmark/run-results";
import type { BenchmarkPlan } from "@/features/benchmark/run-plan";
import type {
  AgentBenchmarkResponse,
  AgentBenchmarkResult,
  AgentBenchmarkProfileBatchScope,
  AgentProviderProfile,
  AgentThinkingMode,
} from "@/lib/agent/types";

export type BenchmarkRunPayloadContext = {
  runId: string;
  plan: BenchmarkPlan;
  contextWindow: number;
  runs: number;
  runNote?: string;
  profileBatchScope?: AgentBenchmarkProfileBatchScope;
  profileModes: Array<{
    providerProfile: AgentProviderProfile;
    thinkingMode: AgentThinkingMode;
  }>;
  results: AgentBenchmarkResult[];
};

export function createBenchmarkRunPayloadContext({
  runId,
  plan,
  contextWindow,
  runs,
  runNote,
  profileBatchScope,
  profileModes,
}: Omit<BenchmarkRunPayloadContext, "results" | "profileBatchScope"> & {
  profileBatchScope: AgentBenchmarkProfileBatchScope;
}): BenchmarkRunPayloadContext {
  return {
    runId,
    plan,
    contextWindow,
    runs,
    runNote,
    profileBatchScope: profileModes.length > 1 ? profileBatchScope : undefined,
    profileModes,
    results: [],
  };
}

export function buildBenchmarkRunPayload(
  context: BenchmarkRunPayloadContext,
  inputResults: AgentBenchmarkResult[] = context.results,
): AgentBenchmarkResponse {
  return {
    ok: inputResults.some((result) => result.okRuns > 0),
    generatedAt: new Date().toISOString(),
    benchmarkMode: context.plan.benchmarkMode,
    prompt: context.plan.prompt,
    runNote: context.runNote,
    promptSetId: context.plan.promptSetId,
    promptSetLabel: context.plan.promptSetLabel,
    promptSetPromptCount: context.plan.promptSetPromptCount,
    datasetId: context.plan.datasetId,
    datasetLabel: context.plan.datasetLabel,
    datasetSourceLabel: context.plan.datasetSourceLabel,
    datasetSourceUrl: context.plan.datasetSourceUrl,
    datasetSampleCount: context.plan.datasetSampleCount,
    suiteId: context.plan.suiteId,
    suiteLabel: context.plan.suiteLabel,
    suiteWorkloadCount: context.plan.suiteWorkloadCount,
    workloads: context.plan.workloads,
    contextWindow: context.contextWindow,
    runs: context.runs,
    providerProfile:
      context.profileModes.length === 1
        ? context.profileModes[0].providerProfile
        : undefined,
    thinkingMode:
      context.profileModes.length === 1
        ? context.profileModes[0].thinkingMode
        : undefined,
    runId: context.runId,
    profileBatchScope: context.profileBatchScope,
    profileModes: context.profileModes.length > 1 ? context.profileModes : undefined,
    comparisonsToLast: computeComparisonsToLast(
      inputResults,
      context.contextWindow,
      {
        ...context.plan,
        profileBatchScope: context.profileBatchScope,
      },
    ),
    results: inputResults,
  };
}
