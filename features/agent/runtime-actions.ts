"use client";

import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  AgentRuntimeAction,
  AgentRuntimeActionResponse,
  AgentRuntimePrewarmAllResponse,
  AgentRuntimePrewarmResponse,
  AgentRuntimeStatus,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";
import type { AgentRuntimeActionPending } from "./runtime-shell-state";

type AgentRuntimeActionsLabels = {
  runtimeFailed: string;
  prewarmDone: string;
  prewarmAllDone: string;
};

type AgentRuntimeActionsTargetInput = {
  agentTargets: AgentTarget[];
  selectedTarget: AgentTarget;
  selectedTargetId: string;
  thinkingMode: AgentThinkingMode;
};

type AgentRuntimeActionsStateInput = {
  pending: boolean;
  runtimeStatus: AgentRuntimeStatus | null;
  runtimeRequestInFlightRef: MutableRefObject<boolean>;
  prewarmPending: boolean;
  prewarmAllPending: boolean;
  runtimeActionPending: AgentRuntimeActionPending;
};

type AgentRuntimeActionsMutationInput = {
  setRuntimeStatus: Dispatch<SetStateAction<AgentRuntimeStatus | null>>;
  setPrewarmPending: Dispatch<SetStateAction<boolean>>;
  setPrewarmAllPending: Dispatch<SetStateAction<boolean>>;
  setPrewarmMessage: Dispatch<SetStateAction<string>>;
  setRuntimeActionPending: Dispatch<SetStateAction<AgentRuntimeActionPending>>;
  setRuntimeLogExcerpt: Dispatch<SetStateAction<string>>;
  setRuntimeLastSwitchMsByTarget: Dispatch<
    SetStateAction<Record<string, number | null>>
  >;
  setRuntimeLastSwitchAtByTarget: Dispatch<
    SetStateAction<Record<string, string | null>>
  >;
  setError: Dispatch<SetStateAction<string>>;
};

type UseAgentRuntimeActionsInput = {
  target: AgentRuntimeActionsTargetInput;
  state: AgentRuntimeActionsStateInput;
  mutations: AgentRuntimeActionsMutationInput;
  labels: AgentRuntimeActionsLabels;
};

export function useAgentRuntimeActions({
  target,
  state,
  mutations,
  labels,
}: UseAgentRuntimeActionsInput) {
  const {
    agentTargets,
    selectedTarget,
    selectedTargetId,
    thinkingMode,
  } = target;
  const {
    pending,
    runtimeStatus,
    runtimeRequestInFlightRef,
    prewarmPending,
    prewarmAllPending,
    runtimeActionPending,
  } = state;
  const {
    setRuntimeStatus,
    setPrewarmPending,
    setPrewarmAllPending,
    setPrewarmMessage,
    setRuntimeActionPending,
    setRuntimeLogExcerpt,
    setRuntimeLastSwitchMsByTarget,
    setRuntimeLastSwitchAtByTarget,
    setError,
  } = mutations;
  const loadRuntimeStatus = useCallback(
    async (
      currentTargetId = selectedTargetId,
      options?: { force?: boolean },
    ) => {
      const target =
        agentTargets.find((item) => item.id === currentTargetId) ||
        selectedTarget;

      if (runtimeRequestInFlightRef.current && !options?.force) {
        return;
      }

      runtimeRequestInFlightRef.current = true;

      try {
        const query = new URLSearchParams({
          targetId: currentTargetId,
          thinkingMode,
        });
        const response = await fetch(`/api/agent/runtime?${query.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as AgentRuntimeStatus & {
          error?: string;
        };
        if (!response.ok) {
          setRuntimeStatus({
            targetId: currentTargetId,
            targetLabel: target.label,
            execution: target.execution,
            available: false,
            message: data.error || labels.runtimeFailed,
          });
          return;
        }
        setRuntimeStatus(data);
      } catch (runtimeError) {
        setRuntimeStatus({
          targetId: currentTargetId,
          targetLabel: target.label,
          execution: target.execution,
          available: false,
          message:
            runtimeError instanceof Error
              ? runtimeError.message
              : labels.runtimeFailed,
        });
      } finally {
        runtimeRequestInFlightRef.current = false;
      }
    },
    [
      agentTargets,
      labels.runtimeFailed,
      runtimeRequestInFlightRef,
      selectedTarget,
      selectedTargetId,
      setRuntimeStatus,
      thinkingMode,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    void loadRuntimeStatus(selectedTargetId, { force: true });
    if (selectedTarget.execution === "local") {
      timer = setInterval(
        () => {
          if (!cancelled && !document.hidden) {
            void loadRuntimeStatus(selectedTargetId);
          }
        },
        pending ? 6000 : 12000,
      );
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [
    loadRuntimeStatus,
    pending,
    selectedTarget.execution,
    selectedTarget.label,
    selectedTargetId,
  ]);

  const handlePrewarm = useCallback(async () => {
    if (selectedTarget.execution !== "local" || prewarmPending || pending) {
      return;
    }
    if (runtimeStatus?.resourceGuardrailLevel === "blocked") {
      setError(
        runtimeStatus.resourceGuardrailSummary ||
          "Current memory pressure is too high for another local model load.",
      );
      return;
    }

    setPrewarmPending(true);
    setPrewarmMessage("");
    setError("");

    try {
      const response = await fetch("/api/agent/runtime/prewarm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetId: selectedTargetId,
        }),
      });
      const data = (await response.json()) as AgentRuntimePrewarmResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || data.message || labels.runtimeFailed);
      }
      const details = [
        data.message || labels.prewarmDone,
        data.status === "ready" && typeof data.loadMs === "number"
          ? `load ${data.loadMs.toFixed(1)} ms`
          : "",
        data.status === "ready" && typeof data.warmupMs === "number"
          ? `warm ${data.warmupMs.toFixed(1)} ms`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      setPrewarmMessage(details);
      if (data.status === "ready" && typeof data.loadMs === "number") {
        const switchedAt = new Date().toISOString();
        setRuntimeLastSwitchMsByTarget((current) => ({
          ...current,
          [selectedTargetId]: data.loadMs ?? null,
        }));
        setRuntimeLastSwitchAtByTarget((current) => ({
          ...current,
          [selectedTargetId]: switchedAt,
        }));
      }
      await loadRuntimeStatus(selectedTargetId);
    } catch (prewarmError) {
      setError(
        prewarmError instanceof Error
          ? prewarmError.message
          : labels.runtimeFailed,
      );
    } finally {
      setPrewarmPending(false);
    }
  }, [
    labels.prewarmDone,
    labels.runtimeFailed,
    loadRuntimeStatus,
    pending,
    prewarmPending,
    runtimeStatus,
    selectedTarget.execution,
    selectedTargetId,
    setError,
    setPrewarmMessage,
    setPrewarmPending,
    setRuntimeLastSwitchAtByTarget,
    setRuntimeLastSwitchMsByTarget,
  ]);

  const handlePrewarmAll = useCallback(async () => {
    if (
      selectedTarget.execution !== "local" ||
      prewarmAllPending ||
      prewarmPending ||
      pending
    ) {
      return;
    }
    if (runtimeStatus?.resourceGuardrailLevel === "blocked") {
      setError(
        runtimeStatus.resourceGuardrailSummary ||
          "Current memory pressure is too high for prewarming local models.",
      );
      return;
    }

    setPrewarmAllPending(true);
    setPrewarmMessage("");
    setError("");

    try {
      const response = await fetch("/api/agent/runtime/prewarm-all", {
        method: "POST",
      });
      const data = (await response.json()) as AgentRuntimePrewarmAllResponse & {
        error?: string;
      };
      if (!response.ok) {
        const failedSummary = data.results
          ?.map((item) => item.message)
          .filter(Boolean)
          .join(" | ");
        throw new Error(data.error || failedSummary || labels.runtimeFailed);
      }
      const details = data.results
        .map((item) => {
          const statusLabel =
            item.status === "loading"
              ? "loading"
              : item.status === "queued"
                ? "queued"
                : item.status === "skipped"
                  ? "skipped"
                  : item.status === "failed"
                    ? "failed"
                    : "ready";
          const parts = [
            item.targetLabel,
            statusLabel,
            item.status === "ready" && typeof item.loadMs === "number"
              ? `load ${item.loadMs.toFixed(1)} ms`
              : "",
            item.status === "ready" && typeof item.warmupMs === "number"
              ? `warm ${item.warmupMs.toFixed(1)} ms`
              : "",
          ].filter(Boolean);
          return parts.join(" · ");
        })
        .join(" | ");
      setPrewarmMessage(
        `${data.message || labels.prewarmAllDone}${details ? ` ${details}` : ""}`,
      );
      setRuntimeLastSwitchMsByTarget((current) => {
        const next = { ...current };
        data.results.forEach((item) => {
          if (item.status === "ready" && typeof item.loadMs === "number") {
            next[item.targetId] = item.loadMs;
          }
        });
        return next;
      });
      setRuntimeLastSwitchAtByTarget((current) => {
        const next = { ...current };
        data.results.forEach((item) => {
          if (item.status === "ready" && typeof item.loadMs === "number") {
            next[item.targetId] = new Date().toISOString();
          }
        });
        return next;
      });
      await loadRuntimeStatus(selectedTargetId);
    } catch (prewarmError) {
      setError(
        prewarmError instanceof Error
          ? prewarmError.message
          : labels.runtimeFailed,
      );
    } finally {
      setPrewarmAllPending(false);
    }
  }, [
    labels.prewarmAllDone,
    labels.runtimeFailed,
    loadRuntimeStatus,
    pending,
    prewarmAllPending,
    prewarmPending,
    runtimeStatus,
    selectedTarget.execution,
    selectedTargetId,
    setError,
    setPrewarmAllPending,
    setPrewarmMessage,
    setRuntimeLastSwitchAtByTarget,
    setRuntimeLastSwitchMsByTarget,
  ]);

  const handleRuntimeAction = useCallback(
    async (action: AgentRuntimeAction) => {
      if (
        selectedTarget.execution !== "local" ||
        runtimeActionPending ||
        pending
      ) {
        return;
      }

      setRuntimeActionPending(action);
      setError("");
      if (action !== "read_log") {
        setRuntimeLogExcerpt("");
      }

      try {
        const response = await fetch("/api/agent/runtime/actions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetId: selectedTargetId,
            action,
          }),
        });
        const data = (await response.json()) as AgentRuntimeActionResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || data.message || labels.runtimeFailed);
        }
        if (data.runtime) {
          setRuntimeStatus(data.runtime);
        } else {
          await loadRuntimeStatus(selectedTargetId);
        }
        if (data.logExcerpt) {
          setRuntimeLogExcerpt(data.logExcerpt);
        }
        if (data.message) {
          setPrewarmMessage(data.message);
        }
      } catch (runtimeActionError) {
        setError(
          runtimeActionError instanceof Error
            ? runtimeActionError.message
            : labels.runtimeFailed,
        );
      } finally {
        setRuntimeActionPending("");
      }
    },
    [
      labels.runtimeFailed,
      loadRuntimeStatus,
      pending,
      runtimeActionPending,
      selectedTarget.execution,
      selectedTargetId,
      setError,
      setPrewarmMessage,
      setRuntimeActionPending,
      setRuntimeLogExcerpt,
      setRuntimeStatus,
    ],
  );

  return {
    loadRuntimeStatus,
    handlePrewarm,
    handlePrewarmAll,
    handleRuntimeAction,
  };
}
