import { createHash } from "node:crypto";

import { readArtifactInstallLifecycleEvidence } from "@/features/artifacts/install-lifecycle";
import { readExtensionEcosystemAcceptanceEvidence } from "@/features/extensions/extension-ecosystem-acceptance";
import { readGovernanceAccessReviewEvidence } from "@/features/governance/access-review";
import { readSharedAssetAuditEvidence } from "@/features/governance/shared-asset-audit";

export const TEAM_STUDIO_MARKETPLACE_SCHEMA_VERSION =
  "governance.team-studio-marketplace.v1" as const;

export type MarketplaceInstallRequest = {
  workspaceId: string;
  actorWorkspaceId: string;
  actorRole: "viewer" | "builder" | "owner" | "security-admin";
  assetType: "profile" | "prompt" | "recipe" | "dataset" | "extension" | "workflow";
  publisherVerified: boolean;
  signatureVerified: boolean;
  independentReviewId?: string;
  revoked: boolean;
  rollbackArtifactId?: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function evaluateMarketplaceInstall(input: MarketplaceInstallRequest) {
  const blockers = [
    ...(input.workspaceId !== input.actorWorkspaceId ? ["Cross-workspace install is denied."] : []),
    ...(!["owner", "security-admin"].includes(input.actorRole)
      ? ["Only a workspace owner or security admin may install shared assets."]
      : []),
    ...(!input.publisherVerified ? ["Publisher identity is not verified."] : []),
    ...(!input.signatureVerified ? ["Artifact signature is not verified."] : []),
    ...(!input.independentReviewId ? ["Independent review is required."] : []),
    ...(input.revoked ? ["The artifact has been revoked."] : []),
    ...(!input.rollbackArtifactId ? ["A rollback artifact is required."] : []),
  ];
  const withoutDigest = {
    assetType: input.assetType,
    allowed: blockers.length === 0,
    blockers,
  };
  return { ...withoutDigest, decisionDigest: digest(withoutDigest) };
}

export function readTeamStudioMarketplaceEvidence() {
  const sharedAssets = readSharedAssetAuditEvidence();
  const access = readGovernanceAccessReviewEvidence();
  const install = readArtifactInstallLifecycleEvidence();
  const extensions = readExtensionEcosystemAcceptanceEvidence();
  const allowed = evaluateMarketplaceInstall({
    workspaceId: "workspace-a",
    actorWorkspaceId: "workspace-a",
    actorRole: "owner",
    assetType: "workflow",
    publisherVerified: true,
    signatureVerified: true,
    independentReviewId: "review-a",
    revoked: false,
    rollbackArtifactId: "workflow-previous",
  });
  const denied = evaluateMarketplaceInstall({
    workspaceId: "workspace-a",
    actorWorkspaceId: "workspace-b",
    actorRole: "builder",
    assetType: "extension",
    publisherVerified: false,
    signatureVerified: false,
    revoked: true,
  });
  const checks = {
    policyAllowsCompliantAsset: allowed.allowed,
    policyDeniesUnsafeAsset: !denied.allowed,
    sharedAssetAudit: Boolean(sharedAssets.latestPassing),
    accessReview: Boolean(access.latestPassing),
    installLifecycle: Boolean(install.latestPassing),
    extensionTrust: Boolean(extensions.latestPassing),
  };
  return {
    ok: true as const,
    schemaVersion: TEAM_STUDIO_MARKETPLACE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: checks.policyAllowsCompliantAsset && checks.policyDeniesUnsafeAsset ? "pass" as const : "hold" as const,
    localStatus: Object.values(checks).every(Boolean) ? "pass" as const : "hold" as const,
    productionStatus: "hold" as const,
    checks,
    probes: { allowed, denied },
    disclosure:
      "Marketplace admission is policy-driven and fail-closed. Organization identity, concurrent multi-user revisions, trust-root rotation, and independent acceptance remain external evidence.",
  };
}
