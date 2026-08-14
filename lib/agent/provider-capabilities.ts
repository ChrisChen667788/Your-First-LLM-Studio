import type { AgentThinkingMode, ResolvedTarget } from "@/lib/agent/types";

export const PROVIDER_CAPABILITY_SCHEMA_VERSION =
  "providers.capability-route.v1" as const;

export type ProviderCapabilityRoute = {
  schemaVersion: typeof PROVIDER_CAPABILITY_SCHEMA_VERSION;
  target: ResolvedTarget;
  fallbackTargets: ResolvedTarget[];
  advertisedModels: string[];
  probed: boolean;
  warning?: string;
};

type CachedModels = {
  expiresAt: number;
  models: string[];
};

const modelCache = new Map<string, CachedModels>();
const CAPABILITY_CACHE_TTL_MS = 5 * 60_000;

function uniqueModels(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function probeAdvertisedModels(
  target: ResolvedTarget,
  fetchImpl: typeof fetch,
) {
  const cacheKey = `${target.id}:${target.resolvedBaseUrl}`;
  const cached = modelCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
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

export async function resolveProviderCapabilityRoute(input: {
  target: ResolvedTarget;
  thinkingMode: AgentThinkingMode;
  candidateModels?: string[];
  fetchImpl?: typeof fetch;
}): Promise<ProviderCapabilityRoute> {
  const { target } = input;
  if (target.id !== "deepseek-api") {
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
  ]);
  try {
    const advertisedModels = await probeAdvertisedModels(
      target,
      input.fetchImpl || fetch,
    );
    const available = candidates.filter((model) =>
      advertisedModels.includes(model),
    );
    const selectedModel = available[0] || target.resolvedModel;
    const fallbackModels = available.filter((model) => model !== selectedModel);
    const selectedTarget = { ...target, resolvedModel: selectedModel };
    return {
      schemaVersion: PROVIDER_CAPABILITY_SCHEMA_VERSION,
      target: selectedTarget,
      fallbackTargets: fallbackModels.map((resolvedModel) => ({
        ...target,
        resolvedModel,
      })),
      advertisedModels,
      probed: true,
      warning:
        selectedModel !== target.resolvedModel
          ? `DeepSeek capability routing selected ${selectedModel} because ${target.resolvedModel} is not advertised for this account.`
          : undefined,
    };
  } catch (error) {
    return {
      schemaVersion: PROVIDER_CAPABILITY_SCHEMA_VERSION,
      target,
      fallbackTargets: candidates
        .filter((model) => model !== target.resolvedModel)
        .map((resolvedModel) => ({ ...target, resolvedModel })),
      advertisedModels: [],
      probed: false,
      warning: `DeepSeek capability probe failed; using configured model order. ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
