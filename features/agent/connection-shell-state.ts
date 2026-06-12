"use client";

import { useEffect, useState } from "react";
import type { AgentConnectionCheckResponse } from "@/lib/agent/types";

export function useAgentConnectionShellState() {
  const [connectionChecksByTargetId, setConnectionChecksByTargetId] = useState<
    Record<string, AgentConnectionCheckResponse>
  >({});
  const [connectionCheckPending, setConnectionCheckPending] = useState(false);
  const [connectionCheckError, setConnectionCheckError] = useState("");
  const [scanTargetsPending, setScanTargetsPending] = useState(false);
  const [scanTargetsMessage, setScanTargetsMessage] = useState("");
  const [scanTargetsMessageTone, setScanTargetsMessageTone] = useState<
    "success" | "error"
  >("success");

  useEffect(() => {
    if (!scanTargetsMessage) return;
    const timer = window.setTimeout(() => setScanTargetsMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [scanTargetsMessage]);

  return {
    connectionChecksByTargetId,
    setConnectionChecksByTargetId,
    connectionCheckPending,
    setConnectionCheckPending,
    connectionCheckError,
    setConnectionCheckError,
    scanTargetsPending,
    setScanTargetsPending,
    scanTargetsMessage,
    setScanTargetsMessage,
    scanTargetsMessageTone,
    setScanTargetsMessageTone,
  };
}
