import { createHash } from "node:crypto";

import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import type { AgentBenchmarkSample } from "@/lib/agent/types";
import type { PlannedSampleTask } from "@/features/benchmark/run-plan";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

const CHECKPOINT_SCHEMA_VERSION = "benchmark.sample-checkpoint.v1" as const;

type BenchmarkSampleCheckpoint = {
  schemaVersion: typeof CHECKPOINT_SCHEMA_VERSION;
  runId: string;
  groupKey: string;
  updatedAt: string;
  samples: Record<
    string,
    {
      taskDigest: string;
      completedAt: string;
      sample: AgentBenchmarkSample;
    }
  >;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
}

function checkpointPath(runId: string, groupKey: string) {
  return getLocalAgentDataPath(
    "benchmark-checkpoints",
    safeSegment(runId),
    `${sha256(groupKey).slice(0, 20)}.json`,
  );
}

function initial(runId: string, groupKey: string): BenchmarkSampleCheckpoint {
  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    runId,
    groupKey,
    updatedAt: new Date(0).toISOString(),
    samples: {},
  };
}

function valid(value: unknown): value is BenchmarkSampleCheckpoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<BenchmarkSampleCheckpoint>;
  return (
    candidate.schemaVersion === CHECKPOINT_SCHEMA_VERSION &&
    typeof candidate.runId === "string" &&
    typeof candidate.groupKey === "string" &&
    Boolean(candidate.samples) &&
    typeof candidate.samples === "object"
  );
}

function taskKey(task: PlannedSampleTask) {
  return `${task.workloadId}:${task.itemId || "prompt"}:${task.sampleRun}`;
}

function taskDigest(task: PlannedSampleTask) {
  return sha256(
    JSON.stringify({
      prompt: task.prompt,
      evaluator: task.evaluator || null,
      maxTokens: task.maxTokens,
      media: task.media || [],
    }),
  );
}

export function readBenchmarkSampleCheckpoint(
  runId: string,
  groupKey: string,
  task: PlannedSampleTask,
) {
  const store = readJsonFileDurably(
    checkpointPath(runId, groupKey),
    () => initial(runId, groupKey),
    valid,
  );
  const entry = store.samples[taskKey(task)];
  if (!entry || entry.taskDigest !== taskDigest(task)) return null;
  if (!entry.sample.ok || entry.sample.evaluation?.status === "unavailable") {
    return null;
  }
  return entry.sample;
}

export function persistBenchmarkSampleCheckpoint(input: {
  runId: string;
  groupKey: string;
  task: PlannedSampleTask;
  sample: AgentBenchmarkSample;
}) {
  const now = new Date().toISOString();
  return updateJsonFileDurably(
    checkpointPath(input.runId, input.groupKey),
    () => initial(input.runId, input.groupKey),
    (current) => ({
      ...current,
      updatedAt: now,
      samples: {
        ...current.samples,
        [taskKey(input.task)]: {
          taskDigest: taskDigest(input.task),
          completedAt: now,
          sample: input.sample,
        },
      },
    }),
    valid,
  );
}
