import type { LocalGatewayPythonInfo } from "@/lib/agent/local-gateway";
import { getLocalGatewaySupervisorInfo } from "@/lib/agent/local-gateway";
import { readRuntimeProcessMetrics } from "@/lib/agent/runtime-process-metrics";
import { buildRuntimeResourceGuardrail } from "@/lib/agent/runtime-safety";
import type {
  AgentRuntimeStatus,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";
import {
  deriveAgentRuntimePhase,
  resolveAgentRuntimeTarget,
} from "./runtime-target-resolution";

type ResolvedRuntimeTarget = ReturnType<typeof resolveAgentRuntimeTarget>;
type RuntimeProcessMetrics = ReturnType<typeof readRuntimeProcessMetrics>;
type RuntimeResourceGuardrail = ReturnType<typeof buildRuntimeResourceGuardrail>;
type LocalGatewaySupervisorInfo = ReturnType<typeof getLocalGatewaySupervisorInfo>;

type LocalRuntimeStatusBaseInput = {
  targetId: string;
  target: AgentTarget;
  thinkingMode: AgentThinkingMode;
  resolvedTarget: ResolvedRuntimeTarget;
  standardResolvedTarget: ResolvedRuntimeTarget;
  thinkingResolvedTarget: ResolvedRuntimeTarget | null;
  thinkingModelConfigured: boolean;
  processMetrics: RuntimeProcessMetrics;
  guardrail: RuntimeResourceGuardrail;
  pythonRuntime: LocalGatewayPythonInfo;
  supervisor: LocalGatewaySupervisorInfo;
};

function buildLocalRuntimeStatusBase(input: LocalRuntimeStatusBaseInput) {
  const { target, processMetrics, guardrail, supervisor } = input;
  return {
    targetId: input.targetId,
    targetLabel: target.label,
    execution: target.execution,
    resolvedModel: input.resolvedTarget.resolvedModel,
    resolvedBaseUrl: input.resolvedTarget.resolvedBaseUrl,
    standardResolvedModel: input.standardResolvedTarget.resolvedModel,
    thinkingResolvedModel: input.thinkingResolvedTarget?.resolvedModel || null,
    activeThinkingMode: input.thinkingMode,
    thinkingModelConfigured: input.thinkingModelConfigured,
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
    pythonRuntime: input.pythonRuntime,
    supervisorPid: supervisor.supervisorPid ?? null,
    supervisorAlive: supervisor.supervisorAlive,
    gatewayPid: supervisor.gatewayPid ?? null,
    gatewayAlive: supervisor.gatewayAlive,
    restartCount: supervisor.restartCount,
    lastStartAt: supervisor.lastStartAt,
    lastExitAt: supervisor.lastExitAt,
    lastExitCode: supervisor.lastExitCode,
    lastEvent: supervisor.lastEvent,
    logFile: supervisor.logFile,
  } satisfies Partial<AgentRuntimeStatus>;
}

export function buildRecoveringLocalRuntimeStatus(
  input: LocalRuntimeStatusBaseInput,
): AgentRuntimeStatus {
  return {
    ...buildLocalRuntimeStatusBase(input),
    available: false,
    phase: "recovering",
    phaseDetail: "Local runtime is starting, restarting, or temporarily busy.",
    busy: true,
    queueDepth: 0,
    activeRequests: 0,
    loadedAlias: null,
    loadingAlias: null,
    loadingElapsedMs: null,
    loadingError: null,
    lastEnsureReason:
      "Runtime probe timed out while the local gateway was already starting or busy.",
    message: "Local runtime is starting, restarting, or temporarily busy. Retry shortly.",
  };
}

export function buildReadyLocalRuntimeStatus(
  input: LocalRuntimeStatusBaseInput & {
    data: Record<string, unknown>;
    loadedAlias: string | null;
    loadingAlias: string | null;
    busy: boolean;
  },
): AgentRuntimeStatus {
  const { data, loadedAlias, loadingAlias, busy, supervisor } = input;
  const available = typeof data.loading_alias === "string" ? false : true;
  return {
    ...buildLocalRuntimeStatusBase(input),
    ...deriveAgentRuntimePhase({
      execution: input.target.execution,
      available,
      busy,
      loadedAlias,
      loadingAlias,
      loadingError: typeof data.loading_error === "string" ? data.loading_error : null,
      supervisorAlive: supervisor.supervisorAlive,
      gatewayAlive: supervisor.gatewayAlive,
    }),
    available,
    busy,
    queueDepth: typeof data.queue_depth === "number" ? data.queue_depth : 0,
    activeRequests: typeof data.active_requests === "number" ? data.active_requests : 0,
    loadedAlias,
    loadingAlias,
    loadingElapsedMs:
      typeof data.loading_elapsed_ms === "number" ? data.loading_elapsed_ms : null,
    loadingError: typeof data.loading_error === "string" ? data.loading_error : null,
    workspaceRoot: typeof data.workspace_root === "string" ? data.workspace_root : undefined,
    message:
      typeof data.loading_alias === "string"
        ? `Loading ${data.loading_alias}${
            typeof data.loading_elapsed_ms === "number"
              ? ` · ${Math.round(data.loading_elapsed_ms / 1000)}s`
              : ""
          }`
        : typeof data.status === "string"
          ? supervisor.supervisorAlive
            ? `${data.status} · supervisor:${supervisor.supervisorPid}`
            : data.status
          : undefined,
  };
}

export function buildUnavailableLocalRuntimeStatus(
  input: LocalRuntimeStatusBaseInput & { message: string },
): AgentRuntimeStatus {
  return {
    ...buildLocalRuntimeStatusBase(input),
    ...deriveAgentRuntimePhase({
      execution: input.target.execution,
      available: false,
      supervisorAlive: input.supervisor.supervisorAlive,
      gatewayAlive: input.supervisor.gatewayAlive,
      message: input.message,
    }),
    available: false,
    busy: false,
    queueDepth: 0,
    activeRequests: 0,
    loadedAlias: null,
    loadingAlias: null,
    loadingElapsedMs: null,
    loadingError: null,
    lastEnsureReason: input.message,
    message: input.message,
  };
}
