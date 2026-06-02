import {
  readBenchmarkReleaseEvidence,
  removeBenchmarkReleaseEvidence,
  upsertBenchmarkReleaseEvidence,
} from "@/lib/agent/benchmark-release-evidence-store";
import {
  failBenchmarkProgress,
  finalizeBenchmarkProgressControl,
  readBenchmarkProgress,
  readLatestBenchmarkProgress,
  requestBenchmarkProgressControl,
  updateBenchmarkProgress,
} from "@/lib/agent/benchmark-progress-store";
import {
  createManagedBenchmarkPromptSet,
  deleteManagedBenchmarkPromptSet,
  readManagedBenchmarkPromptSets,
  updateManagedBenchmarkPromptSet,
} from "@/lib/agent/benchmark-prompt-set-store";
import {
  abortBenchmarkRun,
  hasActiveBenchmarkRunController,
} from "@/lib/agent/benchmark-run-control";

type BenchmarkPromptSetInput = {
  id?: string;
  label?: string;
  description?: string;
  prompts?: string[];
};

type BenchmarkProgressAction = "stop" | "abandon";

const STALE_WORKER_ERROR =
  "Benchmark worker is no longer active. The run was likely interrupted by a server restart or crash.";
const STALE_PROGRESS_GRACE_MS = 60_000;
const STALE_WORKER_HEARTBEAT_GRACE_MS = 180_000;

export function readBenchmarkReleaseEvidenceEntries() {
  return readBenchmarkReleaseEvidence();
}

export function saveBenchmarkReleaseEvidence(input: {
  runId?: string;
  title?: string;
  note?: string;
}) {
  const runId = typeof input.runId === "string" ? input.runId.trim() : "";
  if (!runId) {
    throw new Error("runId is required.");
  }
  return upsertBenchmarkReleaseEvidence({
    runId,
    title:
      typeof input.title === "string" ? input.title.trim() : undefined,
    note: typeof input.note === "string" ? input.note.trim() : undefined,
  });
}

export function deleteBenchmarkReleaseEvidence(runId: string) {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("runId is required.");
  }
  return removeBenchmarkReleaseEvidence(normalizedRunId);
}

function normalizeBenchmarkPromptSetPrompts(prompts: unknown) {
  if (!Array.isArray(prompts)) return [];
  return prompts.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function validateBenchmarkPromptSetInput(input: BenchmarkPromptSetInput) {
  const label = input.label?.trim() || "";
  const description = input.description?.trim() || "";
  const prompts = normalizeBenchmarkPromptSetPrompts(input.prompts);
  if (!label) {
    throw new Error("Prompt set label is required.");
  }
  if (!prompts.length) {
    throw new Error("At least one prompt is required.");
  }
  return { label, description, prompts };
}

export function readBenchmarkPromptSets() {
  return readManagedBenchmarkPromptSets();
}

export function createBenchmarkPromptSet(input: BenchmarkPromptSetInput) {
  const validated = validateBenchmarkPromptSetInput(input);
  return createManagedBenchmarkPromptSet({
    id: input.id,
    ...validated,
  });
}

export function updateBenchmarkPromptSet(input: BenchmarkPromptSetInput) {
  const id = input.id?.trim() || "";
  if (!id) {
    throw new Error("Prompt set id is required.");
  }
  const validated = validateBenchmarkPromptSetInput(input);
  const promptSet = updateManagedBenchmarkPromptSet(id, validated);
  if (!promptSet) {
    throw new Error("Prompt set not found.");
  }
  return promptSet;
}

export function deleteBenchmarkPromptSet(id: string) {
  const normalizedId = id.trim();
  if (!normalizedId) {
    throw new Error("Prompt set id is required.");
  }
  const deleted = deleteManagedBenchmarkPromptSet(normalizedId);
  if (!deleted) {
    throw new Error("Prompt set not found.");
  }
  return normalizedId;
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getProgressFreshnessMs(
  progress: NonNullable<ReturnType<typeof readBenchmarkProgress>>,
) {
  const references = [
    progress.workerHeartbeatAt,
    progress.localPrewarm?.updatedAt,
    progress.updatedAt,
    progress.controlRequestedAt,
    progress.startedAt,
  ].filter((value): value is string => Boolean(value));
  const reference = references
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0];
  if (!Number.isFinite(reference)) return Number.POSITIVE_INFINITY;
  return Date.now() - reference;
}

function getWorkerHeartbeatFreshnessMs(
  progress: NonNullable<ReturnType<typeof readBenchmarkProgress>>,
) {
  const parsed = Date.parse(progress.workerHeartbeatAt || "");
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Date.now() - parsed;
}

function resolveStaleBenchmarkProgress(
  progress: ReturnType<typeof readBenchmarkProgress>,
) {
  if (!progress) return null;
  if (!(progress.status === "pending" || progress.status === "running")) {
    if (progress.status === "completed" && progress.error === STALE_WORKER_ERROR) {
      return updateBenchmarkProgress(progress.runId, (current) => ({
        ...current,
        error: undefined,
        updatedAt: new Date().toISOString(),
      }));
    }
    return progress;
  }
  if (hasActiveBenchmarkRunController(progress.runId)) return progress;
  if (progress.controlAction) {
    const action = progress.controlAction === "stop-requested" ? "stop" : "abandon";
    return finalizeBenchmarkProgressControl(
      progress.runId,
      action,
      action === "stop" ? "Benchmark run stopped." : "Benchmark run abandoned.",
    );
  }
  if (
    getWorkerHeartbeatFreshnessMs(progress) < STALE_WORKER_HEARTBEAT_GRACE_MS &&
    typeof progress.workerPid === "number" &&
    isPidAlive(progress.workerPid)
  ) {
    return progress;
  }
  if (getProgressFreshnessMs(progress) < STALE_PROGRESS_GRACE_MS) {
    return progress;
  }
  return failBenchmarkProgress(progress.runId, STALE_WORKER_ERROR);
}

function readResolvedLatestBenchmarkProgress(unfinishedOnly: boolean) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const progress = readLatestBenchmarkProgress({ unfinishedOnly });
    const resolved = resolveStaleBenchmarkProgress(progress);
    if (!resolved) return null;
    if (!unfinishedOnly || resolved.status === "pending" || resolved.status === "running") {
      return resolved;
    }
  }
  return null;
}

export function readBenchmarkProgressRecord(input: {
  runId?: string;
  latest?: boolean;
  unfinishedOnly?: boolean;
}) {
  const runId = input.runId?.trim() || "";
  if (!runId && !input.latest) {
    throw new Error("runId is required.");
  }
  const progress = runId
    ? readBenchmarkProgress(runId)
    : readResolvedLatestBenchmarkProgress(Boolean(input.unfinishedOnly));
  const resolvedProgress = runId
    ? resolveStaleBenchmarkProgress(progress)
    : progress;
  if (!resolvedProgress) {
    throw new Error("Progress record not found.");
  }
  return resolvedProgress;
}

export function requestBenchmarkProgressAction(input: {
  runId?: string;
  action?: BenchmarkProgressAction;
}) {
  const runId = input.runId?.trim() || "";
  const action = input.action;
  if (!runId) {
    throw new Error("runId is required.");
  }
  if (action !== "stop" && action !== "abandon") {
    throw new Error("Unsupported action.");
  }
  const current = readBenchmarkProgress(runId);
  if (!current) {
    throw new Error("Progress record not found.");
  }
  const next =
    current.status === "pending" || current.status === "running"
      ? (() => {
          const updated = requestBenchmarkProgressControl(runId, action);
          const aborted = abortBenchmarkRun(runId);
          if (aborted) return updated;
          return finalizeBenchmarkProgressControl(
            runId,
            action,
            action === "stop"
              ? "Benchmark run stopped."
              : "Benchmark run abandoned.",
          );
        })()
      : finalizeBenchmarkProgressControl(
          runId,
          action,
          action === "stop"
            ? "Benchmark run stopped."
            : "Benchmark run abandoned.",
        );

  if (!next) {
    throw new Error("Failed to update progress record.");
  }
  return next;
}
