export const OLLAMA_RUNTIME_BRIDGE_SCHEMA_VERSION = "runtime.ollama-bridge.v1" as const;

type OllamaModel = {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: Record<string, unknown>;
};

function baseUrl() {
  const value = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("OLLAMA_BASE_URL must use http or https.");
  }
  return parsed.toString().replace(/\/$/, "");
}

export async function requestOllama<T>(pathname: string, init?: RequestInit, timeoutMs = 5_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl()}${pathname}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || `Ollama returned HTTP ${response.status}.`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeOllamaError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ollama request failed.";
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "ollama_timeout", message: "Ollama did not respond before the timeout." };
  }
  if (/fetch failed|ECONNREFUSED|connect/i.test(message)) {
    return { code: "ollama_unavailable", message: "Ollama is not reachable at the configured base URL." };
  }
  if (/not found/i.test(message)) return { code: "ollama_model_not_found", message };
  return { code: "ollama_request_failed", message };
}

export async function readOllamaHealth() {
  const startedAt = Date.now();
  try {
    const version = await requestOllama<{ version?: string }>("/api/version", undefined, 2_500);
    return {
      ok: true as const,
      schemaVersion: OLLAMA_RUNTIME_BRIDGE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      available: true,
      baseUrl: baseUrl(),
      version: version.version || "unknown",
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      ok: true as const,
      schemaVersion: OLLAMA_RUNTIME_BRIDGE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      available: false,
      baseUrl: baseUrl(),
      version: null,
      latencyMs: Date.now() - startedAt,
      error: normalizeOllamaError(error),
    };
  }
}

export async function discoverOllamaModels() {
  const health = await readOllamaHealth();
  if (!health.available) return { ...health, models: [] as OllamaModel[] };
  try {
    const payload = await requestOllama<{ models?: OllamaModel[] }>("/api/tags");
    return { ...health, models: Array.isArray(payload.models) ? payload.models : [] };
  } catch (error) {
    return { ...health, available: false, models: [] as OllamaModel[], error: normalizeOllamaError(error) };
  }
}

export async function runOllamaRuntimeAction(input: {
  action: "prewarm" | "unload";
  model?: string;
  keepAlive?: string;
}) {
  const model = input.model?.trim();
  if (!model) throw new Error("model is required.");
  try {
    const result = await requestOllama<Record<string, unknown>>(
      "/api/generate",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          prompt: "",
          stream: false,
          keep_alive: input.action === "unload" ? 0 : input.keepAlive || "10m",
        }),
      },
      input.action === "unload" ? 10_000 : 120_000,
    );
    return {
      ok: true as const,
      schemaVersion: OLLAMA_RUNTIME_BRIDGE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      action: input.action,
      model,
      baseUrl: baseUrl(),
      result,
    };
  } catch (error) {
    const normalized = normalizeOllamaError(error);
    return {
      ok: false as const,
      schemaVersion: OLLAMA_RUNTIME_BRIDGE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      action: input.action,
      model,
      baseUrl: baseUrl(),
      error: normalized,
    };
  }
}
