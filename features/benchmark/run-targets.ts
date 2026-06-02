import { listServerAgentTargets } from "@/lib/agent/server-targets";
import type { BenchmarkRequestBody } from "@/features/benchmark/run-plan";
import type { AgentTarget } from "@/lib/agent/types";

export type BenchmarkRunTargetSelection = {
  selectedTargets: AgentTarget[];
  targetIds: string[];
  localTargets: AgentTarget[];
  remoteTargets: AgentTarget[];
};

export function resolveBenchmarkRunTargetSelection(
  body: BenchmarkRequestBody,
): BenchmarkRunTargetSelection | { error: string } {
  const benchmarkTargets = listServerAgentTargets();
  const selectedTargets = body.targetIds?.length
    ? benchmarkTargets.filter((target) => body.targetIds?.includes(target.id))
    : benchmarkTargets;

  if (!selectedTargets.length) {
    return { error: "No benchmark targets selected." };
  }

  return {
    selectedTargets,
    targetIds: selectedTargets.map((target) => target.id),
    localTargets: selectedTargets.filter((target) => target.execution === "local"),
    remoteTargets: selectedTargets.filter((target) => target.execution === "remote"),
  };
}
