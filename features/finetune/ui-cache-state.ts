"use client";

import { useCallback, useState } from "react";
import type {
  AgentFineTuneCurvePoint,
  AgentFineTuneReportExport,
} from "@/lib/agent/types";

export type TrainingChartRangePreset =
  | "all"
  | "first-300"
  | "last-300"
  | "last-100";

export type TrainingChartSmoothingMode = "raw" | "smooth-5";

export type TrainingChartPoint = AgentFineTuneCurvePoint & {
  rawLoss: number;
  normalizedLoss: number;
  x: number;
  y: number;
};

export type TrainingChartHoverState = TrainingChartPoint | null;

export function useFineTuneUiCacheState() {
  const [chartRangeByJobId, setChartRangeByJobId] = useState<
    Record<string, TrainingChartRangePreset>
  >({});
  const [chartHoverByJobId, setChartHoverByJobId] = useState<
    Record<string, TrainingChartHoverState>
  >({});
  const [chartSmoothingByJobId, setChartSmoothingByJobId] = useState<
    Record<string, TrainingChartSmoothingMode>
  >({});
  const [selectedOverlayJobIdsByJobId, setSelectedOverlayJobIdsByJobId] =
    useState<Record<string, string[]>>({});
  const [lastReportByJobId, setLastReportByJobId] = useState<
    Record<string, AgentFineTuneReportExport>
  >({});

  const setChartRangeForJob = useCallback(
    (jobId: string, range: TrainingChartRangePreset) => {
      setChartRangeByJobId((current) => ({
        ...current,
        [jobId]: range,
      }));
      setChartHoverByJobId((current) => ({
        ...current,
        [jobId]: null,
      }));
    },
    [],
  );

  const setChartHoverForJob = useCallback(
    (jobId: string, point: TrainingChartHoverState) => {
      setChartHoverByJobId((current) => ({
        ...current,
        [jobId]: point,
      }));
    },
    [],
  );

  const setChartSmoothingForJob = useCallback(
    (jobId: string, mode: TrainingChartSmoothingMode) => {
      setChartSmoothingByJobId((current) => ({
        ...current,
        [jobId]: mode,
      }));
    },
    [],
  );

  const toggleOverlayJobForJob = useCallback(
    (jobId: string, overlayJobId: string) => {
      setSelectedOverlayJobIdsByJobId((current) => {
        const selected = current[jobId] || [];
        const nextSelected = selected.includes(overlayJobId)
          ? selected.filter((id) => id !== overlayJobId)
          : [...selected, overlayJobId].slice(-4);
        return {
          ...current,
          [jobId]: nextSelected,
        };
      });
    },
    [],
  );

  const cacheJobReport = useCallback(
    (jobId: string, report: AgentFineTuneReportExport) => {
      setLastReportByJobId((current) => ({
        ...current,
        [jobId]: report,
      }));
    },
    [],
  );

  return {
    chartRangeByJobId,
    chartHoverByJobId,
    chartSmoothingByJobId,
    selectedOverlayJobIdsByJobId,
    lastReportByJobId,
    setChartRangeForJob,
    setChartHoverForJob,
    setChartSmoothingForJob,
    toggleOverlayJobForJob,
    cacheJobReport,
  };
}
