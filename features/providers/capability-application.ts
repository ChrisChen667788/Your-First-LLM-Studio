import {
  readProviderDiscoveryPolicy,
  resolveProviderCapabilityRoute,
} from "@/lib/agent/provider-capabilities";
import { resolveTargetWithMode } from "@/lib/agent/providers";
import { listServerAgentTargets } from "@/lib/agent/server-targets";
import type { AgentThinkingMode } from "@/lib/agent/types";

export const PROVIDER_CAPABILITY_APPLICATION_SCHEMA_VERSION =
  "providers.capability-discovery.v1" as const;

function configured(target: ReturnType<typeof listServerAgentTargets>[number]) {
  if (target.execution === "local" || !target.apiKeyEnv) return true;
  return Boolean(process.env[target.apiKeyEnv]);
}

export function readProviderCapabilityCatalog() {
  const targets = listServerAgentTargets().map((target) => {
    const policy = readProviderDiscoveryPolicy(target.id);
    return {
      targetId: target.id,
      label: target.label,
      provider: target.providerLabel,
      execution: target.execution,
      configured: configured(target),
      configuredModel: target.modelDefault,
      modelsEndpoint: `${target.baseUrlDefault.replace(/\/$/u, "")}/models`,
      sourceUrl: policy?.sourceUrl || null,
      officialCandidates: policy?.candidates || [],
      deprecatedModels: policy?.deprecatedModels || [],
      capabilities: policy?.capabilities || {
        text: true,
        vision: "probe-required" as const,
        tools: target.supportsTools,
        structuredOutput: "probe-required" as const,
        thinking: Boolean(target.thinkingModelDefault),
      },
      discoveryState:
        target.execution === "local"
          ? "local-registry"
          : configured(target)
            ? "probe-ready"
            : "configuration-required",
    };
  });
  return {
    ok: true as const,
    schemaVersion: PROVIDER_CAPABILITY_APPLICATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    targets,
    totals: {
      targets: targets.length,
      remote: targets.filter((entry) => entry.execution === "remote").length,
      configuredRemote: targets.filter(
        (entry) => entry.execution === "remote" && entry.configured,
      ).length,
      probeReady: targets.filter((entry) => entry.discoveryState === "probe-ready").length,
      deprecatedAliases: targets.reduce(
        (sum, entry) => sum + entry.deprecatedModels.length,
        0,
      ),
    },
    policy: {
      paidInferenceRequired: false,
      modelListProbeBeforeInference: true,
      unsupportedCapabilityFailsClosed: true,
      sourceLinkRequired: true,
    },
  };
}

export async function probeProviderCapabilityTarget(input: {
  targetId: string;
  thinkingMode?: AgentThinkingMode;
  fetchImpl?: typeof fetch;
  freshProbe?: boolean;
}) {
  const catalog = readProviderCapabilityCatalog();
  const catalogTarget = catalog.targets.find((entry) => entry.targetId === input.targetId);
  if (!catalogTarget) throw new Error(`Unknown provider target: ${input.targetId}`);
  if (catalogTarget.execution !== "remote") {
    return {
      ok: true as const,
      schemaVersion: PROVIDER_CAPABILITY_APPLICATION_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      target: catalogTarget,
      route: null,
      state: "local-registry" as const,
    };
  }
  if (!catalogTarget.configured) {
    return {
      ok: true as const,
      schemaVersion: PROVIDER_CAPABILITY_APPLICATION_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      target: catalogTarget,
      route: null,
      state: "configuration-required" as const,
    };
  }
  const resolved = resolveTargetWithMode(
    input.targetId,
    input.thinkingMode || "standard",
  );
  const route = await resolveProviderCapabilityRoute({
    target: resolved,
    thinkingMode: input.thinkingMode || "standard",
    candidateModels: catalogTarget.officialCandidates,
    fetchImpl: input.fetchImpl,
    freshProbe: input.freshProbe,
  });
  return {
    ok: true as const,
    schemaVersion: PROVIDER_CAPABILITY_APPLICATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    target: catalogTarget,
    route: {
      selectedModel: route.target.resolvedModel,
      fallbackModels: route.fallbackTargets.map((entry) => entry.resolvedModel),
      advertisedModels: route.advertisedModels,
      probed: route.probed,
      warning: route.warning || null,
      capabilities: route.capabilities || catalogTarget.capabilities,
      sourceUrl: route.sourceUrl || catalogTarget.sourceUrl,
    },
    state: route.probed ? "probed" as const : "configured-fallback" as const,
  };
}
