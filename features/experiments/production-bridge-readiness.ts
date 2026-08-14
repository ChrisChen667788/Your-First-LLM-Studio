import { readQualityArtifactBindingEvidence } from "@/features/evaluation/quality-artifact-binding";
import { readEnterpriseIdpAdapterReadiness } from "@/features/governance/enterprise-idp-adapter";
import { readRemoteWorkerFailoverEvidence } from "@/features/workflows/remote-worker-failover";

export const PRODUCTION_BRIDGE_READINESS_SCHEMA_VERSION =
  "experiments.production-bridge-readiness.v1" as const;

export function readProductionBridgeReadiness() {
  const identity = readEnterpriseIdpAdapterReadiness();
  const worker = readRemoteWorkerFailoverEvidence();
  const quality = readQualityArtifactBindingEvidence();
  const bridges = [
    {
      id: "enterprise-idp-scim",
      label: "Enterprise IdP / SCIM",
      localStatus: identity.latest?.status || "evidence-needed",
      productionStatus: "hold" as const,
      summary: identity.latest
        ? `${identity.latest.scim.users} users and ${identity.latest.scim.groups} groups verified.`
        : identity.configured
          ? "Provider configured; probe or sync receipt is still required."
          : "OIDC issuer/client and external SCIM provider are not configured.",
      blockers: identity.productionBlockers,
    },
    {
      id: "postgres-worker-failover",
      label: "PostgreSQL worker failover",
      localStatus: worker.latest?.localStatus || "evidence-needed",
      productionStatus: "hold" as const,
      summary: worker.latest
        ? `Fence ${worker.latest.evidence.initialFenceToken} -> ${worker.latest.evidence.recoveredFenceToken}; process-isolated recovery recorded.`
        : "PostgreSQL process-isolated failover rehearsal is still required.",
      blockers: worker.productionBlockers,
    },
    {
      id: "quality-artifact-binding",
      label: "Quality CI artifact binding",
      localStatus: quality.latest?.status || "evidence-needed",
      productionStatus: "hold" as const,
      summary: quality.latest
        ? `${quality.latest.inventory.benchmarkRuns} benchmark runs; ${quality.latest.inventory.pairedScoredSamples} paired scored samples across ${quality.latest.inventory.pairedSeeds} seeds.`
        : "Real Benchmark and Fine-tune repositories are not bound yet.",
      blockers: quality.productionBlockers,
    },
  ];
  return {
    ok: true as const,
    schemaVersion: PRODUCTION_BRIDGE_READINESS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: bridges.every((bridge) => bridge.localStatus === "pass")
      ? "pass" as const
      : "hold" as const,
    productionStatus: "hold" as const,
    bridges,
  };
}
