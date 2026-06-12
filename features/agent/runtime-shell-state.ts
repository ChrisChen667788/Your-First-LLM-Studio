"use client";

import { useRef, useState } from "react";
import type { AgentRuntimeStatus } from "@/lib/agent/types";

export type AgentRuntimeActionPending = "" | "release" | "restart" | "read_log";

export function useAgentRuntimeShellState() {
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatus | null>(
    null,
  );
  const [runtimeLastSwitchMsByTarget, setRuntimeLastSwitchMsByTarget] =
    useState<Record<string, number | null>>({});
  const [runtimeLastSwitchAtByTarget, setRuntimeLastSwitchAtByTarget] =
    useState<Record<string, string | null>>({});
  const [prewarmPending, setPrewarmPending] = useState(false);
  const [prewarmAllPending, setPrewarmAllPending] = useState(false);
  const [prewarmMessage, setPrewarmMessage] = useState("");
  const [runtimeActionPending, setRuntimeActionPending] =
    useState<AgentRuntimeActionPending>("");
  const [runtimeLogExcerpt, setRuntimeLogExcerpt] = useState("");
  const runtimeRequestInFlightRef = useRef(false);

  return {
    runtimeStatus,
    setRuntimeStatus,
    runtimeLastSwitchMsByTarget,
    setRuntimeLastSwitchMsByTarget,
    runtimeLastSwitchAtByTarget,
    setRuntimeLastSwitchAtByTarget,
    prewarmPending,
    setPrewarmPending,
    prewarmAllPending,
    setPrewarmAllPending,
    prewarmMessage,
    setPrewarmMessage,
    runtimeActionPending,
    setRuntimeActionPending,
    runtimeLogExcerpt,
    setRuntimeLogExcerpt,
    runtimeRequestInFlightRef,
  };
}
