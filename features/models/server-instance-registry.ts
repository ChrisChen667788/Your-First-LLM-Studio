import { createHash } from "crypto";
import os from "os";
import path from "path";
import { readIdleUnloadConfig } from "@/features/models/runtime-profile-registry";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

export const SERVER_INSTANCE_REGISTRY_SCHEMA_VERSION =
  "models.server-instance-registry.v1" as const;

export type ServerInstanceRecord = {
  id: string;
  label: string;
  backend: "mlx" | "ollama" | "llama.cpp" | "localai" | "vllm" | "sglang";
  baseUrl: string;
  state: "configured" | "starting" | "ready" | "stopped" | "unavailable";
  pinnedModelIds: string[];
  activeModelId?: string;
  idleTtlMinutes: number;
  autoEvict: boolean;
  networkExposure: "loopback" | "lan";
  authMode: "none" | "api-key";
  trustedHosts: string[];
  requestLogRetentionDays: number;
  maxConcurrentRequests: number;
  createdAt: string;
  updatedAt: string;
};

type ServerInstanceRegistry = {
  schemaVersion: typeof SERVER_INSTANCE_REGISTRY_SCHEMA_VERSION;
  instances: ServerInstanceRecord[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const REGISTRY_FILE = path.join(DATA_DIR, "server-instance-registry.json");

function defaultRegistry(): ServerInstanceRegistry {
  const now = new Date().toISOString();
  const idle = readIdleUnloadConfig();
  return {
    schemaVersion: SERVER_INSTANCE_REGISTRY_SCHEMA_VERSION,
    instances: [
      {
        id: "local-mlx-gateway",
        label: "Local MLX Gateway",
        backend: "mlx",
        baseUrl: process.env.LOCAL_AGENT_GATEWAY_BASE_URL || "http://127.0.0.1:4000",
        state: "configured",
        pinnedModelIds: [],
        idleTtlMinutes: idle.idleMinutes,
        autoEvict: idle.enabled,
        networkExposure: "loopback",
        authMode: "none",
        trustedHosts: ["127.0.0.1", "localhost"],
        requestLogRetentionDays: 7,
        maxConcurrentRequests: 4,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function normalizeInstance(instance: Partial<ServerInstanceRecord>): ServerInstanceRecord | null {
  if (!instance.id || !instance.baseUrl) return null;
  const now = new Date().toISOString();
  const networkExposure = instance.networkExposure === "lan" ? "lan" : "loopback";
  const trustedHosts = Array.isArray(instance.trustedHosts)
    ? instance.trustedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean)
    : networkExposure === "lan"
      ? []
      : ["127.0.0.1", "localhost"];
  return {
    id: instance.id,
    label: instance.label?.trim() || "Local server",
    backend: instance.backend || "mlx",
    baseUrl: instance.baseUrl,
    state: instance.state || "configured",
    pinnedModelIds: Array.isArray(instance.pinnedModelIds) ? instance.pinnedModelIds : [],
    activeModelId: instance.activeModelId,
    idleTtlMinutes: Math.max(1, Math.min(240, instance.idleTtlMinutes || 20)),
    autoEvict: instance.autoEvict ?? false,
    networkExposure,
    authMode: instance.authMode === "api-key" ? "api-key" : "none",
    trustedHosts: [...new Set(trustedHosts)],
    requestLogRetentionDays: Math.max(1, Math.min(90, instance.requestLogRetentionDays || 7)),
    maxConcurrentRequests: Math.max(1, Math.min(64, instance.maxConcurrentRequests || 4)),
    createdAt: instance.createdAt || now,
    updatedAt: instance.updatedAt || now,
  };
}

function isRegistry(value: unknown): value is ServerInstanceRegistry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ServerInstanceRegistry>;
  return (
    candidate.schemaVersion === SERVER_INSTANCE_REGISTRY_SCHEMA_VERSION &&
    Array.isArray(candidate.instances)
  );
}

function normalizeRegistry(registry: ServerInstanceRegistry) {
  const instances = registry.instances
    .map(normalizeInstance)
    .filter((instance): instance is ServerInstanceRecord => Boolean(instance));
  return {
    schemaVersion: SERVER_INSTANCE_REGISTRY_SCHEMA_VERSION,
    instances,
  } satisfies ServerInstanceRegistry;
}

function readRegistry() {
  return normalizeRegistry(
    readJsonFileDurably(REGISTRY_FILE, defaultRegistry, isRegistry),
  );
}

export function readServerInstanceRegistry() {
  const registry = readRegistry();
  return {
    ok: true as const,
    schemaVersion: SERVER_INSTANCE_REGISTRY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    instances: registry.instances,
    totals: {
      instances: registry.instances.length,
      ready: registry.instances.filter((instance) => instance.state === "ready").length,
      configured: registry.instances.filter((instance) => instance.state === "configured").length,
      lanExposed: registry.instances.filter((instance) => instance.networkExposure === "lan").length,
      unauthenticatedLan: registry.instances.filter(
        (instance) => instance.networkExposure === "lan" && instance.authMode === "none",
      ).length,
      unsafeTrustedHosts: registry.instances.filter((instance) =>
        instance.trustedHosts?.some((host) => host === "*" || host === "0.0.0.0"),
      ).length,
    },
    paths: { registry: REGISTRY_FILE },
  };
}

export function upsertServerInstance(input: Partial<ServerInstanceRecord>) {
  const baseUrl = input.baseUrl?.trim();
  if (!baseUrl) throw new Error("baseUrl is required.");
  const id =
    input.id?.trim() ||
    `server-${createHash("sha256").update(baseUrl).digest("hex").slice(0, 12)}`;
  let saved: ServerInstanceRecord | null = null;
  updateJsonFileDurably(
    REGISTRY_FILE,
    defaultRegistry,
    (current) => {
      const registry = normalizeRegistry(current);
      const existing = registry.instances.find((instance) => instance.id === id);
      const now = new Date().toISOString();
      const networkExposure = input.networkExposure || existing?.networkExposure || "loopback";
      const authMode = input.authMode || existing?.authMode || "none";
      const trustedHosts = (input.trustedHosts || existing?.trustedHosts || ["127.0.0.1", "localhost"])
        .map((host) => host.trim().toLowerCase()).filter(Boolean);
      if (networkExposure === "lan" && authMode === "none") {
        throw new Error("LAN server instances require api-key authentication.");
      }
      if (trustedHosts.some((host) => host === "*" || host === "0.0.0.0")) {
        throw new Error("Wildcard trusted hosts are not allowed.");
      }
      saved = {
        id,
        label: input.label?.trim() || existing?.label || "Local server",
        backend: input.backend || existing?.backend || "mlx",
        baseUrl,
        state: input.state || existing?.state || "configured",
        pinnedModelIds: input.pinnedModelIds || existing?.pinnedModelIds || [],
        activeModelId: input.activeModelId || existing?.activeModelId,
        idleTtlMinutes: Math.max(1, Math.min(240, input.idleTtlMinutes || existing?.idleTtlMinutes || 20)),
        autoEvict: input.autoEvict ?? existing?.autoEvict ?? false,
        networkExposure,
        authMode,
        trustedHosts: [...new Set(trustedHosts)],
        requestLogRetentionDays: Math.max(1, Math.min(90, input.requestLogRetentionDays || existing?.requestLogRetentionDays || 7)),
        maxConcurrentRequests: Math.max(1, Math.min(64, input.maxConcurrentRequests || existing?.maxConcurrentRequests || 4)),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      return {
        schemaVersion: SERVER_INSTANCE_REGISTRY_SCHEMA_VERSION,
        instances: [saved, ...registry.instances.filter((instance) => instance.id !== id)],
      };
    },
    isRegistry,
  );
  return saved!;
}

export function updateServerInstanceRuntime(
  id: string,
  patch: { state?: ServerInstanceRecord["state"]; activeModelId?: string | null },
) {
  let saved: ServerInstanceRecord | null = null;
  updateJsonFileDurably(
    REGISTRY_FILE,
    defaultRegistry,
    (currentRegistry) => {
      const registry = normalizeRegistry(currentRegistry);
      const current = registry.instances.find((instance) => instance.id === id);
      if (!current) throw new Error("Server instance was not found.");
      saved = {
        ...current,
        state: patch.state || current.state,
        activeModelId:
          patch.activeModelId === null
            ? undefined
            : patch.activeModelId === undefined
              ? current.activeModelId
              : patch.activeModelId,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...registry,
        instances: registry.instances.map((instance) => instance.id === id ? saved! : instance),
      };
    },
    isRegistry,
  );
  return saved!;
}
