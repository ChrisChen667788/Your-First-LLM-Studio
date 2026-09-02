import { createHash } from "node:crypto";

import { agentTargets } from "@/lib/agent/catalog";
import { getBenchmarkTargetCapability } from "@/features/benchmark/model-capabilities";
import { runMultimodalEvaluatorConformance } from "@/features/benchmark/multimodal-official-evaluators";

export const MULTIMODAL_CAPABILITY_REGISTRY_SCHEMA_VERSION =
  "benchmark.multimodal-capability-registry.v1" as const;

const PROTOCOLS = [
  { id: "mmmu", modalities: ["text", "image"], judge: "deterministic-choice", sourceUrl: "https://mmmu-benchmark.github.io/" },
  { id: "mathvista", modalities: ["text", "image"], judge: "audited-extraction", sourceUrl: "https://mathvista.github.io/" },
  { id: "mmbench", modalities: ["text", "image"], judge: "official-submission", sourceUrl: "https://mmbench.opencompass.org.cn/" },
  { id: "video-mme-v2", modalities: ["text", "video"], judge: "deterministic-choice", sourceUrl: "https://video-mme.github.io/" },
] as const;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function readMultimodalCapabilityRegistry() {
  const targets = agentTargets.map((target) => {
    const capability = getBenchmarkTargetCapability(target);
    return {
      targetId: target.id,
      label: target.label,
      configuredModel: target.modelDefault,
      evidenceStatus: capability.evidenceStatus,
      officialDocsUrl: capability.officialDocsUrl || null,
      modelModalities: capability.modelModalities,
      transportModalities: capability.transportModalities,
      effectiveModalities: capability.effectiveModalities,
      reason: capability.reason,
    };
  });
  const conformance = runMultimodalEvaluatorConformance();
  const protocols = PROTOCOLS.map((protocol) => ({
    ...protocol,
    evaluatorStatus: conformance.passed === conformance.total ? "pass" as const : "hold" as const,
    eligibleTargetIds: targets
      .filter((target) => protocol.modalities.every((modality) => target.effectiveModalities.includes(modality)))
      .map((target) => target.targetId),
  }));
  const withoutDigest = {
    ok: true as const,
    schemaVersion: MULTIMODAL_CAPABILITY_REGISTRY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: conformance.passed === conformance.total ? "pass" as const : "hold" as const,
    localStatus: protocols.some((protocol) => protocol.eligibleTargetIds.length) ? "pass" as const : "hold" as const,
    productionStatus: "hold" as const,
    targets,
    protocols,
    conformance: { total: conformance.total, passed: conformance.passed },
    policy: {
      officialModelDocumentationRequired: true,
      modelAndTransportMustSupportModality: true,
      unsupportedTasksFailClosedWithSourceLink: true,
    },
  };
  return { ...withoutDigest, registryDigest: digest(withoutDigest) };
}
