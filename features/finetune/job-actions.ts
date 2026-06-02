"use client";

import { useCallback } from "react";
import type {
  AgentFineTuneDataset,
  AgentFineTuneUpstreamDatasetCandidate,
} from "@/lib/agent/types";
import type { FineTuneActionResponse } from "./actions";

type FineTuneSecondaryAction = (
  key: string,
  payload: Record<string, unknown>,
  successMessage?: string,
) => void | Promise<void>;

type FineTuneActionPoster = (
  body: Record<string, unknown>,
  successMessage: string,
) => Promise<FineTuneActionResponse | null>;

type FineTuneReportFormat = "markdown" | "manifest-json" | "metrics-csv";

type DatasetWatchDraft = {
  upstreamQuery: string;
  refreshCadenceHours: number;
};

type FineTuneAssetJobActionsOptions = {
  postAction: FineTuneActionPoster;
  runSecondaryAction: FineTuneSecondaryAction;
  copyValue: (value: string, message?: string) => void | Promise<void>;
  buildDatasetCandidateImportPlan: (
    dataset: AgentFineTuneDataset,
    candidate: AgentFineTuneUpstreamDatasetCandidate,
  ) => string;
  messages: {
    datasetWatchSave: string;
    datasetWatchCheck: string;
    importPlanCopied: string;
  };
};

export type FineTuneAssetJobActions = {
  openTargetSource: (targetId: string) => void | Promise<void>;
  openDatasetSource: (datasetId: string) => void | Promise<void>;
  saveDatasetWatch: (
    datasetId: string,
    draft: DatasetWatchDraft,
  ) => Promise<FineTuneActionResponse | null>;
  checkUpstreamDatasets: (
    datasetId: string,
    draft: DatasetWatchDraft,
  ) => Promise<FineTuneActionResponse | null>;
  copyDatasetCandidateImportPlan: (
    dataset: AgentFineTuneDataset,
    candidate: AgentFineTuneUpstreamDatasetCandidate,
  ) => void | Promise<void>;
  openAdapterOutput: (adapterId: string) => void | Promise<void>;
  openAdapterSource: (adapterId: string) => void | Promise<void>;
};

export function useFineTuneAssetJobActions({
  postAction,
  runSecondaryAction,
  copyValue,
  buildDatasetCandidateImportPlan,
  messages,
}: FineTuneAssetJobActionsOptions): FineTuneAssetJobActions {
  const openTargetSource = useCallback(
    (targetId: string) =>
      runSecondaryAction(`target-source:${targetId}`, {
        action: "open-source-page",
        targetId,
      }),
    [runSecondaryAction],
  );

  const openDatasetSource = useCallback(
    (datasetId: string) =>
      runSecondaryAction(`dataset-open:${datasetId}`, {
        action: "open-path",
        kind: "dataset-source",
        id: datasetId,
      }),
    [runSecondaryAction],
  );

  const saveDatasetWatch = useCallback(
    (datasetId: string, draft: DatasetWatchDraft) =>
      postAction(
        {
          action: "save-dataset-watch",
          datasetId,
          upstreamQuery: draft.upstreamQuery,
          refreshCadenceHours: draft.refreshCadenceHours,
        },
        messages.datasetWatchSave,
      ),
    [messages.datasetWatchSave, postAction],
  );

  const checkUpstreamDatasets = useCallback(
    (datasetId: string, draft: DatasetWatchDraft) =>
      postAction(
        {
          action: "check-upstream-datasets",
          datasetId,
          upstreamQuery: draft.upstreamQuery,
        },
        messages.datasetWatchCheck,
      ),
    [messages.datasetWatchCheck, postAction],
  );

  const copyDatasetCandidateImportPlan = useCallback(
    (
      dataset: AgentFineTuneDataset,
      candidate: AgentFineTuneUpstreamDatasetCandidate,
    ) =>
      copyValue(
        buildDatasetCandidateImportPlan(dataset, candidate),
        messages.importPlanCopied,
      ),
    [buildDatasetCandidateImportPlan, copyValue, messages.importPlanCopied],
  );

  const openAdapterOutput = useCallback(
    (adapterId: string) =>
      runSecondaryAction(`adapter-open:${adapterId}`, {
        action: "open-path",
        kind: "adapter-output",
        id: adapterId,
      }),
    [runSecondaryAction],
  );

  const openAdapterSource = useCallback(
    (adapterId: string) =>
      runSecondaryAction(`adapter-source:${adapterId}`, {
        action: "open-source-page",
        adapterId,
      }),
    [runSecondaryAction],
  );

  return {
    openTargetSource,
    openDatasetSource,
    saveDatasetWatch,
    checkUpstreamDatasets,
    copyDatasetCandidateImportPlan,
    openAdapterOutput,
    openAdapterSource,
  };
}

type FineTuneRunJobActionsOptions = {
  postAction: FineTuneActionPoster;
  runSecondaryAction: FineTuneSecondaryAction;
  exportJobReport: (
    jobId: string,
    format: FineTuneReportFormat,
    copyContent?: boolean,
  ) => void | Promise<void>;
  messages: {
    startSuccess: string;
    rerunSuccess: string;
    cancelSuccess: string;
  };
};

export type FineTuneRunJobActions = {
  startJob: (jobId: string) => Promise<FineTuneActionResponse | null>;
  rerunJob: (jobId: string) => Promise<FineTuneActionResponse | null>;
  cancelJob: (jobId: string) => Promise<FineTuneActionResponse | null>;
  openJobOutput: (jobId: string) => void | Promise<void>;
  openJobBundle: (jobId: string) => void | Promise<void>;
  openJobSource: (jobId: string) => void | Promise<void>;
  openJobReports: (jobId: string) => void | Promise<void>;
  exportMarkdownReport: (
    jobId: string,
    copyContent?: boolean,
  ) => void | Promise<void>;
  exportManifestJson: (jobId: string) => void | Promise<void>;
  exportMetricsCsv: (jobId: string) => void | Promise<void>;
};

export function useFineTuneRunJobActions({
  postAction,
  runSecondaryAction,
  exportJobReport,
  messages,
}: FineTuneRunJobActionsOptions): FineTuneRunJobActions {
  const startJob = useCallback(
    (jobId: string) =>
      postAction({ action: "start-job", id: jobId }, messages.startSuccess),
    [messages.startSuccess, postAction],
  );

  const rerunJob = useCallback(
    (jobId: string) =>
      postAction({ action: "rerun-job", id: jobId }, messages.rerunSuccess),
    [messages.rerunSuccess, postAction],
  );

  const cancelJob = useCallback(
    (jobId: string) =>
      postAction({ action: "cancel-job", id: jobId }, messages.cancelSuccess),
    [messages.cancelSuccess, postAction],
  );

  const openJobOutput = useCallback(
    (jobId: string) =>
      runSecondaryAction(`job-output:${jobId}`, {
        action: "open-path",
        kind: "job-output",
        id: jobId,
      }),
    [runSecondaryAction],
  );

  const openJobBundle = useCallback(
    (jobId: string) =>
      runSecondaryAction(`job-bundle:${jobId}`, {
        action: "open-path",
        kind: "job-bundle",
        id: jobId,
      }),
    [runSecondaryAction],
  );

  const openJobSource = useCallback(
    (jobId: string) =>
      runSecondaryAction(`job-source:${jobId}`, {
        action: "open-source-page",
        id: jobId,
      }),
    [runSecondaryAction],
  );

  const openJobReports = useCallback(
    (jobId: string) =>
      runSecondaryAction(`job-reports:${jobId}`, {
        action: "open-path",
        kind: "job-reports",
        id: jobId,
      }),
    [runSecondaryAction],
  );

  const exportMarkdownReport = useCallback(
    (jobId: string, copyContent?: boolean) =>
      exportJobReport(jobId, "markdown", copyContent),
    [exportJobReport],
  );

  const exportManifestJson = useCallback(
    (jobId: string) => exportJobReport(jobId, "manifest-json"),
    [exportJobReport],
  );

  const exportMetricsCsv = useCallback(
    (jobId: string) => exportJobReport(jobId, "metrics-csv"),
    [exportJobReport],
  );

  return {
    startJob,
    rerunJob,
    cancelJob,
    openJobOutput,
    openJobBundle,
    openJobSource,
    openJobReports,
    exportMarkdownReport,
    exportManifestJson,
    exportMetricsCsv,
  };
}
