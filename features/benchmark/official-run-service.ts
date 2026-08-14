import { randomUUID } from "node:crypto";
import { closeSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { readBenchmarkLogs } from "@/lib/agent/log-store";
import {
  listBenchmarkProgress,
  readBenchmarkProgress,
} from "@/lib/agent/benchmark-progress-store";
import {
  MATH500_FULL_RUN_PREFIX,
  OFFICIAL_BENCHMARK_RUN_SCHEMA_VERSION,
  type Math500FullRunEvidence,
  type OfficialBenchmarkRunAction,
  type OfficialBenchmarkRunReadModel,
} from "@/features/benchmark/official-run-contracts";

const RUNNER_SCRIPT = path.join(process.cwd(), "scripts", "run-v164-math500-full.mjs");
const SUPPORTED_TARGETS = [
  "local-qwen3-0.6b",
  "local-qwen35-4b-4bit",
  "local-qwen3-4b-4bit",
] as const;
const ACTIVE_HEARTBEAT_GRACE_MS = 90_000;

function isActiveProgress(progress: ReturnType<typeof readBenchmarkProgress>) {
  if (!progress || !["pending", "running"].includes(progress.status)) return false;
  const heartbeat = Date.parse(progress.workerHeartbeatAt || progress.updatedAt);
  return Number.isFinite(heartbeat) && Date.now() - heartbeat < ACTIVE_HEARTBEAT_GRACE_MS;
}

function buildEvidence(runId: string): Math500FullRunEvidence | null {
  const log = readBenchmarkLogs({ limit: 1000 })
    .filter((entry) => entry.runId === runId)
    .at(-1);
  if (!log || log.datasetId !== "math-500-qualified") return null;
  const result = log.results[0];
  if (!result) return null;
  const samples = result.samples || [];
  const successful = samples.filter((sample) => sample.ok);
  const scored = successful.filter(
    (sample) =>
      sample.evaluation?.status === "scored" &&
      typeof sample.passed === "boolean",
  );
  const correct = scored.filter((sample) => sample.passed === true);
  const evaluator = scored[0]?.evaluation;
  const complete =
    samples.length === 500 &&
    new Set(samples.map((sample) => sample.itemId).filter(Boolean)).size === 500 &&
    scored.length === 500;
  return {
    runId,
    generatedAt: log.generatedAt,
    targetId: result.targetId,
    targetLabel: result.targetLabel,
    resolvedModel: result.resolvedModel,
    totalSamples: samples.length,
    successfulSamples: successful.length,
    scoredSamples: scored.length,
    correctSamples: correct.length,
    failedSamples: samples.filter((sample) => !sample.ok).length,
    resumedSamples: samples.filter((sample) => sample.resumedFromCheckpoint).length,
    accuracy: scored.length
      ? Number(((correct.length / scored.length) * 100).toFixed(2))
      : null,
    evaluatorId: evaluator?.evaluatorId || null,
    evaluatorVersion: evaluator?.evaluatorVersion || null,
    evaluatorConfigId: evaluator?.configId || null,
    complete,
    evidenceStatus: complete ? "pass" : "hold",
    disclosure: complete
      ? "All 500 qualified MATH-500 items completed and were scored by the pinned Math-Verify evaluator. This is local model evidence, not a hosted leaderboard submission."
      : "A partial or unscored run cannot be presented as full MATH-500 evidence.",
  };
}

export function readOfficialBenchmarkRun(): OfficialBenchmarkRunReadModel {
  const recentProgress = listBenchmarkProgress({
    runIdPrefix: MATH500_FULL_RUN_PREFIX,
    limit: 10,
  });
  const latestProgress = recentProgress[0] || null;
  const latestCompleted = recentProgress.find(
    (progress) => buildEvidence(progress.runId)?.complete,
  );
  return {
    ok: true,
    schemaVersion: OFFICIAL_BENCHMARK_RUN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    active: recentProgress.some(isActiveProgress),
    latestProgress,
    latestEvidence: latestCompleted ? buildEvidence(latestCompleted.runId) : null,
    recentProgress,
    supportedTargets: [...SUPPORTED_TARGETS],
    productionStatus: "hold",
    blockers: [
      "Local full-run evidence is not an external leaderboard submission or independent reproduction.",
      "Multimodal full datasets, licensed media, and compatible local vision/video runtimes are separate gates.",
    ],
  };
}

function normalizeTarget(value: string | undefined) {
  return SUPPORTED_TARGETS.includes(value as (typeof SUPPORTED_TARGETS)[number])
    ? (value as (typeof SUPPORTED_TARGETS)[number])
    : SUPPORTED_TARGETS[0];
}

function normalizeMaxTokens(value: number | undefined) {
  return Number.isFinite(value)
    ? Math.max(128, Math.min(Math.trunc(value as number), 1024))
    : 512;
}

export function startOfficialBenchmarkRun(
  action: OfficialBenchmarkRunAction,
  baseUrl: string,
) {
  const current = readOfficialBenchmarkRun();
  if (current.active) {
    throw new Error(
      `An official benchmark run is already active (${current.latestProgress?.runId || "unknown"}).`,
    );
  }
  const requestedRunId = action.runId?.trim();
  const runId =
    action.action === "resume" && requestedRunId
      ? requestedRunId
      : `${MATH500_FULL_RUN_PREFIX}${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  if (!runId.startsWith(MATH500_FULL_RUN_PREFIX) || !/^[a-zA-Z0-9._-]+$/.test(runId)) {
    throw new Error("Only a previously issued MATH-500 full-run id can be resumed.");
  }
  if (action.action === "resume" && !readBenchmarkProgress(runId)) {
    throw new Error(`No resumable progress exists for ${runId}.`);
  }

  const logDir = getLocalAgentDataPath("official-benchmark-runs");
  mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${runId}.log`);
  const output = openSync(logPath, "a");
  try {
    const child = spawn(
      process.execPath,
      [
        RUNNER_SCRIPT,
        "--base-url",
        baseUrl,
        "--run-id",
        runId,
        "--target-id",
        normalizeTarget(action.targetId),
        "--max-tokens",
        String(normalizeMaxTokens(action.maxTokens)),
      ],
      {
        cwd: process.cwd(),
        detached: true,
        stdio: ["ignore", output, output],
        env: process.env,
      },
    );
    child.unref();
    return { runId, pid: child.pid, logPath };
  } finally {
    closeSync(output);
  }
}
