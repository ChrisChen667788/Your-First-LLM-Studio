import path from "path";
import type {
  AgentFineTuneBestCheckpointSelection,
  AgentFineTuneCheckpointEvent,
  AgentFineTuneCurvePoint,
  AgentFineTuneJob,
  AgentFineTuneRecipe,
} from "@/lib/agent/types";
import { listArtifactFiles } from "./bundle-service";
import {
  getJobPaths,
  readJobs,
  readRecipes,
  writeJobRuntimeState,
} from "./repository";
import { normalizeLoraBestCheckpointMetric } from "./lora-config";

type BackfillCandidate = {
  job: AgentFineTuneJob;
  checkpointEvents: AgentFineTuneCheckpointEvent[];
  bestCheckpoint: AgentFineTuneBestCheckpointSelection;
};

type BackfillResult = {
  jobId: string;
  adapterName: string;
  status: "updated" | "skipped";
  reason: string;
  bestCheckpoint?: AgentFineTuneBestCheckpointSelection;
  checkpointEventCount?: number;
};

export type FineTuneBestCheckpointBackfillResult = {
  generatedAt: string;
  updatedCount: number;
  skippedCount: number;
  results: BackfillResult[];
};

function parseCheckpointStep(relativePath: string) {
  const match =
    relativePath.match(
      /(?:^|[/_-])0*(\d{1,8})(?:[_-](?:adapter|checkpoint|weights)|\.)/i,
    ) ||
    relativePath.match(/checkpoint[-_]?0*(\d{1,8})/i);
  if (!match) return null;
  const step = Number(match[1]);
  return Number.isFinite(step) && step > 0 ? Math.round(step) : null;
}

function isAdapterArtifact(relativePath: string) {
  return /\.(safetensors|npz|bin|ckpt|pt)$/i.test(relativePath) ||
    /(?:checkpoint|weights)/i.test(relativePath);
}

function inferCheckpointEvents(job: AgentFineTuneJob) {
  const existingEvents = (job.checkpointEvents || []).filter(
    (event) => typeof event.step === "number" && Number.isFinite(event.step),
  );
  if (existingEvents.length) return existingEvents;

  const files = listArtifactFiles(job.outputDir, 500).filter(isAdapterArtifact);
  const events: AgentFineTuneCheckpointEvent[] = [];
  files.forEach((relativePath) => {
    const step = parseCheckpointStep(relativePath);
    if (!step) return;
    events.push({
      step,
      path: path.join(job.outputDir, relativePath),
      metric: "eval_loss",
      value: null,
      at: job.completedAt || job.updatedAt,
    });
  });

  return events.sort((left, right) => left.step - right.step);
}

function pickValidationBestPoint(job: AgentFineTuneJob) {
  return (job.curve || [])
    .filter(
      (point): point is AgentFineTuneCurvePoint =>
        point.split === "valid" &&
        typeof point.step === "number" &&
        Number.isFinite(point.step) &&
        typeof point.loss === "number" &&
        Number.isFinite(point.loss),
    )
    .sort((left, right) => left.loss - right.loss || left.step - right.step)[0];
}

function nearestCheckpointPath(
  step: number,
  checkpointEvents: AgentFineTuneCheckpointEvent[],
) {
  const exact = checkpointEvents.find((event) => event.step === step);
  if (exact?.path) return exact.path;
  const prior = [...checkpointEvents]
    .filter((event) => event.step <= step && event.path)
    .sort((left, right) => right.step - left.step)[0];
  return prior?.path;
}

function latestCheckpointEvent(checkpointEvents: AgentFineTuneCheckpointEvent[]) {
  return [...checkpointEvents].sort((left, right) => right.step - left.step)[0];
}

function buildBackfillCandidate(
  job: AgentFineTuneJob,
  recipe?: AgentFineTuneRecipe,
): BackfillCandidate | null {
  if (job.bestCheckpoint) return null;

  const files = listArtifactFiles(job.outputDir, 500).filter(isAdapterArtifact);
  if (!files.length) return null;

  const metric = normalizeLoraBestCheckpointMetric(recipe?.bestCheckpointMetric);
  const selectedAt = job.completedAt || new Date().toISOString();
  const checkpointEvents = inferCheckpointEvents(job);
  const validationBest =
    metric === "eval_loss" ? pickValidationBestPoint(job) : undefined;

  if (validationBest) {
    return {
      job,
      checkpointEvents,
      bestCheckpoint: {
        step: Math.round(validationBest.step),
        metric: "eval_loss",
        value: validationBest.loss,
        path: nearestCheckpointPath(validationBest.step, checkpointEvents),
        source: "validation",
        loadBestCheckpointAtEnd: recipe?.loadBestCheckpointAtEnd ?? true,
        selectedAt,
      },
    };
  }

  const latestEvent = latestCheckpointEvent(checkpointEvents);
  return {
    job,
    checkpointEvents,
    bestCheckpoint: {
      step:
        latestEvent?.step ||
        job.progress?.currentStep ||
        job.progress?.totalSteps ||
        1,
      metric,
      value: latestEvent?.value ?? null,
      path:
        latestEvent?.path || path.join(job.outputDir, "adapters.safetensors"),
      source: "final",
      loadBestCheckpointAtEnd: recipe?.loadBestCheckpointAtEnd ?? true,
      selectedAt,
    },
  };
}

export function backfillFineTuneBestCheckpoints(): FineTuneBestCheckpointBackfillResult {
  const recipes = readRecipes();
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const jobs = readJobs();
  const results: BackfillResult[] = [];

  for (const job of jobs) {
    if (job.bestCheckpoint) {
      results.push({
        jobId: job.id,
        adapterName: job.adapterName,
        status: "skipped",
        reason: "already-has-best-checkpoint",
        bestCheckpoint: job.bestCheckpoint,
        checkpointEventCount: job.checkpointEvents?.length || 0,
      });
      continue;
    }

    const paths = getJobPaths(job.id);
    const candidate = buildBackfillCandidate(job, recipeById.get(job.recipeId));
    if (!candidate) {
      results.push({
        jobId: job.id,
        adapterName: job.adapterName,
        status: "skipped",
        reason: "no-adapter-artifacts",
      });
      continue;
    }

    writeJobRuntimeState(job.id, {
      stateFile: paths.stateFile,
      checkpointEvents: candidate.checkpointEvents.slice(-200),
      bestCheckpoint: candidate.bestCheckpoint,
      latestMessage:
        candidate.bestCheckpoint.source === "validation"
          ? `Backfilled best checkpoint from validation loss at step ${candidate.bestCheckpoint.step}.`
          : `Backfilled final checkpoint marker at step ${candidate.bestCheckpoint.step}.`,
    });
    results.push({
      jobId: job.id,
      adapterName: job.adapterName,
      status: "updated",
      reason: candidate.bestCheckpoint.source,
      bestCheckpoint: candidate.bestCheckpoint,
      checkpointEventCount: candidate.checkpointEvents.length,
    });
  }

  const updatedCount = results.filter(
    (result) => result.status === "updated",
  ).length;
  return {
    generatedAt: new Date().toISOString(),
    updatedCount,
    skippedCount: results.length - updatedCount,
    results,
  };
}
