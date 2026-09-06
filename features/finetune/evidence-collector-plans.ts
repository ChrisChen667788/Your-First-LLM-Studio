import type { EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";

export function readFineTuneEvidenceCollectorPlans(): EvidenceCollectionPlan[] {
  return [{
    version: "v4.3.2",
    label: "Federated Training Dispatch Collector",
    owner: "features/finetune",
    track: "finetune",
    kind: "collector",
    mode: "operator-assisted",
    sourceMilestones: ["v4.1.2"],
    requiredInputs: ["frozen recipe", "dataset digest", "eligible backend capabilities", "worker identities"],
    artifactKinds: ["worker receipts", "checkpoint lineage", "metrics and charts", "comparable export packages"],
    executionSteps: ["negotiate capabilities", "dispatch frozen recipe", "collect checkpoints and metrics", "verify comparable exports"],
    timeoutMs: 24 * 60 * 60_000,
    retryPolicy: { maxAttempts: 2, baseDelayMs: 60_000, maxDelayMs: 10 * 60_000 },
    localGate: "At least one comparable non-MLX execution binds recipe, dataset, checkpoints, quality, charts, export, and checksums.",
    externalGate: "Managed compute identity, base-model license, registry read-back, and independent quality review remain external.",
  }];
}
