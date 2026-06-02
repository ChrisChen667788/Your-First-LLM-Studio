"use client";

import { useCallback } from "react";
import type { AgentFineTuneReportExport } from "@/lib/agent/types";
import type { FineTuneActionResponse } from "./actions";

type FineTuneReportFormat = "markdown" | "manifest-json" | "metrics-csv";

type FineTuneReportActionsOptions = {
  postAction: (
    body: Record<string, unknown>,
    successMessage: string,
  ) => Promise<FineTuneActionResponse | null>;
  cacheJobReport: (jobId: string, report: AgentFineTuneReportExport) => void;
  copyValue: (value?: string | null, successMessage?: string) => Promise<void>;
  reportExportSuccessMessage: string;
  reportCopySuccessMessage: string;
};

export function useFineTuneReportActions({
  postAction,
  cacheJobReport,
  copyValue,
  reportExportSuccessMessage,
  reportCopySuccessMessage,
}: FineTuneReportActionsOptions) {
  const exportJobReport = useCallback(
    async (
      jobId: string,
      reportFormat: FineTuneReportFormat,
      copyContent = false,
    ) => {
      const payload = await postAction(
        {
          action: "export-report",
          id: jobId,
          reportFormat,
        },
        reportExportSuccessMessage,
      );
      if (payload?.report) {
        cacheJobReport(jobId, payload.report);
        if (copyContent && payload.report.content) {
          await copyValue(payload.report.content, reportCopySuccessMessage);
        }
      }
    },
    [
      cacheJobReport,
      copyValue,
      postAction,
      reportCopySuccessMessage,
      reportExportSuccessMessage,
    ],
  );

  return { exportJobReport };
}
