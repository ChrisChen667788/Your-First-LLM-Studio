import { createHash } from "node:crypto";

import { readTrainingCapabilityRegistry } from "@/features/finetune/training-capabilities";
import { readTrainingExecutionPlanCatalog } from "@/features/finetune/training-execution-plan";

export const FINETUNE_BACKEND_FEDERATION_SCHEMA_VERSION =
  "finetune.backend-federation.v1" as const;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function readFineTuneBackendFederation() {
  const capabilities = readTrainingCapabilityRegistry();
  const plans = readTrainingExecutionPlanCatalog();
  const backends = capabilities.backends.map((backend) => ({
    id: backend.id,
    status: backend.status,
    platforms: backend.platforms,
    methods: backend.methods,
    distributed: backend.distributed,
    negotiatedFields: [
      "method",
      "quantizationBits",
      "scheduler",
      "packingPolicy",
      "bestCheckpointMetric",
      "targetModules",
      "distributed",
    ],
    artifactContract: {
      adapter: "adapter/",
      checkpoints: "checkpoints/",
      report: "report.json",
      recipe: "recipe.json",
      provenance: "provenance.json",
      checksums: "checksums.sha256",
    },
  }));
  const withoutDigest = {
    ok: true as const,
    schemaVersion: FINETUNE_BACKEND_FEDERATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: backends.length >= 4 ? "pass" as const : "hold" as const,
    localStatus: capabilities.totals.implemented > 0 ? "pass" as const : "hold" as const,
    productionStatus: "hold" as const,
    backends,
    plans,
    policy: {
      unsupportedParameterFailsBeforeQueue: true,
      previewBackendExecutionAllowed: false,
      unifiedArtifactContractRequired: true,
    },
  };
  return { ...withoutDigest, federationDigest: digest(withoutDigest) };
}
