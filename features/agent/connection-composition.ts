"use client";

import type { Dispatch, SetStateAction } from "react";
import type { AgentTarget } from "@/lib/agent/types";
import { useAgentConnectionActions } from "./connection-actions";
import { useAgentConnectionShellState } from "./connection-shell-state";
import type { AgentTurn } from "./session-model";

type UseAgentConnectionCompositionInput = {
  shell: ReturnType<typeof useAgentConnectionShellState>;
  context: {
    locale: string;
    selectedTarget: AgentTarget;
    selectedTargetId: string;
    pending: boolean;
    supportsConnectionCheck: boolean;
  };
  mutations: {
    setAvailableTargets: Dispatch<SetStateAction<AgentTarget[]>>;
    setTurns: Dispatch<SetStateAction<AgentTurn[]>>;
    loadRuntimeStatus: (
      targetId?: string,
      options?: { force?: boolean },
    ) => Promise<void>;
  };
  labels: {
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
};

export function useAgentConnectionComposition({
  shell,
  context,
  mutations,
  labels,
}: UseAgentConnectionCompositionInput) {
  const actions = useAgentConnectionActions({
    context,
    state: {
      scanTargetsPending: shell.scanTargetsPending,
      connectionCheckPending: shell.connectionCheckPending,
    },
    mutations: {
      setScanTargetsPending: shell.setScanTargetsPending,
      setScanTargetsMessage: shell.setScanTargetsMessage,
      setScanTargetsMessageTone: shell.setScanTargetsMessageTone,
      setConnectionCheckPending: shell.setConnectionCheckPending,
      setConnectionCheckError: shell.setConnectionCheckError,
      setConnectionChecksByTargetId: shell.setConnectionChecksByTargetId,
      setAvailableTargets: mutations.setAvailableTargets,
      setTurns: mutations.setTurns,
      loadRuntimeStatus: mutations.loadRuntimeStatus,
    },
    labels,
  });
  return {
    ...shell,
    ...actions,
  };
}

export function useAgentConnectionCompositionState() {
  return useAgentConnectionShellState();
}
