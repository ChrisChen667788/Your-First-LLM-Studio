"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openAdminBenchmarkReport } from "@/features/admin/benchmark-report-application";
import type { AdminDashboardResponse } from "@/features/admin/dashboard-contract";

type BenchmarkEvidenceEntry = {
  runId?: string;
  suiteLabel?: string;
  datasetLabel?: string;
  promptSetLabel?: string;
  prompt: string;
};

export function useAdminBenchmarkInteractions(input: {
  benchmarkTargetIds: string[];
  benchmarkHeatmapWindowMinutes: number;
  loadDashboard: () => Promise<void>;
  setError: (message: string) => void;
}) {
  const [benchmarkCopyState, setBenchmarkCopyState] = useState<{
    key: string;
    tone: "success" | "error";
  } | null>(null);
  const [benchmarkEvidencePendingRunId, setBenchmarkEvidencePendingRunId] =
    useState("");
  const benchmarkCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (benchmarkCopyTimeoutRef.current) {
        clearTimeout(benchmarkCopyTimeoutRef.current);
      }
    },
    [],
  );

  const handleCopyBenchmarkRunNote = useCallback(
    async (value: string, key: string) => {
      const fallbackCopy = (text: string) => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      };

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          fallbackCopy(value);
        }
        setBenchmarkCopyState({ key, tone: "success" });
      } catch {
        try {
          fallbackCopy(value);
          setBenchmarkCopyState({ key, tone: "success" });
        } catch {
          setBenchmarkCopyState({ key, tone: "error" });
        }
      }

      if (benchmarkCopyTimeoutRef.current) {
        clearTimeout(benchmarkCopyTimeoutRef.current);
      }
      benchmarkCopyTimeoutRef.current = setTimeout(() => {
        setBenchmarkCopyState((current) =>
          current?.key === key ? null : current,
        );
      }, 2200);
    },
    [],
  );

  const openBenchmarkReportMarkdown = useCallback(
    (
      entry?:
        | AdminDashboardResponse["benchmarkHistory"][number]
        | AdminDashboardResponse["releaseEvidence"][number]
        | null,
    ) => {
      openAdminBenchmarkReport({
        entry,
        fallbackTargetIds: input.benchmarkTargetIds,
        windowMinutes: input.benchmarkHeatmapWindowMinutes,
      });
    },
    [input.benchmarkHeatmapWindowMinutes, input.benchmarkTargetIds],
  );

  const toggleBenchmarkReleaseEvidence = useCallback(
    async (entry: BenchmarkEvidenceEntry, pinned: boolean) => {
      if (!entry.runId) return;
      setBenchmarkEvidencePendingRunId(entry.runId);
      input.setError("");
      try {
        const response = await fetch(
          pinned
            ? `/api/admin/benchmark/evidence?runId=${encodeURIComponent(entry.runId)}`
            : "/api/admin/benchmark/evidence",
          pinned
            ? { method: "DELETE" }
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  runId: entry.runId,
                  title:
                    entry.suiteLabel ||
                    entry.datasetLabel ||
                    entry.promptSetLabel ||
                    entry.prompt,
                }),
              },
        );
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(
            payload.error || "Failed to update release evidence.",
          );
        }
        await input.loadDashboard();
      } catch (error) {
        input.setError(
          error instanceof Error
            ? error.message
            : "Failed to update release evidence.",
        );
      } finally {
        setBenchmarkEvidencePendingRunId("");
      }
    },
    [input],
  );

  return {
    benchmarkCopyState,
    benchmarkEvidencePendingRunId,
    handleCopyBenchmarkRunNote,
    openBenchmarkReportMarkdown,
    toggleBenchmarkReleaseEvidence,
  };
}
