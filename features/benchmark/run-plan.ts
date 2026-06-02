import { getManagedBenchmarkPromptSet } from "@/lib/agent/benchmark-prompt-set-store";
import {
  getBenchmarkDataset,
  getBenchmarkMilestoneSuite,
} from "@/lib/agent/benchmark-datasets";
import { listServerAgentTargets } from "@/lib/agent/server-targets";
import {
  clampContextWindowForTarget,
  normalizeContextWindow,
} from "@/lib/agent/metrics";
import {
  normalizeProviderProfile,
  normalizeThinkingMode,
} from "@/lib/agent/providers";
import type {
  AgentBenchmarkDatasetItem,
  AgentBenchmarkMode,
  AgentBenchmarkProfileBatchScope,
  AgentBenchmarkWorkloadSummary,
  AgentProviderProfile,
  AgentThinkingMode,
} from "@/lib/agent/types";

export type BenchmarkRequestBody = {
  runId?: string;
  targetIds?: string[];
  runs?: number;
  contextWindow?: number;
  maxTokens?: number;
  benchmarkMode?: AgentBenchmarkMode;
  prompt?: string;
  runNote?: string;
  promptSetId?: string;
  datasetId?: string;
  datasetSampleLimit?: number;
  suiteId?: string;
  providerProfile?: AgentProviderProfile;
  thinkingMode?: AgentThinkingMode;
  profileModes?: Array<{
    providerProfile?: AgentProviderProfile;
    thinkingMode?: AgentThinkingMode;
  }>;
  profileBatchScope?: AgentBenchmarkProfileBatchScope;
};

export type BenchmarkWorkload = {
  benchmarkMode: AgentBenchmarkMode;
  prompt: string;
  promptSetId?: string;
  promptSetLabel?: string;
  promptSetPromptCount?: number;
  datasetId?: string;
  datasetLabel?: string;
  datasetSourceLabel?: string;
  datasetSourceUrl?: string;
  datasetSampleCount?: number;
  suiteId?: string;
  suiteLabel?: string;
  suiteWorkloadCount?: number;
  workloads?: AgentBenchmarkWorkloadSummary[];
};

export type PlannedBenchmarkItem = {
  id: string;
  prompt: string;
  workloadId: string;
  workloadLabel: string;
  expectedAnswerPreview?: string;
  evaluator?: AgentBenchmarkDatasetItem["evaluator"];
  runCount: number;
};

export type PlannedSampleTask = {
  sampleRun: number;
  prompt: string;
  workloadId: string;
  workloadLabel: string;
  itemId: string;
  expectedAnswerPreview?: string;
  evaluator?: AgentBenchmarkDatasetItem["evaluator"];
  contextWindow: number;
  maxTokens: number;
};

export type BenchmarkPlan = BenchmarkWorkload & {
  items: PlannedBenchmarkItem[];
};

const REMOTE_PROFILE_COMPARISON_WORKLOAD_IDS = new Set([
  "latency-smoke",
  "instruction-following-lite",
  "ifeval-starter",
  "bfcl-starter",
]);

function buildSuitePlan(
  benchmarkMode: AgentBenchmarkMode,
  suite: NonNullable<ReturnType<typeof getBenchmarkMilestoneSuite>>,
  runs: number,
): BenchmarkPlan | { error: string } {
  const items: PlannedBenchmarkItem[] = [];
  const workloadSummaries: AgentBenchmarkWorkloadSummary[] = [];

  for (const workload of suite.workloads) {
    if (workload.kind === "prompt-set") {
      const promptSet = getManagedBenchmarkPromptSet(workload.promptSetId);
      if (!promptSet) {
        return { error: `Unknown prompt set in suite ${suite.id}: ${workload.promptSetId}` };
      }
      workloadSummaries.push({
        kind: "prompt-set",
        id: promptSet.id,
        label: promptSet.label,
        description: promptSet.description,
        sampleCount: promptSet.prompts.length,
        scorable: false,
      });
      for (const [index, prompt] of promptSet.prompts.entries()) {
        items.push({
          id: `${promptSet.id}:${index + 1}`,
          prompt,
          workloadId: promptSet.id,
          workloadLabel: promptSet.label,
          runCount: workload.runs || runs,
        });
      }
      continue;
    }

    const dataset = getBenchmarkDataset(workload.datasetId);
    if (!dataset) {
      return { error: `Unknown dataset in suite ${suite.id}: ${workload.datasetId}` };
    }
    const datasetItems = dataset.items.slice(0, workload.sampleLimit || dataset.items.length);
    workloadSummaries.push({
      kind: "dataset",
      id: dataset.id,
      label: dataset.label,
      description: dataset.description,
      sourceLabel: dataset.sourceLabel,
      sourceUrl: dataset.sourceUrl,
      sampleCount: datasetItems.length,
      scorable: datasetItems.some((item) => item.evaluator.kind !== "manual-review"),
    });
    for (const item of datasetItems) {
      items.push({
        id: `${dataset.id}:${item.id}`,
        prompt: item.prompt,
        workloadId: dataset.id,
        workloadLabel: dataset.label,
        expectedAnswerPreview: item.expectedAnswerPreview,
        evaluator: item.evaluator,
        runCount: workload.runs || runs,
      });
    }
  }

  return {
    benchmarkMode,
    prompt: `[${benchmarkMode}] ${suite.label}`,
    suiteId: suite.id,
    suiteLabel: suite.label,
    suiteWorkloadCount: suite.workloads.length,
    workloads: workloadSummaries,
    items,
  };
}

export function normalizeProfileModes(
  inputModes: BenchmarkRequestBody["profileModes"],
  fallbackProviderProfile: AgentProviderProfile,
  fallbackThinkingMode: AgentThinkingMode,
) {
  const baseModes =
    inputModes && inputModes.length
      ? inputModes
      : [{ providerProfile: fallbackProviderProfile, thinkingMode: fallbackThinkingMode }];

  const normalized = baseModes.map((entry) => {
    const thinkingMode = normalizeThinkingMode(entry.thinkingMode || fallbackThinkingMode);
    const requestedProviderProfile = normalizeProviderProfile(entry.providerProfile || fallbackProviderProfile);
    return {
      providerProfile: thinkingMode === "thinking" ? "tool-first" : requestedProviderProfile,
      thinkingMode,
    };
  });

  return normalized.filter((entry, index, all) => {
    const key = `${entry.providerProfile}:${entry.thinkingMode}`;
    return all.findIndex((candidate) => `${candidate.providerProfile}:${candidate.thinkingMode}` === key) === index;
  });
}

export function matchesBenchmarkWorkload(
  benchmark: {
    prompt: string;
    benchmarkMode?: AgentBenchmarkMode;
    promptSetId?: string | null;
    datasetId?: string | null;
    suiteId?: string | null;
    profileBatchScope?: string | null;
  },
  workload: BenchmarkWorkload & { profileBatchScope?: AgentBenchmarkProfileBatchScope },
) {
  if ((benchmark.benchmarkMode || "prompt") !== workload.benchmarkMode) return false;
  if (workload.profileBatchScope && (benchmark.profileBatchScope || "") !== workload.profileBatchScope) return false;
  if (workload.suiteId) {
    return benchmark.suiteId === workload.suiteId;
  }
  if (workload.datasetId) {
    return benchmark.datasetId === workload.datasetId;
  }
  if (workload.promptSetId) {
    return benchmark.promptSetId === workload.promptSetId;
  }
  return !benchmark.promptSetId && benchmark.prompt === workload.prompt;
}

function normalizeWorkloadBudget(
  workloadId: string,
  requestedContextWindow: number,
  requestedMaxTokens: number,
) {
  const byWorkloadId: Record<
    string,
    {
      contextWindow: number;
      maxTokens: number;
    }
  > = {
    "latency-smoke": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 96),
    },
    "instruction-following-lite": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 96),
    },
    "ifeval-starter": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 96),
    },
    "ceval-cs-starter": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 64),
    },
    "cmmlu-cs-starter": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 64),
    },
    "bfcl-starter": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 96),
    },
    "grounded-kb-qa": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 160),
    },
    "code-rag-repo-qa": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 160),
    },
    "agent-flow-lite": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 160),
    },
    "longbench-starter": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 192),
    },
    "humaneval-starter": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 256),
    },
    "mbppplus-starter": {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 256),
    },
  };

  return (
    byWorkloadId[workloadId] || {
      contextWindow: requestedContextWindow,
      maxTokens: Math.min(requestedMaxTokens, 160),
    }
  );
}

export function expandPlanTasks(
  plan: BenchmarkPlan,
  requestedContextWindow: number,
  requestedMaxTokens: number,
) {
  const tasks: PlannedSampleTask[] = [];
  let sampleRun = 1;

  for (const benchmarkPrompt of plan.items) {
    const budget = normalizeWorkloadBudget(
      benchmarkPrompt.workloadId,
      requestedContextWindow,
      requestedMaxTokens,
    );
    for (let run = 1; run <= benchmarkPrompt.runCount; run += 1) {
      tasks.push({
        sampleRun,
        prompt: benchmarkPrompt.prompt,
        workloadId: benchmarkPrompt.workloadId,
        workloadLabel: benchmarkPrompt.workloadLabel,
        itemId: benchmarkPrompt.id,
        expectedAnswerPreview: benchmarkPrompt.expectedAnswerPreview,
        evaluator: benchmarkPrompt.evaluator,
        contextWindow: budget.contextWindow,
        maxTokens: budget.maxTokens,
      });
      sampleRun += 1;
    }
  }

  return tasks;
}

export function buildGroupKey(
  targetId: string,
  providerProfile: AgentProviderProfile,
  thinkingMode: AgentThinkingMode,
) {
  return `${targetId}:${providerProfile}:${thinkingMode}`;
}

export function deriveComparisonSubsetTasks(tasks: PlannedSampleTask[]) {
  const seenPerWorkload = new Map<string, number>();
  const subset: PlannedSampleTask[] = [];

  for (const task of tasks) {
    if (!REMOTE_PROFILE_COMPARISON_WORKLOAD_IDS.has(task.workloadId)) continue;
    const currentCount = seenPerWorkload.get(task.workloadId) || 0;
    const limit = task.workloadId === "latency-smoke" ? 4 : 3;
    if (currentCount >= limit) continue;
    seenPerWorkload.set(task.workloadId, currentCount + 1);
    subset.push(task);
  }

  return subset.length ? subset : tasks.slice(0, Math.min(tasks.length, 12));
}

export function clampBenchmarkContextWindowForTarget(
  targetId: string,
  requestedContextWindow: number,
) {
  const target = listServerAgentTargets().find((item) => item.id === targetId);
  if (target?.execution === "local") {
    return Math.min(normalizeContextWindow(requestedContextWindow, 8192), 32768);
  }
  return clampContextWindowForTarget(targetId, requestedContextWindow, {
    enableTools: false,
    enableRetrieval: false,
  });
}

export function groupBenchmarkTasksByWorkload(tasks: PlannedSampleTask[]) {
  const groups: Array<{
    workloadId: string;
    workloadLabel: string;
    tasks: PlannedSampleTask[];
  }> = [];

  for (const task of tasks) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.workloadId === task.workloadId) {
      lastGroup.tasks.push(task);
      continue;
    }
    groups.push({
      workloadId: task.workloadId,
      workloadLabel: task.workloadLabel,
      tasks: [task],
    });
  }

  return groups;
}

export function buildPlan(
  body: BenchmarkRequestBody,
  runs: number,
): BenchmarkPlan | { error: string } {
  const benchmarkMode = body.benchmarkMode || (body.suiteId ? "suite" : body.datasetId ? "dataset" : "prompt");
  const datasetSampleLimit = Math.max(1, Math.min(Math.trunc(body.datasetSampleLimit || 5), 50));

  if (benchmarkMode === "suite") {
    const suite = getBenchmarkMilestoneSuite(body.suiteId);
    if (!suite) {
      return { error: `Unknown benchmark suite: ${body.suiteId || "empty"}` };
    }
    return buildSuitePlan(benchmarkMode, suite, runs);
  }

  if (benchmarkMode === "dataset") {
    const dataset = getBenchmarkDataset(body.datasetId);
    if (!dataset) {
      return { error: `Unknown benchmark dataset: ${body.datasetId || "empty"}` };
    }
    const items = dataset.items.slice(0, datasetSampleLimit).map((item) => ({
      id: item.id,
      prompt: item.prompt,
      workloadId: dataset.id,
      workloadLabel: dataset.label,
      expectedAnswerPreview: item.expectedAnswerPreview,
      evaluator: item.evaluator,
      runCount: runs,
    }));
    return {
      benchmarkMode,
      prompt: `[dataset] ${dataset.label}`,
      datasetId: dataset.id,
      datasetLabel: dataset.label,
      datasetSourceLabel: dataset.sourceLabel,
      datasetSourceUrl: dataset.sourceUrl,
      datasetSampleCount: items.length,
      workloads: [
        {
          kind: "dataset",
          id: dataset.id,
          label: dataset.label,
          description: dataset.description,
          sourceLabel: dataset.sourceLabel,
          sourceUrl: dataset.sourceUrl,
          sampleCount: items.length,
          scorable: items.some((item) => item.evaluator?.kind !== "manual-review"),
        },
      ],
      items,
    };
  }

  const promptSet = getManagedBenchmarkPromptSet(body.promptSetId);
  if (body.promptSetId && !promptSet) {
    return { error: `Unknown prompt set: ${body.promptSetId}` };
  }
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim()
      : "请用一段简短中文解释本地编码 Agent 的价值。";

  if (promptSet) {
    return {
      benchmarkMode,
      prompt: `[prompt-set] ${promptSet.label}`,
      promptSetId: promptSet.id,
      promptSetLabel: promptSet.label,
      promptSetPromptCount: promptSet.prompts.length,
      workloads: [
        {
          kind: "prompt-set",
          id: promptSet.id,
          label: promptSet.label,
          description: promptSet.description,
          sampleCount: promptSet.prompts.length,
          scorable: false,
        },
      ],
      items: promptSet.prompts.map((entry, index) => ({
        id: `${promptSet.id}:${index + 1}`,
        prompt: entry,
        workloadId: promptSet.id,
        workloadLabel: promptSet.label,
        runCount: runs,
      })),
    };
  }

  return {
    benchmarkMode,
    prompt,
    workloads: [
      {
        kind: "prompt",
        id: "custom-prompt",
        label: "Custom prompt",
        sampleCount: 1,
        scorable: false,
      },
    ],
    items: [
      {
        id: "custom-prompt:1",
        prompt,
        workloadId: "custom-prompt",
        workloadLabel: "Custom prompt",
        runCount: runs,
      },
    ],
  };
}
