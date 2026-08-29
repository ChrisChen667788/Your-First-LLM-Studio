import {
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
} from "@/features/experiments/external-assurance-chain";
import { readGovernedAutonomyReadinessTrain } from "@/features/experiments/governed-autonomy-readiness-train";
import {
  readGovernedAutonomySourceSignals,
  type GovernedAutonomySourceSignalSnapshot,
} from "@/features/experiments/governed-autonomy-source-signals";
import {
  buildSourceBackedAssuranceProjection,
  type SourceBackedAssuranceDefinition,
} from "@/features/experiments/source-backed-assurance-projection";

export const OPEN_ECOSYSTEM_INTEROPERABILITY_SCHEMA_VERSION =
  "experiments.open-ecosystem-interoperability.v1" as const;

export const OPEN_ECOSYSTEM_INTEROPERABILITY_DEFINITIONS: SourceBackedAssuranceDefinition[] = [
  {
    version: "v2.7.0",
    key: "OPENAI_API_COMPATIBILITY",
    label: "OpenAI API Compatibility",
    schemaVersion: "enterprise.open-ecosystem-openai-api.v1",
    sourceSignalId: "openai-api-compatibility",
    sourceContracts: ["model discovery endpoint", "chat completion and streaming shapes", "usage, error, and request-ledger semantics"],
    externalBlocker: "Independent clients and runtime operators must verify supported SDKs, streaming, errors, accounting, and load behavior against deployed endpoints.",
    requiredAssertions: ["openai-api-conformance-verified", "client-compatibility-reviewed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.7.1",
    key: "MCP_EXTENSION_INTEROPERABILITY",
    label: "MCP Extension Interoperability",
    schemaVersion: "enterprise.open-ecosystem-mcp-extensions.v1",
    sourceSignalId: "mcp-extension-interoperability",
    sourceContracts: ["MCP registration and capability discovery", "tool annotations and permission mapping", "signed package, sandbox, lifecycle, and rollback"],
    externalBlocker: "Independent publishers and platform owners must verify remote transports, OAuth, trust roots, and Linux/Windows isolation.",
    requiredAssertions: ["mcp-interoperability-observed", "extension-portability-reviewed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.7.2",
    key: "ARTIFACT_MODEL_PORTABILITY",
    label: "Artifact and Model Portability",
    schemaVersion: "enterprise.open-ecosystem-artifact-model-portability.v1",
    sourceSignalId: "artifact-model-portability",
    sourceContracts: ["immutable Hub source and checksums", "multi-file acquisition and content addressing", "runtime compatibility, migration, removal, and rollback"],
    externalBlocker: "Independent Hub, storage, and runtime operators must import, verify, run, migrate, remove, and restore representative models and adapters.",
    requiredAssertions: ["artifact-portability-rehearsed", "model-readback-verified"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.7.3",
    key: "WORKSPACE_IDENTITY_PORTABILITY",
    label: "Workspace and Identity Portability",
    schemaVersion: "enterprise.open-ecosystem-workspace-identity.v1",
    sourceSignalId: "workspace-identity-portability",
    sourceContracts: ["organization, workspace, group, and role mapping", "OIDC and SCIM configuration boundary", "database enforcement, audit export, and deprovision"],
    externalBlocker: "Organization-controlled IdP, SCIM, database, and audit owners must verify real users, groups, lifecycle, conflicts, and cross-workspace isolation.",
    requiredAssertions: ["workspace-portability-reviewed", "identity-lifecycle-verified"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.7.4",
    key: "INDEPENDENT_INTEROPERABILITY_REVIEW",
    label: "Independent Interoperability Closure",
    schemaVersion: "enterprise.open-ecosystem-independent-closure.v1",
    sourceSignalId: "independent-interoperability-review",
    sourceContracts: ["ordered v2.7.0-v2.7.3 interoperability evidence", "independent client, publisher, and operator review", "immutable terminal archive"],
    externalBlocker: "A distinct client, publisher, operator, and assurance authority must sign and retain the complete interoperability package outside the Studio.",
    requiredAssertions: ["interoperability-chain-reviewed", "immutable-closure-retained"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

export function buildOpenEcosystemInteroperabilityState(input: {
  anchor: Parameters<typeof buildSourceBackedAssuranceProjection>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: GovernedAutonomySourceSignalSnapshot;
  now: number;
}) {
  return buildSourceBackedAssuranceProjection({
    definitions: OPEN_ECOSYSTEM_INTEROPERABILITY_DEFINITIONS,
    ...input,
  });
}

export function readOpenEcosystemInteroperabilityTrain() {
  const autonomy = readGovernedAutonomyReadinessTrain();
  const anchor = autonomy.versions.find((version) => version.version === "v2.6.9");
  const artifacts = OPEN_ECOSYSTEM_INTEROPERABILITY_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_OPEN_ECOSYSTEM_${definition.key}`),
  );
  return {
    ok: true as const,
    schemaVersion: OPEN_ECOSYSTEM_INTEROPERABILITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...buildOpenEcosystemInteroperabilityState({
      anchor: {
        version: "v2.6.9",
        evidenceStatus: anchor?.evidenceStatus || "missing",
        digest: anchor?.digest || null,
        recordId: anchor?.recordId || null,
        issuerOrganizationId: anchor?.issuerOrganizationId || null,
      },
      artifacts,
      sourceSignals: readGovernedAutonomySourceSignals(),
      now: Date.now(),
    }),
    configuredVersions: OPEN_ECOSYSTEM_INTEROPERABILITY_DEFINITIONS.filter(
      (_, index) => artifacts[index]?.present,
    ).map((definition) => definition.version),
  };
}
