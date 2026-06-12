"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type {
  AgentConnectionCheckResponse,
  AgentConnectionCheckStage,
  AgentTarget,
} from "@/lib/agent/types";
import type { AgentTurn } from "./session-model";

type AgentTargetsScanResponse = {
  ok: boolean;
  targets?: AgentTarget[];
  remoteChecks?: Record<string, AgentConnectionCheckResponse>;
  summary?: {
    localNewTargetIds: string[];
    localRemovedTargetIds: string[];
    remoteConfiguredCount: number;
    remoteHealthyCount: number;
    remoteSkippedTargetIds: string[];
  };
  error?: string;
};

type AgentConnectionActionsLabels = {
  scanFailed: string;
  connectionCheckFailed: string;
  attentionNeeded: string;
  connectionRecord: string;
  latest: string;
  model: string;
  endpoint: string;
  ok: string;
  failed: string;
};

type LoadRuntimeStatus = (
  targetId?: string,
  options?: { force?: boolean },
) => Promise<void>;

type UseAgentConnectionActionsInput = {
  locale: string;
  selectedTarget: AgentTarget;
  selectedTargetId: string;
  pending: boolean;
  supportsConnectionCheck: boolean;
  scanTargetsPending: boolean;
  setScanTargetsPending: Dispatch<SetStateAction<boolean>>;
  setScanTargetsMessage: Dispatch<SetStateAction<string>>;
  setScanTargetsMessageTone: Dispatch<SetStateAction<"success" | "error">>;
  connectionCheckPending: boolean;
  setConnectionCheckPending: Dispatch<SetStateAction<boolean>>;
  setConnectionCheckError: Dispatch<SetStateAction<string>>;
  setConnectionChecksByTargetId: Dispatch<
    SetStateAction<Record<string, AgentConnectionCheckResponse>>
  >;
  setAvailableTargets: Dispatch<SetStateAction<AgentTarget[]>>;
  setTurns: Dispatch<SetStateAction<AgentTurn[]>>;
  loadRuntimeStatus: LoadRuntimeStatus;
  labels: AgentConnectionActionsLabels;
};

function formatConnectionStageNarrativeLabel(
  stageId: AgentConnectionCheckStage["id"],
) {
  switch (stageId) {
    case "models":
      return "models";
    case "chat":
      return "chat";
    case "tool_calls":
      return "tool calls";
    default:
      return stageId;
  }
}

function buildConnectionCheckNarrative(
  check: AgentConnectionCheckResponse,
  labels: Pick<
    AgentConnectionActionsLabels,
    "connectionRecord" | "latest" | "model" | "endpoint" | "ok" | "failed"
  >,
) {
  const lines = [
    `${labels.connectionRecord}: ${check.targetLabel}`,
    `${labels.latest}: ${check.ok ? labels.ok : labels.failed}`,
    `${labels.model}: ${check.resolvedModel}`,
    `${labels.endpoint}: ${check.resolvedBaseUrl}`,
    "",
    ...check.stages.map(
      (stage) =>
        `- ${formatConnectionStageNarrativeLabel(stage.id)}: ${stage.ok ? labels.ok : labels.failed} · ${stage.latencyMs} ms · ${stage.summary}`,
    ),
  ];
  return lines.join("\n");
}

export function useAgentConnectionActions({
  locale,
  selectedTarget,
  selectedTargetId,
  pending,
  supportsConnectionCheck,
  scanTargetsPending,
  setScanTargetsPending,
  setScanTargetsMessage,
  setScanTargetsMessageTone,
  connectionCheckPending,
  setConnectionCheckPending,
  setConnectionCheckError,
  setConnectionChecksByTargetId,
  setAvailableTargets,
  setTurns,
  loadRuntimeStatus,
  labels,
}: UseAgentConnectionActionsInput) {
  const handleScanTargets = useCallback(async () => {
    if (scanTargetsPending) return;

    setScanTargetsPending(true);
    setScanTargetsMessage("");
    setConnectionCheckError("");

    try {
      const response = await fetch("/api/agent/targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
      const payload = (await response.json()) as AgentTargetsScanResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || labels.scanFailed);
      }

      if (Array.isArray(payload.targets) && payload.targets.length) {
        setAvailableTargets(payload.targets);
      }
      if (payload.remoteChecks && typeof payload.remoteChecks === "object") {
        setConnectionChecksByTargetId((current) => ({
          ...current,
          ...payload.remoteChecks,
        }));
      }

      const summary = payload.summary;
      const localAdded = summary?.localNewTargetIds.length || 0;
      const localRemoved = summary?.localRemovedTargetIds.length || 0;
      const remoteHealthy = summary?.remoteHealthyCount || 0;
      const remoteConfigured = summary?.remoteConfiguredCount || 0;
      const remoteSkipped = summary?.remoteSkippedTargetIds.length || 0;

      setScanTargetsMessageTone("success");
      setScanTargetsMessage(
        locale.startsWith("en")
          ? `Scan complete. Local +${localAdded}${localRemoved ? ` / -${localRemoved}` : ""}; remote APIs healthy ${remoteHealthy}/${remoteConfigured}${remoteSkipped ? `, skipped ${remoteSkipped}` : ""}.`
          : `扫描完成。本地新增 ${localAdded} 个${localRemoved ? `、移除 ${localRemoved} 个` : ""}；远端 API 健康 ${remoteHealthy}/${remoteConfigured}${remoteSkipped ? `，跳过 ${remoteSkipped} 个` : ""}。`,
      );
      await loadRuntimeStatus(selectedTargetId, { force: true });
    } catch (scanError) {
      setScanTargetsMessageTone("error");
      setScanTargetsMessage(
        scanError instanceof Error ? scanError.message : labels.scanFailed,
      );
    } finally {
      setScanTargetsPending(false);
    }
  }, [
    labels.scanFailed,
    loadRuntimeStatus,
    locale,
    scanTargetsPending,
    selectedTargetId,
    setAvailableTargets,
    setConnectionCheckError,
    setConnectionChecksByTargetId,
    setScanTargetsMessage,
    setScanTargetsMessageTone,
    setScanTargetsPending,
  ]);

  const handleConnectionCheck = useCallback(async () => {
    if (!supportsConnectionCheck || connectionCheckPending || pending) return;

    setConnectionCheckPending(true);
    setConnectionCheckError("");

    try {
      const response = await fetch(
        `/api/agent/connection-check?targetId=${encodeURIComponent(selectedTargetId)}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response.json()) as AgentConnectionCheckResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || labels.connectionCheckFailed);
      }
      setConnectionChecksByTargetId((current) => ({
        ...current,
        [selectedTargetId]: data,
      }));
      setTurns((currentTurns) => [
        ...currentTurns,
        {
          id: `${Date.now()}-check`,
          kind: "check",
          targetId: selectedTargetId,
          prompt: `$ connection-check ${selectedTarget.label}`,
          displayPrompt: `$ connection-check ${selectedTarget.label}`,
          response: buildConnectionCheckNarrative(data, labels),
          providerLabel: data.providerLabel,
          targetLabel: data.targetLabel,
          resolvedModel: data.resolvedModel,
          resolvedBaseUrl: data.resolvedBaseUrl,
          toolRuns: [],
          warning: data.ok ? undefined : labels.attentionNeeded,
          connectionCheck: data,
        },
      ]);
    } catch (checkError) {
      setConnectionCheckError(
        checkError instanceof Error
          ? checkError.message
          : labels.connectionCheckFailed,
      );
    } finally {
      setConnectionCheckPending(false);
    }
  }, [
    connectionCheckPending,
    labels,
    pending,
    selectedTarget.label,
    selectedTargetId,
    setConnectionCheckError,
    setConnectionCheckPending,
    setConnectionChecksByTargetId,
    setTurns,
    supportsConnectionCheck,
  ]);

  return {
    handleScanTargets,
    handleConnectionCheck,
  };
}
