import { getBenchmarkRunSignal } from "@/lib/agent/benchmark-run-control";
import {
  getRemoteBenchmarkProviderKind,
  getRemoteBenchmarkRetryDelayMs,
  resolveRemoteBenchmarkPolicy,
} from "@/lib/agent/benchmark-remote-policy";
import { calculateTokenThroughputTps } from "@/lib/agent/metrics";
import {
  buildOpenAICompatibleRequestShape,
  buildProviderOutputContract,
  resolveSuggestedMaxTokens,
} from "@/lib/agent/providers";
import { assertBenchmarkRunActive } from "@/features/benchmark/run-control";
import {
  fetchWithTimeout,
  isRetryableRemoteBenchmarkFailure,
  readNdjsonStream,
  sleep,
} from "@/features/benchmark/run-network";
import type {
  AgentBenchmarkSample,
  AgentProviderProfile,
  AgentThinkingMode,
  ResolvedTarget,
} from "@/lib/agent/types";

const REMOTE_BENCHMARK_MAX_ATTEMPTS = 6;

type RemoteBenchmarkSampleRunnerOptions = {
  workloadId?: string;
  thinkingMode?: AgentThinkingMode;
  runId?: string;
};

async function readRemoteBenchmarkStream(
  response: Response,
  input: {
    firstTokenDeadlineAt: number;
    streamIdleTimeoutMs: number;
    getFirstTokenLatency: () => number | null;
    setFirstTokenTimeout: () => never;
    setStreamIdleTimeout: () => never;
    onPayload: (payload: Record<string, unknown>) => void | Promise<void>;
  },
) {
  await readNdjsonStream(
    new Response(
      new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();
          let buffer = "";

          while (true) {
            if (input.getFirstTokenLatency() === null && Date.now() >= input.firstTokenDeadlineAt) {
              void reader.cancel().catch(() => undefined);
              input.setFirstTokenTimeout();
            }
            const readTimeoutMs =
              input.getFirstTokenLatency() === null
                ? Math.max(1, Math.min(input.streamIdleTimeoutMs, input.firstTokenDeadlineAt - Date.now()))
                : input.streamIdleTimeoutMs;
            if (readTimeoutMs <= 0) {
              void reader.cancel().catch(() => undefined);
              input.setFirstTokenTimeout();
            }
            const { done, value } = await new Promise<ReadableStreamReadResult<Uint8Array>>(
              (resolve, reject) => {
                const timer = setTimeout(() => {
                  void reader.cancel().catch(() => undefined);
                  try {
                    if (input.getFirstTokenLatency() === null) {
                      input.setFirstTokenTimeout();
                    }
                    input.setStreamIdleTimeout();
                  } catch (error) {
                    reject(error);
                  }
                }, readTimeoutMs);
                reader
                  .read()
                  .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                  })
                  .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                  });
              },
            );
            if (done) break;
            if (input.getFirstTokenLatency() === null && Date.now() >= input.firstTokenDeadlineAt) {
              void reader.cancel().catch(() => undefined);
              input.setFirstTokenTimeout();
            }
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";
            for (const event of events) {
              const lines = event
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.startsWith("data:"));
              for (const line of lines) {
                const data = line.slice(5).trim();
                if (!data || data === "[DONE]") continue;
                controller.enqueue(encoder.encode(`${data}\n`));
              }
            }
            if (input.getFirstTokenLatency() === null && Date.now() >= input.firstTokenDeadlineAt) {
              void reader.cancel().catch(() => undefined);
              input.setFirstTokenTimeout();
            }
          }
          controller.close();
        },
      }),
    ),
    input.onPayload,
  );
}

function buildRemoteFailureSample(input: {
  startedAt: number;
  warning: string;
  outputPreview?: string;
}): AgentBenchmarkSample {
  return {
    run: 0,
    firstTokenLatencyMs: null,
    latencyMs: Date.now() - input.startedAt,
    completionTokens: 0,
    totalTokens: 0,
    tokenThroughputTps: null,
    outputPreview: input.outputPreview,
    ok: false,
    warning: input.warning,
  };
}

export async function runRemoteBenchmarkSample(
  target: ResolvedTarget,
  _contextWindow: number,
  maxTokens: number,
  prompt: string,
  providerProfile: AgentProviderProfile,
  options?: RemoteBenchmarkSampleRunnerOptions,
): Promise<AgentBenchmarkSample> {
  const startedAt = Date.now();
  let attempt = 1;
  let lastWarning = "Unknown remote benchmark error.";
  const thinkingMode = options?.thinkingMode || "standard";
  const workloadId = options?.workloadId || "custom-prompt";
  const runSignal = options?.runId ? getBenchmarkRunSignal(options.runId) : undefined;
  const effectiveMaxTokens = resolveSuggestedMaxTokens({
    target,
    enableTools: false,
    input: prompt,
    providerProfile,
    thinkingMode,
    requestedMaxTokens: maxTokens,
  });
  const remotePolicy = resolveRemoteBenchmarkPolicy({
    workloadId,
    providerProfile,
    thinkingMode,
    providerKind: getRemoteBenchmarkProviderKind(target),
  });
  const retryWindowStartedAt = Date.now();

  while (attempt <= REMOTE_BENCHMARK_MAX_ATTEMPTS) {
    const attemptStartedAt = Date.now();
    const firstTokenDeadlineAt = attemptStartedAt + remotePolicy.firstTokenTimeoutMs;
    let attemptFirstTokenLatencyMs: number | null = null;
    let attemptCompletionTokens = 0;
    let attemptTotalTokens = 0;
    let attemptOutputBuffer = "";

    try {
      const requestShape = buildOpenAICompatibleRequestShape({
        target,
        input: prompt,
        enableTools: false,
        thinkingMode,
      });
      const benchmarkSystemPrompt = buildProviderOutputContract(
        "Reply directly and keep the answer concise.",
        {
          target,
          input: prompt,
          enableTools: false,
          thinkingMode,
        },
      );
      if (options?.runId) {
        assertBenchmarkRunActive(options.runId);
      }
      const remainingFirstTokenBudgetMs = firstTokenDeadlineAt - Date.now();
      if (remainingFirstTokenBudgetMs <= 0) {
        throw new Error("Remote benchmark first token timeout.");
      }
      const initialFetchTimeoutMs = Math.min(remotePolicy.totalTimeoutMs, remainingFirstTokenBudgetMs);
      let response: Response;
      try {
        response = await fetchWithTimeout(
          `${target.resolvedBaseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(target.resolvedApiKey ? { Authorization: `Bearer ${target.resolvedApiKey}` } : {}),
            },
            body: JSON.stringify({
              model: requestShape.model,
              messages: [
                { role: "system", content: benchmarkSystemPrompt },
                { role: "user", content: prompt },
              ],
              max_tokens: effectiveMaxTokens,
              ...requestShape.bodyExtras,
              stream: true,
              stream_options: { include_usage: true },
            }),
          },
          initialFetchTimeoutMs,
          runSignal,
        );
      } catch (error) {
        if (attemptFirstTokenLatencyMs === null && Date.now() >= firstTokenDeadlineAt) {
          throw new Error("Remote benchmark first token timeout.");
        }
        throw error;
      }
      if (!response.ok) {
        const warning = await response.text();
        lastWarning = warning || `Remote benchmark request failed with HTTP ${response.status}.`;
        const retryDelayMs = getRemoteBenchmarkRetryDelayMs(lastWarning, attempt, workloadId);
        if (
          attempt < REMOTE_BENCHMARK_MAX_ATTEMPTS &&
          isRetryableRemoteBenchmarkFailure(lastWarning) &&
          Date.now() - retryWindowStartedAt + retryDelayMs < remotePolicy.retryBudgetMs
        ) {
          await sleep(retryDelayMs);
          attempt += 1;
          continue;
        }
        return buildRemoteFailureSample({ startedAt: attemptStartedAt, warning: lastWarning });
      }

      await readRemoteBenchmarkStream(response, {
        firstTokenDeadlineAt,
        streamIdleTimeoutMs: remotePolicy.streamIdleTimeoutMs,
        getFirstTokenLatency: () => attemptFirstTokenLatencyMs,
        setFirstTokenTimeout: () => {
          throw new Error("Remote benchmark first token timeout.");
        },
        setStreamIdleTimeout: () => {
          throw new Error("Remote benchmark stream idle timeout.");
        },
        onPayload: async (payload) => {
          const choices = Array.isArray(payload.choices)
            ? (payload.choices as Array<Record<string, unknown>>)
            : [];
          const delta = choices[0]?.delta as Record<string, unknown> | undefined;
          const content = typeof delta?.content === "string" ? delta.content : "";
          const reasoningContent =
            typeof delta?.reasoning_content === "string" ? delta.reasoning_content : "";
          if ((content || reasoningContent) && attemptFirstTokenLatencyMs === null) {
            attemptFirstTokenLatencyMs = Date.now() - attemptStartedAt;
          }
          if (content) {
            attemptOutputBuffer += content;
          }
          const usage = payload.usage as Record<string, unknown> | undefined;
          if (usage) {
            attemptCompletionTokens =
              typeof usage.completion_tokens === "number" ? usage.completion_tokens : attemptCompletionTokens;
            attemptTotalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : attemptTotalTokens;
          }
        },
      });
      if (attemptFirstTokenLatencyMs === null) {
        attemptFirstTokenLatencyMs = Date.now() - attemptStartedAt;
      }

      const latencyMs = Date.now() - attemptStartedAt;
      const tokenThroughputTps =
        calculateTokenThroughputTps(attemptCompletionTokens, latencyMs, attemptFirstTokenLatencyMs) ?? null;

      return {
        run: 0,
        firstTokenLatencyMs: attemptFirstTokenLatencyMs,
        latencyMs,
        completionTokens: attemptCompletionTokens,
        totalTokens: attemptTotalTokens,
        tokenThroughputTps,
        outputText: attemptOutputBuffer.trim().slice(0, 12000),
        outputPreview: attemptOutputBuffer.trim().slice(0, 400),
        ok: true,
      };
    } catch (error) {
      if (options?.runId) {
        assertBenchmarkRunActive(options.runId);
      }
      lastWarning = error instanceof Error ? error.message : "Unknown remote benchmark error.";
      const retryDelayMs = getRemoteBenchmarkRetryDelayMs(lastWarning, attempt, workloadId);
      if (
        attempt < REMOTE_BENCHMARK_MAX_ATTEMPTS &&
        isRetryableRemoteBenchmarkFailure(lastWarning) &&
        Date.now() - retryWindowStartedAt + retryDelayMs < remotePolicy.retryBudgetMs
      ) {
        await sleep(retryDelayMs);
        attempt += 1;
        continue;
      }
      return buildRemoteFailureSample({
        startedAt: attemptStartedAt,
        warning: lastWarning,
        outputPreview: attemptOutputBuffer.trim().slice(0, 400),
      });
    }
  }

  return buildRemoteFailureSample({
    startedAt,
    warning: lastWarning,
    outputPreview: "",
  });
}
