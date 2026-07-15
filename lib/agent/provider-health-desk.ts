import { readChatLogs, readConnectionCheckLogs } from "@/lib/agent/log-store";
import { listServerAgentTargets } from "@/lib/agent/server-targets";
import {
  resolveRemoteBenchmarkPolicy,
  type RemoteBenchmarkProviderKind,
} from "@/lib/agent/benchmark-remote-policy";
import type {
  AgentProviderHealthDeskItem,
  AgentProviderProfile,
  AgentThinkingMode,
  AgentTarget,
} from "@/lib/agent/types";
import type { StoredChatLog } from "@/lib/agent/log-store";

type ProviderPricing = {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
};

// Pricing is intentionally approximate and only wired for providers we already benchmark heavily.
// These values were aligned to the current official pricing pages on 2026-04-18.
const PROVIDER_PRICING: Record<string, ProviderPricing> = {
  "openai-gpt54:standard": { inputUsdPer1M: 2.5, outputUsdPer1M: 15 },
  "openai-gpt54:thinking": { inputUsdPer1M: 2.5, outputUsdPer1M: 15 },
  "anthropic-claude:standard": { inputUsdPer1M: 5, outputUsdPer1M: 25 },
  "anthropic-claude:thinking": { inputUsdPer1M: 5, outputUsdPer1M: 25 },
  "deepseek-api:standard": { inputUsdPer1M: 0.27, outputUsdPer1M: 1.1 },
  "deepseek-api:thinking": { inputUsdPer1M: 0.55, outputUsdPer1M: 2.19 }
};

function average(values: number[]) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function classifyFailureMessage(message: string | undefined) {
  const normalized = (message || "").toLowerCase();
  return {
    timeout:
      normalized.includes("timeout") ||
      normalized.includes("timed out") ||
      normalized.includes("first token timeout") ||
      normalized.includes("stream idle timeout"),
    rateLimit: normalized.includes("429") || normalized.includes("rate limit"),
    auth:
      normalized.includes("401") ||
      normalized.includes("403") ||
      normalized.includes("unauthorized") ||
      normalized.includes("forbidden") ||
      normalized.includes("invalid api key") ||
      normalized.includes("auth"),
    network:
      normalized.includes("connection") ||
      normalized.includes("network") ||
      normalized.includes("abort") ||
      normalized.includes("empty")
  };
}

function estimateCostUsd(targetId: string, thinkingMode: AgentThinkingMode | undefined, promptTokens: number, completionTokens: number) {
  const pricing = PROVIDER_PRICING[`${targetId}:${thinkingMode || "standard"}`];
  if (!pricing) return null;
  const promptCost = (promptTokens / 1_000_000) * pricing.inputUsdPer1M;
  const completionCost = (completionTokens / 1_000_000) * pricing.outputUsdPer1M;
  return Number((promptCost + completionCost).toFixed(4));
}

function estimateRowCostUsd(targetId: string, row: StoredChatLog) {
  return estimateCostUsd(
    targetId,
    row.thinkingMode,
    row.usage?.promptTokens || 0,
    row.usage?.completionTokens || 0,
  );
}

function sumEstimatedCostUsd(targetId: string, rows: StoredChatLog[]) {
  const total = rows.reduce((sum, row) => sum + (estimateRowCostUsd(targetId, row) || 0), 0);
  return Number.isFinite(total) && total > 0 ? Number(total.toFixed(4)) : null;
}

function compactHourLabel(value: Date) {
  return value.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildTrendBuckets(targetId: string, rows: StoredChatLog[], now = Date.now()) {
  const bucketMs = 4 * 60 * 60 * 1000;
  const bucketCount = 6;
  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStartMs = now - (bucketCount - index) * bucketMs;
    const bucketEndMs = bucketStartMs + bucketMs;
    const bucketRows = rows.filter((row) => {
      const completed = new Date(row.completedAt).getTime();
      return Number.isFinite(completed) && completed >= bucketStartMs && completed < bucketEndMs;
    });
    const failureRows = bucketRows.filter((row) => !row.ok);
    let timeoutCount = 0;
    let rateLimitCount = 0;
    let authFailureCount = 0;
    for (const row of failureRows) {
      const flags = classifyFailureMessage(row.warning || row.outputPreview);
      if (flags.timeout) timeoutCount += 1;
      if (flags.rateLimit) rateLimitCount += 1;
      if (flags.auth) authFailureCount += 1;
    }
    const successRows = bucketRows.filter((row) => row.ok);
    return {
      bucketStart: new Date(bucketStartMs).toISOString(),
      bucketLabel: compactHourLabel(new Date(bucketStartMs)),
      totalRequests: bucketRows.length,
      failureCount: failureRows.length,
      timeoutCount,
      rateLimitCount,
      authFailureCount,
      avgFirstTokenLatencyMs: average(
        successRows.flatMap((row) =>
          typeof row.firstTokenLatencyMs === "number" ? [row.firstTokenLatencyMs] : [],
        ),
      ),
      estimatedCostUsd: sumEstimatedCostUsd(targetId, bucketRows),
    };
  });
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    map.set(key, [...(map.get(key) || []), row]);
  }
  return map;
}

function buildModelBreakdown(targetId: string, rows: StoredChatLog[]) {
  return [...groupBy(rows, (row) => row.resolvedModel || "unknown").entries()]
    .map(([resolvedModel, modelRows]) => {
      const successRows = modelRows.filter((row) => row.ok);
      return {
        resolvedModel,
        totalRequests: modelRows.length,
        failureCount: modelRows.filter((row) => !row.ok).length,
        avgFirstTokenLatencyMs: average(
          successRows.flatMap((row) =>
            typeof row.firstTokenLatencyMs === "number" ? [row.firstTokenLatencyMs] : [],
          ),
        ),
        estimatedCostUsd: sumEstimatedCostUsd(targetId, modelRows),
      };
    })
    .sort((left, right) => right.totalRequests - left.totalRequests)
    .slice(0, 4);
}

function buildProfileBreakdown(targetId: string, rows: StoredChatLog[]) {
  return [...groupBy(rows, (row) => `${row.providerProfile || "unknown"}:${row.thinkingMode || "unknown"}`).entries()]
    .map(([key, profileRows]) => {
      const [providerProfile, thinkingMode] = key.split(":") as [
        AgentProviderProfile | "unknown",
        AgentThinkingMode | "unknown",
      ];
      const successRows = profileRows.filter((row) => row.ok);
      return {
        providerProfile,
        thinkingMode,
        totalRequests: profileRows.length,
        failureCount: profileRows.filter((row) => !row.ok).length,
        avgFirstTokenLatencyMs: average(
          successRows.flatMap((row) =>
            typeof row.firstTokenLatencyMs === "number" ? [row.firstTokenLatencyMs] : [],
          ),
        ),
        estimatedCostUsd: sumEstimatedCostUsd(targetId, profileRows),
      };
    })
    .sort((left, right) => right.totalRequests - left.totalRequests)
    .slice(0, 5);
}

function buildPolicyRecommendation(input: {
  totalRequests: number;
  failureCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  authFailureCount: number;
  avgFirstTokenLatencyMs: number | null;
  lastConnectionOk: boolean | null;
}): AgentProviderHealthDeskItem["policyRecommendation"] {
  if (!input.totalRequests) {
    return {
      severity: input.lastConnectionOk === false ? "action" : "watch",
      summary:
        input.lastConnectionOk === false
          ? "Connection check is failing before production traffic."
          : "No recent traffic; run a connection check or smoke request before release.",
      actions:
        input.lastConnectionOk === false
          ? ["Verify API key and base URL.", "Run a provider connection check.", "Keep this target out of release benchmarks."]
          : ["Run a smoke request.", "Add this target to the provider regression batch."],
    };
  }

  const failureRate = input.failureCount / input.totalRequests;
  if (input.authFailureCount > 0) {
    return {
      severity: "action",
      summary: "Authentication failures detected; this provider should not be used for release evidence.",
      actions: ["Rotate or re-check the API key.", "Confirm endpoint/base URL.", "Re-run connection check after fixing credentials."],
    };
  }
  if (input.rateLimitCount > 0) {
    return {
      severity: "action",
      summary: "Rate-limit or quota pressure is visible in recent traffic.",
      actions: ["Lower concurrency.", "Switch release benchmark to a cheaper profile.", "Check quota/billing before long runs."],
    };
  }
  if (failureRate >= 0.2 || input.timeoutCount >= 2) {
    return {
      severity: "watch",
      summary: "Reliability is below release comfort; timeouts or failures need review.",
      actions: ["Increase first-token or total timeout for long tasks.", "Compare speed vs balanced profile.", "Inspect latest failure summaries before retrying."],
    };
  }
  if (typeof input.avgFirstTokenLatencyMs === "number" && input.avgFirstTokenLatencyMs > 5000) {
    return {
      severity: "watch",
      summary: "First-token latency is high compared with interactive usage expectations.",
      actions: ["Use speed profile for short turns.", "Reserve thinking mode for complex tasks.", "Check provider status page if latency jumped recently."],
    };
  }
  return {
    severity: "ok",
    summary: "Recent provider traffic is within the current release comfort band.",
    actions: ["Keep this provider in the regression batch.", "Review cost trend before larger benchmark runs."],
  };
}

function inferProviderKind(target: AgentTarget): RemoteBenchmarkProviderKind {
  const baseUrl = target.baseUrlDefault.toLowerCase();
  const model = `${target.modelDefault} ${target.thinkingModelDefault || ""}`.toLowerCase();
  if (target.id === "anthropic-claude" || model.includes("claude")) return "claude-compatible";
  if (target.id === "deepseek-api" || baseUrl.includes("deepseek") || model.includes("deepseek")) {
    return "deepseek-compatible";
  }
  if (target.id === "kimi-api" || baseUrl.includes("moonshot") || model.includes("kimi")) {
    return "moonshot-compatible";
  }
  if (target.id === "glm-api" || baseUrl.includes("bigmodel") || model.includes("glm")) {
    return "zhipu-compatible";
  }
  if (target.id === "qwen-api" || baseUrl.includes("dashscope") || model.includes("qwen")) {
    return "dashscope-compatible";
  }
  return "openai-compatible";
}

function buildRetryPolicyView(input: {
  target: AgentTarget;
  failureRatePct: number;
  timeoutCount: number;
  rateLimitCount: number;
  authFailureCount: number;
  avgFirstTokenLatencyMs: number | null;
}): AgentProviderHealthDeskItem["retryPolicy"] {
  const providerKind = inferProviderKind(input.target);
  const templateInputs: Array<{
    id: string;
    label: string;
    workloadId: string;
    providerProfile: AgentProviderProfile;
    thinkingMode: AgentThinkingMode;
    retryCadence: string;
    fallbackProfile: AgentProviderProfile;
  }> = [
    {
      id: "interactive-speed",
      label: "Interactive speed",
      workloadId: "latency-smoke",
      providerProfile: "speed",
      thinkingMode: "standard",
      retryCadence: "500ms -> 1500ms -> 2500ms for timeout-shaped failures",
      fallbackProfile: "balanced",
    },
    {
      id: "balanced-release",
      label: "Balanced release",
      workloadId: "instruction-following-lite",
      providerProfile: "balanced",
      thinkingMode: "standard",
      retryCadence: "1000ms -> 2500ms -> 5000ms for transient failures",
      fallbackProfile: "balanced",
    },
    {
      id: "tool-thinking",
      label: "Tool / thinking",
      workloadId: "bfcl-starter",
      providerProfile: "tool-first",
      thinkingMode: input.target.thinkingModelDefault || input.target.thinkingModelEnv ? "thinking" : "standard",
      retryCadence: "2000ms -> 5000ms -> 10000ms for tool or reasoning runs",
      fallbackProfile: "tool-first",
    },
  ];
  const templates = templateInputs.map((template) => ({
    ...template,
    ...resolveRemoteBenchmarkPolicy({
      workloadId: template.workloadId,
      providerProfile: template.providerProfile,
      thinkingMode: template.thinkingMode,
      providerKind,
    }),
  }));
  const recommendedTemplateId =
    input.authFailureCount > 0 || input.rateLimitCount > 0
      ? "balanced-release"
      : input.timeoutCount > 1 || (input.avgFirstTokenLatencyMs ?? 0) > 5000
        ? "tool-thinking"
        : input.failureRatePct > 10
          ? "balanced-release"
          : "interactive-speed";
  return {
    providerKind,
    recommendedTemplateId,
    templates,
  };
}

function classifyProviderStatus(input: {
  totalRequests: number;
  failureCount: number;
  authFailureCount: number;
  rateLimitCount: number;
  lastConnectionOk: boolean | null;
}): AgentProviderHealthDeskItem["status"] {
  if (!input.totalRequests) return "no-traffic";
  if (input.authFailureCount > 0 || input.lastConnectionOk === false) return "unhealthy";
  if (input.rateLimitCount > 0 || pct(input.failureCount, input.totalRequests) >= 20) return "degraded";
  return "healthy";
}

export function buildProviderHealthDesk(options?: {
  sinceIso?: string;
}) {
  const remoteTargets = listServerAgentTargets().filter((target) => target.execution === "remote");
  const chatLogs = readChatLogs({ sinceIso: options?.sinceIso, limit: 2000 }).filter((row) => row.execution === "remote");
  const connectionChecks = readConnectionCheckLogs({ sinceIso: options?.sinceIso, limit: 400 })
    .filter((row) => remoteTargets.some((target) => target.id === row.targetId));

  return remoteTargets
    .map<AgentProviderHealthDeskItem>((target) => {
      const targetRows = chatLogs.filter((row) => row.targetId === target.id);
      const successRows = targetRows.filter((row) => row.ok);
      const failureRows = targetRows.filter((row) => !row.ok);
      const lastFailure = failureRows[failureRows.length - 1] || null;
      const lastSuccess = successRows[successRows.length - 1] || null;
      const latestConnectionCheck = connectionChecks
        .filter((row) => row.targetId === target.id)
        .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt))
        .pop() || null;

      let timeoutCount = 0;
      let rateLimitCount = 0;
      let authFailureCount = 0;
      let networkFailureCount = 0;
      for (const row of failureRows) {
        const flags = classifyFailureMessage(row.warning || row.outputPreview);
        if (flags.timeout) timeoutCount += 1;
        if (flags.rateLimit) rateLimitCount += 1;
        if (flags.auth) authFailureCount += 1;
        if (flags.network) networkFailureCount += 1;
      }

      const totalPromptTokens = targetRows.reduce((sum, row) => sum + (row.usage?.promptTokens || 0), 0);
      const totalCompletionTokens = targetRows.reduce((sum, row) => sum + (row.usage?.completionTokens || 0), 0);
      const totalTokens = targetRows.reduce((sum, row) => sum + (row.usage?.totalTokens || 0), 0);
      const estimatedCostUsd = sumEstimatedCostUsd(target.id, targetRows);
      const avgFirstTokenLatencyMs = average(successRows.flatMap((row) => (typeof row.firstTokenLatencyMs === "number" ? [row.firstTokenLatencyMs] : [])));
      const successRatePct = pct(successRows.length, targetRows.length);
      const failureRatePct = pct(failureRows.length, targetRows.length);
      const lastConnectionOk = latestConnectionCheck?.ok ?? null;
      const status = classifyProviderStatus({
        totalRequests: targetRows.length,
        failureCount: failureRows.length,
        authFailureCount,
        rateLimitCount,
        lastConnectionOk,
      });

      return {
        targetId: target.id,
        targetLabel: target.label,
        providerLabel: target.providerLabel,
        resolvedModel: lastSuccess?.resolvedModel || lastFailure?.resolvedModel || target.modelDefault,
        status,
        totalRequests: targetRows.length,
        successCount: successRows.length,
        failureCount: failureRows.length,
        successRatePct,
        failureRatePct,
        timeoutCount,
        rateLimitCount,
        authFailureCount,
        networkFailureCount,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        estimatedCostUsd,
        pricingSource: PROVIDER_PRICING[`${target.id}:standard`] ? "official" : "unavailable",
        avgFirstTokenLatencyMs,
        avgLatencyMs: average(successRows.map((row) => row.latencyMs)),
        lastSuccessAt: lastSuccess?.completedAt || null,
        lastFailureAt: lastFailure?.completedAt || null,
        lastFailureSummary: lastFailure?.warning || null,
        lastConnectionOk,
        lastConnectionAt: latestConnectionCheck?.checkedAt || null,
        lastConnectionSummary: latestConnectionCheck?.stages
          ?.map((stage) => `${stage.id}: ${stage.summary}`)
          .join(" · ") || null,
        trendBuckets: buildTrendBuckets(target.id, targetRows),
        modelBreakdown: buildModelBreakdown(target.id, targetRows),
        profileBreakdown: buildProfileBreakdown(target.id, targetRows),
        retryPolicy: buildRetryPolicyView({
          target,
          failureRatePct,
          timeoutCount,
          rateLimitCount,
          authFailureCount,
          avgFirstTokenLatencyMs,
        }),
        policyRecommendation: buildPolicyRecommendation({
          totalRequests: targetRows.length,
          failureCount: failureRows.length,
          timeoutCount,
          rateLimitCount,
          authFailureCount,
          avgFirstTokenLatencyMs,
          lastConnectionOk,
        }),
      };
    })
    .sort((left, right) => {
      const leftTime = left.lastSuccessAt || left.lastFailureAt || "";
      const rightTime = right.lastSuccessAt || right.lastFailureAt || "";
      return rightTime.localeCompare(leftTime) || left.targetLabel.localeCompare(right.targetLabel);
    });
}
