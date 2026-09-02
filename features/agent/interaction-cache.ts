import { createHash } from "node:crypto";

import { readChatLogs, type StoredChatLog } from "@/lib/agent/log-store";

export const AGENT_INTERACTION_CACHE_SCHEMA_VERSION =
  "agent.interaction-cache-attribution.v1" as const;

type CacheObservation = Pick<
  StoredChatLog,
  "id" | "targetId" | "resolvedModel" | "cacheHit" | "cacheMode" | "latencyMs" | "usage"
>;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
}

export function buildInteractionCacheAttribution(rows: CacheObservation[]) {
  const attributed = rows.filter((row) => typeof row.cacheHit === "boolean");
  const hits = attributed.filter((row) => row.cacheHit);
  const misses = attributed.filter((row) => !row.cacheHit);
  const byTarget = [...new Set(attributed.map((row) => row.targetId))].map((targetId) => {
    const targetRows = attributed.filter((row) => row.targetId === targetId);
    const targetHits = targetRows.filter((row) => row.cacheHit);
    return {
      targetId,
      observations: targetRows.length,
      hitRatePct: targetRows.length
        ? Number(((targetHits.length / targetRows.length) * 100).toFixed(2))
        : 0,
      observedPromptTokensOnHits: targetHits.reduce(
        (sum, row) => sum + row.usage.promptTokens,
        0,
      ),
      averageLatencyMs: average(targetRows.map((row) => row.latencyMs)),
    };
  });
  const withoutDigest = {
    observations: rows.length,
    attributed: attributed.length,
    hits: hits.length,
    misses: misses.length,
    hitRatePct: attributed.length
      ? Number(((hits.length / attributed.length) * 100).toFixed(2))
      : 0,
    hitLatencyMs: average(hits.map((row) => row.latencyMs)),
    missLatencyMs: average(misses.map((row) => row.latencyMs)),
    observedPromptTokensOnHits: hits.reduce(
      (sum, row) => sum + row.usage.promptTokens,
      0,
    ),
    byTarget,
  };
  return { ...withoutDigest, attributionDigest: digest(withoutDigest) };
}

export function readInteractionCacheEvidence() {
  const attribution = buildInteractionCacheAttribution(readChatLogs({ limit: 500 }));
  return {
    ok: true as const,
    schemaVersion: AGENT_INTERACTION_CACHE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass" as const,
    localStatus:
      attribution.hits > 0 && attribution.misses > 0
        ? "pass" as const
        : "hold" as const,
    productionStatus: "hold" as const,
    attribution,
    blockers: [
      ...(attribution.hits > 0 && attribution.misses > 0
        ? []
        : ["Both cache-hit and cache-miss observations are required for a local comparison."]),
      "Provider-native cached-token billing receipts are required before observed prompt tokens may be reported as financial savings.",
    ],
  };
}
