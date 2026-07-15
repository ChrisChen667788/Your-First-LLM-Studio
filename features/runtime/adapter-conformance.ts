export const RUNTIME_ADAPTER_CONFORMANCE_SCHEMA_VERSION =
  "runtime.adapter-conformance.v1" as const;

export type RuntimeAdapterCapability =
  | "discover"
  | "load"
  | "unload"
  | "prewarm"
  | "cancel"
  | "health"
  | "stream"
  | "tools"
  | "embeddings";

export type RuntimeAdapterDescriptor = {
  id: "mlx" | "ollama" | "llama.cpp" | "localai" | "vllm" | "sglang";
  label: string;
  status: "implemented" | "preview" | "planned";
  platforms: string[];
  endpoint?: string;
  capabilities: RuntimeAdapterCapability[];
};

const REQUIRED_CAPABILITIES: RuntimeAdapterCapability[] = [
  "discover",
  "load",
  "unload",
  "health",
  "stream",
];

export function readRuntimeAdapterConformance() {
  const adapters: RuntimeAdapterDescriptor[] = [
    {
      id: "mlx",
      label: "MLX / MLX-LM",
      status: "implemented",
      platforms: ["darwin-arm64"],
      endpoint: process.env.LOCAL_AGENT_GATEWAY_BASE_URL || "http://127.0.0.1:4000",
      capabilities: ["discover", "load", "unload", "prewarm", "cancel", "health", "stream", "tools"],
    },
    {
      id: "ollama",
      label: "Ollama",
      status: "preview",
      platforms: ["darwin-arm64", "darwin-x64", "linux-x64", "windows-x64"],
      endpoint: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      capabilities: ["discover", "load", "unload", "prewarm", "health", "stream", "tools", "embeddings"],
    },
    {
      id: "llama.cpp",
      label: "llama.cpp server",
      status: "planned",
      platforms: ["darwin-arm64", "darwin-x64", "linux-x64", "windows-x64"],
      capabilities: ["load", "unload", "health", "stream"],
    },
    {
      id: "localai",
      label: "LocalAI",
      status: "planned",
      platforms: ["darwin-arm64", "linux-x64", "windows-x64"],
      capabilities: ["discover", "load", "unload", "health", "stream", "tools", "embeddings"],
    },
    {
      id: "vllm",
      label: "vLLM",
      status: "planned",
      platforms: ["linux-x64-nvidia"],
      capabilities: ["discover", "load", "unload", "health", "stream", "tools", "embeddings"],
    },
    {
      id: "sglang",
      label: "SGLang",
      status: "planned",
      platforms: ["linux-x64-nvidia"],
      capabilities: ["discover", "load", "unload", "health", "stream", "tools"],
    },
  ];
  const results = adapters.map((adapter) => {
    const missingCapabilities = REQUIRED_CAPABILITIES.filter(
      (capability) => !adapter.capabilities.includes(capability),
    );
    return {
      ...adapter,
      conformance: missingCapabilities.length === 0 ? "pass" as const : "partial" as const,
      missingCapabilities,
    };
  });
  return {
    ok: true as const,
    schemaVersion: RUNTIME_ADAPTER_CONFORMANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    requiredCapabilities: REQUIRED_CAPABILITIES,
    adapters: results,
    totals: {
      adapters: results.length,
      implemented: results.filter((adapter) => adapter.status === "implemented").length,
      preview: results.filter((adapter) => adapter.status === "preview").length,
      planned: results.filter((adapter) => adapter.status === "planned").length,
      conformant: results.filter((adapter) => adapter.conformance === "pass").length,
    },
  };
}
