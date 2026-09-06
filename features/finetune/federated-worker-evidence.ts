import type { EvidenceOperationMilestoneSpec } from "@/features/evidence/operational-receipts";
import { operationalReadModelDigest } from "@/features/evidence/operational-receipts";
import { readFineTuneBackendFederation } from "@/features/finetune/backend-federation";

export function readFineTuneEvidenceOperationSpecs(): EvidenceOperationMilestoneSpec[] {
  const federation = readFineTuneBackendFederation();
  const plans = federation.plans;
  const planState = operationalReadModelDigest({
    ...plans,
    sample: operationalReadModelDigest(plans.sample),
    preview: operationalReadModelDigest(plans.preview),
    previews: Object.fromEntries(Object.entries(plans.previews).map(([key, plan]) => [key, operationalReadModelDigest(plan)])),
  });
  const executable = federation.backends.filter((backend) => backend.status === "implemented").length;
  return [{
    version: "v4.1.2",
    label: "Federated Training Workers",
    owner: "features/finetune",
    track: "finetune",
    contract: "finetune.federated-worker-receipts.v1",
    requiredMetrics: ["workers", "completedRuns", "artifactChecksums"],
    currentSignal: {
      status: "hold",
      summary: `${executable}/${federation.backends.length} backend(s) are executable; no comparable non-MLX worker receipt is promoted.`,
      evidenceDigest: operationalReadModelDigest({ ...federation, plans: planState }, "federationDigest"),
    },
    localGate: "Execute the same frozen recipe on eligible backends and bind dataset, args, checkpoints, metrics, charts, exports, and checksums.",
    externalGate: "Managed compute identity, licensed base model, remote registry read-back, and independent quality review remain external.",
  }];
}
