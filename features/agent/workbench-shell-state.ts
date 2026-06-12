"use client";

import { useState } from "react";
import type { AgentSessionExportScope } from "@/features/agent/session-model";
import type { AgentReproduceLanguage } from "@/lib/agent/reproduce-request";

export function useAgentWorkbenchShellState() {
  const [getCodeOpen, setGetCodeOpen] = useState(false);
  const [getCodeLanguage, setGetCodeLanguage] =
    useState<AgentReproduceLanguage>("curl");
  const [runtimeRailCollapsed, setRuntimeRailCollapsed] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionTargetFilter, setSessionTargetFilter] = useState("all");
  const [sessionExportScope, setSessionExportScope] =
    useState<AgentSessionExportScope>("visible");

  return {
    getCodeOpen,
    setGetCodeOpen,
    getCodeLanguage,
    setGetCodeLanguage,
    runtimeRailCollapsed,
    setRuntimeRailCollapsed,
    sessionSearch,
    setSessionSearch,
    sessionTargetFilter,
    setSessionTargetFilter,
    sessionExportScope,
    setSessionExportScope,
  };
}
