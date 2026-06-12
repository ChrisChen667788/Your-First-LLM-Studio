import {
  buildRuntimeStageItems,
  describeRuntimePhase,
} from "@/features/agent/runtime-formatters";
import type { AgentRuntimeStatus } from "@/lib/agent/types";

type AgentRuntimeViewModelInput = {
  runtimeStatus: AgentRuntimeStatus | null;
  locale: string;
  selectedTargetId: string;
  lastSwitchMsByTarget: Record<string, number | null>;
  lastSwitchAtByTarget: Record<string, string | null>;
};

export function buildAgentRuntimeViewModel({
  runtimeStatus,
  locale,
  selectedTargetId,
  lastSwitchMsByTarget,
  lastSwitchAtByTarget,
}: AgentRuntimeViewModelInput) {
  return {
    runtimePhase: describeRuntimePhase(runtimeStatus, locale),
    runtimeStageItems: buildRuntimeStageItems(runtimeStatus, locale),
    loadedAliasForSelectedTarget:
      runtimeStatus?.loadedAlias === selectedTargetId
        ? runtimeStatus.loadedAlias
        : null,
    gatewayLoadedOtherAlias:
      runtimeStatus?.loadedAlias && runtimeStatus.loadedAlias !== selectedTargetId
        ? runtimeStatus.loadedAlias
        : null,
    runtimeGuardrailBlocked:
      runtimeStatus?.resourceGuardrailLevel === "blocked",
    runtimeGuardrailCaution:
      runtimeStatus?.resourceGuardrailLevel === "caution",
    selectedTargetLastSwitchMs:
      lastSwitchMsByTarget[selectedTargetId] ?? null,
    selectedTargetLastSwitchAt:
      lastSwitchAtByTarget[selectedTargetId] ?? null,
  };
}
