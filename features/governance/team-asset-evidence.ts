import type { EvidenceOperationMilestoneSpec } from "@/features/evidence/operational-receipts";
import { operationalReadModelDigest } from "@/features/evidence/operational-receipts";
import { readTeamStudioMarketplaceEvidence } from "@/features/governance/team-studio-marketplace";

export function readGovernanceEvidenceOperationSpecs(): EvidenceOperationMilestoneSpec[] {
  const marketplace = readTeamStudioMarketplaceEvidence();
  return [{
    version: "v4.1.3",
    label: "Team Asset Conflict and Revocation",
    owner: "features/governance",
    track: "governance",
    contract: "governance.team-asset-conflict-revocation.v1",
    requiredMetrics: ["concurrentWriters", "conflicts", "revocations"],
    currentSignal: {
      status: marketplace.localStatus,
      summary: `${Object.values(marketplace.checks).filter(Boolean).length}/${Object.keys(marketplace.checks).length} local policy and lifecycle checks pass.`,
      evidenceDigest: operationalReadModelDigest(marketplace),
    },
    localGate: "Run concurrent writers, optimistic conflicts, review, signed install, revocation propagation, and rollback under real workspace identities.",
    externalGate: "OIDC/SCIM lifecycle, organization trust roots, and independent access review remain external.",
  }];
}
