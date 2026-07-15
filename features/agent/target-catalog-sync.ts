"use client";

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { AgentTarget } from "@/lib/agent/types";

export function useAgentTargetCatalogSync(input: {
  availableTargets: AgentTarget[];
  setAvailableTargets: Dispatch<SetStateAction<AgentTarget[]>>;
  selectedTargetId: string;
  setSelectedTargetId: (value: string) => void;
  refreshMs?: number;
}) {
  const loadAvailableTargets = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/targets", { cache: "no-store" });
      const payload = (await response.json()) as { targets?: AgentTarget[] };
      if (!response.ok || !Array.isArray(payload.targets) || !payload.targets.length) {
        return;
      }
      input.setAvailableTargets(payload.targets);
    } catch {
      // Keep the built-in catalog when server synchronization is unavailable.
    }
  }, [input.setAvailableTargets]);

  useEffect(() => {
    let cancelled = false;
    void loadAvailableTargets();
    const timer = window.setInterval(() => {
      if (!cancelled) void loadAvailableTargets();
    }, input.refreshMs ?? 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [input.refreshMs, loadAvailableTargets]);

  useEffect(() => {
    if (!input.availableTargets.length) return;
    if (!input.availableTargets.some((target) => target.id === input.selectedTargetId)) {
      input.setSelectedTargetId(input.availableTargets[0].id);
    }
  }, [input.availableTargets, input.selectedTargetId, input.setSelectedTargetId]);
}
