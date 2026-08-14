"use client";

import { useCallback, useEffect, useState } from "react";
import {
  executeAdminRuntimeAction,
  fetchAdminRuntimeStatus,
  prewarmAdminRuntime,
  prewarmAllAdminRuntimes,
} from "@/features/admin/runtime-operations";
import { useAdminRuntimeSwitchHistory } from "@/features/admin/runtime-switch-history";
import type { AdminRuntimeMetricSample } from "@/features/admin/runtime-target-view-model";
import type {
  AgentRuntimeLogSummary,
  AgentRuntimeStatus,
  AgentTarget,
} from "@/lib/agent/types";

const MAX_RUNTIME_METRIC_SAMPLES = 24;

export type AdminRuntimeActionKind =
  | "refresh"
  | "prewarm"
  | "release"
  | "restart"
  | "read_log";

export function useAdminRuntimeController(localTargets: AgentTarget[]) {
  const [runtimeStatuses, setRuntimeStatuses] = useState<
    Record<string, AgentRuntimeStatus | null>
  >({});
  const [runtimeMetricHistory, setRuntimeMetricHistory] = useState<
    Record<string, AdminRuntimeMetricSample[]>
  >({});
  const [runtimeActionPending, setRuntimeActionPending] = useState<
    Record<string, AdminRuntimeActionKind | "">
  >({});
  const [runtimeLogExcerpts, setRuntimeLogExcerpts] = useState<
    Record<string, string>
  >({});
  const [runtimeLogSummaries, setRuntimeLogSummaries] = useState<
    Record<string, AgentRuntimeLogSummary | null>
  >({});
  const [runtimeLogQueries, setRuntimeLogQueries] = useState<
    Record<string, string>
  >({});
  const [runtimeLogLimits, setRuntimeLogLimits] = useState<
    Record<string, number>
  >({});
  const [runtimeMessages, setRuntimeMessages] = useState<
    Record<string, string>
  >({});
  const [prewarmAllPending, setPrewarmAllPending] = useState(false);
  const [prewarmAllMessage, setPrewarmAllMessage] = useState("");
  const {
    runtimeLastSwitchMs,
    setRuntimeLastSwitchMs,
    runtimeLastSwitchAt,
    setRuntimeLastSwitchAt,
  } = useAdminRuntimeSwitchHistory();

  const recordRuntimeMetricSample = useCallback(
    (targetId: string, status: AgentRuntimeStatus) => {
      const sample: AdminRuntimeMetricSample = {
        timestamp: new Date().toISOString(),
        gatewayCpuPct:
          typeof status.gatewayCpuPct === "number" ? status.gatewayCpuPct : null,
        gatewayResidentMemoryMb:
          typeof status.gatewayResidentMemoryMb === "number"
            ? status.gatewayResidentMemoryMb
            : null,
        gatewayGpuPct:
          typeof status.gatewayGpuPct === "number" ? status.gatewayGpuPct : null,
        gatewayGpuMemoryMb:
          typeof status.gatewayGpuMemoryMb === "number"
            ? status.gatewayGpuMemoryMb
            : null,
        gatewayEnergySignalPct:
          typeof status.gatewayEnergySignalPct === "number"
            ? status.gatewayEnergySignalPct
            : null,
        gatewayDiskUsedPct:
          typeof status.gatewayDiskUsedPct === "number"
            ? status.gatewayDiskUsedPct
            : null,
        modelStorageFootprintMb:
          typeof status.modelStorageFootprintMb === "number"
            ? status.modelStorageFootprintMb
            : null,
      };
      setRuntimeMetricHistory((current) => ({
        ...current,
        [targetId]: [...(current[targetId] || []), sample].slice(
          -MAX_RUNTIME_METRIC_SAMPLES,
        ),
      }));
    },
    [],
  );

  const loadRuntimeStatus = useCallback(
    async (targetId: string) => {
      setRuntimeActionPending((current) => ({
        ...current,
        [targetId]: "refresh",
      }));
      try {
        const payload = await fetchAdminRuntimeStatus(targetId);
        setRuntimeStatuses((current) => ({ ...current, [targetId]: payload }));
        recordRuntimeMetricSample(targetId, payload);
        if (payload.message) {
          setRuntimeMessages((current) => ({
            ...current,
            [targetId]: payload.message || "",
          }));
        }
      } finally {
        setRuntimeActionPending((current) => ({ ...current, [targetId]: "" }));
      }
    },
    [recordRuntimeMetricSample],
  );

  const loadAllRuntimeStatuses = useCallback(async () => {
    await Promise.all(
      localTargets.map(async (target) => {
        try {
          await loadRuntimeStatus(target.id);
        } catch (error) {
          setRuntimeStatuses((current) => ({
            ...current,
            [target.id]: {
              targetId: target.id,
              targetLabel: target.label,
              execution: "local",
              available: false,
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to load runtime status.",
            },
          }));
        }
      }),
    );
  }, [loadRuntimeStatus, localTargets]);

  const handleRuntimePrewarm = useCallback(
    async (targetId: string) => {
      setRuntimeActionPending((current) => ({
        ...current,
        [targetId]: "prewarm",
      }));
      try {
        const payload = await prewarmAdminRuntime(targetId);
        setRuntimeMessages((current) => ({
          ...current,
          [targetId]: payload.message,
        }));
        if (payload.status === "ready" && typeof payload.loadMs === "number") {
          const switchedAt = new Date().toISOString();
          setRuntimeLastSwitchMs((current) => ({
            ...current,
            [targetId]: payload.loadMs ?? null,
          }));
          setRuntimeLastSwitchAt((current) => ({
            ...current,
            [targetId]: switchedAt,
          }));
        }
        await loadRuntimeStatus(targetId);
      } catch (error) {
        setRuntimeMessages((current) => ({
          ...current,
          [targetId]:
            error instanceof Error ? error.message : "Prewarm failed.",
        }));
      } finally {
        setRuntimeActionPending((current) => ({ ...current, [targetId]: "" }));
      }
    },
    [loadRuntimeStatus, setRuntimeLastSwitchAt, setRuntimeLastSwitchMs],
  );

  const handleRuntimeAction = useCallback(
    async (
      targetId: string,
      action: Exclude<AdminRuntimeActionKind, "refresh" | "prewarm">,
      options?: { query?: string; limit?: number },
    ) => {
      setRuntimeActionPending((current) => ({ ...current, [targetId]: action }));
      try {
        const payload = await executeAdminRuntimeAction({
          targetId,
          action,
          query: options?.query,
          limit: options?.limit,
        });
        if (payload.logExcerpt) {
          setRuntimeLogExcerpts((current) => ({
            ...current,
            [targetId]: payload.logExcerpt || "",
          }));
        }
        if (payload.logSummary) {
          setRuntimeLogSummaries((current) => ({
            ...current,
            [targetId]: payload.logSummary || null,
          }));
        }
        if (payload.runtime) {
          setRuntimeStatuses((current) => ({
            ...current,
            [targetId]: payload.runtime || null,
          }));
        }
        setRuntimeMessages((current) => ({
          ...current,
          [targetId]: payload.message,
        }));
        await loadRuntimeStatus(targetId);
      } catch (error) {
        setRuntimeMessages((current) => ({
          ...current,
          [targetId]:
            error instanceof Error ? error.message : "Runtime action failed.",
        }));
      } finally {
        setRuntimeActionPending((current) => ({ ...current, [targetId]: "" }));
      }
    },
    [loadRuntimeStatus],
  );

  const handlePrewarmAllRuntimes = useCallback(async () => {
    setPrewarmAllPending(true);
    try {
      const payload = await prewarmAllAdminRuntimes();
      const detail = payload.results
        .map((entry) => `${entry.targetLabel}: ${entry.status}`)
        .join(" · ");
      setPrewarmAllMessage(`${payload.message}${detail ? ` ${detail}` : ""}`);
      setRuntimeLastSwitchMs((current) => {
        const next = { ...current };
        payload.results.forEach((entry) => {
          if (entry.status === "ready" && typeof entry.loadMs === "number") {
            next[entry.targetId] = entry.loadMs;
          }
        });
        return next;
      });
      setRuntimeLastSwitchAt((current) => {
        const next = { ...current };
        payload.results.forEach((entry) => {
          if (entry.status === "ready" && typeof entry.loadMs === "number") {
            next[entry.targetId] = new Date().toISOString();
          }
        });
        return next;
      });
      await loadAllRuntimeStatuses();
    } catch (error) {
      setPrewarmAllMessage(
        error instanceof Error ? error.message : "Prewarm-all failed.",
      );
    } finally {
      setPrewarmAllPending(false);
    }
  }, [loadAllRuntimeStatuses, setRuntimeLastSwitchAt, setRuntimeLastSwitchMs]);

  const handleRuntimeLogSearch = useCallback(
    async (targetId: string) => {
      await handleRuntimeAction(targetId, "read_log", {
        query: runtimeLogQueries[targetId] || "",
        limit: runtimeLogLimits[targetId] || 120,
      });
    },
    [handleRuntimeAction, runtimeLogLimits, runtimeLogQueries],
  );

  useEffect(() => {
    setRuntimeMetricHistory((current) => {
      const allowedTargetIds = new Set(localTargets.map((target) => target.id));
      const nextEntries = Object.entries(current).filter(([targetId]) =>
        allowedTargetIds.has(targetId),
      );
      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });
  }, [localTargets]);

  return {
    runtimeStatuses,
    runtimeMetricHistory,
    runtimeActionPending,
    runtimeLogExcerpts,
    runtimeLogSummaries,
    runtimeLogQueries,
    setRuntimeLogQueries,
    runtimeLogLimits,
    setRuntimeLogLimits,
    runtimeMessages,
    runtimeLastSwitchMs,
    runtimeLastSwitchAt,
    prewarmAllPending,
    prewarmAllMessage,
    loadRuntimeStatus,
    loadAllRuntimeStatuses,
    handleRuntimePrewarm,
    handleRuntimeAction,
    handlePrewarmAllRuntimes,
    handleRuntimeLogSearch,
  };
}
