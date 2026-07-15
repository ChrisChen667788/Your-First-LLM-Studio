"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentBenchmarkProgress } from "@/lib/agent/types";

export function useAdminBenchmarkProgressState(input: {
  onCompleted: () => void | Promise<void>;
  onError: (message: string) => void;
  pollMs?: number;
}) {
  const [benchmarkProgress, setBenchmarkProgress] =
    useState<AgentBenchmarkProgress | null>(null);
  const onCompletedRef = useRef(input.onCompleted);
  const onErrorRef = useRef(input.onError);
  useEffect(() => {
    onCompletedRef.current = input.onCompleted;
    onErrorRef.current = input.onError;
  });

  const loadBenchmarkProgress = useCallback(async (runId: string) => {
    try {
      const response = await fetch(
        `/api/admin/benchmark/progress?runId=${encodeURIComponent(runId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        if (response.status === 404) return;
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to load benchmark progress.");
      }
      const payload = (await response.json()) as AgentBenchmarkProgress;
      setBenchmarkProgress(payload);
      if (payload.status !== "running" && payload.status !== "pending") {
        await onCompletedRef.current();
      }
    } catch (error) {
      onErrorRef.current(
        error instanceof Error ? error.message : "Failed to load benchmark progress.",
      );
    }
  }, []);

  const loadLatestBenchmarkProgress = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/admin/benchmark/progress?latest=1&unfinishedOnly=1",
        { cache: "no-store" },
      );
      if (!response.ok) {
        if (response.status === 404) {
          setBenchmarkProgress(null);
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to load latest benchmark progress.");
      }
      setBenchmarkProgress((await response.json()) as AgentBenchmarkProgress);
    } catch (error) {
      onErrorRef.current(
        error instanceof Error ? error.message : "Failed to load latest benchmark progress.",
      );
    }
  }, []);

  useEffect(() => {
    void loadLatestBenchmarkProgress();
  }, [loadLatestBenchmarkProgress]);

  useEffect(() => {
    const runId = benchmarkProgress?.runId;
    if (
      !runId ||
      (benchmarkProgress.status !== "running" && benchmarkProgress.status !== "pending")
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadBenchmarkProgress(runId);
    }, input.pollMs ?? 1500);
    return () => window.clearInterval(timer);
  }, [benchmarkProgress?.runId, benchmarkProgress?.status, input.pollMs, loadBenchmarkProgress]);

  return {
    benchmarkProgress,
    setBenchmarkProgress,
    loadBenchmarkProgress,
    loadLatestBenchmarkProgress,
  };
}
