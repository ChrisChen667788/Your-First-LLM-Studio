import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { readRuntimeAdapterConformance } from "@/features/runtime/adapter-conformance";
import { runRuntimeOperationContractSuite } from "@/features/runtime/operation-port";
import {
  evaluateRuntimeCompatibility,
  readRuntimeHostCapabilities,
  type RuntimeBackend,
  type RuntimeModelFormat,
} from "@/features/runtime/runtime-fabric-contract";
import {
  probeRuntimeAdapter,
  runRuntimeFabricChat,
  runRuntimeFabricStream,
} from "@/features/runtime/runtime-fabric-adapters";

export const RUNTIME_FABRIC_ACCEPTANCE_SCHEMA_VERSION =
  "runtime.fabric-acceptance.v1" as const;

type BackendAcceptance = {
  backend: "mlx" | "ollama" | "llama.cpp";
  status: "pass" | "hold";
  realProcess: boolean;
  model: string;
  discoveredModels: number;
  runtimeVersion: string | null;
  fingerprint: string | null;
  checks: {
    health: boolean;
    discovery: boolean;
    chat: boolean;
    stream: boolean;
    normalizedUsage: boolean;
  };
  metrics: {
    probeLatencyMs: number;
    chatLatencyMs: number;
    streamLatencyMs: number;
    streamChunks: number;
    promptTokens: number;
    completionTokens: number;
  };
  error: { code: string; message: string } | null;
};

type CompatibilityEvidence = {
  backend: RuntimeBackend;
  modelFormat: RuntimeModelFormat;
  minimumMemoryGb: number;
  compatible: boolean;
  codes: string[];
  reasons: string[];
};

export type RuntimeFabricAcceptanceReceipt = {
  id: string;
  schemaVersion: typeof RUNTIME_FABRIC_ACCEPTANCE_SCHEMA_VERSION;
  generatedAt: string;
  status: "pass" | "hold";
  host: ReturnType<typeof readRuntimeHostCapabilities>;
  backends: BackendAcceptance[];
  adapterContract: {
    implemented: number;
    conformant: number;
    planned: number;
    operationChecks: number;
    normalizedOperationChecks: number;
  };
  compatibilityMatrix: CompatibilityEvidence[];
  totals: {
    realBackends: number;
    passingBackends: number;
    adapterContracts: number;
    compatibleProfiles: number;
    rejectedProfiles: number;
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
const STORE_FILE = path.join(DATA_DIR, "runtime-fabric-acceptance.json");
const LIVE_BACKENDS = ["mlx", "ollama", "llama.cpp"] as const;

function readReceipts(): RuntimeFabricAcceptanceReceipt[] {
  if (!existsSync(STORE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as {
      receipts?: RuntimeFabricAcceptanceReceipt[];
    };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function persist(receipt: RuntimeFabricAcceptanceReceipt) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    STORE_FILE,
    `${JSON.stringify(
      {
        schemaVersion: RUNTIME_FABRIC_ACCEPTANCE_SCHEMA_VERSION,
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

function marker(backend: BackendAcceptance["backend"], suffix: string) {
  return `FABRIC_${backend.replace(/[^a-z0-9]/giu, "_").toUpperCase()}_${suffix}`;
}

async function runBackendAcceptance(
  backend: BackendAcceptance["backend"],
  requestedModel?: string,
): Promise<BackendAcceptance> {
  const probe = await probeRuntimeAdapter(backend);
  const model =
    requestedModel?.trim() ||
    probe.models[0] ||
    (backend === "mlx"
      ? "local-qwen3-0.6b"
      : backend === "ollama"
        ? "qwen3:0.6b"
        : "qwen3-0.6b-llamacpp");
  if (!probe.ok) {
    return {
      backend,
      status: "hold",
      realProcess: false,
      model,
      discoveredModels: 0,
      runtimeVersion: probe.version,
      fingerprint: null,
      checks: {
        health: false,
        discovery: false,
        chat: false,
        stream: false,
        normalizedUsage: false,
      },
      metrics: {
        probeLatencyMs: probe.latencyMs,
        chatLatencyMs: 0,
        streamLatencyMs: 0,
        streamChunks: 0,
        promptTokens: 0,
        completionTokens: 0,
      },
      error: probe.error,
    };
  }
  const discovered =
    probe.models.includes(model) ||
    (backend === "llama.cpp" && probe.models.length === 1);
  const effectiveModel =
    backend === "llama.cpp" && !probe.models.includes(model)
      ? probe.models[0] || model
      : model;
  const chat = await runRuntimeFabricChat({
    backend,
    model: effectiveModel,
    marker: marker(backend, "CHAT_OK"),
  });
  const stream = await runRuntimeFabricStream({
    backend,
    model: effectiveModel,
    marker: marker(backend, "STREAM_OK"),
  });
  const normalizedUsage =
    typeof chat.usage.promptTokens === "number" &&
    typeof chat.usage.completionTokens === "number" &&
    typeof chat.usage.totalTokens === "number";
  const checks = {
    health: probe.available,
    discovery: discovered,
    chat: chat.ok,
    stream: stream.ok,
    normalizedUsage,
  };
  const firstError = chat.error || stream.error;
  return {
    backend,
    status: Object.values(checks).every(Boolean) ? "pass" : "hold",
    realProcess: probe.available,
    model: effectiveModel,
    discoveredModels: probe.models.length,
    runtimeVersion: probe.version,
    fingerprint: chat.fingerprint || null,
    checks,
    metrics: {
      probeLatencyMs: probe.latencyMs,
      chatLatencyMs: chat.latencyMs,
      streamLatencyMs: stream.latencyMs,
      streamChunks: stream.chunks,
      promptTokens: chat.usage.promptTokens,
      completionTokens: chat.usage.completionTokens,
    },
    error: firstError
      ? { code: firstError.code, message: firstError.message }
      : null,
  };
}

function buildCompatibilityMatrix() {
  const scenarios: Array<{
    backend: RuntimeBackend;
    modelFormat: RuntimeModelFormat;
    minimumMemoryGb: number;
  }> = [
    { backend: "mlx", modelFormat: "mlx", minimumMemoryGb: 2 },
    { backend: "ollama", modelFormat: "ollama", minimumMemoryGb: 2 },
    { backend: "llama.cpp", modelFormat: "gguf", minimumMemoryGb: 2 },
    { backend: "localai", modelFormat: "gguf", minimumMemoryGb: 2 },
    { backend: "vllm", modelFormat: "safetensors", minimumMemoryGb: 16 },
    { backend: "sglang", modelFormat: "safetensors", minimumMemoryGb: 16 },
  ];
  return scenarios.map((scenario) => ({
    ...scenario,
    ...evaluateRuntimeCompatibility(scenario),
  }));
}

export async function runRuntimeFabricAcceptance(input: {
  models?: Partial<Record<BackendAcceptance["backend"], string>>;
} = {}) {
  const adapterCatalog = readRuntimeAdapterConformance();
  const operationReceipt = runRuntimeOperationContractSuite();
  const compatibilityMatrix = buildCompatibilityMatrix();
  const backends: BackendAcceptance[] = [];
  for (const backend of LIVE_BACKENDS) {
    backends.push(
      await runBackendAcceptance(backend, input.models?.[backend]),
    );
  }
  const normalizedOperationChecks = operationReceipt.checks.filter(
    (check) => check.normalized,
  ).length;
  const adapterContract = {
    implemented: adapterCatalog.totals.implemented,
    conformant: adapterCatalog.totals.conformant,
    planned: adapterCatalog.totals.planned,
    operationChecks: operationReceipt.checks.length,
    normalizedOperationChecks,
  };
  const blockers = [
    ...backends
      .filter((backend) => backend.status !== "pass")
      .map(
        (backend) =>
          `${backend.backend} live conformance is HOLD${
            backend.error ? `: ${backend.error.message}` : "."
          }`,
      ),
    ...(adapterContract.implemented === 6 &&
    adapterContract.conformant === 6 &&
    adapterContract.planned === 0
      ? []
      : ["All six runtime adapters must satisfy the shared contract."]),
    ...(normalizedOperationChecks === operationReceipt.checks.length
      ? []
      : ["Every runtime operation must normalize success or rejection."]),
    ...compatibilityMatrix
      .filter(
        (profile) => !profile.compatible && profile.codes.length === 0,
      )
      .map(
        (profile) =>
          `${profile.backend} rejected a profile without an actionable code.`,
      ),
  ];
  const latencies = backends.flatMap((backend) => [
    backend.metrics.chatLatencyMs,
    backend.metrics.streamLatencyMs,
  ]);
  const totals = {
    realBackends: backends.length,
    passingBackends: backends.filter((backend) => backend.status === "pass")
      .length,
    adapterContracts: adapterContract.implemented,
    compatibleProfiles: compatibilityMatrix.filter(
      (profile) => profile.compatible,
    ).length,
    rejectedProfiles: compatibilityMatrix.filter(
      (profile) => !profile.compatible,
    ).length,
    promptTokens: backends.reduce(
      (total, backend) => total + backend.metrics.promptTokens,
      0,
    ),
    completionTokens: backends.reduce(
      (total, backend) => total + backend.metrics.completionTokens,
      0,
    ),
    averageLatencyMs: latencies.length
      ? Math.round(
          latencies.reduce((total, latency) => total + latency, 0) /
            latencies.length,
        )
      : 0,
  };
  const core = {
    schemaVersion: RUNTIME_FABRIC_ACCEPTANCE_SCHEMA_VERSION,
    status: blockers.length ? ("hold" as const) : ("pass" as const),
    host: readRuntimeHostCapabilities(),
    backends,
    adapterContract,
    compatibilityMatrix,
    totals,
    blockers,
  };
  const stableProjection = {
    schemaVersion: core.schemaVersion,
    status: core.status,
    host: {
      platformKey: core.host.platformKey,
      accelerator: core.host.accelerator,
    },
    backends: core.backends.map((backend) => ({
      backend: backend.backend,
      status: backend.status,
      realProcess: backend.realProcess,
      model: backend.model,
      checks: backend.checks,
      runtimeVersion: backend.runtimeVersion,
      fingerprint: backend.fingerprint,
    })),
    adapterContract: core.adapterContract,
    compatibilityMatrix: core.compatibilityMatrix.map((profile) => ({
      backend: profile.backend,
      compatible: profile.compatible,
      codes: profile.codes,
    })),
  };
  const receipt: RuntimeFabricAcceptanceReceipt = {
    id: `runtime-fabric-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...core,
    evidenceDigest: stableDigest(stableProjection),
  };
  persist(receipt);
  return receipt;
}

export function readRuntimeFabricAcceptanceEvidence() {
  const receipts = readReceipts();
  return {
    ok: true as const,
    schemaVersion: RUNTIME_FABRIC_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latest: receipts[0] || null,
    latestPassing:
      receipts.find((receipt) => receipt.status === "pass") || null,
    path: STORE_FILE,
  };
}
