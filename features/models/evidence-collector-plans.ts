import type { EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";

export function readModelEvidenceCollectorPlans(): EvidenceCollectionPlan[] {
  return [{
    version: "v4.2.9",
    label: "Model Transfer and Runtime Collector",
    owner: "features/models",
    track: "models",
    kind: "collector",
    mode: "automatic",
    sourceMilestones: ["v4.0.8", "v4.0.9"],
    requiredInputs: ["authenticated immutable source", "file manifest", "runtime profile", "load plan"],
    artifactKinds: ["transfer receipt", "checksum read-back", "runtime activation", "load and drain report"],
    executionSteps: ["transfer and resume", "verify every file", "migrate and activate", "load, cancel, drain, rollback and unload"],
    timeoutMs: 2 * 60 * 60_000,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 5_000, maxDelayMs: 120_000 },
    localGate: "Authenticated bytes and request-level runtime behavior are linked by one reviewed provenance chain.",
    externalGate: "Hub ownership, license review, independent load generation, and SLO acceptance remain external.",
  }];
}
