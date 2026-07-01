import { NextResponse } from "next/server";
import { listServerAgentTargets, syncDiscoveredLocalTargetsFromGateway } from "@/lib/agent/server-targets";
import { runRemoteConnectionCheck } from "@/lib/agent/connection-check";
import { clearProviderEnvCache } from "@/lib/agent/providers";
import { getLocalGatewaySupervisorInfo } from "@/lib/agent/local-gateway";
import { readRuntimeProcessMetrics } from "@/lib/agent/runtime-process-metrics";
import { buildRuntimeResourceGuardrail } from "@/lib/agent/runtime-safety";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import type { AgentConnectionCheckResponse, AgentTarget } from "@/lib/agent/types";

export const runtime = "nodejs";

function decorateTargetsWithLoadGuardrails(targets: AgentTarget[]) {
  const supervisor = getLocalGatewaySupervisorInfo();
  const gatewayPid = supervisor.gatewayPid ?? supervisor.supervisorPid;
  return targets.map((target) => {
    if (target.execution !== "local") {
      return target;
    }
    const processMetrics = readRuntimeProcessMetrics(gatewayPid, {
      modelSourcePath: target.sourcePath
    });
    const guardrail = buildRuntimeResourceGuardrail({
      resolvedModel: target.modelDefault,
      loadedAlias: null,
      processMetrics,
      parameterScale: target.parameterScale,
      quantizationLabel: target.quantizationLabel
    });
    return {
      ...target,
      loadGuardrailLevel: guardrail.level,
      loadGuardrailSummary: guardrail.summary
    } satisfies AgentTarget;
  });
}

export async function GET() {
  try {
    const targets = await syncDiscoveredLocalTargetsFromGateway();
    return NextResponse.json({
      ok: true,
      targets: decorateTargetsWithLoadGuardrails(targets)
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load agent targets.",
      targets: decorateTargetsWithLoadGuardrails(listServerAgentTargets())
    });
  }
}

type ScanTargetsResponse = {
  ok: boolean;
  targets: AgentTarget[];
  remoteChecks: Record<string, AgentConnectionCheckResponse>;
  summary: {
    scannedAt: string;
    localNewTargetIds: string[];
    localRemovedTargetIds: string[];
    remoteConfiguredCount: number;
    remoteHealthyCount: number;
    remoteSkippedTargetIds: string[];
  };
  error?: string;
};

export async function POST() {
  const beforeTargets = listServerAgentTargets();
  const beforeIds = new Set(beforeTargets.map((target) => target.id));
  clearProviderEnvCache();

  try {
    const targets = await syncDiscoveredLocalTargetsFromGateway();
    const targetIds = new Set(targets.map((target) => target.id));
    const localNewTargetIds = targets
      .filter((target) => target.execution === "local" && !beforeIds.has(target.id))
      .map((target) => target.id);
    const localRemovedTargetIds = beforeTargets
      .filter((target) => target.execution === "local" && !targetIds.has(target.id))
      .map((target) => target.id);

    const remoteTargets = targets.filter(
      (target) => target.execution === "remote" && target.transport === "openai-compatible" && Boolean(target.apiKeyEnv)
    );
    const remoteChecks: Record<string, AgentConnectionCheckResponse> = {};
    const remoteSkippedTargetIds: string[] = [];
    let remoteConfiguredCount = 0;
    let remoteHealthyCount = 0;

    for (const target of remoteTargets) {
      try {
        const result = await runRemoteConnectionCheck(target.id, {
          mode: "quick",
          log: false
        });
        remoteChecks[target.id] = result;
        remoteConfiguredCount += 1;
        if (result.ok) {
          remoteHealthyCount += 1;
        }
      } catch {
        remoteSkippedTargetIds.push(target.id);
      }
    }

    const summary = {
      scannedAt: new Date().toISOString(),
      localNewTargetIds,
      localRemovedTargetIds,
      remoteConfiguredCount,
      remoteHealthyCount,
      remoteSkippedTargetIds
    };
    appendExperimentEvent({
      kind: "model",
      status:
        remoteConfiguredCount > 0 && remoteHealthyCount < remoteConfiguredCount
          ? "failed"
          : "completed",
      title: "Agent target scan completed",
      summary: `Local +${localNewTargetIds.length} / -${localRemovedTargetIds.length}; remote healthy ${remoteHealthyCount}/${remoteConfiguredCount}${remoteSkippedTargetIds.length ? `; skipped ${remoteSkippedTargetIds.length}` : ""}.`,
      targetIds: targets.map((target) => target.id),
      artifacts: [
        {
          kind: "api",
          role: "manifest",
          label: "Agent target catalog",
          uri: "/api/agent/targets",
        },
      ],
      metadata: {
        localAdded: localNewTargetIds.length,
        localRemoved: localRemovedTargetIds.length,
        remoteConfigured: remoteConfiguredCount,
        remoteHealthy: remoteHealthyCount,
        remoteSkipped: remoteSkippedTargetIds.length,
      },
    });

    return NextResponse.json({
      ok: true,
      targets: decorateTargetsWithLoadGuardrails(targets),
      remoteChecks,
      summary
    } satisfies ScanTargetsResponse);
  } catch (error) {
    appendExperimentEvent({
      kind: "model",
      status: "failed",
      title: "Agent target scan failed",
      summary: error instanceof Error ? error.message : "Failed to scan agent targets.",
      artifacts: [
        {
          kind: "api",
          role: "manifest",
          label: "Agent target catalog",
          uri: "/api/agent/targets",
        },
      ],
    });
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to scan agent targets.",
      targets: decorateTargetsWithLoadGuardrails(listServerAgentTargets()),
      remoteChecks: {},
      summary: {
        scannedAt: new Date().toISOString(),
        localNewTargetIds: [],
        localRemovedTargetIds: [],
        remoteConfiguredCount: 0,
        remoteHealthyCount: 0,
        remoteSkippedTargetIds: []
      }
    } satisfies ScanTargetsResponse);
  }
}
