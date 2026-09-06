import type { AgentThinkingMode, ResolvedTarget } from "@/lib/agent/types";

export const PROVIDER_CAPABILITY_SCHEMA_VERSION =
  "providers.capability-route.v1" as const;

export type ProviderCapabilityRoute = {
  schemaVersion: typeof PROVIDER_CAPABILITY_SCHEMA_VERSION;
  target: ResolvedTarget;
  fallbackTargets: ResolvedTarget[];
  advertisedModels: string[];
  probed: boolean;
  sourceUrl?: string;
  deprecatedModels?: string[];
  capabilities?: {
    text: boolean;
    vision: boolean | "probe-required";
    tools: boolean | "probe-required";
    structuredOutput: boolean | "probe-required";
    thinking: boolean | "probe-required";
  };
  warning?: string;
};

type CachedModels = {
  expiresAt: number;
  models: string[];
};

const modelCache = new Map<string, CachedModels>();
const CAPABILITY_CACHE_TTL_MS = 5 * 60_000;

type ProviderDiscoveryPolicy = {
  candidates: string[];
  deprecatedModels: string[];
  sourceUrl: string;
  capabilities: NonNullable<ProviderCapabilityRoute["capabilities"]>;
};

const PROVIDER_DISCOVERY_POLICIES: Record<string, ProviderDiscoveryPolicy> = {
  "openai-codex": {
    candidates: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
    deprecatedModels: ["gpt-5.3-codex", "gpt-5.2-codex"],
    sourceUrl: "https://developers.openai.com/api/docs/models",
    capabilities: { text: true, vision: true, tools: true, structuredOutput: true, thinking: true },
  },
  "openai-gpt54": {
    candidates: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
    deprecatedModels: ["gpt-5.5", "gpt-5.4"],
    sourceUrl: "https://developers.openai.com/api/docs/models",
    capabilities: { text: true, vision: true, tools: true, structuredOutput: true, thinking: true },
  },
  "anthropic-claude": {
    candidates: ["claude-fable-5", "claude-opus-5", "claude-sonnet-5"],
    deprecatedModels: ["claude-opus-4-7", "claude-opus-4-6-thinking"],
    sourceUrl: "https://platform.claude.com/docs/en/models/overview",
    capabilities: { text: true, vision: true, tools: true, structuredOutput: "probe-required", thinking: true },
  },
  "deepseek-api": {
    candidates: ["deepseek-v4-pro", "deepseek-v4-flash"],
    deprecatedModels: ["deepseek-chat", "deepseek-reasoner"],
    sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing",
    capabilities: { text: true, vision: false, tools: true, structuredOutput: true, thinking: true },
  },
  "minimax-m3": {
    candidates: ["MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M3"],
    deprecatedModels: [],
    sourceUrl: "https://platform.minimax.io/docs/guides/models-intro",
    capabilities: { text: true, vision: "probe-required", tools: "probe-required", structuredOutput: "probe-required", thinking: true },
  },
  "kimi-api": {
    candidates: ["kimi-k2.6", "kimi-k2.5"],
    deprecatedModels: ["kimi-latest", "kimi-k2"],
    sourceUrl: "https://platform.kimi.com/docs/models",
    capabilities: { text: true, vision: true, tools: true, structuredOutput: "probe-required", thinking: true },
  },
  "glm-api": {
    candidates: ["glm-5.2", "glm-5.1", "glm-5"],
    deprecatedModels: [],
    sourceUrl: "https://docs.bigmodel.cn/cn/guide/models/text/glm-5.2",
    capabilities: { text: true, vision: false, tools: true, structuredOutput: true, thinking: true },
  },
  "qwen-api": {
    candidates: ["qwen3-max", "qwen3-coder-plus", "qwen3-max-preview"],
    deprecatedModels: [],
    sourceUrl: "https://help.aliyun.com/zh/model-studio/getting-started/models",
    capabilities: { text: true, vision: "probe-required", tools: true, structuredOutput: true, thinking: true },
  },
};

function uniqueModels(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function probeAdvertisedModels(
  target: ResolvedTarget,
  fetchImpl: typeof fetch,
  freshProbe = false,
) {
  const cacheKey = `${target.id}:${target.resolvedBaseUrl}`;
  const cached = modelCache.get(cacheKey);
  if (!freshProbe && cached && cached.expiresAt > Date.now()) {
    return cached.models;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetchImpl(`${target.resolvedBaseUrl}/models`, {
      headers: target.resolvedApiKey
        ? { Authorization: `Bearer ${target.resolvedApiKey}` }
        : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`model catalog returned ${response.status}`);
    }
    const payload = (await response.json()) as {
      data?: Array<{ id?: unknown }>;
    };
    const models = uniqueModels(
      (payload.data || []).map((entry) =>
        typeof entry.id === "string" ? entry.id : "",
      ),
    );
    modelCache.set(cacheKey, {
      expiresAt: Date.now() + CAPABILITY_CACHE_TTL_MS,
      models,
    });
    return models;
  } finally {
    clearTimeout(timer);
  }
}

export function clearProviderCapabilityCache() {
  modelCache.clear();
}

export function readProviderDiscoveryPolicy(targetId: string) {
  return PROVIDER_DISCOVERY_POLICIES[targetId] || null;
}

export async function resolveProviderCapabilityRoute(input: {
  target: ResolvedTarget;
  thinkingMode: AgentThinkingMode;
  candidateModels?: string[];
  fetchImpl?: typeof fetch;
  freshProbe?: boolean;
}): Promise<ProviderCapabilityRoute> {
  const { target } = input;
  const policy = PROVIDER_DISCOVERY_POLICIES[target.id];
  if (target.execution !== "remote" || !policy) {
    return {
      schemaVersion: PROVIDER_CAPABILITY_SCHEMA_VERSION,
      target,
      fallbackTargets: [],
      advertisedModels: [],
      probed: false,
    };
  }

  const candidates = uniqueModels([
    target.resolvedModel,
    ...(input.candidateModels || []),
    ...policy.candidates,
  ]);
  const fallbackTargets = candidates
    .filter((model) => model !== target.resolvedModel)
    .map((resolvedModel) => ({ ...target, resolvedModel }));
  const base = {
    schemaVersion: PROVIDER_CAPABILITY_SCHEMA_VERSION,
    sourceUrl: policy.sourceUrl,
    deprecatedModels: policy.deprecatedModels,
    capabilities: policy.capabilities,
  };
  if (!target.resolvedApiKey || /\.example(?:\/|$)/u.test(target.resolvedBaseUrl)) {
    return {
      ...base,
      target,
      fallbackTargets,
      advertisedModels: [],
      probed: false,
      warning: `${target.label} model discovery is unavailable until its endpoint and API key are configured.`,
    };
  }
  try {
    const advertisedModels = await probeAdvertisedModels(
      target,
      input.fetchImpl || fetch,
      input.freshProbe,
    );
    const available = candidates.filter((model) =>
      advertisedModels.includes(model),
    );
    const selectedModel = available[0] || target.resolvedModel;
    const fallbackModels = available.filter((model) => model !== selectedModel);
    const selectedTarget = { ...target, resolvedModel: selectedModel };
    return {
      ...base,
      target: selectedTarget,
      fallbackTargets: fallbackModels.map((resolvedModel) => ({
        ...target,
        resolvedModel,
      })),
      advertisedModels,
      probed: true,
      warning:
        selectedModel !== target.resolvedModel
          ? `${target.label} capability routing selected ${selectedModel} because ${target.resolvedModel} is not advertised for this account.`
          : policy.deprecatedModels.includes(selectedModel)
            ? `${selectedModel} is deprecated by the pinned official catalog and should be migrated.`
            : undefined,
    };
  } catch (error) {
    return {
      ...base,
      target,
      fallbackTargets,
      advertisedModels: [],
      probed: false,
      warning: `${target.label} capability probe failed; using configured model order. ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
