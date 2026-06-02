import { probeLocalGateway } from "@/lib/agent/local-gateway";
import { getBenchmarkRunSignal } from "@/lib/agent/benchmark-run-control";
import { calculateTokenThroughputTps } from "@/lib/agent/metrics";
import { resolveSuggestedMaxTokens } from "@/lib/agent/providers";
import {
  ensureLocalBenchmarkGateway,
  restartLocalBenchmarkGateway,
} from "@/features/benchmark/run-local-prewarm";
import {
  fetchWithTimeout,
  readNdjsonStream,
} from "@/features/benchmark/run-network";
import { assertBenchmarkRunActive } from "@/features/benchmark/run-control";
import type {
  AgentBenchmarkSample,
  AgentProviderProfile,
  AgentThinkingMode,
  ResolvedTarget,
} from "@/lib/agent/types";

const LOCAL_BENCHMARK_STREAM_TIMEOUT_MS = 300000;

type LocalBenchmarkSampleRunnerOptions = {
  ensureGateway?: boolean;
  thinkingMode?: AgentThinkingMode;
  runId?: string;
};

function buildLocalBenchmarkExtraBody(
  target: ResolvedTarget,
  thinkingMode: AgentThinkingMode = "standard",
) {
  if (target.execution !== "local") {
    return undefined;
  }
  if (target.id !== "local-qwen35-4b-4bit") {
    return undefined;
  }
  return {
    chat_template_kwargs: {
      enable_thinking: thinkingMode === "thinking",
    },
  };
}

function buildLocalBenchmarkRequest(input: {
  target: ResolvedTarget;
  prompt: string;
  maxTokens: number;
  contextWindow: number;
  thinkingMode: AgentThinkingMode;
}) {
  const localExtraBody = buildLocalBenchmarkExtraBody(input.target, input.thinkingMode);

  return {
    url: `${input.target.resolvedBaseUrl.replace(/\/v1$/, "")}/v1/chat/completions/stream`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.target.resolvedModel,
        messages: [
          { role: "system", content: "Reply directly and keep the answer concise." },
          { role: "user", content: input.prompt },
        ],
        max_tokens: input.maxTokens,
        context_window: input.contextWindow,
        ...(localExtraBody ? { extra_body: localExtraBody } : {}),
      }),
    } satisfies RequestInit,
  };
}

async function requestLocalBenchmarkStream(input: {
  target: ResolvedTarget;
  prompt: string;
  maxTokens: number;
  contextWindow: number;
  thinkingMode: AgentThinkingMode;
  runId?: string;
}) {
  const request = buildLocalBenchmarkRequest(input);
  const runSignal = input.runId ? getBenchmarkRunSignal(input.runId) : undefined;

  try {
    return await fetchWithTimeout(
      request.url,
      request.init,
      LOCAL_BENCHMARK_STREAM_TIMEOUT_MS,
      runSignal,
    );
  } catch {
    if (input.runId) {
      assertBenchmarkRunActive(input.runId);
    }

    const reachable = await probeLocalGateway(input.target.resolvedBaseUrl, 5000);
    if (!reachable) {
      const restarted = await restartLocalBenchmarkGateway(input.target.resolvedBaseUrl);
      if (!restarted) {
        throw new Error("Local gateway restart timed out before retrying benchmark.");
      }
    }

    return fetchWithTimeout(
      request.url,
      request.init,
      LOCAL_BENCHMARK_STREAM_TIMEOUT_MS,
      runSignal,
    );
  }
}

export async function runLocalBenchmarkSample(
  target: ResolvedTarget,
  contextWindow: number,
  maxTokens: number,
  prompt: string,
  providerProfile: AgentProviderProfile,
  options?: LocalBenchmarkSampleRunnerOptions,
): Promise<AgentBenchmarkSample> {
  const startedAt = Date.now();
  let firstTokenLatencyMs: number | null = null;
  let completionTokens = 0;
  let totalTokens = 0;
  let outputBuffer = "";
  const thinkingMode = options?.thinkingMode || "standard";
  const effectiveMaxTokens = resolveSuggestedMaxTokens({
    target,
    enableTools: false,
    input: prompt,
    providerProfile,
    thinkingMode,
    requestedMaxTokens: maxTokens,
  });

  try {
    const ensureResult =
      options?.ensureGateway === false
        ? { ok: true, reason: "Skipped per-sample ensure because the gateway was prewarmed." }
        : await ensureLocalBenchmarkGateway(target.resolvedBaseUrl);
    if (!ensureResult.ok) {
      return {
        run: 0,
        firstTokenLatencyMs: null,
        latencyMs: Date.now() - startedAt,
        completionTokens: 0,
        totalTokens: 0,
        tokenThroughputTps: null,
        ok: false,
        warning: ensureResult.reason,
      };
    }

    const response = await requestLocalBenchmarkStream({
      target,
      prompt,
      maxTokens: effectiveMaxTokens,
      contextWindow,
      thinkingMode,
      runId: options?.runId,
    });

    if (!response.ok) {
      return {
        run: 0,
        firstTokenLatencyMs: null,
        latencyMs: Date.now() - startedAt,
        completionTokens: 0,
        totalTokens: 0,
        tokenThroughputTps: null,
        ok: false,
        warning: await response.text(),
      };
    }

    await readNdjsonStream(response, async (payload) => {
      if (payload.type === "delta" && typeof payload.delta === "string" && payload.delta && firstTokenLatencyMs === null) {
        firstTokenLatencyMs = Date.now() - startedAt;
      }
      if (payload.type === "delta" && typeof payload.delta === "string") {
        outputBuffer += payload.delta;
      }
      if (payload.type === "done") {
        const usage = payload.usage as Record<string, unknown> | undefined;
        completionTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : 0;
        totalTokens = typeof usage?.total_tokens === "number" ? usage.total_tokens : 0;
        if (typeof payload.content === "string" && !outputBuffer.trim()) {
          outputBuffer = payload.content;
        }
        if (firstTokenLatencyMs === null) {
          firstTokenLatencyMs = Date.now() - startedAt;
        }
      }
    });

    const latencyMs = Date.now() - startedAt;
    const tokenThroughputTps =
      calculateTokenThroughputTps(completionTokens, latencyMs, firstTokenLatencyMs) ?? null;

    return {
      run: 0,
      firstTokenLatencyMs,
      latencyMs,
      completionTokens,
      totalTokens,
      tokenThroughputTps,
      outputText: outputBuffer.trim().slice(0, 12000),
      outputPreview: outputBuffer.trim().slice(0, 400),
      ok: true,
    };
  } catch (error) {
    if (options?.runId) {
      assertBenchmarkRunActive(options.runId);
    }
    return {
      run: 0,
      firstTokenLatencyMs: null,
      latencyMs: Date.now() - startedAt,
      completionTokens: 0,
      totalTokens: 0,
      tokenThroughputTps: null,
      outputPreview: "",
      ok: false,
      warning: error instanceof Error ? error.message : "Unknown benchmark error.",
    };
  }
}
