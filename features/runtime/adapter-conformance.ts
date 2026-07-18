import {
  readRuntimeFabricContract,
  type RuntimeBackend,
} from "@/features/runtime/runtime-fabric-contract";

export const RUNTIME_ADAPTER_CONFORMANCE_SCHEMA_VERSION =
  "runtime.adapter-conformance.v2" as const;

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

const EXTRA_CAPABILITIES: Record<
  RuntimeBackend,
  RuntimeAdapterCapability[]
> = {
  mlx: ["tools"],
  ollama: ["tools", "embeddings"],
  "llama.cpp": ["tools", "embeddings"],
  localai: ["tools", "embeddings"],
  vllm: ["tools", "embeddings"],
  sglang: ["tools"],
};

export function readRuntimeAdapterConformance() {
  const fabric = readRuntimeFabricContract();
  const adapters = fabric.adapters.map((adapter) => {
    const capabilities = [
      "discover",
      "health",
      "stream",
      ...(adapter.supportedOperations.includes("prewarm")
        ? ["prewarm" as const, "load" as const]
        : []),
      ...(adapter.supportedOperations.includes("unload")
        ? ["unload" as const]
        : []),
      ...(adapter.supportedOperations.includes("cancel")
        ? ["cancel" as const]
        : []),
      ...EXTRA_CAPABILITIES[adapter.backend],
    ];
    const missingCapabilities = adapter.operations
      .filter((operation) => !operation.normalized)
      .map((operation) => operation.operation);
    return {
      id: adapter.backend,
      label: adapter.label,
      status: "implemented" as const,
      implementation: adapter.implementation,
      platforms: adapter.platforms,
      endpoint: adapter.configuredBaseUrl || undefined,
      capabilities: [...new Set(capabilities)],
      conformance:
        adapter.contractStatus === "pass"
          ? ("pass" as const)
          : ("partial" as const),
      missingCapabilities,
      operationCoverage: adapter.operations,
    };
  });
  return {
    ok: true as const,
    schemaVersion: RUNTIME_ADAPTER_CONFORMANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    host: fabric.host,
    requiredContract:
      "Every operation resolves to a backend-neutral success or normalized rejection.",
    adapters,
    totals: {
      adapters: adapters.length,
      implemented: adapters.length,
      preview: 0,
      planned: 0,
      conformant: adapters.filter(
        (adapter) => adapter.conformance === "pass",
      ).length,
    },
  };
}
