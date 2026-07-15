import type { AgentTarget } from "@/lib/agent/types";
import { flattenTurns, type AgentTurn } from "./session-model";

export function buildAgentConversationSelectors(
  turns: AgentTurn[],
  selectedTargetId: string,
) {
  return {
    historyMessages: flattenTurns(turns),
    lastTurn: turns[turns.length - 1],
    lastChatTurn: [...turns]
      .reverse()
      .find(
        (turn) => turn.kind !== "check" && turn.targetId === selectedTargetId,
      ),
    toolRunCount: turns.reduce(
      (count, turn) => count + turn.toolRuns.length,
      0,
    ),
  };
}

export function countSelectedCompareLanes(
  targets: AgentTarget[],
  selectedTargetIds: string[],
) {
  const selected = new Set(selectedTargetIds);
  return targets.filter((target) => selected.has(target.id)).length;
}
