import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { runIdleUnloadDaemonTick } from "@/features/models/idle-unload-daemon";
import { rehearseServerAccessAttribution } from "@/features/models/server-access-control";
import {
  readServerInstanceRegistry,
  upsertServerInstance,
} from "@/features/models/server-instance-registry";
import { runServerLifecycleAction } from "@/features/models/server-lifecycle";
import { rehearseServerLogRetention } from "@/features/models/server-log-retention";
import { rehearseServerNetworkPolicy } from "@/features/models/server-network-policy";
import {
  appendServerRequestEntry,
  readServerRequestLedger,
} from "@/features/models/server-request-ledger";
import { rehearseServerSwitchController } from "@/features/models/server-switch-controller";
import {
  discoverOllamaModels,
  readOllamaHealth,
  requestOllama,
  runOllamaRuntimeAction,
} from "@/features/runtime/ollama-adapter";
import { runOpenAiCompatibleConformance } from "@/features/runtime/openai-compatible-conformance";

export const LOCAL_SERVER_ACCEPTANCE_SCHEMA_VERSION =
  "models.local-server-acceptance.v1" as const;

type SliceStatus = "pass" | "hold";
type AcceptanceSlice = {
  id: string;
  title: string;
  status: SliceStatus;
  evidence: string;
  metrics?: Record<string, number | string | boolean | null>;
};
type AcceptanceReceipt = {
  schemaVersion: typeof LOCAL_SERVER_ACCEPTANCE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  status: SliceStatus;
  runtime: {
    backend: "ollama";
    baseUrl: string;
    version: string | null;
    realProcess: boolean;
    realModel: boolean;
  };
  model: string;
  slices: AcceptanceSlice[];
  totals: {
    slices: number;
    passed: number;
    held: number;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    averageLatencyMs: number;
  };
  blockers: string[];
  evidenceDigest: string;
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const RECEIPT_FILE = path.join(DATA_DIR, "local-server-acceptance.json");
const SERVER_ID = "local-ollama";

function readReceipts(): AcceptanceReceipt[] {
  if (!existsSync(RECEIPT_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as {
      receipts?: AcceptanceReceipt[];
    };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function persist(receipt: AcceptanceReceipt) {
  mkdirSync(path.dirname(RECEIPT_FILE), { recursive: true });
  writeFileSync(
    RECEIPT_FILE,
    `${JSON.stringify(
      {
        schemaVersion: LOCAL_SERVER_ACCEPTANCE_SCHEMA_VERSION,
        receipts: [receipt, ...readReceipts()].slice(0, 50),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function pushSlice(
  slices: AcceptanceSlice[],
  input: Omit<AcceptanceSlice, "status"> & { passed: boolean },
) {
  slices.push({
    id: input.id,
    title: input.title,
    status: input.passed ? "pass" : "hold",
    evidence: input.evidence,
    metrics: input.metrics,
  });
}

async function readLoadedModels() {
  return requestOllama<{
    models?: Array<{
      name?: string;
      model?: string;
      size?: number;
      size_vram?: number;
      expires_at?: string;
    }>;
  }>("/api/ps", undefined, 10_000);
}

async function waitForResidency(model: string, expected: boolean) {
  let resident = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const loaded = await readLoadedModels();
    resident = Boolean(
      loaded.models?.some(
        (candidate) =>
          candidate.name === model || candidate.model === model,
      ),
    );
    if (resident === expected) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return resident === expected;
}

async function runStreamingChat(baseUrl: string, model: string) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: "Reply with exactly STREAM_OK.",
        },
      ],
      temperature: 0,
      max_tokens: 32,
      reasoning_effort: "none",
      stream: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.text();
  const dataLines = body
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data:"));
  const completion = dataLines
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as {
          choices?: Array<{
            delta?: { content?: string; reasoning?: string };
          }>;
        };
        const delta = parsed.choices?.[0]?.delta;
        return `${delta?.reasoning || ""}${delta?.content || ""}`;
      } catch {
        return "";
      }
    })
    .join("");
  return {
    ok: response.ok && dataLines.length > 1 && body.includes("[DONE]") && completion.length > 0,
    statusCode: response.status,
    latencyMs: Date.now() - startedAt,
    chunks: dataLines.length,
    completion,
  };
}

async function runConcurrentChats(baseUrl: string, model: string) {
  const startedAt = Date.now();
  const requests = Array.from({ length: 2 }, (_, index) =>
    fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `Reply with exactly PARALLEL_${index + 1}.`,
          },
        ],
        temperature: 0,
        max_tokens: 32,
        reasoning_effort: "none",
        stream: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    }).then(async (response) => {
      const payload = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string; reasoning?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };
      return {
        ok:
          response.ok &&
          Boolean(
            payload.choices?.[0]?.message?.content?.trim() ||
              payload.choices?.[0]?.message?.reasoning?.trim(),
          ) &&
          Boolean(payload.choices?.[0]?.finish_reason),
        statusCode: response.status,
        promptTokens: payload.usage?.prompt_tokens || 0,
        completionTokens: payload.usage?.completion_tokens || 0,
      };
    }),
  );
  const results = await Promise.all(requests);
  const latencyMs = Date.now() - startedAt;
  results.forEach((result) => {
    appendServerRequestEntry({
      serverId: SERVER_ID,
      modelId: model,
      operation: "chat",
      status: result.ok ? "success" : "error",
      statusCode: result.statusCode,
      latencyMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      profileId: "v1.2.0-concurrency",
      errorCode: result.ok ? undefined : "parallel_request_failed",
    });
  });
  return {
    ok: results.every((result) => result.ok),
    completed: results.filter((result) => result.ok).length,
    latencyMs,
    promptTokens: results.reduce(
      (sum, result) => sum + result.promptTokens,
      0,
    ),
    completionTokens: results.reduce(
      (sum, result) => sum + result.completionTokens,
      0,
    ),
  };
}

export function readLocalServerAcceptanceEvidence() {
  const receipts = readReceipts();
  return {
    ok: true as const,
    schemaVersion: LOCAL_SERVER_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latest: receipts[0] || null,
    latestPassing: receipts.find((receipt) => receipt.status === "pass") || null,
    capabilities: [
      "real-runtime-health",
      "real-model-discovery",
      "openai-models-chat",
      "streaming-sse",
      "bounded-concurrency",
      "token-latency-ledger",
      "api-key-attribution",
      "trusted-host-policy",
      "redacted-retention",
      "drain-aware-switch",
      "idle-eviction-dry-run",
      "unload-reload-recovery",
    ],
    path: RECEIPT_FILE,
  };
}

export async function runLocalServerAcceptance(input: {
  model?: string;
} = {}) {
  const slices: AcceptanceSlice[] = [];
  const ledgerBefore = readServerRequestLedger(SERVER_ID).entries.length;
  const health = await readOllamaHealth();
  const baseUrl = health.baseUrl;

  pushSlice(slices, {
    id: "runtime-health",
    title: "Real runtime health and version",
    passed: health.available,
    evidence: health.available
      ? `Ollama ${health.version} answered the live version endpoint.`
      : health.error?.message || "Ollama is unavailable.",
    metrics: { latencyMs: health.latencyMs, version: health.version },
  });

  const discovery = await discoverOllamaModels();
  const model =
    input.model?.trim() ||
    discovery.models[0]?.name ||
    discovery.models[0]?.model ||
    "qwen3:0.6b";
  const discoveredModel = discovery.models.find(
    (candidate) => candidate.name === model || candidate.model === model,
  );
  pushSlice(slices, {
    id: "model-discovery",
    title: "Installed model discovery",
    passed: Boolean(discoveredModel),
    evidence: discoveredModel
      ? `${model} was discovered from the live runtime.`
      : `${model} is not installed in the live runtime.`,
    metrics: {
      installedModels: discovery.models.length,
      bytes: discoveredModel?.size || 0,
    },
  });

  const registration = await runServerLifecycleAction({
    serverId: SERVER_ID,
    action: "register",
    modelId: model,
    autoEvict: true,
    idleTtlMinutes: 1,
  });
  const registered = readServerInstanceRegistry().instances.find(
    (instance) => instance.id === SERVER_ID,
  );
  pushSlice(slices, {
    id: "instance-registration",
    title: "Durable server instance registration",
    passed:
      registration.status === "pass" &&
      registered?.activeModelId === model &&
      registered.baseUrl === baseUrl,
    evidence:
      registration.status === "pass"
        ? `${SERVER_ID} persisted with ${model}.`
        : registration.error || "Server registration failed.",
    metrics: {
      maxConcurrentRequests: registered?.maxConcurrentRequests || 0,
      idleTtlMinutes: registered?.idleTtlMinutes || 0,
    },
  });

  const prewarm = await runServerLifecycleAction({
    serverId: SERVER_ID,
    action: "hot-switch",
    modelId: model,
  });
  pushSlice(slices, {
    id: "model-prewarm",
    title: "Model prewarm and activation",
    passed: prewarm.status === "pass",
    evidence:
      prewarm.status === "pass"
        ? `${model} was loaded with a bounded keep-alive.`
        : prewarm.error || "Model prewarm failed.",
  });

  let loadedBeforeRecovery = false;
  try {
    const loaded = await readLoadedModels();
    loadedBeforeRecovery = Boolean(
      loaded.models?.some(
        (candidate) =>
          candidate.name === model || candidate.model === model,
      ),
    );
    const resident = loaded.models?.find(
      (candidate) =>
        candidate.name === model || candidate.model === model,
    );
    pushSlice(slices, {
      id: "loaded-process-evidence",
      title: "Loaded process and memory evidence",
      passed: loadedBeforeRecovery,
      evidence: loadedBeforeRecovery
        ? `${model} is resident in the live Ollama process.`
        : `${model} was not resident after prewarm.`,
      metrics: {
        sizeBytes: resident?.size || 0,
        vramBytes: resident?.size_vram || 0,
        expiresAt: resident?.expires_at || null,
      },
    });
  } catch (error) {
    pushSlice(slices, {
      id: "loaded-process-evidence",
      title: "Loaded process and memory evidence",
      passed: false,
      evidence:
        error instanceof Error ? error.message : "Loaded-process probe failed.",
    });
  }

  const conformance = await runOpenAiCompatibleConformance({
    serverId: SERVER_ID,
    baseUrl,
    model,
  });
  pushSlice(slices, {
    id: "openai-models-and-chat",
    title: "OpenAI-compatible models and chat",
    passed: conformance.ok,
    evidence: conformance.ok
      ? "Live /v1/models and non-stream chat conformance passed."
      : conformance.error || "OpenAI-compatible conformance failed.",
    metrics: conformance.metrics,
  });

  try {
    const streaming = await runStreamingChat(baseUrl, model);
    appendServerRequestEntry({
      serverId: SERVER_ID,
      modelId: model,
      operation: "chat",
      status: streaming.ok ? "success" : "error",
      statusCode: streaming.statusCode,
      latencyMs: streaming.latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      profileId: "v1.2.0-stream",
      errorCode: streaming.ok ? undefined : "streaming_conformance_failed",
    });
    pushSlice(slices, {
      id: "streaming-sse",
      title: "Streaming SSE completion",
      passed: streaming.ok,
      evidence: streaming.ok
        ? `Received ${streaming.chunks} SSE data chunks and [DONE].`
        : "Streaming response was incomplete or empty.",
      metrics: {
        chunks: streaming.chunks,
        latencyMs: streaming.latencyMs,
      },
    });
  } catch (error) {
    pushSlice(slices, {
      id: "streaming-sse",
      title: "Streaming SSE completion",
      passed: false,
      evidence:
        error instanceof Error ? error.message : "Streaming request failed.",
    });
  }

  try {
    const concurrency = await runConcurrentChats(baseUrl, model);
    pushSlice(slices, {
      id: "bounded-concurrency",
      title: "Bounded concurrent requests",
      passed: concurrency.ok && concurrency.completed === 2,
      evidence: `${concurrency.completed}/2 concurrent requests completed.`,
      metrics: concurrency,
    });
  } catch (error) {
    pushSlice(slices, {
      id: "bounded-concurrency",
      title: "Bounded concurrent requests",
      passed: false,
      evidence:
        error instanceof Error ? error.message : "Concurrent requests failed.",
    });
  }

  const ledger = readServerRequestLedger(SERVER_ID);
  const newEntries = ledger.entries.slice(
    0,
    Math.max(0, ledger.entries.length - ledgerBefore),
  );
  pushSlice(slices, {
    id: "token-latency-ledger",
    title: "Token and latency accounting",
    passed:
      newEntries.length >= 4 &&
      newEntries.some(
        (entry) =>
          entry.promptTokens > 0 && entry.completionTokens > 0,
      ) &&
      newEntries.every((entry) => entry.latencyMs >= 0),
    evidence: `${newEntries.length} live request records were attributed to this run.`,
    metrics: {
      requests: newEntries.length,
      promptTokens: newEntries.reduce(
        (sum, entry) => sum + entry.promptTokens,
        0,
      ),
      completionTokens: newEntries.reduce(
        (sum, entry) => sum + entry.completionTokens,
        0,
      ),
      averageLatencyMs: newEntries.length
        ? Math.round(
            newEntries.reduce((sum, entry) => sum + entry.latencyMs, 0) /
              newEntries.length,
          )
        : 0,
    },
  });

  const access = rehearseServerAccessAttribution(SERVER_ID);
  pushSlice(slices, {
    id: "api-key-attribution",
    title: "API key issue, attribution, and revocation",
    passed: access.status === "pass",
    evidence:
      access.status === "pass"
        ? "Key plaintext was not persisted and revoked access was denied."
        : "API key attribution rehearsal failed.",
    metrics: access.checks,
  });

  const network = rehearseServerNetworkPolicy();
  pushSlice(slices, {
    id: "lan-trusted-host-policy",
    title: "LAN trusted-host, CORS, auth, and rate policy",
    passed: network.status === "pass",
    evidence:
      network.status === "pass"
        ? "Trusted request passed; host, origin, key, and rate denials matched policy."
        : "LAN network policy decisions diverged from expectations.",
    metrics: {
      scenarios: network.decisions.length,
      matched: network.decisions.filter(
        (decision) => decision.matchedExpectation,
      ).length,
    },
  });

  const retention = rehearseServerLogRetention();
  pushSlice(slices, {
    id: "redacted-log-retention",
    title: "Request-log redaction and retention",
    passed: retention.status === "pass",
    evidence:
      retention.status === "pass"
        ? "Expired records were removed and caller identity was hashed."
        : "Log retention rehearsal failed.",
    metrics: retention.checks,
  });

  const switchReceipt = rehearseServerSwitchController();
  pushSlice(slices, {
    id: "drain-aware-switch-rollback",
    title: "Drain-aware switch and rollback policy",
    passed: switchReceipt.status === "pass",
    evidence:
      switchReceipt.status === "pass"
        ? "Healthy candidate activated after drain and unhealthy candidate rolled back."
        : "Switch-controller rehearsal failed.",
    metrics: switchReceipt.checks,
  });

  try {
    const idle = await runIdleUnloadDaemonTick({
      execute: false,
      now: new Date(Date.now() + 2 * 60_000).toISOString(),
    });
    const decision = idle.decisions.find(
      (entry) => entry.serverId === SERVER_ID,
    );
    pushSlice(slices, {
      id: "idle-eviction-dry-run",
      title: "Idle eviction dry-run",
      passed:
        idle.status === "pass" && decision?.decision === "would-unload",
      evidence:
        decision?.reason ||
        "The idle daemon did not produce a server decision.",
      metrics: {
        idleMs: decision?.idleMs || 0,
        thresholdMs: decision?.thresholdMs || 0,
      },
    });
  } catch (error) {
    pushSlice(slices, {
      id: "idle-eviction-dry-run",
      title: "Idle eviction dry-run",
      passed: false,
      evidence:
        error instanceof Error ? error.message : "Idle eviction probe failed.",
    });
  }

  let unloaded = false;
  let recovered = false;
  let recoveryError = "";
  try {
    const unload = await runOllamaRuntimeAction({ action: "unload", model });
    unloaded = unload.ok && (await waitForResidency(model, false));
    const reload = await runOllamaRuntimeAction({
      action: "prewarm",
      model,
      keepAlive: "10m",
    });
    recovered = reload.ok && (await waitForResidency(model, true));
  } catch (error) {
    recoveryError =
      error instanceof Error ? error.message : "Unload/reload recovery failed.";
  }
  pushSlice(slices, {
    id: "unload-reload-recovery",
    title: "Unload and reload recovery",
    passed: loadedBeforeRecovery && unloaded && recovered,
    evidence:
      loadedBeforeRecovery && unloaded && recovered
        ? "The real model left memory and returned after bounded prewarm."
        : recoveryError ||
          "The loaded, unloaded, and recovered states did not all materialize.",
    metrics: { loadedBeforeRecovery, unloaded, recovered },
  });

  const finalLedger = readServerRequestLedger(SERVER_ID);
  const runEntries = finalLedger.entries.slice(
    0,
    Math.max(0, finalLedger.entries.length - ledgerBefore),
  );
  const blockers = slices
    .filter((slice) => slice.status === "hold")
    .map((slice) => `${slice.id}: ${slice.evidence}`);
  const core = {
    schemaVersion: LOCAL_SERVER_ACCEPTANCE_SCHEMA_VERSION,
    status: blockers.length ? ("hold" as const) : ("pass" as const),
    runtime: {
      backend: "ollama" as const,
      baseUrl,
      version: health.version,
      realProcess: health.available,
      realModel: Boolean(discoveredModel),
    },
    model,
    slices,
    totals: {
      slices: slices.length,
      passed: slices.filter((slice) => slice.status === "pass").length,
      held: slices.filter((slice) => slice.status === "hold").length,
      requests: runEntries.length,
      promptTokens: runEntries.reduce(
        (sum, entry) => sum + entry.promptTokens,
        0,
      ),
      completionTokens: runEntries.reduce(
        (sum, entry) => sum + entry.completionTokens,
        0,
      ),
      averageLatencyMs: runEntries.length
        ? Math.round(
            runEntries.reduce((sum, entry) => sum + entry.latencyMs, 0) /
              runEntries.length,
          )
        : 0,
    },
    blockers,
  };
  const receipt: AcceptanceReceipt = {
    id: `local-server-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...core,
    evidenceDigest: stableDigest(core),
  };
  persist(receipt);
  return receipt;
}
