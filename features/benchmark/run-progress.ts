import {
  advanceBenchmarkProgress,
  completeBenchmarkProgress,
  completeBenchmarkProgressGroup,
  createBenchmarkProgress,
  failBenchmarkProgress,
  finalizeBenchmarkProgressControl,
  markBenchmarkProgressRunning,
  startBenchmarkProgressGroup,
  touchBenchmarkProgressWorker,
} from "@/lib/agent/benchmark-progress-store";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import {
  buildExperimentSourceLinks,
  inheritExperimentSourceArtifacts,
} from "@/features/experiments/source-context";
import { setLocalBenchmarkPrewarmState } from "@/features/benchmark/run-local-prewarm";
import type {
  AgentBenchmarkProgress,
  AgentBenchmarkProfileBatchScope,
  AgentBenchmarkResponse,
  AgentExecution,
  AgentProviderProfile,
  AgentThinkingMode,
} from "@/lib/agent/types";
import type { BenchmarkPlan } from "@/features/benchmark/run-plan";
import type { ExperimentSourceContext } from "@/features/experiments/contracts";

export type PlannedBenchmarkProgressGroup = {
  key: string;
  targetLabel: string;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  execution?: AgentExecution;
  sampleCount?: number;
};

export type BenchmarkWorkerHeartbeat = {
  heartbeat: (phaseOverride?: string) => void;
  stop: () => void;
};

export function initializeBenchmarkRunProgress(input: {
  runId: string;
  plan: BenchmarkPlan;
  runNote?: string;
  profileBatchScope: AgentBenchmarkProfileBatchScope;
  totalGroups: number;
  totalSamples: number;
  pendingGroups: PlannedBenchmarkProgressGroup[];
  targetIds: string[];
  experimentContext?: ExperimentSourceContext;
}) {
  createBenchmarkProgress({
    runId: input.runId,
    benchmarkMode: input.plan.benchmarkMode,
    runNote: input.runNote,
    suiteId: input.plan.suiteId,
    suiteLabel: input.plan.suiteLabel,
    profileBatchScope: input.profileBatchScope,
    totalGroups: input.totalGroups,
    totalSamples: input.totalSamples,
    pendingGroups: input.pendingGroups,
  });
  appendExperimentEvent({
    kind: "benchmark",
    status: "started",
    title: "Benchmark run started",
    summary: `${input.plan.suiteLabel || input.plan.promptSetLabel || input.plan.datasetLabel || input.plan.prompt} · ${input.targetIds.length} target${input.targetIds.length === 1 ? "" : "s"}`,
    relatedId: input.runId,
    targetIds: input.targetIds,
    artifacts: [
      ...inheritExperimentSourceArtifacts(input.experimentContext),
      {
        kind: "api",
        role: "progress",
        label: "Benchmark progress",
        uri: `/api/admin/benchmark/progress?runId=${encodeURIComponent(input.runId)}`,
      },
    ],
    links: buildExperimentSourceLinks(input.experimentContext),
    metadata: {
      benchmarkMode: input.plan.benchmarkMode,
      suiteId: input.plan.suiteId,
      suiteLabel: input.plan.suiteLabel,
      promptSetId: input.plan.promptSetId,
      datasetId: input.plan.datasetId,
      runNote: input.runNote,
      totalGroups: input.totalGroups,
      totalSamples: input.totalSamples,
      profileBatchScope: input.profileBatchScope,
    },
  });
  markBenchmarkProgressRunning(input.runId);
}

export function createBenchmarkWorkerHeartbeat(
  runId: string,
  intervalMs: number,
): BenchmarkWorkerHeartbeat {
  let workerPhase = "initializing-benchmark";
  const heartbeat = (phaseOverride?: string) => {
    if (phaseOverride) {
      workerPhase = phaseOverride;
      touchBenchmarkProgressWorker(runId, {
        heartbeatAt: new Date().toISOString(),
        pid: process.pid,
        phase: workerPhase,
      });
      return;
    }
    touchBenchmarkProgressWorker(runId, {
      heartbeatAt: new Date().toISOString(),
      pid: process.pid,
    });
  };
  heartbeat("initializing-benchmark");
  const timer = setInterval(() => heartbeat(), intervalMs);
  timer.unref?.();

  return {
    heartbeat,
    stop: () => clearInterval(timer),
  };
}

export function startBenchmarkRunGroup(
  runId: string,
  group: PlannedBenchmarkProgressGroup,
) {
  startBenchmarkProgressGroup(runId, group);
  setLocalBenchmarkPrewarmState(runId, null);
}

export function advanceBenchmarkRunSampleProgress(
  runId: string,
  sample: {
    ok: boolean;
    targetLabel: string;
    providerProfile: NonNullable<AgentBenchmarkProgress["lastCompletedProfile"]>;
    thinkingMode: NonNullable<AgentBenchmarkProgress["lastCompletedThinkingMode"]>;
    workloadLabel: string;
  },
) {
  advanceBenchmarkProgress(runId, sample);
}

export function completeBenchmarkRunGroup(runId: string, groupKey: string) {
  completeBenchmarkProgressGroup(runId, groupKey);
}

export function completeBenchmarkRunProgress(input: {
  runId: string;
  payload: AgentBenchmarkResponse;
  targetIds: string[];
  experimentContext?: ExperimentSourceContext;
}) {
  appendExperimentEvent({
    kind: "benchmark",
    status: input.payload.ok ? "completed" : "failed",
    title: input.payload.ok ? "Benchmark run completed" : "Benchmark run failed",
    summary: `${input.payload.results.length} result groups · ${input.payload.benchmarkMode}`,
    relatedId: input.runId,
    targetIds: input.targetIds,
    artifacts: [
      {
        kind: "api",
        role: "report",
        label: "Benchmark report",
        uri: `/api/admin/benchmark/report?runId=${encodeURIComponent(input.runId)}`,
      },
      {
        kind: "api",
        role: "progress",
        label: "Benchmark progress",
        uri: `/api/admin/benchmark/progress?runId=${encodeURIComponent(input.runId)}`,
      },
    ],
    links: [
      ...buildExperimentSourceLinks(input.experimentContext),
      {
        relation: "produced",
        entityType: "report",
        id: input.runId,
        label: "Benchmark report",
      },
    ],
    metadata: {
      benchmarkMode: input.payload.benchmarkMode,
      suiteId: input.payload.suiteId,
      suiteLabel: input.payload.suiteLabel,
      runNote: input.payload.runNote,
      resultGroups: input.payload.results.length,
      okGroups: input.payload.results.filter((result) => result.okRuns > 0).length,
      generatedAt: input.payload.generatedAt,
    },
  });
  completeBenchmarkProgress(input.runId);
}

export function finalizeBenchmarkControlProgress(input: {
  runId: string;
  action: "stop" | "abandon";
  message: string;
}) {
  finalizeBenchmarkProgressControl(input.runId, input.action, input.message);
  appendExperimentEvent({
    kind: "benchmark",
    status: input.action === "stop" ? "cancelled" : "failed",
    title: input.action === "stop" ? "Benchmark run stopped" : "Benchmark run abandoned",
    summary: input.message,
    relatedId: input.runId,
  });
}

export function failBenchmarkRunProgress(input: {
  runId: string;
  message: string;
}) {
  failBenchmarkProgress(input.runId, input.message);
  appendExperimentEvent({
    kind: "benchmark",
    status: "failed",
    title: "Benchmark run failed",
    summary: input.message,
    relatedId: input.runId,
  });
}
