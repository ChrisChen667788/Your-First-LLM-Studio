import type { EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";

export function readProviderEvidenceCollectorPlans(): EvidenceCollectionPlan[] {
  return [
    {
      version: "v4.2.4",
      label: "Provider Catalog Collector",
      owner: "features/providers",
      track: "provider",
      kind: "collector",
      mode: "automatic",
      sourceMilestones: ["v4.0.0"],
      requiredInputs: ["provider account binding", "bounded model-list endpoint", "alias policy"],
      artifactKinds: ["account model catalog", "alias reconciliation", "probe timing"],
      executionSteps: ["discover account models", "normalize advertised ids", "classify alias migration", "seal receipt"],
      timeoutMs: 120_000,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 2_000, maxDelayMs: 30_000 },
      localGate: "A fresh account-visible catalog receipt is submitted and independently reviewed.",
      externalGate: "Provider account ownership and billing authority remain external.",
    },
    {
      version: "v4.2.5",
      label: "Routing Quality and Shadow Collector",
      owner: "features/providers",
      track: "evaluation",
      kind: "collector",
      mode: "operator-assisted",
      sourceMilestones: ["v4.0.1", "v4.0.2"],
      requiredInputs: ["pinned workload cohort", "evaluator revision", "selected and fallback targets"],
      artifactKinds: ["quality scorecard", "shadow replay ledger", "fallback divergence report"],
      executionSteps: ["freeze comparable cohort", "score every target", "replay route decisions", "review divergence"],
      timeoutMs: 30 * 60_000,
      retryPolicy: { maxAttempts: 2, baseDelayMs: 10_000, maxDelayMs: 60_000 },
      localGate: "Each source milestone has a current evaluator-bound receipt with at least twenty comparable samples.",
      externalGate: "Live-traffic authorization, provider cost ownership, and independent quality reproduction remain external.",
    },
  ];
}
