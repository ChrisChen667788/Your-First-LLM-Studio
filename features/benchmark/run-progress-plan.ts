import {
  buildGroupKey,
  clampBenchmarkContextWindowForTarget,
  type PlannedSampleTask,
} from "@/features/benchmark/run-plan";
import type {
  AgentBenchmarkProfileBatchScope,
  AgentExecution,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";

type BenchmarkModeProfile = {
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
};

export type BenchmarkRunProgressGroupPlan = {
  key: string;
  targetLabel: string;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  execution: AgentExecution;
  sampleCount: number;
};

export type BenchmarkRunProgressPlan = {
  comparisonLocalContextWindow: number | null;
  totalGroups: number;
  totalSamples: number;
  plannedGroups: BenchmarkRunProgressGroupPlan[];
};

export function buildBenchmarkRunProgressPlan({
  localTargets,
  remoteTargets,
  requestedProviderProfile,
  profileModes,
  profileBatchScope,
  plannedTasks,
  remoteComparisonTasks,
  contextWindow,
}: {
  localTargets: AgentTarget[];
  remoteTargets: AgentTarget[];
  requestedProviderProfile: AgentProviderProfile;
  profileModes: BenchmarkModeProfile[];
  profileBatchScope: AgentBenchmarkProfileBatchScope;
  plannedTasks: PlannedSampleTask[];
  remoteComparisonTasks: PlannedSampleTask[];
  contextWindow: number;
}): BenchmarkRunProgressPlan {
  const comparisonLocalContextWindow =
    localTargets.length && remoteTargets.length
      ? Math.min(...localTargets.map((target) => clampBenchmarkContextWindowForTarget(target.id, contextWindow)))
      : null;
  const totalGroups = localTargets.length + remoteTargets.length * profileModes.length;
  const totalSamples =
    localTargets.length * plannedTasks.length +
    remoteTargets.length *
      profileModes.length *
      (profileModes.length > 1 ? remoteComparisonTasks.length : plannedTasks.length);
  const plannedGroups = [
    ...localTargets.map((target) => ({
      key: buildGroupKey(target.id, requestedProviderProfile, "standard"),
      targetLabel: target.label,
      providerProfile: requestedProviderProfile,
      thinkingMode: "standard" as AgentThinkingMode,
      execution: target.execution as AgentExecution,
      sampleCount: plannedTasks.length,
    })),
    ...remoteTargets.flatMap((target) =>
      profileModes.map((mode) => ({
        key: buildGroupKey(target.id, mode.providerProfile, mode.thinkingMode),
        targetLabel: target.label,
        providerProfile: mode.providerProfile,
        thinkingMode: mode.thinkingMode,
        execution: target.execution as AgentExecution,
        sampleCount:
          profileModes.length > 1 && profileBatchScope === "comparison-subset"
            ? remoteComparisonTasks.length
            : plannedTasks.length,
      }))
    ),
  ];

  return {
    comparisonLocalContextWindow,
    totalGroups,
    totalSamples,
    plannedGroups,
  };
}
