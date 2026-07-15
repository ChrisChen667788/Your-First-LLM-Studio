import { readRuntimeProcessMetrics } from "@/lib/agent/runtime-process-metrics";
import { buildRuntimeResourceGuardrail } from "@/lib/agent/runtime-safety";
import type {
  AgentRuntimeStatus,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";
import { deriveAgentRuntimePhase, resolveAgentRuntimeTarget } from "./runtime-target-resolution";

type ResolvedRuntimeTarget = ReturnType<typeof resolveAgentRuntimeTarget>;
type RuntimeProcessMetrics = ReturnType<typeof readRuntimeProcessMetrics>;
type RuntimeResourceGuardrail = ReturnType<typeof buildRuntimeResourceGuardrail>;

export function buildRemoteAgentRuntimeStatus(input: {
  targetId: string;
  target: AgentTarget;
  thinkingMode: AgentThinkingMode;
  resolvedTarget: ResolvedRuntimeTarget;
  standardResolvedTarget: ResolvedRuntimeTarget;
  thinkingResolvedTarget: ResolvedRuntimeTarget | null;
  thinkingModelConfigured: boolean;
  processMetrics: RuntimeProcessMetrics;
  guardrail: RuntimeResourceGuardrail;
}) {
  const { target, resolvedTarget, processMetrics, guardrail } = input;
  const missingKeyMessage =
    target.apiKeyEnv && !resolvedTarget.apiKeyConfigured
      ? `Missing ${target.apiKeyEnv}. Add it to .env.local before using ${target.label}.`
      : null;
  const phase = deriveAgentRuntimePhase({
    execution: target.execution,
    available: !missingKeyMessage,
  });
  const payload: AgentRuntimeStatus = {
    targetId: input.targetId,
    targetLabel: target.label,
    execution: target.execution,
    available: !missingKeyMessage,
    phase: phase.phase,
    phaseDetail: missingKeyMessage || phase.phaseDetail,
    resolvedModel: resolvedTarget.resolvedModel,
    resolvedBaseUrl: resolvedTarget.resolvedBaseUrl,
    standardResolvedModel: input.standardResolvedTarget.resolvedModel,
    thinkingResolvedModel: input.thinkingResolvedTarget?.resolvedModel || null,
    activeThinkingMode: input.thinkingMode,
    thinkingModelConfigured: input.thinkingModelConfigured,
    busy: false,
    queueDepth: 0,
    activeRequests: 0,
    gatewayCpuPct: processMetrics.gatewayCpuPct,
    gatewayResidentMemoryMb: processMetrics.gatewayResidentMemoryMb,
    gatewayGpuPct: processMetrics.gatewayGpuPct,
    gatewayGpuMemoryMb: processMetrics.gatewayGpuMemoryMb,
    gatewayEnergySignalPct: processMetrics.gatewayEnergySignalPct,
    gatewayDiskUsedPct: processMetrics.gatewayDiskUsedPct,
    modelStorageFootprintMb: processMetrics.modelStorageFootprintMb,
    resourceGuardrailLevel: guardrail.level,
    resourceGuardrailSummary: guardrail.summary,
    resourceGuardrailRecommendations: guardrail.recommendations,
    estimatedLoadMemoryMb: guardrail.estimatedLoadMemoryMb,
    estimatedPeakMemoryMb: guardrail.estimatedPeakMemoryMb,
    systemTotalMemoryMb: guardrail.systemTotalMemoryMb,
    systemFreeMemoryMb: guardrail.systemFreeMemoryMb,
    loadedAlias: null,
    message: missingKeyMessage || "Remote target. No local runtime queue.",
  };
  return payload;
}
