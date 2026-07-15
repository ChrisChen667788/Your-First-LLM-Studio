import { readDeploymentControlPlane } from "@/features/deployment/control-plane";

export const HA_FINOPS_READINESS_SCHEMA_VERSION =
  "deployment.ha-finops-readiness.v1" as const;

export function readHaFinOpsReadiness() {
  const deployment = readDeploymentControlPlane();
  const checks = [
    {
      id: "usage-outbox",
      status: deployment.controlPlane.usageOutbox.records > 0 ? "pass" as const : "watch" as const,
      summary: `${deployment.controlPlane.usageOutbox.records} durable usage record(s).`,
    },
    {
      id: "audit-archive",
      status: deployment.controlPlane.auditArchive.immutableArchivedEvents > 0 ? "pass" as const : "watch" as const,
      summary: `${deployment.controlPlane.auditArchive.immutableArchivedEvents} immutable archive event(s).`,
    },
    {
      id: "verified-signing",
      status: deployment.controlPlane.kmsSigning.verifiedReceipts > 0 ? "pass" as const : "watch" as const,
      summary: `${deployment.controlPlane.kmsSigning.verifiedReceipts} verified receipt(s), ${deployment.controlPlane.kmsSigning.verifiedCloudReceipts} cloud receipt(s).`,
    },
    {
      id: "failover-rehearsal",
      status: deployment.controlPlane.failover.rehearsals > 0 ? "pass" as const : "watch" as const,
      summary: `${deployment.controlPlane.failover.rehearsals} rehearsal(s) recorded.`,
    },
    {
      id: "cloud-production",
      status: deployment.productionReadiness.blockers.length === 0 ? "pass" as const : "blocked" as const,
      summary:
        deployment.productionReadiness.blockers.length === 0
          ? "Cloud production evidence is complete."
          : "Cloud production evidence remains fail-closed.",
    },
  ];
  return {
    ok: true as const,
    schemaVersion: HA_FINOPS_READINESS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    checks,
    localReadiness: deployment.localReadiness,
    productionReadiness: deployment.productionReadiness,
    metrics: {
      usageRecords: deployment.controlPlane.usageOutbox.records,
      pendingUsageRecords: deployment.controlPlane.usageOutbox.pending,
      immutableArchiveEvents: deployment.controlPlane.auditArchive.immutableArchivedEvents,
      verifiedReceipts: deployment.controlPlane.kmsSigning.verifiedReceipts,
      verifiedCloudReceipts: deployment.controlPlane.kmsSigning.verifiedCloudReceipts,
      failoverRehearsals: deployment.controlPlane.failover.rehearsals,
      latestRpoMs: deployment.controlPlane.failover.latestRpoMs ?? null,
      latestRtoMs: deployment.controlPlane.failover.latestRtoMs ?? null,
    },
    blockers: deployment.productionReadiness.blockers,
  };
}
