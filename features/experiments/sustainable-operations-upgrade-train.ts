import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import { readOperationalRemediationEfficiencyTrain } from "@/features/experiments/operational-remediation-efficiency-train";
import {
  readOperationalSustainabilitySourceSignals,
  type OperationalSustainabilitySourceSignalId,
  type OperationalSustainabilitySourceSignalSnapshot,
} from "@/features/experiments/operational-sustainability-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const SUSTAINABLE_OPERATIONS_UPGRADE_SCHEMA_VERSION =
  "experiments.sustainable-operations-upgrade.v1" as const;

export const SUSTAINABLE_OPERATIONS_UPGRADE_DEFINITIONS: Array<
  SourceBackedAssuranceDefinition<OperationalSustainabilitySourceSignalId>
> = [
  {
    version: "v2.9.0", key: "TELEMETRY_RESOURCE_TRANSPARENCY", label: "Telemetry and Resource Transparency", schemaVersion: "enterprise.sustainable-operations-telemetry.v1", sourceSignalId: "telemetry-resource-transparency",
    sourceContracts: ["shared trace adapter and configured exporter", "latency, queue, token, memory, throughput, and error receipts", "resource and cost attribution without secret disclosure"],
    externalBlocker: "Observability, infrastructure, and finance owners must validate deployed traces, retention, sampling, resource attribution, and billing reconciliation.", requiredAssertions: ["telemetry-export-observed", "resource-attribution-reviewed"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v2.9.1", key: "INCIDENT_DIAGNOSTICS_RETENTION", label: "Incident Diagnostics and Evidence Retention", schemaVersion: "enterprise.sustainable-operations-incident-diagnostics.v1", sourceSignalId: "incident-diagnostics-retention",
    sourceContracts: ["connection checks and provider evidence snapshots", "service supervisor degradation and recovery", "integrity-checked retention and export"],
    externalBlocker: "Support and SRE owners must replay real incidents, verify escalation, retention, redaction, and recovery outcomes.", requiredAssertions: ["incident-replay-complete", "diagnostic-retention-verified"], minObservationWindowHours: 168, minimumCoveragePct: 95, requireSecondaryDigest: true,
  },
  {
    version: "v2.9.2", key: "ADMIN_COMPATIBILITY_SUNSET", label: "Admin Compatibility Sunset Readiness", schemaVersion: "enterprise.sustainable-operations-admin-sunset.v1", sourceSignalId: "admin-compatibility-sunset",
    sourceContracts: ["canonical replacement for every legacy route", "compatibility smoke and source-tagged usage", "zero-runtime-hit evidence window and historical archive"],
    externalBlocker: "Gateway and product owners must approve the final zero-traffic window and customer communication before wrapper deletion.", requiredAssertions: ["legacy-callers-cleared", "compatibility-sunset-approved"], minObservationWindowHours: 720, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v2.9.3", key: "DESKTOP_UPGRADE_DATA_LIFECYCLE", label: "Desktop Upgrade and Data Lifecycle Assurance", schemaVersion: "enterprise.sustainable-operations-desktop-upgrade.v1", sourceSignalId: "desktop-upgrade-data-lifecycle",
    sourceContracts: ["signed update channel, staged activation, and rollback", "atomic data migration, backup, restore, uninstall, and purge", "bounded permission repair and symlink denial"],
    externalBlocker: "Apple release, clean-machine, support, and privacy owners must validate notarized packages, real upgrades, rollback, backup, restore, and deletion.", requiredAssertions: ["desktop-upgrade-rehearsed", "desktop-data-lifecycle-reviewed"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true,
  },
  {
    version: "v2.9.4", key: "INDEPENDENT_SUSTAINABLE_OPERATIONS_REVIEW", label: "Independent Sustainable Operations Closure", schemaVersion: "enterprise.sustainable-operations-independent-closure.v1", sourceSignalId: "independent-sustainable-operations-review",
    sourceContracts: ["ordered v2.9.0-v2.9.3 sustainability evidence", "distinct observability, support, upgrade, and customer reviewers", "immutable terminal archive and predecessor binding"],
    externalBlocker: "A distinct assurance authority must sign and retain the complete sustainable-operations package outside the Studio.", requiredAssertions: ["sustainable-operations-reviewed", "sustainable-closure-retained"], minObservationWindowHours: 24, minimumCoveragePct: 100, requireSecondaryDigest: true, finalReview: true,
  },
];

export function buildSustainableOperationsUpgradeState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: OperationalSustainabilitySourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: SUSTAINABLE_OPERATIONS_UPGRADE_DEFINITIONS,
    ...input,
  });
}

export function readSustainableOperationsUpgradeTrain() {
  const remediation = readOperationalRemediationEfficiencyTrain();
  const anchor = remediation.versions.find((version) => version.version === "v2.8.9");
  const artifacts = SUSTAINABLE_OPERATIONS_UPGRADE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_SUSTAINABLE_OPERATIONS_${definition.key}`),
  );
  return {
    ok: true as const,
    schemaVersion: SUSTAINABLE_OPERATIONS_UPGRADE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildSustainableOperationsUpgradeState({
      anchor: { version: "v2.8.9", evidenceStatus: anchor?.evidenceStatus || "missing", digest: anchor?.digest || null, recordId: anchor?.recordId || null, issuerOrganizationId: anchor?.issuerOrganizationId || null },
      artifacts,
      sourceSignals: readOperationalSustainabilitySourceSignals(),
      now: Date.now(),
    }),
    configuredVersions: SUSTAINABLE_OPERATIONS_UPGRADE_DEFINITIONS.filter((_, index) => artifacts[index]?.present).map((definition) => definition.version),
  };
}
