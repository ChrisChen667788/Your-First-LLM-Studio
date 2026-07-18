import { createHash } from "crypto";
import { readExtensionEcosystemAcceptanceEvidence } from "@/features/extensions/extension-ecosystem-acceptance";
import { readMcpFilesystemAcceptanceEvidence } from "@/features/extensions/mcp-filesystem-acceptance";
import { readMcpServerRegistry } from "@/features/extensions/mcp-server-registry";
import { readExtensionSandboxEvidence } from "@/features/extensions/process-sandbox";

export const EXTENSION_ECOSYSTEM_PROMOTION_SCHEMA_VERSION =
  "extensions.ecosystem-promotion.v1" as const;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildExtensionEcosystemPromotionEvidence() {
  const acceptance = readExtensionEcosystemAcceptanceEvidence();
  const latest = acceptance.latest || null;
  const mcp = readMcpFilesystemAcceptanceEvidence();
  const registry = readMcpServerRegistry();
  const sandbox = readExtensionSandboxEvidence();
  const localChecks = {
    unifiedAcceptancePassing: latest?.status === "pass",
    signedInstallUpdateRollback:
      latest?.checks.signedInstallAccepted === true &&
      latest?.checks.signedUpdateAccepted === true &&
      latest?.checks.rollbackRestoredPreviousVersion === true,
    maliciousAndIncompatibleRejected:
      latest?.checks.tamperedPackageRejected === true &&
      latest?.checks.traversalBundleRejected === true &&
      latest?.checks.dependencyConflictVisible === true,
    permissionAndSecretBoundaries:
      latest?.checks.permissionGrantLifecycle === true &&
      latest?.checks.secretScopeEnforced === true,
    osEnforcedSandbox:
      latest?.checks.osSandboxEnforced === true &&
      Boolean(sandbox.latestOsEnforcedPassing),
    realCommunityMcpServer:
      latest?.checks.realMcpServerAccepted === true &&
      mcp.latestPassing?.server.packageName ===
        "@modelcontextprotocol/server-filesystem",
    registryLifecycle:
      registry.totals.registered >= 1 &&
      registry.totals.enabled >= 1 &&
      registry.totals.passing >= 1,
  };
  const productionChecks = {
    independentPublisherTrustRoot: false,
    linuxBubblewrapOrContainerReceipt: false,
    windowsSandboxReceipt: false,
    remoteStreamableHttpOAuthReceipt: false,
  };
  const localBlockers = Object.entries(localChecks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Extension ecosystem local check failed: ${check}.`);
  const productionBlockers = [
    "An independently managed community publisher trust root and signing receipt are still required.",
    "A real Linux bubblewrap or container isolation receipt is still required.",
    "A real Windows sandbox acceptance receipt is still required.",
    "A remote MCP Streamable HTTP OAuth lifecycle receipt is still required.",
  ];
  const core = {
    schemaVersion: EXTENSION_ECOSYSTEM_PROMOTION_SCHEMA_VERSION,
    localStatus: localBlockers.length
      ? ("evidence-needed" as const)
      : ("pass" as const),
    productionStatus: "hold" as const,
    localChecks,
    productionChecks,
    localBlockers,
    productionBlockers,
    acceptanceDigest: latest?.evidenceDigest || null,
    mcpDigest: mcp.latestPassing?.evidenceDigest || null,
  };
  return {
    ok: true as const,
    ...core,
    generatedAt: new Date().toISOString(),
    evidenceDigest: digest(core),
    paths: {
      acceptance: acceptance.path,
      mcp: mcp.path,
      registry: registry.path,
    },
  };
}
