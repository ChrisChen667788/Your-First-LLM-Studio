import { createHash } from "node:crypto";

import { buildProviderHealthDesk } from "@/lib/agent/provider-health-desk";
import { readProviderDiscoveryPolicy } from "@/lib/agent/provider-capabilities";
import { listServerAgentTargets } from "@/lib/agent/server-targets";

export const WORKLOAD_ROUTING_SCHEMA_VERSION =
  "providers.workload-routing-scorecard.v1" as const;

export type RoutingWorkload =
  | "chat"
  | "coding"
  | "agent-tools"
  | "long-context"
  | "multimodal"
  | "benchmark-judge";

export type RoutingCandidateInput = {
  targetId: string;
  execution: "local" | "remote";
  qualityStatus: "measured" | "missing" | "stale";
  qualityScore: number | null;
  sampleCount: number;
  successRatePct: number | null;
  latencyMs: number | null;
  estimatedCostUsdPer1k: number | null;
  capabilities: {
    vision: boolean | "probe-required";
    tools: boolean | "probe-required";
    thinking: boolean | "probe-required";
  };
};

type RoutingPolicy = {
  requireLocal?: boolean;
  maxLatencyMs?: number;
  maxCostUsdPer1k?: number;
  minimumQualityScore?: number;
  requireVision?: boolean;
  requireTools?: boolean;
  requireThinking?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function capabilityPass(
  required: boolean | undefined,
  actual: boolean | "probe-required",
) {
  return !required || actual === true;
}

export function buildWorkloadRoutingScorecard(input: {
  workload: RoutingWorkload;
  candidates: RoutingCandidateInput[];
  policy?: RoutingPolicy;
}) {
  const policy = input.policy || {};
  const candidates = input.candidates.map((candidate) => {
    const exclusions = [
      ...(candidate.qualityStatus !== "measured"
        ? [`Quality evidence is ${candidate.qualityStatus}.`]
        : []),
      ...(candidate.sampleCount < 20
        ? ["At least 20 workload-aligned samples are required."]
        : []),
      ...(policy.requireLocal && candidate.execution !== "local"
        ? ["The policy requires local execution."]
        : []),
      ...(!capabilityPass(policy.requireVision, candidate.capabilities.vision)
        ? ["Native vision support is not verified."]
        : []),
      ...(!capabilityPass(policy.requireTools, candidate.capabilities.tools)
        ? ["Tool support is not verified."]
        : []),
      ...(!capabilityPass(policy.requireThinking, candidate.capabilities.thinking)
        ? ["Thinking support is not verified."]
        : []),
      ...(typeof policy.minimumQualityScore === "number" &&
      (candidate.qualityScore ?? -1) < policy.minimumQualityScore
        ? [`Quality is below ${policy.minimumQualityScore}.`]
        : []),
      ...(typeof policy.maxLatencyMs === "number" &&
      typeof candidate.latencyMs === "number" &&
      candidate.latencyMs > policy.maxLatencyMs
        ? [`Latency exceeds ${policy.maxLatencyMs} ms.`]
        : []),
      ...(typeof policy.maxCostUsdPer1k === "number" &&
      typeof candidate.estimatedCostUsdPer1k === "number" &&
      candidate.estimatedCostUsdPer1k > policy.maxCostUsdPer1k
        ? [`Estimated cost exceeds $${policy.maxCostUsdPer1k}/1K tokens.`]
        : []),
    ];
    const quality = clamp(candidate.qualityScore ?? 0);
    const reliability = clamp(candidate.successRatePct ?? 0);
    const latency = candidate.latencyMs === null
      ? 0
      : clamp(100 - candidate.latencyMs / 100);
    const cost = candidate.estimatedCostUsdPer1k === null
      ? 0
      : clamp(100 - candidate.estimatedCostUsdPer1k * 100);
    const locality = candidate.execution === "local" ? 100 : 50;
    const score = Number(
      (quality * 0.45 + reliability * 0.25 + latency * 0.12 + cost * 0.08 + locality * 0.1).toFixed(2),
    );
    return {
      ...candidate,
      eligible: exclusions.length === 0,
      exclusions,
      components: { quality, reliability, latency, cost, locality },
      score,
    };
  });
  const ranked = [...candidates]
    .filter((candidate) => candidate.eligible)
    .sort((left, right) => right.score - left.score || left.targetId.localeCompare(right.targetId));
  const selected = ranked[0] || null;
  const withoutDigest = {
    schemaVersion: WORKLOAD_ROUTING_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    workload: input.workload,
    policy,
    candidates,
    selectedTargetId: selected?.targetId || null,
    fallbackChain: ranked.slice(1).map((candidate) => ({
      targetId: candidate.targetId,
      reason: `Eligible fallback score ${candidate.score}.`,
    })),
    decision:
      selected
        ? `Selected ${selected.targetId} from measured workload evidence.`
        : "No candidate has sufficient measured quality and policy-compatible capability evidence.",
    failClosed: !selected,
  };
  return { ...withoutDigest, scorecardDigest: digest(withoutDigest) };
}

export function readWorkloadRoutingReadModel() {
  const health = buildProviderHealthDesk();
  const healthByTarget = new Map(health.map((entry) => [entry.targetId, entry]));
  const candidates: RoutingCandidateInput[] = listServerAgentTargets().map((target) => {
    const policy = readProviderDiscoveryPolicy(target.id);
    const targetHealth = healthByTarget.get(target.id);
    return {
      targetId: target.id,
      execution: target.execution,
      qualityStatus: "missing",
      qualityScore: null,
      sampleCount: 0,
      successRatePct: targetHealth?.successRatePct ?? null,
      latencyMs: targetHealth?.avgLatencyMs ?? null,
      estimatedCostUsdPer1k: targetHealth?.estimatedCostUsd ?? null,
      capabilities: {
        vision: policy?.capabilities.vision ?? "probe-required",
        tools: policy?.capabilities.tools ?? target.supportsTools,
        thinking: policy?.capabilities.thinking ?? Boolean(target.thinkingModelDefault),
      },
    };
  });
  return {
    ok: true as const,
    ...buildWorkloadRoutingScorecard({
      workload: "agent-tools",
      candidates,
      policy: { requireTools: true, minimumQualityScore: 60 },
    }),
    disclosure:
      "The default scorecard intentionally has no winner until workload-aligned quality evidence is attached. Provider traffic alone cannot promote a route.",
  };
}
