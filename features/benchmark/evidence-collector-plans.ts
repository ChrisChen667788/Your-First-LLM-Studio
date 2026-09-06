import type { EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";

export function readBenchmarkEvidenceCollectorPlans(): EvidenceCollectionPlan[] {
  return [{
    version: "v4.2.8",
    label: "Licensed Multimodal Execution Collector",
    owner: "features/benchmark",
    track: "evaluation",
    kind: "collector",
    mode: "operator-assisted",
    sourceMilestones: ["v4.0.7"],
    requiredInputs: ["licensed asset manifest", "verified model modality", "native transport", "official evaluator revision"],
    artifactKinds: ["media execution ledger", "unsupported-target skips", "official evaluator output"],
    executionSteps: ["verify license and digest", "admit capable targets", "run native media task", "score or record bounded skip"],
    timeoutMs: 60 * 60_000,
    retryPolicy: { maxAttempts: 2, baseDelayMs: 10_000, maxDelayMs: 60_000 },
    localGate: "Every sample binds media, transformation, model, transport, evaluator, score, and skip reason.",
    externalGate: "Dataset licensing authority, official submission, and independent score reproduction remain external.",
  }];
}
