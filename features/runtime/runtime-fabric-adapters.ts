import {
  readRuntimeAdapterSpecs,
  resolveRuntimeFabricOperation,
  type RuntimeBackend,
  type RuntimeFabricOperation,
} from "@/features/runtime/runtime-fabric-contract";
import {
  discoverOllamaModels,
  readOllamaHealth,
  runOllamaRuntimeAction,
} from "@/features/runtime/ollama-adapter";

export const RUNTIME_FABRIC_ADAPTER_SCHEMA_VERSION =
  "runtime.fabric-adapter.v1" as const;

export type NormalizedRuntimeError = {
  code:
    | "endpoint_not_configured"
    | "backend_unavailable"
    | "operation_unsupported"
    | "model_not_found"
    | "request_timeout"
    | "request_failed";
  message: string;
  retryable: boolean;
};

type OpenAiModelsPayload = {
  data?: Array<{ id?: string }>;
  models?: Array<{ name?: string; model?: string }>;
  error?: { message?: string } | string;
};

type ChatPayload = {
  id?: string;
  model?: string;
  system_fingerprint?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning?: string;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string } | string;
};

function adapterConfig(backend: RuntimeBackend) {
  const spec = readRuntimeAdapterSpecs().find(
    (candidate) => candidate.backend === backend,
  );
  if (!spec) throw new Error(`Unknown runtime backend: ${backend}`);
  const baseUrl =
    process.env[spec.endpointEnv]?.trim() || spec.defaultBaseUrl || null;
  return {
    ...spec,
    baseUrl: baseUrl?.replace(/\/+$/u, "") || null,
  };
}

function openAiBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function normalizeError(
  error: unknown,
  fallback = "Runtime request failed.",
): NormalizedRuntimeError {
  const message = error instanceof Error ? error.message : fallback;
  if (error instanceof Error && error.name === "TimeoutError") {
    return {
      code: "request_timeout",
      message: "Runtime did not respond before the timeout.",
      retryable: true,
    };
  }
  if (/not configured/iu.test(message)) {
    return {
      code: "endpoint_not_configured",
      message,
      retryable: false,
    };
  }
  if (/not found/iu.test(message)) {
    return { code: "model_not_found", message, retryable: false };
  }
  if (/fetch failed|ECONNREFUSED|connect/iu.test(message)) {
    return {
      code: "backend_unavailable",
      message,
      retryable: true,
    };
  }
  return { code: "request_failed", message, retryable: false };
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 10_000,
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    const candidate = payload as {
      error?: { message?: string } | string;
      detail?: string;
    };
    const message =
      candidate.detail ||
      (typeof candidate.error === "string"
        ? candidate.error
        : candidate.error?.message) ||
      `Runtime returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return { response, payload };
}

function modelIds(payload: OpenAiModelsPayload) {
  const ids = [
    ...(payload.data || []).map((entry) => entry.id),
    ...(payload.models || []).map((entry) => entry.name || entry.model),
  ].filter((entry): entry is string => Boolean(entry));
  return [...new Set(ids)];
}

export async function probeRuntimeAdapter(backend: RuntimeBackend) {
  const config = adapterConfig(backend);
  const startedAt = Date.now();
  if (!config.baseUrl) {
    return {
      ok: false as const,
      backend,
      available: false,
      configured: false,
      baseUrl: null,
      latencyMs: 0,
      version: null,
      models: [] as string[],
      error: normalizeError(
        new Error(`${config.endpointEnv} is not configured.`),
      ),
    };
  }
  try {
    if (backend === "ollama") {
      const [health, discovery] = await Promise.all([
        readOllamaHealth(),
        discoverOllamaModels(),
      ]);
      if (!health.available) throw new Error(health.error?.message);
      return {
        ok: true as const,
        backend,
        available: true,
        configured: true,
        baseUrl: config.baseUrl,
        latencyMs: Date.now() - startedAt,
        version: health.version,
        models: discovery.models
          .map((model) => model.name || model.model)
          .filter((model): model is string => Boolean(model)),
        error: null,
      };
    }
    if (backend === "mlx" || backend === "llama.cpp") {
      await requestJson<{ status?: string }>(
        `${config.baseUrl}/health`,
        undefined,
        5_000,
      );
    }
    const { payload } = await requestJson<OpenAiModelsPayload>(
      `${openAiBaseUrl(config.baseUrl)}/models`,
      undefined,
      8_000,
    );
    return {
      ok: true as const,
      backend,
      available: true,
      configured: true,
      baseUrl: config.baseUrl,
      latencyMs: Date.now() - startedAt,
      version: null,
      models: modelIds(payload),
      error: null,
    };
  } catch (error) {
    return {
      ok: false as const,
      backend,
      available: false,
      configured: true,
      baseUrl: config.baseUrl,
      latencyMs: Date.now() - startedAt,
      version: null,
      models: [] as string[],
      error: normalizeError(error),
    };
  }
}

export async function runRuntimeFabricChat(input: {
  backend: RuntimeBackend;
  model: string;
  marker: string;
}) {
  const config = adapterConfig(input.backend);
  const operation = resolveRuntimeFabricOperation(input.backend, "chat");
  if (!operation.ok) {
    return {
      ok: false as const,
      backend: input.backend,
      operation: "chat" as const,
      latencyMs: 0,
      content: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      error: {
        code: "operation_unsupported" as const,
        message: operation.error.message,
        retryable: false,
      },
    };
  }
  if (!config.baseUrl) {
    return {
      ok: false as const,
      backend: input.backend,
      operation: "chat" as const,
      latencyMs: 0,
      content: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      error: normalizeError(
        new Error(`${config.endpointEnv} is not configured.`),
      ),
    };
  }
  const startedAt = Date.now();
  try {
    const { payload } = await requestJson<ChatPayload>(
      `${openAiBaseUrl(config.baseUrl)}/chat/completions`,
      {
        method: "POST",
        body: JSON.stringify({
          model: input.model,
          messages: [
            {
              role: "user",
              content: `/no_think\nReply with exactly ${input.marker}.`,
            },
          ],
          temperature: 0,
          max_tokens: 64,
          stream: false,
        }),
      },
      180_000,
    );
    const message = payload.choices?.[0]?.message;
    const content = (
      message?.content ||
      message?.reasoning_content ||
      message?.reasoning ||
      ""
    ).trim();
    const usage = {
      promptTokens: payload.usage?.prompt_tokens || 0,
      completionTokens: payload.usage?.completion_tokens || 0,
      totalTokens:
        payload.usage?.total_tokens ||
        (payload.usage?.prompt_tokens || 0) +
          (payload.usage?.completion_tokens || 0),
    };
    return {
      ok: content.includes(input.marker),
      backend: input.backend,
      operation: "chat" as const,
      latencyMs: Date.now() - startedAt,
      model: payload.model || input.model,
      content,
      finishReason: payload.choices?.[0]?.finish_reason || null,
      fingerprint: payload.system_fingerprint || null,
      usage,
      error: content.includes(input.marker)
        ? null
        : ({
            code: "request_failed",
            message: `Expected marker ${input.marker} was not returned.`,
            retryable: false,
          } satisfies NormalizedRuntimeError),
    };
  } catch (error) {
    return {
      ok: false as const,
      backend: input.backend,
      operation: "chat" as const,
      latencyMs: Date.now() - startedAt,
      content: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      error: normalizeError(error),
    };
  }
}

export async function runRuntimeFabricStream(input: {
  backend: RuntimeBackend;
  model: string;
  marker: string;
}) {
  const config = adapterConfig(input.backend);
  const operation = resolveRuntimeFabricOperation(input.backend, "stream");
  if (!operation.ok || !config.baseUrl) {
    return {
      ok: false as const,
      backend: input.backend,
      operation: "stream" as const,
      latencyMs: 0,
      chunks: 0,
      done: false,
      content: "",
      error: operation.ok
        ? normalizeError(
            new Error(`${config.endpointEnv} is not configured.`),
          )
        : ({
            code: "operation_unsupported",
            message: operation.error.message,
            retryable: false,
          } satisfies NormalizedRuntimeError),
    };
  }
  const startedAt = Date.now();
  try {
    const response = await fetch(
      `${openAiBaseUrl(config.baseUrl)}/chat/completions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: input.model,
          messages: [
            {
              role: "user",
              content: `/no_think\nReply with exactly ${input.marker}.`,
            },
          ],
          temperature: 0,
          max_tokens: 64,
          stream: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(180_000),
      },
    );
    if (!response.ok || !response.body) {
      throw new Error(`Runtime returned HTTP ${response.status}.`);
    }
    const text = await response.text();
    const events = text
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data: "));
    let done = false;
    let content = "";
    let chunks = 0;
    for (const event of events) {
      const data = event.slice(6).trim();
      if (data === "[DONE]") {
        done = true;
        continue;
      }
      const payload = JSON.parse(data) as {
        choices?: Array<{
          delta?: {
            content?: string;
            reasoning?: string;
            reasoning_content?: string;
          };
        }>;
      };
      const delta = payload.choices?.[0]?.delta;
      content +=
        delta?.content ||
        delta?.reasoning_content ||
        delta?.reasoning ||
        "";
      chunks += 1;
    }
    const ok = done && chunks > 0 && content.includes(input.marker);
    return {
      ok,
      backend: input.backend,
      operation: "stream" as const,
      latencyMs: Date.now() - startedAt,
      chunks,
      done,
      content: content.trim(),
      error: ok
        ? null
        : ({
            code: "request_failed",
            message: "Streaming response did not include the marker and [DONE].",
            retryable: false,
          } satisfies NormalizedRuntimeError),
    };
  } catch (error) {
    return {
      ok: false as const,
      backend: input.backend,
      operation: "stream" as const,
      latencyMs: Date.now() - startedAt,
      chunks: 0,
      done: false,
      content: "",
      error: normalizeError(error),
    };
  }
}

export async function executeRuntimeFabricOperation(input: {
  backend: RuntimeBackend;
  operation: RuntimeFabricOperation;
  model?: string;
}) {
  const resolution = resolveRuntimeFabricOperation(
    input.backend,
    input.operation,
  );
  if (!resolution.ok) {
    return {
      ok: false as const,
      backend: input.backend,
      operation: input.operation,
      error: {
        code: "operation_unsupported" as const,
        message: resolution.error.message,
        retryable: false,
      },
    };
  }
  if (input.operation === "health" || input.operation === "discover") {
    const probe = await probeRuntimeAdapter(input.backend);
    return {
      ...probe,
      operation: input.operation,
    };
  }
  if (input.operation === "chat") {
    if (!input.model) {
      return {
        ok: false as const,
        backend: input.backend,
        operation: input.operation,
        error: {
          code: "model_not_found" as const,
          message: "model is required.",
          retryable: false,
        },
      };
    }
    return runRuntimeFabricChat({
      backend: input.backend,
      model: input.model,
      marker: "RUNTIME_FABRIC_OK",
    });
  }
  if (input.operation === "stream") {
    if (!input.model) {
      return {
        ok: false as const,
        backend: input.backend,
        operation: input.operation,
        error: {
          code: "model_not_found" as const,
          message: "model is required.",
          retryable: false,
        },
      };
    }
    return runRuntimeFabricStream({
      backend: input.backend,
      model: input.model,
      marker: "RUNTIME_FABRIC_STREAM_OK",
    });
  }
  if (!input.model) {
    return {
      ok: false as const,
      backend: input.backend,
      operation: input.operation,
      error: {
        code: "model_not_found" as const,
        message: "model is required.",
        retryable: false,
      },
    };
  }
  try {
    if (input.backend === "ollama") {
      const result = await runOllamaRuntimeAction({
        action: input.operation === "unload" ? "unload" : "prewarm",
        model: input.model,
        keepAlive: "10m",
      });
      return result.ok
        ? {
            ok: true as const,
            backend: input.backend,
            operation: input.operation,
            model: input.model,
          }
        : {
            ok: false as const,
            backend: input.backend,
            operation: input.operation,
            error: normalizeError(new Error(result.error.message)),
          };
    }
    if (input.backend === "mlx") {
      const config = adapterConfig(input.backend);
      if (!config.baseUrl) throw new Error(`${config.endpointEnv} is not configured.`);
      const path =
        input.operation === "unload"
          ? "/v1/models/release"
          : "/v1/models/prewarm";
      await requestJson(
        `${config.baseUrl}${path}`,
        {
          method: "POST",
          body: JSON.stringify({ model: input.model }),
        },
        180_000,
      );
      return {
        ok: true as const,
        backend: input.backend,
        operation: input.operation,
        model: input.model,
      };
    }
    return {
      ok: false as const,
      backend: input.backend,
      operation: input.operation,
      error: {
        code: "operation_unsupported" as const,
        message: `${input.operation} is process-owned for ${input.backend}.`,
        retryable: false,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      backend: input.backend,
      operation: input.operation,
      error: normalizeError(error),
    };
  }
}
