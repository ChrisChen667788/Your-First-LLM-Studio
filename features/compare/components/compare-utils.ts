import type { AgentProviderProfile, AgentThinkingMode } from "@/lib/agent/types";

export function formatContextWindowLabel(value: number) {
  return value >= 1024 ? `${Math.round(value / 1024)}K` : `${value}`;
}

export function formatThinkingMode(locale: string, value: AgentThinkingMode) {
  if (value === "thinking") {
    return locale.startsWith("en") ? "Thinking" : "思考模式";
  }
  return locale.startsWith("en") ? "Standard" : "标准模式";
}

export function formatProviderProfile(locale: string, value: AgentProviderProfile) {
  if (value === "tool-first") {
    return locale.startsWith("en") ? "Tool-first" : "工具优先";
  }
  if (value === "balanced") {
    return locale.startsWith("en") ? "Balanced" : "平衡";
  }
  return locale.startsWith("en") ? "Speed" : "速度优先";
}

function createTokenSet(content: string) {
  return new Set(
    content
      .toLowerCase()
      .split(/[^a-z0-9_\u4e00-\u9fff]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

export function computeTokenOverlap(base: string, candidate: string) {
  const baseSet = createTokenSet(base);
  const candidateSet = createTokenSet(candidate);
  if (!baseSet.size && !candidateSet.size) return 1;
  const union = new Set([...baseSet, ...candidateSet]);
  let intersection = 0;
  union.forEach((token) => {
    if (baseSet.has(token) && candidateSet.has(token)) {
      intersection += 1;
    }
  });
  return union.size ? intersection / union.size : 0;
}

export function extractJsonKeys(content: string) {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return Object.keys(parsed).sort();
  } catch {
    return null;
  }
}

export function formatTimelineTime(locale: string, value: string) {
  try {
    return new Date(value).toLocaleTimeString(
      locale.startsWith("en") ? "en-US" : "zh-CN",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      },
    );
  } catch {
    return value;
  }
}
