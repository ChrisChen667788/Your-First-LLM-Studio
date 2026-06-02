import { resolveTargetWithMode } from "@/lib/agent/providers";
import { buildGroupKey, type PlannedSampleTask } from "@/features/benchmark/run-plan";
import { buildFailedBenchmarkResult } from "@/features/benchmark/run-result-builders";
import {
  advanceBenchmarkRunSampleProgress,
  completeBenchmarkRunGroup,
} from "@/features/benchmark/run-progress";
import type {
  AgentBenchmarkResult,
  AgentProviderProfile,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";

export function recordLocalBenchmarkPrewarmFailure({
  runId,
  target,
  contextWindow,
  providerProfile,
  thinkingMode,
  tasks,
  warning,
}: {
  runId: string;
  target: AgentTarget;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  tasks: PlannedSampleTask[];
  warning: string;
}): AgentBenchmarkResult {
  const groupKey = buildGroupKey(target.id, providerProfile, thinkingMode);
  for (const task of tasks) {
    advanceBenchmarkRunSampleProgress(runId, {
      ok: false,
      targetLabel: target.label,
      providerProfile,
      thinkingMode,
      workloadLabel: task.workloadLabel,
    });
  }
  completeBenchmarkRunGroup(runId, groupKey);

  return buildFailedBenchmarkResult({
    target,
    resolvedModel: resolveTargetWithMode(target.id, thinkingMode).resolvedModel,
    contextWindow,
    providerProfile,
    thinkingMode,
    tasks,
    warning,
  });
}
