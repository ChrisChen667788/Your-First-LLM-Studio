import {
  ensureLocalGatewayAvailableDetailed,
  restartLocalGateway,
} from "@/lib/agent/local-gateway";
import {
  setBenchmarkProgressLocalPrewarm,
  touchBenchmarkProgressWorker,
} from "@/lib/agent/benchmark-progress-store";
import { getBenchmarkRunSignal } from "@/lib/agent/benchmark-run-control";
import { resolveTargetWithMode } from "@/lib/agent/providers";
import type { AgentBenchmarkProgress } from "@/lib/agent/types";
import { assertBenchmarkRunActive } from "@/features/benchmark/run-control";
import {
  fetchWithTimeout,
  sleep,
} from "@/features/benchmark/run-network";

const LOCAL_BENCHMARK_WARMUP_WAIT_MS = 300000;
const LOCAL_BENCHMARK_LOAD_STALL_RECOVERY_MS = 900000;
const LOCAL_BENCHMARK_PREWARM_TIMEOUT_MS = 360000;
const LOCAL_BENCHMARK_PREWARM_POLL_MS = 1500;
const LOCAL_BENCHMARK_GATEWAY_RECOVERY_WAIT_MS = 30000;
const LOCAL_BENCHMARK_AUTO_PREWARM_MODEL = "false";

type LocalGatewayHealthPayload = {
  status?: string;
  loaded_alias?: string | null;
  loading_alias?: string | null;
  loading_elapsed_ms?: number | null;
  loading_error?: string | null;
  busy?: boolean;
};

type LocalBenchmarkPrewarmState = NonNullable<AgentBenchmarkProgress["localPrewarm"]>;

function formatElapsedForStatus(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1000) return `${Math.round(value)} ms`;
  const totalSeconds = Math.round(value / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export async function ensureLocalBenchmarkGateway(
  baseUrl: string,
  options?: {
    runId?: string;
    targetId?: string;
    targetLabel?: string;
    startedAt?: number;
  },
) {
  const startedAt = options?.startedAt || Date.now();
  let lastReason = "Local gateway is unavailable.";

  while (Date.now() - startedAt < LOCAL_BENCHMARK_WARMUP_WAIT_MS) {
    if (options?.runId) {
      assertBenchmarkRunActive(options.runId);
    }

    if (options?.runId && options.targetId && options.targetLabel) {
      setLocalBenchmarkPrewarmState(options.runId, {
        targetId: options.targetId,
        targetLabel: options.targetLabel,
        phase: "ensuring-gateway",
        message: "Ensuring local gateway availability before prewarm.",
        loadingAlias: null,
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs: Date.now() - startedAt,
      });
    }

    const remainingMs = Math.max(5000, LOCAL_BENCHMARK_WARMUP_WAIT_MS - (Date.now() - startedAt));
    const ensureSliceMs = Math.min(20000, remainingMs);
    const ensured = await ensureLocalGatewayAvailableDetailed(baseUrl, {
      waitMs: ensureSliceMs,
      autoPrewarmModel: LOCAL_BENCHMARK_AUTO_PREWARM_MODEL,
    });
    if (ensured.ok) {
      return {
        ok: true,
        reason: ensured.reason,
      };
    }

    lastReason = ensured.reason;

    if (options?.runId && options.targetId && options.targetLabel) {
      setLocalBenchmarkPrewarmState(options.runId, {
        targetId: options.targetId,
        targetLabel: options.targetLabel,
        phase: "waiting-gateway",
        message: `Gateway still unavailable. ${ensured.reason}`,
        loadingAlias: null,
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs: Date.now() - startedAt,
      });
      setLocalBenchmarkPrewarmState(options.runId, {
        targetId: options.targetId,
        targetLabel: options.targetLabel,
        phase: "restarting-gateway",
        message: "Restarting local gateway during benchmark prewarm recovery.",
        loadingAlias: null,
        lastRecoveryAction: "Restarting local gateway during benchmark prewarm recovery.",
        lastRecoveryAt: new Date().toISOString(),
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs: Date.now() - startedAt,
      });
    }

    const restarted = await restartLocalBenchmarkGateway(baseUrl);
    if (!restarted) {
      await sleep(400);
    }
  }

  return {
    ok: false,
    reason: `Gateway unavailable after repeated recovery attempts. ${lastReason}`,
  };
}

export async function restartLocalBenchmarkGateway(baseUrl: string) {
  return restartLocalGateway(baseUrl, {
    waitMs: LOCAL_BENCHMARK_WARMUP_WAIT_MS,
    autoPrewarmModel: LOCAL_BENCHMARK_AUTO_PREWARM_MODEL,
  });
}

export async function releaseLocalBenchmarkRuntime(baseUrl: string) {
  try {
    await fetchWithTimeout(
      `${baseUrl.replace(/\/v1$/, "")}/v1/models/release`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      15000,
    );
  } catch {
    // Best effort cleanup only.
  }
}

async function fetchLocalGatewayHealth(baseUrl: string) {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl.replace(/\/v1$/, "")}/health`,
      {
        cache: "no-store",
      },
      10000,
    );
    if (!response.ok) return null;
    return (await response.json()) as LocalGatewayHealthPayload;
  } catch {
    return null;
  }
}

export function setLocalBenchmarkPrewarmState(
  runId: string | undefined,
  prewarm: LocalBenchmarkPrewarmState | null,
) {
  if (!runId) return;
  setBenchmarkProgressLocalPrewarm(runId, prewarm);
  touchBenchmarkProgressWorker(runId, {
    heartbeatAt: new Date().toISOString(),
    pid: process.pid,
    phase: prewarm ? `local-prewarm:${prewarm.phase}` : "running-benchmark",
  });
}

function kickLocalBenchmarkPrewarm(options: {
  baseUrl: string;
  model: string;
  runId?: string;
}) {
  void requestLocalBenchmarkPrewarm(options).catch(() => {
    // Progress loop keeps polling health and can recover again if the detached kick fails.
  });
}

async function requestLocalBenchmarkPrewarm(options: {
  baseUrl: string;
  model: string;
  runId?: string;
}) {
  const runSignal = options.runId ? getBenchmarkRunSignal(options.runId) : undefined;
  try {
    const response = await fetchWithTimeout(
      `${options.baseUrl.replace(/\/v1$/, "")}/v1/models/prewarm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: options.model }),
      },
      LOCAL_BENCHMARK_PREWARM_TIMEOUT_MS,
      runSignal,
    );
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      // ignore
    }
    return {
      ok: response.ok,
      status: response.status,
      detail,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      detail: error instanceof Error ? error.message : "Unknown prewarm error.",
    };
  }
}

async function waitForLocalBenchmarkPrewarm(options: {
  baseUrl: string;
  model: string;
  targetId: string;
  targetLabel: string;
  runId?: string;
  startedAt: number;
}) {
  let lastRecoveryAt = 0;
  let lastReason = "Local gateway did not report a completed prewarm state yet.";

  while (Date.now() - options.startedAt < LOCAL_BENCHMARK_PREWARM_TIMEOUT_MS) {
    if (options.runId) {
      assertBenchmarkRunActive(options.runId);
    }

    const health = await fetchLocalGatewayHealth(options.baseUrl);
    const elapsedMs = Date.now() - options.startedAt;

    if (health?.loaded_alias === options.targetId && !health.loading_alias) {
      setLocalBenchmarkPrewarmState(options.runId, null);
      return { ok: true, reason: `Loaded ${options.targetId}.` };
    }

    if (health) {
      const loadingAlias = health.loading_alias || null;
      const healthElapsed =
        typeof health.loading_elapsed_ms === "number" && Number.isFinite(health.loading_elapsed_ms)
          ? health.loading_elapsed_ms
          : elapsedMs;
      const loadingLabel = loadingAlias
        ? `Loading ${loadingAlias}`
        : "Gateway is idle after prewarm request; waiting for model load to begin.";
      const elapsedLabel = formatElapsedForStatus(healthElapsed);
      const message = [loadingLabel, elapsedLabel].filter(Boolean).join(" · ");
      setLocalBenchmarkPrewarmState(options.runId, {
        targetId: options.targetId,
        targetLabel: options.targetLabel,
        phase: loadingAlias ? "waiting-load" : "prewarming",
        loadingAlias,
        message,
        startedAt: new Date(options.startedAt).toISOString(),
        elapsedMs,
      });
      lastReason = health.loading_error || message || lastReason;

      const loadingTooLong =
        loadingAlias === options.targetId &&
        typeof health.loading_elapsed_ms === "number" &&
        health.loading_elapsed_ms > LOCAL_BENCHMARK_LOAD_STALL_RECOVERY_MS;
      const idleTooLong =
        !loadingAlias &&
        health.loaded_alias !== options.targetId &&
        elapsedMs > 15000;
      const shouldRecover = Boolean(health.loading_error) || loadingTooLong || idleTooLong;

      if (shouldRecover && Date.now() - lastRecoveryAt > 10000) {
        lastRecoveryAt = Date.now();
        const recoveryMessage =
          health.loading_error ||
          (loadingTooLong
            ? `Rechecking local gateway after extended load wait (${formatElapsedForStatus(health.loading_elapsed_ms)}).`
            : idleTooLong
              ? "Restarting local gateway because prewarm is idle and no model load began."
              : "Restarting local gateway after prewarm health degradation.");
        setLocalBenchmarkPrewarmState(options.runId, {
          targetId: options.targetId,
          targetLabel: options.targetLabel,
          phase: "restarting-gateway",
          loadingAlias,
          message: recoveryMessage,
          lastRecoveryAction: loadingTooLong
            ? `Attempting recovery after extended load wait (${formatElapsedForStatus(health.loading_elapsed_ms)}).`
            : idleTooLong
              ? "Attempting recovery because prewarm stayed idle and no model load began."
              : health.loading_error || "Attempting recovery after prewarm health degradation.",
          lastRecoveryAt: new Date().toISOString(),
          startedAt: new Date(options.startedAt).toISOString(),
          elapsedMs,
        });
        const ensured = await ensureLocalGatewayAvailableDetailed(options.baseUrl, {
          waitMs: LOCAL_BENCHMARK_GATEWAY_RECOVERY_WAIT_MS,
          autoPrewarmModel: LOCAL_BENCHMARK_AUTO_PREWARM_MODEL,
        });
        let recoveryAction = "Re-issued local benchmark prewarm request.";
        if (!ensured.ok) {
          await restartLocalBenchmarkGateway(options.baseUrl);
          recoveryAction =
            health.loading_error ||
            (loadingTooLong
              ? `Restarted local gateway after extended load wait (${formatElapsedForStatus(health.loading_elapsed_ms)}).`
              : idleTooLong
                ? "Restarted local gateway because prewarm stayed idle and no model load began."
                : "Restarted local gateway after prewarm health degradation.");
        } else if (loadingTooLong) {
          recoveryAction = `Re-issued prewarm after extended load wait (${formatElapsedForStatus(health.loading_elapsed_ms)}).`;
        } else if (idleTooLong) {
          recoveryAction = "Re-issued prewarm because gateway stayed idle and no model load began.";
        } else if (health.loading_error) {
          recoveryAction = health.loading_error;
        }
        setLocalBenchmarkPrewarmState(options.runId, {
          targetId: options.targetId,
          targetLabel: options.targetLabel,
          phase: ensured.ok ? (loadingAlias ? "waiting-load" : "prewarming") : "restarting-gateway",
          loadingAlias,
          message: ensured.ok
            ? message
            : recoveryMessage,
          lastRecoveryAction: recoveryAction,
          lastRecoveryAt: new Date().toISOString(),
          startedAt: new Date(options.startedAt).toISOString(),
          elapsedMs,
        });
        if (ensured.ok) {
          const kick = await requestLocalBenchmarkPrewarm({
            baseUrl: options.baseUrl,
            model: options.model,
            runId: options.runId,
          });
          if (!kick.ok && kick.status === 409 && !loadingAlias && health.loaded_alias !== options.targetId) {
            await restartLocalBenchmarkGateway(options.baseUrl);
            setLocalBenchmarkPrewarmState(options.runId, {
              targetId: options.targetId,
              targetLabel: options.targetLabel,
              phase: "restarting-gateway",
              loadingAlias: null,
              message: "Restarting local gateway after inconsistent still-loading conflict.",
              lastRecoveryAction: "Restarted local gateway because prewarm returned still-loading while the gateway reported no active load.",
              lastRecoveryAt: new Date().toISOString(),
              startedAt: new Date(options.startedAt).toISOString(),
              elapsedMs: Date.now() - options.startedAt,
            });
          }
        } else {
          kickLocalBenchmarkPrewarm({
            baseUrl: options.baseUrl,
            model: options.model,
            runId: options.runId,
          });
        }
      }
    } else {
      setLocalBenchmarkPrewarmState(options.runId, {
        targetId: options.targetId,
        targetLabel: options.targetLabel,
        phase: "waiting-gateway",
        loadingAlias: null,
        message: "Waiting for local gateway to come back online.",
        startedAt: new Date(options.startedAt).toISOString(),
        elapsedMs,
      });
      lastReason = "Local gateway health probe failed during prewarm.";

      if (Date.now() - lastRecoveryAt > 10000) {
        lastRecoveryAt = Date.now();
        setLocalBenchmarkPrewarmState(options.runId, {
          targetId: options.targetId,
          targetLabel: options.targetLabel,
          phase: "restarting-gateway",
          loadingAlias: null,
          message: "Restarting local gateway after health probe failure.",
          lastRecoveryAction: "Attempting recovery after local gateway health probe failure.",
          startedAt: new Date(options.startedAt).toISOString(),
          elapsedMs,
        });
        const ensured = await ensureLocalGatewayAvailableDetailed(options.baseUrl, {
          waitMs: LOCAL_BENCHMARK_GATEWAY_RECOVERY_WAIT_MS,
          autoPrewarmModel: LOCAL_BENCHMARK_AUTO_PREWARM_MODEL,
        });
        let recoveryAction = "Re-issued local benchmark prewarm request after health probe failure.";
        if (!ensured.ok) {
          await restartLocalBenchmarkGateway(options.baseUrl);
          recoveryAction = "Restarted local gateway after health probe failure.";
        }
        setLocalBenchmarkPrewarmState(options.runId, {
          targetId: options.targetId,
          targetLabel: options.targetLabel,
          phase: ensured.ok ? "prewarming" : "restarting-gateway",
          loadingAlias: null,
          message: ensured.ok
            ? "Retrying local benchmark prewarm after health probe failure."
            : "Restarting local gateway after health probe failure.",
          lastRecoveryAction: recoveryAction,
          lastRecoveryAt: new Date().toISOString(),
          startedAt: new Date(options.startedAt).toISOString(),
          elapsedMs,
        });
        if (ensured.ok) {
          const kick = await requestLocalBenchmarkPrewarm({
            baseUrl: options.baseUrl,
            model: options.model,
            runId: options.runId,
          });
          if (!kick.ok && kick.status === 409) {
            await restartLocalBenchmarkGateway(options.baseUrl);
            setLocalBenchmarkPrewarmState(options.runId, {
              targetId: options.targetId,
              targetLabel: options.targetLabel,
              phase: "restarting-gateway",
              loadingAlias: null,
              message: "Restarting local gateway after conflicting prewarm response.",
              lastRecoveryAction: "Restarted local gateway because the prewarm retry still reported an inconsistent still-loading state.",
              lastRecoveryAt: new Date().toISOString(),
              startedAt: new Date(options.startedAt).toISOString(),
              elapsedMs: Date.now() - options.startedAt,
            });
          }
        } else {
          kickLocalBenchmarkPrewarm({
            baseUrl: options.baseUrl,
            model: options.model,
            runId: options.runId,
          });
        }
      }
    }

    await sleep(LOCAL_BENCHMARK_PREWARM_POLL_MS);
  }

  return {
    ok: false,
    reason: `Timed out while waiting for ${options.targetId} to finish loading. ${lastReason}`,
  };
}

export async function prewarmTarget(targetId: string, runId?: string) {
  const target = resolveTargetWithMode(targetId, "standard");
  const errors: string[] = [];
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (runId) {
      assertBenchmarkRunActive(runId);
    }
    setLocalBenchmarkPrewarmState(runId, {
      targetId,
      targetLabel: target.label,
      phase: "ensuring-gateway",
      message: `Ensuring local gateway before prewarming ${target.label}. Attempt ${attempt}/3.`,
      loadingAlias: null,
      startedAt: startedAtIso,
      elapsedMs: Date.now() - startedAt,
    });
    const ensureResult = await ensureLocalBenchmarkGateway(target.resolvedBaseUrl, {
      runId,
      targetId,
      targetLabel: target.label,
      startedAt,
    });
    if (!ensureResult.ok) {
      errors.push(`attempt ${attempt}: ${ensureResult.reason}`);
    } else {
      try {
        setLocalBenchmarkPrewarmState(runId, {
          targetId,
          targetLabel: target.label,
          phase: "prewarming",
          message: `Requesting prewarm for ${target.label}. Attempt ${attempt}/3.`,
          loadingAlias: null,
          startedAt: startedAtIso,
          elapsedMs: Date.now() - startedAt,
        });
        kickLocalBenchmarkPrewarm({
          baseUrl: target.resolvedBaseUrl,
          model: target.resolvedModel,
          runId,
        });
        const waited = await waitForLocalBenchmarkPrewarm({
          baseUrl: target.resolvedBaseUrl,
          model: target.resolvedModel,
          targetId,
          targetLabel: target.label,
          runId,
          startedAt,
        });
        if (waited.ok) {
          setLocalBenchmarkPrewarmState(runId, null);
          return;
        }
        errors.push(`attempt ${attempt} wait: ${waited.reason}`);
      } catch (error) {
        errors.push(
          `attempt ${attempt}: ${error instanceof Error ? error.message : "Unknown prewarm error."}`,
        );
        const waited = await waitForLocalBenchmarkPrewarm({
          baseUrl: target.resolvedBaseUrl,
          model: target.resolvedModel,
          targetId,
          targetLabel: target.label,
          runId,
          startedAt,
        });
        if (waited.ok) {
          setLocalBenchmarkPrewarmState(runId, null);
          return;
        }
        errors.push(`attempt ${attempt} wait: ${waited.reason}`);
      }
    }

    if (attempt < 3) {
      setLocalBenchmarkPrewarmState(runId, {
        targetId,
        targetLabel: target.label,
        phase: "restarting-gateway",
        message: `Restarting local gateway before retrying ${target.label}.`,
        loadingAlias: null,
        startedAt: startedAtIso,
        elapsedMs: Date.now() - startedAt,
      });
      await restartLocalBenchmarkGateway(target.resolvedBaseUrl);
      await sleep(400);
    }
  }

  setLocalBenchmarkPrewarmState(runId, null);
  throw new Error(`Prewarm failed for ${targetId}. ${errors.join(" | ")}`);
}
