import type { AgentWorkbenchSessionConflict } from "@/lib/agent/types";

export type AgentSessionSyncState = "" | "syncing" | "synced" | "error";

export function buildAgentSessionSyncLabel(input: {
  locale: string;
  state: AgentSessionSyncState;
  conflict: AgentWorkbenchSessionConflict | null;
}) {
  const isEnglish = input.locale.startsWith("en");
  if (input.conflict) {
    return isEnglish
      ? "Server snapshot conflict detected"
      : "检测到服务端快照冲突";
  }
  if (input.state === "syncing") {
    return isEnglish ? "Syncing server copy" : "同步服务端快照中";
  }
  if (input.state === "synced") {
    return isEnglish ? "Server snapshot synced" : "服务端快照已同步";
  }
  if (input.state === "error") {
    return isEnglish
      ? "Server snapshot unavailable"
      : "服务端快照暂不可用";
  }
  return isEnglish ? "Local-first session storage" : "本地优先会话存储";
}
