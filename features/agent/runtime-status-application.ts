import { getServerAgentTarget } from "@/lib/agent/server-targets";
import {
  getLocalGatewayPythonInfo,
  getLocalGatewaySupervisorInfo,
} from "@/lib/agent/local-gateway";
import { readRuntimeProcessMetrics } from "@/lib/agent/runtime-process-metrics";
import { buildRuntimeResourceGuardrail } from "@/lib/agent/runtime-safety";
import { normalizeThinkingMode } from "@/lib/agent/providers";
import type { AgentRuntimeStatus } from "@/lib/agent/types";
import {
  loadAgentLocalEnv,
  readAgentEnv,
  resolveAgentRuntimeTarget,
} from "./runtime-target-resolution";
import {
  buildReadyLocalRuntimeStatus,
  buildRecoveringLocalRuntimeStatus,
  buildUnavailableLocalRuntimeStatus,
} from "./runtime-local-status";
import { resolveLocalRuntimeHealth } from "./runtime-local-health";
import { buildRemoteAgentRuntimeStatus } from "./runtime-remote-status";

export type AgentRuntimeStatusApplicationResult = {
  status: number;
  payload: AgentRuntimeStatus | { error: string };
};

function runtimeResult(
  payload: AgentRuntimeStatusApplicationResult["payload"],
  status = 200,
): AgentRuntimeStatusApplicationResult {
  return { status, payload };
}

export async function handleAgentRuntimeStatusRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("targetId");
  const thinkingMode = normalizeThinkingMode(searchParams.get("thinkingMode") || undefined);

  if (!targetId) {
    return runtimeResult({ error: "targetId is required." }, 400);
  }

  const target = getServerAgentTarget(targetId);
  if (!target) {
    return runtimeResult({ error: `Unknown target: ${targetId}` }, 404);
  }

  const localEnv = loadAgentLocalEnv();
  const resolvedTarget = resolveAgentRuntimeTarget(target, thinkingMode, localEnv);
  const standardResolvedTarget = resolveAgentRuntimeTarget(target, "standard", localEnv);
  const thinkingResolvedTarget =
    target.execution === "remote" ? resolveAgentRuntimeTarget(target, "thinking", localEnv) : null;
  const thinkingModelConfigured =
    target.execution === "remote"
      ? Boolean(target.thinkingModelEnv && readAgentEnv(localEnv, target.thinkingModelEnv, ""))
      : false;
  const supervisor = getLocalGatewaySupervisorInfo();
  const baseProcessMetrics = readRuntimeProcessMetrics(supervisor.gatewayPid ?? supervisor.supervisorPid, {
    modelSourcePath: target.sourcePath
  });
  const baseGuardrail = buildRuntimeResourceGuardrail({
    resolvedModel: resolvedTarget.resolvedModel,
    loadedAlias: null,
    processMetrics: baseProcessMetrics,
    parameterScale: target.parameterScale,
    quantizationLabel: target.quantizationLabel
  });

  if (target.execution !== "local") {
    const payload = buildRemoteAgentRuntimeStatus({
      targetId,
      target,
      thinkingMode,
      resolvedTarget,
      standardResolvedTarget,
      thinkingResolvedTarget,
      thinkingModelConfigured,
      processMetrics: baseProcessMetrics,
      guardrail: baseGuardrail,
    });
    return runtimeResult(payload);
  }

  const resolvedBaseUrl = readAgentEnv(localEnv, target.baseUrlEnv, target.baseUrlDefault).replace(/\/$/, "");
  const healthUrl = `${resolvedBaseUrl.replace(/\/v1$/, "")}/health`;
  const pythonRuntime = getLocalGatewayPythonInfo();

  try {
    const health = await resolveLocalRuntimeHealth({
      resolvedBaseUrl,
      healthUrl,
      supervisor,
    });
    if (health.state === "recovering") {
      const payload = buildRecoveringLocalRuntimeStatus({
        targetId,
        target,
        thinkingMode,
        resolvedTarget,
        standardResolvedTarget,
        thinkingResolvedTarget,
        thinkingModelConfigured,
        processMetrics: baseProcessMetrics,
        guardrail: baseGuardrail,
        pythonRuntime,
        supervisor,
      });
      return runtimeResult(payload);
    }
    const data = health.data;
    const loadedAlias =
      typeof data.loaded_alias === "string" || data.loaded_alias === null
        ? (data.loaded_alias as string | null)
        : null;
    const loadingAlias =
      typeof data.loading_alias === "string" || data.loading_alias === null
        ? (data.loading_alias as string | null)
        : null;
    const busy = Boolean(data.busy);
    const processMetrics = readRuntimeProcessMetrics(supervisor.gatewayPid ?? supervisor.supervisorPid, {
      modelSourcePath: target.sourcePath,
      runtimeBusy: busy
    });
    const guardrail = buildRuntimeResourceGuardrail({
      resolvedModel: resolvedTarget.resolvedModel,
      loadedAlias,
      processMetrics,
      parameterScale: target.parameterScale,
      quantizationLabel: target.quantizationLabel
    });
    const payload = buildReadyLocalRuntimeStatus({
      targetId,
      target,
      thinkingMode,
      resolvedTarget,
      standardResolvedTarget,
      thinkingResolvedTarget,
      thinkingModelConfigured,
      processMetrics,
      guardrail,
      pythonRuntime,
      supervisor,
      data,
      busy,
      loadedAlias,
      loadingAlias,
    });
    return runtimeResult(payload);
  } catch (error) {
    const payload = buildUnavailableLocalRuntimeStatus({
      targetId,
      target,
      thinkingMode,
      resolvedTarget,
      standardResolvedTarget,
      thinkingResolvedTarget,
      thinkingModelConfigured,
      processMetrics: baseProcessMetrics,
      guardrail: baseGuardrail,
      pythonRuntime,
      supervisor,
      message: error instanceof Error ? error.message : "Local runtime unavailable.",
    });
    return runtimeResult(payload);
  }
}
