import { normalizeContextWindow } from "@/lib/agent/metrics";
import {
  normalizeProviderProfile,
  normalizeThinkingMode,
} from "@/lib/agent/providers";
import {
  buildPlan,
  deriveComparisonSubsetTasks,
  expandPlanTasks,
  normalizeProfileModes,
  type BenchmarkPlan,
  type BenchmarkRequestBody,
  type PlannedSampleTask,
} from "@/features/benchmark/run-plan";
import { buildBenchmarkRunProgressPlan } from "@/features/benchmark/run-progress-plan";
import { resolveBenchmarkRunTargetSelection } from "@/features/benchmark/run-targets";
import { createBenchmarkRunPayloadContext } from "@/features/benchmark/run-payload";
import { initializeBenchmarkRunProgress } from "@/features/benchmark/run-progress";
import type { BenchmarkRunPayloadContext } from "@/features/benchmark/run-payload";
import type { BenchmarkRunProgressPlan } from "@/features/benchmark/run-progress-plan";
import type {
  AgentBenchmarkProfileBatchScope,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";
import type { ExperimentSourceContext } from "@/features/experiments/contracts";

type BenchmarkRunMode = {
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
};

export type BenchmarkRunRequestContext = {
  runId: string;
  runs: number;
  contextWindow: number;
  runNote?: string;
  requestedProviderProfile: AgentProviderProfile;
  profileModes: BenchmarkRunMode[];
  profileBatchScope: AgentBenchmarkProfileBatchScope;
  resolvedPlan: BenchmarkPlan;
  targetIds: string[];
  localTargets: AgentTarget[];
  remoteTargets: AgentTarget[];
  plannedTasks: PlannedSampleTask[];
  remoteComparisonTasks: PlannedSampleTask[];
  responseContext: BenchmarkRunPayloadContext;
  progressPlan: BenchmarkRunProgressPlan;
  experimentContext?: ExperimentSourceContext;
};

export type BenchmarkRunRequestContextError = {
  error: string;
};

export function createBenchmarkRunRequestContext({
  body,
  runId,
}: {
  body: BenchmarkRequestBody;
  runId: string;
}): BenchmarkRunRequestContext | BenchmarkRunRequestContextError {
  const runs = Math.max(1, Math.min(Math.trunc(body.runs || 3), 10));
  const contextWindow = normalizeContextWindow(body.contextWindow, 32768);
  const maxTokens = Math.max(32, Math.min(Math.trunc(body.maxTokens || 192), 512));
  const runNote =
    typeof body.runNote === "string" && body.runNote.trim()
      ? body.runNote.trim()
      : undefined;
  const thinkingMode = normalizeThinkingMode(body.thinkingMode);
  const requestedProviderProfile = normalizeProviderProfile(body.providerProfile);
  const profileModes = normalizeProfileModes(
    body.profileModes,
    requestedProviderProfile,
    thinkingMode,
  );
  const plan = buildPlan(body, runs);
  if ("error" in plan) {
    return { error: plan.error };
  }
  const resolvedPlan = plan;

  const targetSelection = resolveBenchmarkRunTargetSelection(body);
  if ("error" in targetSelection) {
    return { error: targetSelection.error };
  }
  const { targetIds, localTargets, remoteTargets } = targetSelection;
  const profileBatchScope: AgentBenchmarkProfileBatchScope =
    body.profileBatchScope === "comparison-subset" ? "comparison-subset" : "full-suite";
  const plannedTasks = expandPlanTasks(resolvedPlan, contextWindow, maxTokens);
  const remoteComparisonTasks =
    resolvedPlan.benchmarkMode === "suite" && profileBatchScope === "comparison-subset"
      ? deriveComparisonSubsetTasks(plannedTasks)
      : plannedTasks;
  const responseContext = createBenchmarkRunPayloadContext({
    runId,
    plan: resolvedPlan,
    contextWindow,
    runs,
    runNote,
    profileBatchScope,
    profileModes,
  });
  const progressPlan = buildBenchmarkRunProgressPlan({
    localTargets,
    remoteTargets,
    requestedProviderProfile,
    profileModes,
    profileBatchScope,
    plannedTasks,
    remoteComparisonTasks,
    contextWindow,
  });

  return {
    runId,
    runs,
    contextWindow,
    runNote,
    requestedProviderProfile,
    profileModes,
    profileBatchScope,
    resolvedPlan,
    targetIds,
    localTargets,
    remoteTargets,
    plannedTasks,
    remoteComparisonTasks,
    responseContext,
    progressPlan,
    experimentContext: body.experimentContext,
  };
}

export function initializeBenchmarkRunRequestProgress(
  context: BenchmarkRunRequestContext,
) {
  initializeBenchmarkRunProgress({
    runId: context.runId,
    plan: context.resolvedPlan,
    runNote: context.runNote,
    profileBatchScope:
      context.profileModes.length > 1 ? context.profileBatchScope : "full-suite",
    totalGroups: context.progressPlan.totalGroups,
    totalSamples: context.progressPlan.totalSamples,
    targetIds: context.targetIds,
    pendingGroups: context.progressPlan.plannedGroups,
    experimentContext: context.experimentContext,
  });
}
