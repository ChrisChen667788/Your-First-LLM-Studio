"use client";

import { useAgentConnectionShellState } from "./connection-shell-state";
import { useAgentRuntimeShellState } from "./runtime-shell-state";

export function useAgentRuntimeConnectionShellState() {
  const runtime = useAgentRuntimeShellState();
  const connection = useAgentConnectionShellState();
  return { runtime, connection };
}
