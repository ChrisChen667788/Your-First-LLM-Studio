import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

import type { BenchmarkEvaluationResult } from "@/lib/agent/benchmark-evaluation";

export const MATH_VERIFY_EVALUATOR_ID = "huggingface-math-verify" as const;
export const MATH_VERIFY_VERSION = "0.9.0" as const;
export const MATH500_EVALUATOR_CONFIG_ID = "math-500-v1" as const;
export const MATH_VERIFY_SOURCE_REVISION =
  "ba3d3aaff23b3f4cac7a14672b4f6e293d97c98b" as const;

const WORKER_SCRIPT = path.join(process.cwd(), "scripts", "math_verify_worker.py");
const DEFAULT_PYTHON = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "local-agent-lab",
  "evaluators",
  `math-verify-${MATH_VERIFY_VERSION}`,
  "bin",
  "python",
);
const REQUEST_TIMEOUT_MS = 30_000;

type WorkerResponse = {
  requestId: string;
  ok: boolean;
  score?: number;
  passed?: boolean;
  evaluatorId?: string;
  evaluatorVersion?: string;
  configId?: string;
  extractedGold?: string[];
  extractedPrediction?: string[];
  error?: string;
};

type PendingRequest = {
  resolve: (value: WorkerResponse) => void;
  timer: ReturnType<typeof setTimeout>;
};

type MathVerifyWorkerState = {
  child: ChildProcessWithoutNullStreams;
  pending: Map<string, PendingRequest>;
  configId: typeof MATH500_EVALUATOR_CONFIG_ID;
};

export type MathVerifyRuntimeHealth = {
  available: boolean;
  python: string;
  evaluatorId: typeof MATH_VERIFY_EVALUATOR_ID;
  evaluatorVersion: typeof MATH_VERIFY_VERSION;
  configId: typeof MATH500_EVALUATOR_CONFIG_ID;
  sourceRevision: typeof MATH_VERIFY_SOURCE_REVISION;
  error?: string;
  checkedAt: number;
};

const globalWorker = globalThis as typeof globalThis & {
  __firstLlmMathVerifyWorker?: MathVerifyWorkerState;
  __firstLlmMathVerifyHealth?: MathVerifyRuntimeHealth;
};

export function resolveMathVerifyPython() {
  return process.env.FIRST_LLM_MATH_VERIFY_PYTHON_BIN || DEFAULT_PYTHON;
}

export function inspectMathVerifyRuntime(): MathVerifyRuntimeHealth {
  const cached = globalWorker.__firstLlmMathVerifyHealth;
  if (cached && Date.now() - cached.checkedAt < 60_000) {
    return cached;
  }
  const python = resolveMathVerifyPython();
  if (!existsSync(python) || !existsSync(WORKER_SCRIPT)) {
    const result = {
      available: false,
      python,
      evaluatorId: MATH_VERIFY_EVALUATOR_ID,
      evaluatorVersion: MATH_VERIFY_VERSION,
      configId: MATH500_EVALUATOR_CONFIG_ID,
      sourceRevision: MATH_VERIFY_SOURCE_REVISION,
      error: "Pinned Math-Verify runtime is not installed.",
      checkedAt: Date.now(),
    };
    globalWorker.__firstLlmMathVerifyHealth = result;
    return result;
  }
  const probe = spawnSync(python, [WORKER_SCRIPT, "--health"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  try {
    const payload = JSON.parse(probe.stdout.trim()) as { ok?: boolean; error?: string };
    const result = {
      available: probe.status === 0 && payload.ok === true,
      python,
      evaluatorId: MATH_VERIFY_EVALUATOR_ID,
      evaluatorVersion: MATH_VERIFY_VERSION,
      configId: MATH500_EVALUATOR_CONFIG_ID,
      sourceRevision: MATH_VERIFY_SOURCE_REVISION,
      error:
        probe.status === 0 && payload.ok === true
          ? undefined
          : payload.error || probe.stderr.trim() || "Math-Verify health check failed.",
      checkedAt: Date.now(),
    };
    globalWorker.__firstLlmMathVerifyHealth = result;
    return result;
  } catch {
    const result = {
      available: false,
      python,
      evaluatorId: MATH_VERIFY_EVALUATOR_ID,
      evaluatorVersion: MATH_VERIFY_VERSION,
      configId: MATH500_EVALUATOR_CONFIG_ID,
      sourceRevision: MATH_VERIFY_SOURCE_REVISION,
      error: probe.stderr.trim() || "Math-Verify health check returned invalid JSON.",
      checkedAt: Date.now(),
    };
    globalWorker.__firstLlmMathVerifyHealth = result;
    return result;
  }
}

function rejectPending(state: MathVerifyWorkerState, message: string) {
  for (const [requestId, pending] of state.pending.entries()) {
    clearTimeout(pending.timer);
    pending.resolve({ requestId, ok: false, error: message });
  }
  state.pending.clear();
}

function createWorker() {
  const child = spawn(resolveMathVerifyPython(), [WORKER_SCRIPT], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const state: MathVerifyWorkerState = {
    child,
    pending: new Map(),
    configId: MATH500_EVALUATOR_CONFIG_ID,
  };
  const lines = readline.createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const payload = JSON.parse(line) as WorkerResponse;
      const pending = state.pending.get(payload.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      state.pending.delete(payload.requestId);
      pending.resolve(payload);
    } catch {
      // Invalid worker output is ignored; the request timeout reports the failure.
    }
  });
  child.once("exit", () => {
    rejectPending(state, "Math-Verify worker exited before scoring completed.");
    if (globalWorker.__firstLlmMathVerifyWorker === state) {
      globalWorker.__firstLlmMathVerifyWorker = undefined;
    }
  });
  child.once("error", (error) => {
    rejectPending(state, `Math-Verify worker failed: ${error.message}`);
  });
  child.stderr.resume();
  globalWorker.__firstLlmMathVerifyWorker = state;
  return state;
}

function getWorker() {
  const current = globalWorker.__firstLlmMathVerifyWorker;
  if (
    current &&
    current.configId === MATH500_EVALUATOR_CONFIG_ID &&
    current.child.exitCode === null &&
    !current.child.killed
  ) {
    return current;
  }
  current?.child.kill();
  return createWorker();
}

async function requestScore(gold: string, prediction: string) {
  const health = inspectMathVerifyRuntime();
  if (!health.available) {
    return { requestId: "", ok: false, error: health.error } satisfies WorkerResponse;
  }
  const state = getWorker();
  const requestId = randomUUID();
  return new Promise<WorkerResponse>((resolve) => {
    const timer = setTimeout(() => {
      state.pending.delete(requestId);
      resolve({ requestId, ok: false, error: "Math-Verify scoring timed out." });
    }, REQUEST_TIMEOUT_MS);
    state.pending.set(requestId, { resolve, timer });
    state.child.stdin.write(`${JSON.stringify({ requestId, gold, prediction })}\n`);
  });
}

export async function evaluateMathEquivalence(
  gold: string,
  prediction: string,
): Promise<BenchmarkEvaluationResult> {
  const response = await requestScore(gold, prediction);
  if (!response.ok) {
    return {
      score: null,
      passed: null,
      rationale: response.error || "Math-Verify evaluator is unavailable.",
      evaluation: {
        evaluatorId: MATH_VERIFY_EVALUATOR_ID,
        evaluatorVersion: MATH_VERIFY_VERSION,
        configId: MATH500_EVALUATOR_CONFIG_ID,
        status: "unavailable",
        rationale: response.error || "Math-Verify evaluator is unavailable.",
      },
    };
  }
  const rationale = response.passed
    ? "Hugging Face Math-Verify found the prediction mathematically equivalent to the gold answer."
    : "Hugging Face Math-Verify did not find mathematical equivalence.";
  return {
    score: response.score ?? 0,
    passed: response.passed ?? false,
    rationale,
    evaluation: {
      evaluatorId: response.evaluatorId || MATH_VERIFY_EVALUATOR_ID,
      evaluatorVersion: response.evaluatorVersion || MATH_VERIFY_VERSION,
      configId: response.configId || MATH500_EVALUATOR_CONFIG_ID,
      status: "scored",
      rationale,
      extractedGold: response.extractedGold,
      extractedPrediction: response.extractedPrediction,
    },
  };
}
