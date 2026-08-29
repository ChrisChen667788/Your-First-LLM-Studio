import { createHash } from "node:crypto";

import { readExtensionEcosystemAcceptanceEvidence } from "@/features/extensions/extension-ecosystem-acceptance";
import { readMcpFilesystemAcceptanceEvidence } from "@/features/extensions/mcp-filesystem-acceptance";
import { readMcpServerRegistry } from "@/features/extensions/mcp-server-registry";
import { readExtensionRegistryFoundation } from "@/features/extensions/registry";
import { readEnterpriseIdpAdapterReadiness } from "@/features/governance/enterprise-idp-adapter";
import { readWorkspaceActionProvenanceEvidence } from "@/features/governance/workspace-action-provenance";
import { readWorkspaceIdentityFoundation } from "@/features/governance/workspace-identity";
import { readModelSupplyChainOperationsEvidence } from "@/features/models/supply-chain-operations-evidence";
import { readOpenAiCompatibleConformance } from "@/features/runtime/openai-compatible-conformance";
import { readOperationalSourceSignals } from "@/features/experiments/operational-source-signals";

export const GOVERNED_AUTONOMY_SOURCE_SIGNALS_SCHEMA_VERSION =
  "experiments.governed-autonomy-source-signals.v1" as const;

export type GovernedAutonomySourceSignalId =
  | "model-selection-policy"
  | "provider-routing-safety"
  | "grounded-context-policy"
  | "tool-permission-policy"
  | "protected-action-approval"
  | "workflow-replay-safety"
  | "benchmark-quality-policy"
  | "adapter-rollback-policy"
  | "audit-provenance"
  | "independent-autonomy-review"
  | "openai-api-compatibility"
  | "mcp-extension-interoperability"
  | "artifact-model-portability"
  | "workspace-identity-portability"
  | "independent-interoperability-review";

export type GovernedAutonomySourceSignalStatus =
  | "pass"
  | "attention"
  | "unavailable"
  | "external-only";

export type GovernedAutonomySourceSignal = {
  id: GovernedAutonomySourceSignalId;
  label: string;
  status: GovernedAutonomySourceSignalStatus;
  summary: string;
  checks: Record<string, boolean>;
  metrics: Record<string, string | number | boolean | null>;
  blockers: string[];
  evidenceUri: string;
};

export type GovernedAutonomySourceSignalSnapshot = {
  ok: true;
  schemaVersion: typeof GOVERNED_AUTONOMY_SOURCE_SIGNALS_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "attention";
  summary: {
    totalSignals: number;
    sourceOwnedSignals: number;
    passingSignals: number;
    attentionSignals: number;
    unavailableSignals: number;
    externalOnlySignals: number;
  };
  signals: GovernedAutonomySourceSignal[];
  stateDigest: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sourceSignal(
  input: Omit<GovernedAutonomySourceSignal, "status">,
): GovernedAutonomySourceSignal {
  return {
    ...input,
    status: Object.values(input.checks).every(Boolean) ? "pass" : "attention",
  };
}

function unavailableSignal(input: {
  id: GovernedAutonomySourceSignalId;
  label: string;
  evidenceUri: string;
  error: unknown;
}): GovernedAutonomySourceSignal {
  return {
    id: input.id,
    label: input.label,
    status: "unavailable",
    summary: "The feature-owned read model could not be projected without side effects.",
    checks: { readSucceeded: false },
    metrics: {},
    blockers: [
      input.error instanceof Error ? input.error.message : "Source signal read failed.",
    ],
    evidenceUri: input.evidenceUri,
  };
}

function externalOnlySignal(
  id: GovernedAutonomySourceSignalId,
  label: string,
): GovernedAutonomySourceSignal {
  return {
    id,
    label,
    status: "external-only",
    summary: "Only an independently signed review may satisfy this milestone.",
    checks: { localSubstitutionDenied: true },
    metrics: {},
    blockers: [
      "Repository fixtures, local operators, and self-authored receipts cannot replace the independent review.",
    ],
    evidenceUri: "/experiments",
  };
}

function trySignal(
  identity: Pick<GovernedAutonomySourceSignal, "id" | "label" | "evidenceUri">,
  reader: () => GovernedAutonomySourceSignal,
) {
  try {
    return reader();
  } catch (error) {
    return unavailableSignal({ ...identity, error });
  }
}

export function buildGovernedAutonomySourceSignalSnapshot(
  signals: GovernedAutonomySourceSignal[],
): GovernedAutonomySourceSignalSnapshot {
  const sourceOwned = signals.filter((entry) => entry.status !== "external-only");
  const withoutDigest = {
    ok: true as const,
    schemaVersion: GOVERNED_AUTONOMY_SOURCE_SIGNALS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: sourceOwned.every((entry) => entry.status === "pass")
      ? ("pass" as const)
      : ("attention" as const),
    summary: {
      totalSignals: signals.length,
      sourceOwnedSignals: sourceOwned.length,
      passingSignals: signals.filter((entry) => entry.status === "pass").length,
      attentionSignals: signals.filter((entry) => entry.status === "attention").length,
      unavailableSignals: signals.filter((entry) => entry.status === "unavailable").length,
      externalOnlySignals: signals.filter((entry) => entry.status === "external-only").length,
    },
    signals,
  };
  return {
    ...withoutDigest,
    stateDigest: createHash("sha256").update(stableJson(withoutDigest)).digest("hex"),
  };
}

export function readGovernedAutonomySourceSignals() {
  const operational = readOperationalSourceSignals();
  const byId = new Map(operational.signals.map((entry) => [entry.id, entry]));

  function operationalPolicy(input: {
    id: GovernedAutonomySourceSignalId;
    label: string;
    sourceIds: Array<Parameters<typeof byId.get>[0]>;
    evidenceUri: string;
    summary: string;
  }) {
    return trySignal(
      { id: input.id, label: input.label, evidenceUri: input.evidenceUri },
      () => {
        const sources = input.sourceIds.map((id) => byId.get(id));
        const checks = Object.fromEntries(
          input.sourceIds.map((id, index) => [
            `${id}Ready`,
            sources[index]?.status === "pass",
          ]),
        );
        const blockers = sources.flatMap((entry, index) =>
          entry?.status === "pass"
            ? []
            : entry?.blockers.length
              ? entry.blockers
              : [`${input.sourceIds[index]} source signal is unavailable.`],
        );
        return sourceSignal({
          id: input.id,
          label: input.label,
          summary: input.summary,
          checks,
          metrics: Object.fromEntries(
            input.sourceIds.map((id, index) => [
              `${id}Status`,
              sources[index]?.status || "unavailable",
            ]),
          ),
          blockers,
          evidenceUri: input.evidenceUri,
        });
      },
    );
  }

  const signals: GovernedAutonomySourceSignal[] = [
    operationalPolicy({
      id: "model-selection-policy",
      label: "Model selection policy",
      sourceIds: ["runtime-fleet", "benchmark-drift"],
      evidenceUri: "/models",
      summary: "Runtime conformance and qualified benchmark evidence jointly constrain model selection.",
    }),
    operationalPolicy({
      id: "provider-routing-safety",
      label: "Provider routing and fallback safety",
      sourceIds: ["provider-reliability", "workload-slo"],
      evidenceUri: "/admin",
      summary: "Observed provider traffic, failures, and workload SLOs gate fallback routing.",
    }),
    operationalPolicy({
      id: "grounded-context-policy",
      label: "Grounded context and retrieval policy",
      sourceIds: ["retrieval-drift"],
      evidenceUri: "/retrieval",
      summary: "Citation, replay, deletion, and ACL evidence constrain grounded context assembly.",
    }),
    trySignal(
      { id: "tool-permission-policy", label: "Tool permission and extension policy", evidenceUri: "/agent" },
      () => {
        const foundation = readExtensionRegistryFoundation();
        const acceptance = readExtensionEcosystemAcceptanceEvidence();
        const checks = {
          trustPolicyDeclared: foundation.policy.requireDigest && foundation.policy.requireSignatureForCommunity,
          sensitivePermissionsRequireConfirmation:
            foundation.policy.confirmationPermissions.includes("command:execute") &&
            foundation.policy.confirmationPermissions.includes("secret:read"),
          builtinManifestsValid: foundation.packages.every((entry) => entry.validation.valid),
          lifecycleAcceptanceAvailable: Boolean(acceptance.latestPassing),
        };
        return sourceSignal({
          id: "tool-permission-policy",
          label: "Tool permission and extension policy",
          summary: `${foundation.packages.length} built-ins use signed manifest, permission-review, and rollback contracts.`,
          checks,
          metrics: {
            builtinPackages: foundation.packages.length,
            confirmationPermissions: foundation.policy.confirmationPermissions.length,
            acceptanceReceipts: acceptance.receipts.length,
          },
          blockers: Object.entries(checks)
            .filter(([, passed]) => !passed)
            .map(([check]) => `Extension policy check requires attention: ${check}.`),
          evidenceUri: "/agent",
        });
      },
    ),
    operationalPolicy({
      id: "protected-action-approval",
      label: "Protected action approval",
      sourceIds: ["agent-action-safety"],
      evidenceUri: "/agent",
      summary: "Protected actions require interrupt, approval, idempotent resume, and zero duplicate side effects.",
    }),
    operationalPolicy({
      id: "workflow-replay-safety",
      label: "Workflow checkpoint and replay safety",
      sourceIds: ["workflow-recovery"],
      evidenceUri: "/workflows",
      summary: "Typed executors, checkpoints, replay, and lease recovery form the workflow safety boundary.",
    }),
    operationalPolicy({
      id: "benchmark-quality-policy",
      label: "Benchmark-backed quality policy",
      sourceIds: ["benchmark-drift"],
      evidenceUri: "/benchmarks",
      summary: "Pinned datasets and deterministic evaluators gate quality-sensitive promotion decisions.",
    }),
    operationalPolicy({
      id: "adapter-rollback-policy",
      label: "Adapter selection and rollback policy",
      sourceIds: ["finetune-roi"],
      evidenceUri: "/fine-tune",
      summary: "Paired quality, best checkpoint, package read-back, and rollback constrain adapter promotion.",
    }),
    trySignal(
      { id: "audit-provenance", label: "Audit and provenance projection", evidenceUri: "/experiments" },
      () => {
        const provenance = readWorkspaceActionProvenanceEvidence();
        const dataBoundary = byId.get("data-sovereignty");
        const checks = {
          workspaceProvenanceAvailable: Boolean(provenance.latestPassing),
          dataBoundaryProjected: dataBoundary?.status === "pass",
          identifiersPersistedAsDigests: provenance.latestPassing
            ? Object.values(provenance.latestPassing.audit).every((value) => /^[a-f0-9]{64}$/iu.test(value))
            : false,
        };
        return sourceSignal({
          id: "audit-provenance",
          label: "Audit and provenance projection",
          summary: "Workspace action digests and data-boundary signals preserve audit provenance without storing raw identities.",
          checks,
          metrics: {
            provenanceReceipts: provenance.receipts.length,
            dataSovereigntyStatus: dataBoundary?.status || "unavailable",
          },
          blockers: [
            ...Object.entries(checks)
              .filter(([, passed]) => !passed)
              .map(([check]) => `Audit provenance check requires attention: ${check}.`),
            ...(!dataBoundary || dataBoundary.status === "pass" ? [] : dataBoundary.blockers),
          ],
          evidenceUri: "/experiments",
        });
      },
    ),
    externalOnlySignal("independent-autonomy-review", "Independent governed autonomy review"),
    trySignal(
      { id: "openai-api-compatibility", label: "OpenAI API compatibility", evidenceUri: "/models/runtime" },
      () => {
        const conformance = readOpenAiCompatibleConformance();
        const checks = {
          conformanceObserved: conformance.reports.length > 0,
          completePassingReport: Boolean(conformance.latestPassing),
        };
        return sourceSignal({
          id: "openai-api-compatibility",
          label: "OpenAI API compatibility",
          summary: `${conformance.reports.length} local server conformance reports cover models, chat, response, and usage shapes.`,
          checks,
          metrics: {
            reports: conformance.reports.length,
            latestPassingServer: conformance.latestPassing?.serverId || null,
            latestPassingModel: conformance.latestPassing?.model || null,
          },
          blockers: Object.entries(checks)
            .filter(([, passed]) => !passed)
            .map(([check]) => `OpenAI-compatible conformance requires attention: ${check}.`),
          evidenceUri: "/models/runtime",
        });
      },
    ),
    trySignal(
      { id: "mcp-extension-interoperability", label: "MCP extension interoperability", evidenceUri: "/agent" },
      () => {
        const registry = readMcpServerRegistry();
        const filesystem = readMcpFilesystemAcceptanceEvidence();
        const ecosystem = readExtensionEcosystemAcceptanceEvidence();
        const checks = {
          serverRegistered: registry.totals.registered > 0,
          passingServerProbe: registry.totals.passing > 0,
          filesystemAcceptance: Boolean(filesystem.latestPassing),
          ecosystemAcceptance: Boolean(ecosystem.latestPassing),
        };
        return sourceSignal({
          id: "mcp-extension-interoperability",
          label: "MCP extension interoperability",
          summary: `${registry.totals.passing}/${registry.totals.registered} registered MCP servers pass their latest probe.`,
          checks,
          metrics: {
            registeredServers: registry.totals.registered,
            passingServers: registry.totals.passing,
            filesystemReceipts: filesystem.receipts.length,
          },
          blockers: Object.entries(checks)
            .filter(([, passed]) => !passed)
            .map(([check]) => `MCP interoperability requires attention: ${check}.`),
          evidenceUri: "/agent",
        });
      },
    ),
    trySignal(
      { id: "artifact-model-portability", label: "Artifact and model portability", evidenceUri: "/models" },
      () => {
        const supplyChain = readModelSupplyChainOperationsEvidence();
        const checks = {
          localSupplyChainPassing: supplyChain.localStatus === "pass",
          immutableRevisionBound: supplyChain.checks.immutableAuthenticatedHubReceipt,
          multiFileChecksumsBound: supplyChain.checks.multiFileChecksumsBound,
          activationRollbackRehearsed: supplyChain.checks.activationRollbackRehearsed,
        };
        return sourceSignal({
          id: "artifact-model-portability",
          label: "Artifact and model portability",
          summary: "Immutable Hub revisions, multi-file checksums, migration, compatibility, and rollback form the portability contract.",
          checks,
          metrics: {
            hubFiles: supplyChain.summary.hubFiles,
            verifiedHubChecksums: supplyChain.summary.verifiedHubChecksums,
            localStatus: supplyChain.localStatus,
          },
          blockers: supplyChain.blockers,
          evidenceUri: "/models",
        });
      },
    ),
    trySignal(
      { id: "workspace-identity-portability", label: "Workspace and identity portability", evidenceUri: "/admin" },
      () => {
        const workspace = readWorkspaceIdentityFoundation();
        const idp = readEnterpriseIdpAdapterReadiness();
        const checks = {
          localAccessDecisionPassing: workspace.sampleDecision.allowed,
          enforcementLayersDeclared: workspace.enforcementLayers.length >= 4,
          externalIdentityConfigurationVisible: idp.configured || idp.productionStatus === "hold",
        };
        return sourceSignal({
          id: "workspace-identity-portability",
          label: "Workspace and identity portability",
          summary: "Workspace roles, enforcement layers, and explicit IdP/SCIM configuration state are projected without exporting credentials.",
          checks,
          metrics: {
            governanceMode: workspace.mode,
            enforcementLayers: workspace.enforcementLayers.length,
            idpConfigured: idp.configured,
            oidcConfigured: idp.oidc.configured,
            scimConfigured: idp.scim.configured,
          },
          blockers: [
            ...Object.entries(checks)
              .filter(([, passed]) => !passed)
              .map(([check]) => `Workspace identity portability requires attention: ${check}.`),
            ...workspace.blockers,
            ...idp.productionBlockers,
          ],
          evidenceUri: "/admin",
        });
      },
    ),
    externalOnlySignal(
      "independent-interoperability-review",
      "Independent interoperability closure",
    ),
  ];

  return buildGovernedAutonomySourceSignalSnapshot(signals);
}
