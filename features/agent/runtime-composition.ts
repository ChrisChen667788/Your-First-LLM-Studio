"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";
import {
  useAgentRuntimeShellState,
  type AgentRuntimeActionPending,
} from "./runtime-shell-state";
import { useAgentRuntimeActions } from "./runtime-actions";

type AgentRuntimeCompositionLabels = {
  runtimeFailed: string;
  prewarmDone: string;
  prewarmAllDone: string;
};

type AgentRuntimeCompositionTarget = {
  agentTargets: AgentTarget[];
  selectedTarget: AgentTarget;
  selectedTargetId: string;
  thinkingMode: AgentThinkingMode;
};

type AgentRuntimeShellComposition = ReturnType<
  typeof useAgentRuntimeShellState
>;

type UseAgentRuntimeCompositionInput = {
  target: AgentRuntimeCompositionTarget;
  pending: boolean;
  runtime: AgentRuntimeShellComposition;
  labels: AgentRuntimeCompositionLabels;
  setError: Dispatch<SetStateAction<string>>;
};

export type AgentRuntimeComposition = AgentRuntimeShellComposition & {
  runtimeActionPending: AgentRuntimeActionPending;
  loadRuntimeStatus: ReturnType<typeof useAgentRuntimeActions>["loadRuntimeStatus"];
  handlePrewarm: ReturnType<typeof useAgentRuntimeActions>["handlePrewarm"];
  handlePrewarmAll: ReturnType<typeof useAgentRuntimeActions>["handlePrewarmAll"];
  handleRuntimeAction: ReturnType<typeof useAgentRuntimeActions>["handleRuntimeAction"];
};

export function useAgentRuntimeComposition({
  target,
  pending,
  runtime,
  labels,
  setError,
}: UseAgentRuntimeCompositionInput): AgentRuntimeComposition {
  const actions = useAgentRuntimeActions({
    target,
    state: {
      pending,
      runtimeStatus: runtime.runtimeStatus,
      runtimeRequestInFlightRef: runtime.runtimeRequestInFlightRef,
      prewarmPending: runtime.prewarmPending,
      prewarmAllPending: runtime.prewarmAllPending,
      runtimeActionPending: runtime.runtimeActionPending,
    },
    mutations: {
      setRuntimeStatus: runtime.setRuntimeStatus,
      setPrewarmPending: runtime.setPrewarmPending,
      setPrewarmAllPending: runtime.setPrewarmAllPending,
      setPrewarmMessage: runtime.setPrewarmMessage,
      setRuntimeActionPending: runtime.setRuntimeActionPending,
      setRuntimeLogExcerpt: runtime.setRuntimeLogExcerpt,
      setRuntimeLastSwitchMsByTarget: runtime.setRuntimeLastSwitchMsByTarget,
      setRuntimeLastSwitchAtByTarget: runtime.setRuntimeLastSwitchAtByTarget,
      setError,
    },
    labels,
  });

  return {
    ...runtime,
    ...actions,
  };
}
