import { existsSync } from "fs";
import os from "os";

export const RUNTIME_FABRIC_CONTRACT_SCHEMA_VERSION =
  "runtime.fabric-contract.v1" as const;

export type RuntimeBackend =
  | "mlx"
  | "ollama"
  | "llama.cpp"
  | "localai"
  | "vllm"
  | "sglang";

export type RuntimeFabricOperation =
  | "health"
  | "discover"
  | "chat"
  | "stream"
  | "prewarm"
  | "unload"
  | "cancel";

export type RuntimeModelFormat =
  | "mlx"
  | "ollama"
  | "gguf"
  | "safetensors"
  | "onnx";

export type RuntimeAdapterSpec = {
  backend: RuntimeBackend;
  label: string;
  implementation: "native" | "openai-compatible";
  endpointEnv: string;
  defaultBaseUrl: string | null;
  platforms: string[];
  modelFormats: RuntimeModelFormat[];
  supportedOperations: RuntimeFabricOperation[];
};

export type RuntimeHostCapabilities = {
  platform: NodeJS.Platform;
  arch: string;
  platformKey: string;
  memoryGb: number;
  accelerator: "apple-silicon" | "nvidia" | "amd" | "cpu";
  nvidiaVisible: boolean;
};

export type RuntimeCompatibilityInput = {
  backend: RuntimeBackend;
  modelFormat: RuntimeModelFormat;
  minimumMemoryGb: number;
};

const ALL_OPERATIONS: RuntimeFabricOperation[] = [
  "health",
  "discover",
  "chat",
  "stream",
  "prewarm",
  "unload",
  "cancel",
];

const ADAPTER_SPECS: RuntimeAdapterSpec[] = [
  {
    backend: "mlx",
    label: "MLX / MLX-LM",
    implementation: "native",
    endpointEnv: "LOCAL_AGENT_GATEWAY_BASE_URL",
    defaultBaseUrl: "http://127.0.0.1:4000",
    platforms: ["darwin-arm64"],
    modelFormats: ["mlx", "safetensors"],
    supportedOperations: [
      "health",
      "discover",
      "chat",
      "stream",
      "prewarm",
      "unload",
    ],
  },
  {
    backend: "ollama",
    label: "Ollama",
    implementation: "native",
    endpointEnv: "OLLAMA_BASE_URL",
    defaultBaseUrl: "http://127.0.0.1:11434",
    platforms: [
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "win32-x64",
    ],
    modelFormats: ["ollama", "gguf"],
    supportedOperations: [
      "health",
      "discover",
      "chat",
      "stream",
      "prewarm",
      "unload",
    ],
  },
  {
    backend: "llama.cpp",
    label: "llama.cpp server",
    implementation: "native",
    endpointEnv: "LLAMA_CPP_BASE_URL",
    defaultBaseUrl: "http://127.0.0.1:11435",
    platforms: [
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "win32-x64",
    ],
    modelFormats: ["gguf"],
    supportedOperations: ["health", "discover", "chat", "stream"],
  },
  {
    backend: "localai",
    label: "LocalAI",
    implementation: "openai-compatible",
    endpointEnv: "LOCALAI_BASE_URL",
    defaultBaseUrl: null,
    platforms: [
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "win32-x64",
    ],
    modelFormats: ["gguf", "safetensors", "onnx"],
    supportedOperations: ["health", "discover", "chat", "stream"],
  },
  {
    backend: "vllm",
    label: "vLLM",
    implementation: "openai-compatible",
    endpointEnv: "VLLM_BASE_URL",
    defaultBaseUrl: null,
    platforms: ["linux-x64-nvidia"],
    modelFormats: ["safetensors"],
    supportedOperations: ["health", "discover", "chat", "stream"],
  },
  {
    backend: "sglang",
    label: "SGLang",
    implementation: "openai-compatible",
    endpointEnv: "SGLANG_BASE_URL",
    defaultBaseUrl: null,
    platforms: ["linux-x64-nvidia"],
    modelFormats: ["safetensors"],
    supportedOperations: ["health", "discover", "chat", "stream"],
  },
];

export function readRuntimeAdapterSpecs() {
  return ADAPTER_SPECS.map((spec) => ({
    ...spec,
    platforms: [...spec.platforms],
    modelFormats: [...spec.modelFormats],
    supportedOperations: [...spec.supportedOperations],
  }));
}

export function readRuntimeHostCapabilities(): RuntimeHostCapabilities {
  const platform = os.platform();
  const arch = os.arch();
  const nvidiaVisible =
    existsSync("/dev/nvidia0") ||
    Boolean(
      process.env.CUDA_VISIBLE_DEVICES &&
        process.env.CUDA_VISIBLE_DEVICES !== "-1",
    ) ||
    Boolean(
      process.env.NVIDIA_VISIBLE_DEVICES &&
        process.env.NVIDIA_VISIBLE_DEVICES !== "void",
    );
  const accelerator =
    platform === "darwin" && arch === "arm64"
      ? "apple-silicon"
      : nvidiaVisible
        ? "nvidia"
        : process.env.ROCR_VISIBLE_DEVICES
          ? "amd"
          : "cpu";
  return {
    platform,
    arch,
    platformKey: `${platform}-${arch}`,
    memoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    accelerator,
    nvidiaVisible,
  };
}

export function resolveRuntimeFabricOperation(
  backend: RuntimeBackend,
  operation: RuntimeFabricOperation,
) {
  const spec = ADAPTER_SPECS.find((candidate) => candidate.backend === backend);
  if (!spec) {
    return {
      ok: false as const,
      backend,
      operation,
      error: {
        code: "backend_unknown" as const,
        message: "Runtime backend is unknown.",
      },
    };
  }
  if (!spec.supportedOperations.includes(operation)) {
    return {
      ok: false as const,
      backend,
      operation,
      error: {
        code: "operation_unsupported" as const,
        message: `${operation} is not supported by ${spec.label}.`,
      },
    };
  }
  return {
    ok: true as const,
    backend,
    operation,
    implementation: spec.implementation,
    idempotent: ["health", "discover", "prewarm", "unload", "cancel"].includes(
      operation,
    ),
  };
}

export function evaluateRuntimeCompatibility(
  input: RuntimeCompatibilityInput,
  host = readRuntimeHostCapabilities(),
) {
  const spec = ADAPTER_SPECS.find(
    (candidate) => candidate.backend === input.backend,
  );
  if (!spec) {
    return {
      compatible: false,
      reasons: ["Runtime backend is unknown."],
      codes: ["backend_unknown"],
    };
  }
  const reasons: string[] = [];
  const codes: string[] = [];
  const requiresNvidia = spec.platforms.some((platform) =>
    platform.endsWith("-nvidia"),
  );
  const platformMatches = spec.platforms.some((platform) => {
    const normalized = platform.replace(/-nvidia$/u, "");
    return normalized === host.platformKey;
  });
  if (!platformMatches) {
    reasons.push(
      `${spec.label} does not support ${host.platformKey} in this runtime profile.`,
    );
    codes.push("platform_unsupported");
  }
  if (requiresNvidia && !host.nvidiaVisible) {
    reasons.push(`${spec.label} requires a visible NVIDIA accelerator.`);
    codes.push("accelerator_unavailable");
  }
  if (!spec.modelFormats.includes(input.modelFormat)) {
    reasons.push(
      `${input.modelFormat} is not a supported model format for ${spec.label}.`,
    );
    codes.push("model_format_unsupported");
  }
  if (host.memoryGb < input.minimumMemoryGb) {
    reasons.push(
      `${host.memoryGb} GB is below the ${input.minimumMemoryGb} GB minimum.`,
    );
    codes.push("memory_insufficient");
  }
  return {
    compatible: reasons.length === 0,
    reasons,
    codes,
  };
}

export function readRuntimeFabricContract() {
  const host = readRuntimeHostCapabilities();
  const adapters = readRuntimeAdapterSpecs().map((spec) => {
    const operations = ALL_OPERATIONS.map((operation) => {
      const result = resolveRuntimeFabricOperation(spec.backend, operation);
      return {
        operation,
        supported: result.ok,
        normalized: result.ok || Boolean(result.error.code),
        errorCode: result.ok ? null : result.error.code,
      };
    });
    return {
      ...spec,
      configuredBaseUrl:
        process.env[spec.endpointEnv]?.trim() || spec.defaultBaseUrl,
      operations,
      contractStatus: operations.every((operation) => operation.normalized)
        ? ("pass" as const)
        : ("hold" as const),
    };
  });
  return {
    ok: true as const,
    schemaVersion: RUNTIME_FABRIC_CONTRACT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    host,
    operations: ALL_OPERATIONS,
    adapters,
    totals: {
      adapters: adapters.length,
      implemented: adapters.length,
      configured: adapters.filter((adapter) => adapter.configuredBaseUrl).length,
      contractPassing: adapters.filter(
        (adapter) => adapter.contractStatus === "pass",
      ).length,
    },
  };
}
