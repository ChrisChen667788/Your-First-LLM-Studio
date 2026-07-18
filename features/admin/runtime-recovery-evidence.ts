import type { AgentBenchmarkProgress } from "@/lib/agent/types";

export type AdminRuntimeRecoveryEvidence = {
  action: string;
  occurredAt: string;
  runId: string;
  phase: string;
};

export function selectAdminRuntimeRecoveryEvidence(
  progress: AgentBenchmarkProgress | null | undefined,
  targetId: string,
): AdminRuntimeRecoveryEvidence | null {
  const prewarm = progress?.localPrewarm;
  if (
    !progress?.runId ||
    !prewarm ||
    prewarm.targetId !== targetId ||
    !prewarm.lastRecoveryAction?.trim() ||
    !prewarm.lastRecoveryAt
  ) {
    return null;
  }
  return {
    action: prewarm.lastRecoveryAction.trim(),
    occurredAt: prewarm.lastRecoveryAt,
    runId: progress.runId,
    phase: prewarm.phase,
  };
}
