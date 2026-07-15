import { existsSync, readFileSync } from "fs";
import path from "path";
import type { AgentTarget, AgentThinkingMode } from "@/lib/agent/types";

export function loadAgentLocalEnv() {
  const values: Record<string, string> = {};
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!existsSync(filePath)) continue;
    const source = readFileSync(filePath, "utf8");
    for (const rawLine of source.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      values[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
  return values;
}

export function readAgentEnv(
  localEnv: Record<string, string>,
  name: string | undefined,
  fallback: string,
) {
  if (!name) return fallback;
  return localEnv[name] || process.env[name] || fallback;
}

export function resolveAgentRuntimeTarget(
  target: AgentTarget,
  thinkingMode: AgentThinkingMode,
  localEnv: Record<string, string>,
) {
  const resolvedBaseUrl = readAgentEnv(
    localEnv,
    target.baseUrlEnv,
    target.baseUrlDefault,
  ).replace(/\/$/, "");
  const modelEnv = thinkingMode === "thinking"
    ? target.thinkingModelEnv || target.modelEnv
    : target.modelEnv;
  const modelDefault = thinkingMode === "thinking"
    ? target.thinkingModelDefault || target.modelDefault
    : target.modelDefault;
  const resolvedModel = target.id === "deepseek-api" && thinkingMode === "thinking"
    ? readAgentEnv(localEnv, target.modelEnv, target.modelDefault)
    : readAgentEnv(localEnv, modelEnv, modelDefault);
  return {
    resolvedBaseUrl,
    resolvedModel,
    apiKeyConfigured: target.apiKeyEnv
      ? Boolean(readAgentEnv(localEnv, target.apiKeyEnv, ""))
      : true,
  };
}

export function deriveAgentRuntimePhase(input: {
  execution: "local" | "remote";
  available: boolean;
  busy?: boolean;
  loadedAlias?: string | null;
  loadingAlias?: string | null;
  loadingError?: string | null;
  supervisorAlive?: boolean;
  gatewayAlive?: boolean;
  message?: string;
}) {
  if (input.execution === "remote") return { phase: "remote" as const, phaseDetail: "Remote target. No local runtime queue." };
  if (input.loadingError) return { phase: "error" as const, phaseDetail: input.loadingError };
  if (input.loadingAlias) return { phase: "loading" as const, phaseDetail: `Loading ${input.loadingAlias}` };
  if (input.available && input.busy) return { phase: "busy" as const, phaseDetail: "The local runtime is serializing requests." };
  if (input.available && !input.loadedAlias) return { phase: "unloaded" as const, phaseDetail: "No local model is currently loaded. The gateway is idle and ready for a prewarm or chat request." };
  if (input.available) return { phase: "ready" as const, phaseDetail: "The local runtime is ready." };
  if (input.supervisorAlive || input.gatewayAlive) return { phase: "recovering" as const, phaseDetail: input.message || "The local runtime is starting or recovering." };
  return { phase: "offline" as const, phaseDetail: input.message || "The local runtime is unavailable." };
}
