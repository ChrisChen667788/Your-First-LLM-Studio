"use client";

import { useState } from "react";
import type {
  AgentFineTuneSummary,
  AgentTarget,
} from "@/lib/agent/types";

export type FineTuneJobGroupKey =
  | "active"
  | "needs-review"
  | "completed"
  | "staged";

export type FineTuneWorkspaceTab = "setup" | "runs" | "assets";
export type FineTuneLabTab = "train" | "evaluate" | "chat" | "export";
export type FineTuneMessageTone = "success" | "error";

const INITIAL_COLLAPSED_JOB_GROUPS: Record<FineTuneJobGroupKey, boolean> = {
  active: false,
  "needs-review": false,
  completed: true,
  staged: true,
};

export function useFineTuneSurfaceState() {
  const [summary, setSummary] = useState<AgentFineTuneSummary | null>(null);
  const [targetCatalog, setTargetCatalog] = useState<AgentTarget[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] =
    useState<FineTuneMessageTone>("success");
  const [actionPending, setActionPending] = useState<Record<string, boolean>>(
    {},
  );
  const [collapsedJobGroups, setCollapsedJobGroups] = useState<
    Record<FineTuneJobGroupKey, boolean>
  >(INITIAL_COLLAPSED_JOB_GROUPS);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<FineTuneWorkspaceTab>("setup");
  const [activeFineTuneLabTab, setActiveFineTuneLabTab] =
    useState<FineTuneLabTab>("train");

  return {
    summary,
    setSummary,
    targetCatalog,
    setTargetCatalog,
    pending,
    setPending,
    message,
    setMessage,
    messageTone,
    setMessageTone,
    actionPending,
    setActionPending,
    collapsedJobGroups,
    setCollapsedJobGroups,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    activeFineTuneLabTab,
    setActiveFineTuneLabTab,
  };
}
