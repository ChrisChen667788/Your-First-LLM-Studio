import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import {
  MODEL_RUNTIME_OPERATIONS_CONTRACT_VERSION,
  type ModelRuntimeDeveloperApiGuide,
  type ModelRuntimeOperationCapability,
} from "@/features/models/contracts";
import { listServerAgentTargets } from "@/lib/agent/server-targets";

export type ModelRuntimeProfileRecord = {
  id: string;
  label: string;
  description: string;
  targetId: string;
  temperature: number;
  contextWindow: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  thinkingMode: "standard" | "thinking";
  providerProfile: "speed" | "balanced" | "tool-first";
  hardwareBudget: string;
  ragPolicy: string;
  source: "builtin" | "user";
  createdAt: string;
  updatedAt: string;
};

export type RuntimeProfileRegistry = {
  schemaVersion: "model-runtime-profiles.v1";
  generatedAt: string;
  profiles: ModelRuntimeProfileRecord[];
};

export type LocalServerIdleUnloadConfig = {
  schemaVersion: "local-server-idle-unload.v1";
  enabled: boolean;
  idleMinutes: number;
  memoryPressureRelease: boolean;
  preserveAdapters: boolean;
  applyMode: "config-only" | "daemon-managed";
  updatedAt: string;
  notes: string[];
};

export type LocalServerRequestLogEntry = {
  id: string;
  targetId: string;
  targetLabel: string;
  providerLabel: string;
  execution: string;
  resolvedModel: string;
  resolvedBaseUrl: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  firstTokenLatencyMs?: number;
  tokenThroughputTps?: number;
  ok: boolean;
  inputPreview: string;
  outputPreview: string;
  toolRunsCount: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  warning?: string;
};

export type LocalServerRequestLogSummary = {
  total: number;
  ok: number;
  failed: number;
  avgLatencyMs: number | null;
  totalTokens: number;
  entries: LocalServerRequestLogEntry[];
};

export type ModelRuntimeOperationsReadModel = {
  contractVersion: typeof MODEL_RUNTIME_OPERATIONS_CONTRACT_VERSION;
  generatedAt: string;
  capabilities: ModelRuntimeOperationCapability[];
  registry: RuntimeProfileRegistry;
  idleUnload: LocalServerIdleUnloadConfig;
  requestLogs: LocalServerRequestLogSummary;
  developerApi: ModelRuntimeDeveloperApiGuide;
  targetCards: ModelRuntimeTargetCard[];
  paths: ReturnType<typeof getRuntimeProfileStoragePaths>;
};

export type ModelRuntimeTargetCard = {
  targetId: string;
  label: string;
  providerLabel: string;
  execution: string;
  resolvedModel: string;
  endpoint: string;
  chatCompletionsUrl: string;
  modelsUrl: string;
  apiKeyEnv?: string;
  keyStatus: ModelRuntimeDeveloperApiGuide["keyStatus"];
  recommendedContext?: string;
  recommendedContextWindow?: number;
  memoryProfile?: string;
  profileCount: number;
  profileLabels: string[];
  toolEnabledProfileCount: number;
  ragEnabledProfileCount: number;
  idleUnloadEnabled: boolean;
  idleMinutes: number;
  requestCount: number;
  failureCount: number;
  totalTokens: number;
  avgLatencyMs: number | null;
  lastRequestAt?: string;
};

const DEFAULT_DATA_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "local-agent-lab",
  "observability",
);

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || DEFAULT_DATA_DIR;
const PROFILE_REGISTRY_FILE = path.join(DATA_DIR, "model-runtime-profiles.json");
const IDLE_UNLOAD_CONFIG_FILE = path.join(DATA_DIR, "local-server-idle-unload.json");
const CHAT_HISTORY_FILE = path.join(DATA_DIR, "chat-history.jsonl");
const DEFAULT_LOCAL_SERVER_BASE_URL = "http://localhost:11434/v1";

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  ensureDataDir();
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeThinkingMode(value: unknown): ModelRuntimeProfileRecord["thinkingMode"] {
  return value === "thinking" ? "thinking" : "standard";
}

function normalizeProviderProfile(value: unknown): ModelRuntimeProfileRecord["providerProfile"] {
  if (value === "speed" || value === "tool-first") return value;
  return "balanced";
}

function createBuiltinProfiles(now: string): ModelRuntimeProfileRecord[] {
  return [
    {
      id: "local-coding-balanced",
      label: "Local coding balanced",
      description: "4B local coding profile with tools on and a conservative context window.",
      targetId: "local-qwen35-4b-4bit",
      temperature: 0.2,
      contextWindow: 16384,
      enableTools: true,
      enableRetrieval: false,
      thinkingMode: "standard",
      providerProfile: "balanced",
      hardwareBudget: "Keep one 4B model hot; release before loading another 4B target.",
      ragPolicy: "Manual RAG toggle for repo-specific questions.",
      source: "builtin",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "rag-grounded-review",
      label: "RAG grounded review",
      description: "Knowledge-first profile for cited answers, ACL-filtered retrieval, and eval probes.",
      targetId: "local-qwen3-0.6b",
      temperature: 0.1,
      contextWindow: 8192,
      enableTools: true,
      enableRetrieval: true,
      thinkingMode: "standard",
      providerProfile: "tool-first",
      hardwareBudget: "Favor a light local model when the knowledge base does most of the work.",
      ragPolicy: "Require citations and fall back when evidence is weak.",
      source: "builtin",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "remote-thinking-agent",
      label: "Remote thinking agent",
      description: "Remote OpenAI-compatible profile for expensive reasoning and long tool chains.",
      targetId: "openai-codex",
      temperature: 0.25,
      contextWindow: 32768,
      enableTools: true,
      enableRetrieval: true,
      thinkingMode: "thinking",
      providerProfile: "tool-first",
      hardwareBudget: "Offload compute to the provider; watch token accounting and latency.",
      ragPolicy: "Use citations for enterprise docs and benchmark evidence.",
      source: "builtin",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function readRuntimeProfileRegistry(): RuntimeProfileRegistry {
  const now = new Date().toISOString();
  const fallback: RuntimeProfileRegistry = {
    schemaVersion: "model-runtime-profiles.v1",
    generatedAt: now,
    profiles: createBuiltinProfiles(now),
  };
  const registry = readJsonFile<RuntimeProfileRegistry>(PROFILE_REGISTRY_FILE, fallback);
  const builtinIds = new Set(fallback.profiles.map((profile) => profile.id));
  const customProfiles = Array.isArray(registry.profiles)
    ? registry.profiles.filter((profile) => !builtinIds.has(profile.id))
    : [];
  return {
    schemaVersion: "model-runtime-profiles.v1",
    generatedAt: now,
    profiles: [...fallback.profiles, ...customProfiles],
  };
}

export function upsertRuntimeProfile(input: Partial<ModelRuntimeProfileRecord>) {
  const registry = readRuntimeProfileRegistry();
  const now = new Date().toISOString();
  const baseId = readString(input.id) || slugify(readString(input.label, "runtime-profile"));
  const id = baseId || `runtime-profile-${Date.now()}`;
  const existing = registry.profiles.find((profile) => profile.id === id);
  const nextProfile: ModelRuntimeProfileRecord = {
    id,
    label: readString(input.label, existing?.label || "Runtime profile"),
    description: readString(input.description, existing?.description || ""),
    targetId: readString(input.targetId, existing?.targetId || "local-qwen3-0.6b"),
    temperature: clampNumber(input.temperature, existing?.temperature ?? 0.2, 0, 2),
    contextWindow: Math.round(clampNumber(input.contextWindow, existing?.contextWindow ?? 8192, 1024, 262144)),
    enableTools: typeof input.enableTools === "boolean" ? input.enableTools : existing?.enableTools ?? true,
    enableRetrieval:
      typeof input.enableRetrieval === "boolean" ? input.enableRetrieval : existing?.enableRetrieval ?? false,
    thinkingMode: normalizeThinkingMode(input.thinkingMode ?? existing?.thinkingMode),
    providerProfile: normalizeProviderProfile(input.providerProfile ?? existing?.providerProfile),
    hardwareBudget: readString(input.hardwareBudget, existing?.hardwareBudget || ""),
    ragPolicy: readString(input.ragPolicy, existing?.ragPolicy || ""),
    source: "user",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const profiles = registry.profiles
    .filter((profile) => profile.source === "builtin" || profile.id !== id)
    .concat(nextProfile);
  const nextRegistry: RuntimeProfileRegistry = {
    schemaVersion: "model-runtime-profiles.v1",
    generatedAt: now,
    profiles,
  };
  writeJsonFile(PROFILE_REGISTRY_FILE, nextRegistry);
  return nextProfile;
}

export function deleteRuntimeProfile(id: string) {
  const registry = readRuntimeProfileRegistry();
  const target = registry.profiles.find((profile) => profile.id === id);
  if (!target || target.source === "builtin") return false;
  const nextRegistry: RuntimeProfileRegistry = {
    schemaVersion: "model-runtime-profiles.v1",
    generatedAt: new Date().toISOString(),
    profiles: registry.profiles.filter((profile) => profile.id !== id),
  };
  writeJsonFile(PROFILE_REGISTRY_FILE, nextRegistry);
  return true;
}

export function readIdleUnloadConfig(): LocalServerIdleUnloadConfig {
  const now = new Date().toISOString();
  return readJsonFile<LocalServerIdleUnloadConfig>(IDLE_UNLOAD_CONFIG_FILE, {
    schemaVersion: "local-server-idle-unload.v1",
    enabled: false,
    idleMinutes: 20,
    memoryPressureRelease: true,
    preserveAdapters: true,
    applyMode: "config-only",
    updatedAt: now,
    notes: [
      "Config is persisted for the local gateway daemon.",
      "The gateway should release the loaded model after idleMinutes once daemon-managed mode is wired.",
    ],
  });
}

export function updateIdleUnloadConfig(input: Partial<LocalServerIdleUnloadConfig>) {
  const current = readIdleUnloadConfig();
  const next: LocalServerIdleUnloadConfig = {
    schemaVersion: "local-server-idle-unload.v1",
    enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
    idleMinutes: Math.round(clampNumber(input.idleMinutes, current.idleMinutes, 1, 240)),
    memoryPressureRelease:
      typeof input.memoryPressureRelease === "boolean"
        ? input.memoryPressureRelease
        : current.memoryPressureRelease,
    preserveAdapters:
      typeof input.preserveAdapters === "boolean" ? input.preserveAdapters : current.preserveAdapters,
    applyMode: input.applyMode === "daemon-managed" ? "daemon-managed" : "config-only",
    updatedAt: new Date().toISOString(),
    notes: Array.isArray(input.notes) ? input.notes.filter((note): note is string => typeof note === "string") : current.notes,
  };
  writeJsonFile(IDLE_UNLOAD_CONFIG_FILE, next);
  return next;
}

function readJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

function average(values: number[]) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (!numbers.length) return null;
  return Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1));
}

function resolveEndpointForTarget(target?: { baseUrlEnv?: string; baseUrlDefault?: string }) {
  if (target) {
    return (
      (target.baseUrlEnv ? process.env[target.baseUrlEnv] : "") ||
      target.baseUrlDefault ||
      DEFAULT_LOCAL_SERVER_BASE_URL
    ).replace(/\/$/, "");
  }
  return (
    process.env.LOCAL_OPENAI_COMPAT_BASE_URL ||
    process.env.OPENAI_COMPATIBLE_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    DEFAULT_LOCAL_SERVER_BASE_URL
  ).replace(/\/$/, "");
}

function resolveKeyStatusForTarget(target: { execution?: string; apiKeyEnv?: string }, endpoint: string) {
  if (
    target.execution === "local" ||
    endpoint.includes("localhost") ||
    endpoint.includes("127.0.0.1")
  ) {
    return "not-required" as const;
  }
  return target.apiKeyEnv && process.env[target.apiKeyEnv] ? "configured" as const : "missing" as const;
}

function buildDeveloperApiGuide(targetId?: string): ModelRuntimeDeveloperApiGuide {
  const target = targetId ? listServerAgentTargets().find((item) => item.id === targetId) : undefined;
  const endpoint = resolveEndpointForTarget(target);
  const model = targetId || process.env.LOCAL_OPENAI_COMPAT_MODEL || "local-qwen35-4b-4bit";
  const apiKeyEnv = target?.apiKeyEnv || "LOCAL_OPENAI_COMPAT_API_KEY";
  const keyStatus = resolveKeyStatusForTarget(target || { execution: "local", apiKeyEnv }, endpoint);
  return {
    endpoint,
    chatCompletionsUrl: `${endpoint}/chat/completions`,
    modelsUrl: `${endpoint}/models`,
    apiKeyEnv,
    keyStatus,
    curlExample: [
      `curl ${endpoint}/chat/completions \\`,
      `  -H "Authorization: Bearer $${apiKeyEnv}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"model":"${model}","messages":[{"role":"user","content":"ping"}],"temperature":0.2}'`,
    ].join("\n"),
    openaiSdkExample: [
      "import OpenAI from \"openai\";",
      `const client = new OpenAI({ baseURL: "${endpoint}", apiKey: process.env.${apiKeyEnv} || "local" });`,
      `const response = await client.chat.completions.create({ model: "${model}", messages: [{ role: "user", content: "ping" }] });`,
    ].join("\n"),
    tokenAccountingFields: [
      "usage.promptTokens",
      "usage.completionTokens",
      "usage.totalTokens",
    ],
    latencyFields: [
      "latencyMs",
      "firstTokenLatencyMs",
      "tokenThroughputTps",
    ],
  };
}

function buildRuntimeTargetCards(input: {
  registry: RuntimeProfileRegistry;
  idleUnload: LocalServerIdleUnloadConfig;
  requestLogs: LocalServerRequestLogSummary;
}): ModelRuntimeTargetCard[] {
  return listServerAgentTargets()
    .filter((target) => target.transport === "openai-compatible")
    .map((target) => {
      const endpoint = resolveEndpointForTarget(target);
      const profiles = input.registry.profiles.filter((profile) => profile.targetId === target.id);
      const logs = input.requestLogs.entries.filter((entry) => entry.targetId === target.id);
      return {
        targetId: target.id,
        label: target.label,
        providerLabel: target.providerLabel,
        execution: target.execution,
        resolvedModel: target.modelDefault,
        endpoint,
        chatCompletionsUrl: `${endpoint}/chat/completions`,
        modelsUrl: `${endpoint}/models`,
        apiKeyEnv: target.apiKeyEnv,
        keyStatus: resolveKeyStatusForTarget(target, endpoint),
        recommendedContext: target.recommendedContext,
        recommendedContextWindow: target.recommendedContextWindow,
        memoryProfile: target.memoryProfile,
        profileCount: profiles.length,
        profileLabels: profiles.map((profile) => profile.label).slice(0, 3),
        toolEnabledProfileCount: profiles.filter((profile) => profile.enableTools).length,
        ragEnabledProfileCount: profiles.filter((profile) => profile.enableRetrieval).length,
        idleUnloadEnabled: input.idleUnload.enabled,
        idleMinutes: input.idleUnload.idleMinutes,
        requestCount: logs.length,
        failureCount: logs.filter((entry) => !entry.ok).length,
        totalTokens: logs.reduce((sum, entry) => sum + (entry.usage?.totalTokens || 0), 0),
        avgLatencyMs: average(logs.map((entry) => entry.latencyMs)),
        lastRequestAt: logs[0]?.completedAt,
      };
    })
    .sort((left, right) => {
      if (left.execution !== right.execution) return left.execution === "local" ? -1 : 1;
      if (right.profileCount !== left.profileCount) return right.profileCount - left.profileCount;
      return left.label.localeCompare(right.label);
    });
}

export function readLocalServerRequestLogs(options?: {
  targetId?: string;
  limit?: number;
}): LocalServerRequestLogSummary {
  const limit = Math.round(clampNumber(options?.limit, 40, 1, 200));
  const rows = readJsonl<LocalServerRequestLogEntry>(CHAT_HISTORY_FILE)
    .filter((row) => (options?.targetId ? row.targetId === options.targetId : true))
    .sort((left, right) => String(left.completedAt).localeCompare(String(right.completedAt)))
    .slice(-limit)
    .reverse();
  const ok = rows.filter((row) => row.ok).length;
  return {
    total: rows.length,
    ok,
    failed: rows.length - ok,
    avgLatencyMs: average(rows.map((row) => row.latencyMs)),
    totalTokens: rows.reduce((sum, row) => sum + (row.usage?.totalTokens || 0), 0),
    entries: rows,
  };
}

export function getRuntimeProfileStoragePaths() {
  ensureDataDir();
  return {
    dataDir: DATA_DIR,
    profileRegistryFile: PROFILE_REGISTRY_FILE,
    idleUnloadConfigFile: IDLE_UNLOAD_CONFIG_FILE,
    chatHistoryFile: CHAT_HISTORY_FILE,
  };
}

export function readModelRuntimeOperations(options?: {
  targetId?: string;
  logLimit?: number;
}): ModelRuntimeOperationsReadModel {
  const registry = readRuntimeProfileRegistry();
  const idleUnload = readIdleUnloadConfig();
  const requestLogs = readLocalServerRequestLogs({
    targetId: options?.targetId,
    limit: options?.logLimit,
  });
  return {
    contractVersion: MODEL_RUNTIME_OPERATIONS_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    capabilities: [
      "runtime-profiles",
      "request-logs",
      "idle-unload",
      "developer-api",
      "openai-compatible-server",
      "token-accounting",
      "latency-evidence",
    ],
    registry,
    idleUnload,
    requestLogs,
    developerApi: buildDeveloperApiGuide(options?.targetId),
    targetCards: buildRuntimeTargetCards({
      registry,
      idleUnload,
      requestLogs,
    }),
    paths: getRuntimeProfileStoragePaths(),
  };
}
