import { readMultimodalCapabilityRegistry } from "@/features/benchmark/multimodal-capability-registry";
import type { EvidenceOperationMilestoneSpec } from "@/features/evidence/operational-receipts";
import { operationalReadModelDigest } from "@/features/evidence/operational-receipts";

export function readMultimodalEvidenceOperationSpecs(): EvidenceOperationMilestoneSpec[] {
  const registry = readMultimodalCapabilityRegistry();
  const eligible = registry.protocols.reduce(
    (sum, protocol) => sum + protocol.eligibleTargetIds.length,
    0,
  );
  return [{
    version: "v4.0.7",
    label: "Licensed Multimodal Execution",
    owner: "features/benchmark",
    track: "evaluation",
    contract: "benchmark.licensed-multimodal-execution.v1",
    requiredMetrics: ["samples", "scored", "unsupportedSkipped"],
    currentSignal: {
      status: "hold",
      summary: `${registry.conformance.passed}/${registry.conformance.total} evaluator adapter checks pass with ${eligible} eligible target binding(s); licensed task execution is absent.`,
      evidenceDigest: operationalReadModelDigest(registry, "registryDigest"),
    },
    localGate: "Bind licensed assets, native media transport, model capability, evaluator revision, skip reasons, and sample outputs.",
    externalGate: "Dataset licensing, official submission, and independent score reproduction remain external.",
  }];
}
