"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "local-agent-runtime-switch-history-v1";

export function useAdminRuntimeSwitchHistory() {
  const [runtimeLastSwitchMs, setRuntimeLastSwitchMs] =
    useState<Record<string, number | null>>({});
  const [runtimeLastSwitchAt, setRuntimeLastSwitchAt] =
    useState<Record<string, string | null>>({});
  const hydratedRef = useRef(false);
  const skipFirstPersistenceRef = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<
          string,
          { loadMs?: number | null; switchedAt?: string | null }
        >;
        const nextLoadMs: Record<string, number | null> = {};
        const nextSwitchedAt: Record<string, string | null> = {};
        for (const [targetId, entry] of Object.entries(parsed || {})) {
          nextLoadMs[targetId] =
            typeof entry?.loadMs === "number" && Number.isFinite(entry.loadMs)
              ? entry.loadMs
              : null;
          nextSwitchedAt[targetId] =
            typeof entry?.switchedAt === "string" ? entry.switchedAt : null;
        }
        setRuntimeLastSwitchMs(nextLoadMs);
        setRuntimeLastSwitchAt(nextSwitchedAt);
      }
    } catch {
      // Ignore malformed local cache and keep runtime panels usable.
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (skipFirstPersistenceRef.current) {
      skipFirstPersistenceRef.current = false;
      return;
    }
    if (!hydratedRef.current) return;
    const targetIds = new Set([
      ...Object.keys(runtimeLastSwitchMs),
      ...Object.keys(runtimeLastSwitchAt),
    ]);
    const payload: Record<
      string,
      { loadMs: number | null; switchedAt: string | null }
    > = {};
    targetIds.forEach((targetId) => {
      payload[targetId] = {
        loadMs: runtimeLastSwitchMs[targetId] ?? null,
        switchedAt: runtimeLastSwitchAt[targetId] ?? null,
      };
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [runtimeLastSwitchAt, runtimeLastSwitchMs]);

  return {
    runtimeLastSwitchMs,
    setRuntimeLastSwitchMs,
    runtimeLastSwitchAt,
    setRuntimeLastSwitchAt,
  };
}
