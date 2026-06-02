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
    lastReportByJobId,
    setChartRangeForJob,
    setChartHoverForJob,
    cacheJobReport,
  };
}
