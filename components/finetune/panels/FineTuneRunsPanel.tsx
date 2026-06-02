"use client";

import type {
  AgentFineTuneAdapterArtifact,
  AgentFineTuneJob,
  AgentFineTuneReportExport,
  AgentFineTuneRunComparisonSummary,
} from "@/lib/agent/types";
import type {
  TrainingChartHoverState,
  TrainingChartRangePreset,
} from "@/features/finetune/ui-cache-state";
import type { FineTuneRunJobActions } from "@/features/finetune/job-actions";
import { FineTuneJobActionsCard } from "./FineTuneJobActionsCard";
import { FineTuneJobGroupHeader } from "./FineTuneJobGroupHeader";
import { FineTuneJobNextStepCard } from "./FineTuneJobNextStepCard";
import { FineTuneJobPathsCard } from "./FineTuneJobPathsCard";
import { FineTuneJobRunOverview } from "./FineTuneJobRunOverview";
import { FineTuneLatestReportCard } from "./FineTuneLatestReportCard";
import { FineTuneTrainingCurveCard } from "./FineTuneTrainingCurveCard";
import { FineTuneWorkerLogCard } from "./FineTuneWorkerLogCard";

type FineTuneJobGroup = {
  key: string;
  label: string;
  jobs: AgentFineTuneJob[];
};

type FineTuneJobStatusMeta = {
  label: string;
  dot: string;
  badge: string;
  bar: string;
};

type FineTuneRunDeltaConclusion = NonNullable<
  NonNullable<AgentFineTuneRunComparisonSummary["deltaToPrevious"]>
>["conclusion"];

type FineTuneRunsPanelProps = {
  jobs: AgentFineTuneJob[];
  jobGroups: FineTuneJobGroup[];
  collapsedJobGroups: Record<string, boolean | undefined>;
  chartRangeByJobId: Record<string, TrainingChartRangePreset>;
  chartHoverByJobId: Record<string, TrainingChartHoverState>;
  lastReportByJobId: Record<string, AgentFineTuneReportExport | undefined>;
  adapterByJobId: Map<string, AgentFineTuneAdapterArtifact>;
  text: Record<string, string>;
  isEnglish: boolean;
  pending: boolean;
  actionPending: Record<string, boolean>;
  formatDateTime: (value?: string) => string;
  formatNumber: (value?: number | null, digits?: number) => string;
  formatSignedNumber: (value?: number | null, digits?: number) => string;
  formatSignedDurationMs: (value?: number | null) => string;
  formatSignedInteger: (value?: number | null) => string;
  getJobProgressPercent: (job: AgentFineTuneJob) => number;
  getJobStatusMeta: (job: AgentFineTuneJob) => FineTuneJobStatusMeta;
  getJobSourceUrl: (job: AgentFineTuneJob) => string | undefined;
  getRunDeltaConclusionLabel: (
    value: FineTuneRunDeltaConclusion | undefined,
    isEnglish: boolean,
  ) => string;
  setChartRangeForJob: (
    jobId: string,
    range: TrainingChartRangePreset,
  ) => void;
  setChartHoverForJob: (
    jobId: string,
    point: TrainingChartHoverState,
  ) => void;
  onToggleJobGroup: (groupKey: string) => void;
  jobActions: FineTuneRunJobActions;
  copyValue: (value: string, message?: string) => void | Promise<void>;
  attachAdapterRuntime: (adapterId: string) => void | Promise<void>;
  runAdapterCompareHandoff: (adapterId: string) => void | Promise<void>;
  runAdapterBenchmarkHandoff: (adapterId: string) => void | Promise<void>;
};

export function FineTuneRunsPanel({
  jobs,
  jobGroups,
  collapsedJobGroups,
  chartRangeByJobId,
  chartHoverByJobId,
  lastReportByJobId,
  adapterByJobId,
  text,
  isEnglish,
  pending,
  actionPending,
  formatDateTime,
  formatNumber,
  formatSignedNumber,
  formatSignedDurationMs,
  formatSignedInteger,
  getJobProgressPercent,
  getJobStatusMeta,
  getJobSourceUrl,
  getRunDeltaConclusionLabel,
  setChartRangeForJob,
  setChartHoverForJob,
  onToggleJobGroup,
  jobActions,
  copyValue,
  attachAdapterRuntime,
  runAdapterCompareHandoff,
  runAdapterBenchmarkHandoff,
}: FineTuneRunsPanelProps) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{text.jobs}</p>
        <span className="text-xs text-slate-500">{jobs.length}</span>
      </div>
      <div className="mt-3 space-y-3">
        {jobs.length ? (
          jobGroups.map((group) => {
            if (!group.jobs.length) return null;
            const groupCollapsed = Boolean(collapsedJobGroups[group.key]);
            const latestJob = group.jobs[0];
            return (
              <section
                key={group.key}
                className="rounded-[24px] border border-white/10 bg-black/15 p-3"
              >
                <FineTuneJobGroupHeader
                  groupKey={group.key}
                  label={group.label}
                  jobs={group.jobs}
                  latestJob={latestJob}
                  collapsed={groupCollapsed}
                  pending={pending}
                  text={text}
                  onToggle={() => onToggleJobGroup(group.key)}
                  onRerunLatestFailed={(jobId) =>
                    void jobActions.rerunJob(jobId)
                  }
                />
                {!groupCollapsed ? (
                  <div className="mt-3 space-y-3">
                    {group.jobs.map((job) => {
                      const progressPercent = getJobProgressPercent(job);
                      const statusMeta = getJobStatusMeta(job);
                      const currentStep = job.progress?.currentStep ?? 0;
                      const totalSteps = job.progress?.totalSteps ?? 0;
                      const canStart =
                        job.status !== "queued" && job.status !== "running";
                      const latestReport = lastReportByJobId[job.id];
                      const adapterForJob = adapterByJobId.get(job.id);
                      const canUseAdapterActions =
                        adapterForJob?.status === "ready";
                      const jobNextStepCopy =
                        job.status === "completed"
                          ? text.jobNextCompleted
                          : job.status === "failed" ||
                              job.status === "cancelled"
                            ? text.jobNextFailed
                            : job.status === "queued" ||
                                job.status === "running"
                              ? text.jobNextRunning
                              : text.jobNextStaged;
                      return (
                        <div
                          key={job.id}
                          className="rounded-[22px] border border-white/10 bg-slate-950/70 px-4 py-4 text-xs leading-6 text-slate-300"
                        >
                          <FineTuneJobRunOverview
                            job={job}
                            text={text}
                            statusMeta={statusMeta}
                            progressPercent={progressPercent}
                            currentStep={currentStep}
                            totalSteps={totalSteps}
                            formatDateTime={formatDateTime}
                            formatNumber={formatNumber}
                          />

                          <FineTuneTrainingCurveCard
                            job={job}
                            jobs={jobs}
                            text={text}
                            isEnglish={isEnglish}
                            chartRange={chartRangeByJobId[job.id] || "all"}
                            hoverPoint={chartHoverByJobId[job.id] || null}
                            formatNumber={formatNumber}
                            onChartRangeChange={(range) =>
                              setChartRangeForJob(job.id, range)
                            }
                            onHoverPointChange={(point) =>
                              setChartHoverForJob(job.id, point)
                            }
                          />

                          {job.latestMessage ? (
                            <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200">
                              {job.latestMessage}
                            </p>
                          ) : null}

                          <FineTuneJobNextStepCard
                            job={job}
                            adapter={adapterForJob}
                            canUseAdapterActions={canUseAdapterActions}
                            jobNextStepCopy={jobNextStepCopy}
                            text={text}
                            actionPending={actionPending}
                            onAttachAdapterRuntime={(adapterId) =>
                              void attachAdapterRuntime(adapterId)
                            }
                            onRunAdapterCompareHandoff={(adapterId) =>
                              void runAdapterCompareHandoff(adapterId)
                            }
                            onRunAdapterBenchmarkHandoff={(adapterId) =>
                              void runAdapterBenchmarkHandoff(adapterId)
                            }
                            onExportMarkdownReport={(jobId) =>
                              void jobActions.exportMarkdownReport(jobId)
                            }
                          />

                          <FineTuneJobPathsCard job={job} text={text} />

                          <FineTuneJobActionsCard
                            job={job}
                            text={text}
                            canStart={canStart}
                            hasSourceUrl={Boolean(getJobSourceUrl(job))}
                            actionPending={actionPending}
                            onStartJob={(jobId) =>
                              void jobActions.startJob(jobId)
                            }
                            onRerunJob={(jobId) =>
                              void jobActions.rerunJob(jobId)
                            }
                            onCancelJob={(jobId) =>
                              void jobActions.cancelJob(jobId)
                            }
                            onOpenOutput={(jobId) =>
                              void jobActions.openJobOutput(jobId)
                            }
                            onOpenBundle={(jobId) =>
                              void jobActions.openJobBundle(jobId)
                            }
                            onCopyOutputDir={(outputDir) =>
                              void copyValue(outputDir)
                            }
                            onOpenSource={(jobId) =>
                              void jobActions.openJobSource(jobId)
                            }
                            onExportMarkdownReport={(jobId, copyContent) =>
                              void jobActions.exportMarkdownReport(
                                jobId,
                                copyContent,
                              )
                            }
                            onExportManifestJson={(jobId) =>
                              void jobActions.exportManifestJson(jobId)
                            }
                            onExportMetricsCsv={(jobId) =>
                              void jobActions.exportMetricsCsv(jobId)
                            }
                          />

                          <FineTuneLatestReportCard
                            job={job}
                            latestReport={latestReport}
                            text={text}
                            isEnglish={isEnglish}
                            actionPending={actionPending}
                            copyValue={copyValue}
                            onOpenReports={jobActions.openJobReports}
                            getRunDeltaConclusionLabel={
                              getRunDeltaConclusionLabel
                            }
                            formatSignedNumber={formatSignedNumber}
                            formatSignedDurationMs={formatSignedDurationMs}
                            formatSignedInteger={formatSignedInteger}
                          />

                          <FineTuneWorkerLogCard job={job} text={text} />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">{text.empty}</p>
        )}
      </div>
    </div>
  );
}
