import { randomUUID } from "node:crypto";

import {
  EVIDENCE_AUTHORITY_CAMPAIGN_PLANS,
  buildEvidenceAuthorityEscrowBundle,
  classifyEvidenceAuthorityReceipt,
  createEvidenceAuthorityAssignment,
  createEvidenceAuthorityCampaign,
  createEvidenceAuthorityChallenge,
  createEvidenceAuthorityCredentialReference,
  createEvidenceAuthorityProfile,
  createEvidenceAuthorityReceiptEnvelope,
  createEvidenceAuthorityTrustSnapshot,
  createUnconfiguredEvidenceAuthorityPort,
  validateEvidenceAuthorityAssignment,
  validateEvidenceAuthorityCampaign,
  validateEvidenceAuthorityCredentialReference,
  validateEvidenceAuthorityProfile,
  validateEvidenceAuthorityReceiptEnvelope,
  validateEvidenceAuthorityTrustSnapshot,
} from "@/features/evidence/authority-campaign";
import { readEvidenceAuthorityCampaignStore } from "@/features/evidence/authority-campaign-store";
import { evidenceAcceptanceDigest } from "@/features/evidence/acceptance-lifecycle";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_SCHEMA_VERSION = "experiments.evidence-authority-campaign-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("experiments", "v4.8.0-v4.9.4-evidence-authority-campaign-train.json");

const digest = (seed: string) => operationalEvidenceDigest({ seed });

function runAuthorityCampaignConformance() {
  const now = new Date();
  const credential = createEvidenceAuthorityCredentialReference({
    kind: "vault",
    reference: "vault://studio-org/evidence-authority-client",
  });
  const profile = createEvidenceAuthorityProfile({
    id: "studio-authority-profile",
    organizationId: "studio-org",
    authorityConfigDigest: digest("authority-config"),
    discoveryUrl: "https://authority.example.com/trust/discovery",
    challengeUrl: "https://authority.example.com/evidence/challenges",
    receiptUrl: "https://authority.example.com/evidence/receipts",
    credentialReference: credential,
    maxReceiptAgeHours: 72,
  });
  const snapshot = createEvidenceAuthorityTrustSnapshot({
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    issuerId: "studio-review-authority",
    jwksDigest: digest("jwks"),
    archivePolicyDigest: digest("archive-policy"),
    observedAt: now.toISOString(),
  });
  const campaign = createEvidenceAuthorityCampaign({
    idempotencyKey: "source-authority-campaign",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const assignments = EVIDENCE_COLLECTION_SOURCE_MILESTONES.map((sourceMilestone, index) => createEvidenceAuthorityAssignment({
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    sourceMilestone,
    observerId: `observer-${String(index + 1).padStart(2, "0")}`,
    assignedBy: "coordinator-001",
    assignedAt: now.toISOString(),
  }));
  const challenge = createEvidenceAuthorityChallenge({
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    profileDigest: profile.profileDigest,
    packageId: "package-v400-001",
    sourceMilestone: EVIDENCE_COLLECTION_SOURCE_MILESTONES[0],
    nonceDigest: digest("challenge-nonce"),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
  });
  const envelope = createEvidenceAuthorityReceiptEnvelope({
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    challengeDigest: challenge.challengeDigest,
    profileDigest: profile.profileDigest,
    packageId: challenge.packageId,
    sourceMilestone: challenge.sourceMilestone,
    outcome: "verified",
    signerKeyFingerprint: digest("authority-signing-key"),
    observedAt: now.toISOString(),
  });
  const record = classifyEvidenceAuthorityReceipt({ envelope, profile, campaign, challenge, now: now.getTime() });
  const escrow = buildEvidenceAuthorityEscrowBundle({ profile, campaign, assignments, receipts: [record], now: now.getTime() });
  return {
    checks: {
      credential: validateEvidenceAuthorityCredentialReference(credential).ok,
      profile: validateEvidenceAuthorityProfile(profile).ok,
      snapshot: validateEvidenceAuthorityTrustSnapshot(snapshot, profile, now.getTime()).ok,
      campaign: validateEvidenceAuthorityCampaign(campaign, profile, now.getTime()).ok,
      assignments: assignments.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length && assignments.every((assignment) => validateEvidenceAuthorityAssignment(assignment, campaign).ok),
      challenge: challenge.campaignDigest === campaign.campaignDigest && challenge.profileDigest === profile.profileDigest,
      receipt: validateEvidenceAuthorityReceiptEnvelope(envelope, profile, campaign, challenge, now.getTime()).ok,
      quarantine: record.disposition === "accepted-for-binding" && record.reason === null,
      escrow: escrow.coveredMilestones.length === 1 && escrow.status === "hold",
      unconfiguredPortConstructed: Boolean(createUnconfiguredEvidenceAuthorityPort()),
    },
  };
}

export function buildEvidenceAuthorityCampaignTrainState() {
  const conformance = runAuthorityCampaignConformance();
  const store = readEvidenceAuthorityCampaignStore();
  const deterministic = new Set([
    "v4.8.0", "v4.8.1", "v4.8.4", "v4.8.5", "v4.8.6",
    "v4.8.7", "v4.8.9", "v4.9.0", "v4.9.2",
  ]);
  const checksPass = Object.values(conformance.checks).every(Boolean);
  const acceptedForBinding = store.receipts.filter((record) => record.disposition === "accepted-for-binding" && record.envelope.outcome === "verified");
  const quarantinedReceipts = store.receipts.filter((record) => record.disposition === "quarantined");
  const assignedMilestones = new Set(store.assignments.map((assignment) => assignment.sourceMilestone));
  const acceptedMilestones = new Set(acceptedForBinding.map((record) => record.envelope.sourceMilestone));
  const coveredMilestones = EVIDENCE_COLLECTION_SOURCE_MILESTONES.filter((milestone) => assignedMilestones.has(milestone) && acceptedMilestones.has(milestone));
  const versions = EVIDENCE_AUTHORITY_CAMPAIGN_PLANS.map((plan) => {
    const localPass = deterministic.has(plan.version) && checksPass;
    return {
      ...plan,
      sourceStatus: "pass" as const,
      localStatus: localPass ? "pass" as const : "hold" as const,
      externalStatus: "hold" as const,
      productionStatus: "blocked" as const,
      coverage: coveredMilestones.length,
      blockers: localPass
        ? []
        : plan.requiresExternalReceipt
          ? [`Current externally attested receipt coverage is ${coveredMilestones.length}/14.`]
          : ["A controlled external authority connection is required for this capability."],
    };
  });
  const localPassed = versions.filter((version) => version.localStatus === "pass").length;
  const core = versions.map((version) => ({
    version: version.version,
    localStatus: version.localStatus,
    coverage: version.coverage,
    blockers: version.blockers,
  }));
  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass" as const,
    localStatus: localPassed === versions.length ? "pass" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    totals: {
      versions: EVIDENCE_AUTHORITY_CAMPAIGN_PLANS.length,
      sourcePassed: versions.length,
      localPassed,
      localHeld: versions.length - localPassed,
      registeredProfiles: store.profiles.length,
      campaigns: store.campaigns.length,
      acceptedForBinding: acceptedForBinding.length,
      quarantinedReceipts: quarantinedReceipts.length,
      coveredMilestones: coveredMilestones.length,
    },
    conformance,
    versions,
    disclosure: "All v4.8-v4.9 source contracts are implemented. A profile, opaque credential reference, local campaign, injected port, or accepted-for-binding envelope does not prove an externally controlled authority, immutable archive, independent observer, distribution decision, or production authority.",
    stateDigest: evidenceAcceptanceDigest({ core, campaignStoreRevision: store.revision }),
  };
}

export function buildEvidenceAuthorityCampaignPromotionBundle() {
  const state = buildEvidenceAuthorityCampaignTrainState();
  const core = {
    schemaVersion: "experiments.evidence-authority-campaign-promotion-bundle.v1" as const,
    generatedAt: new Date().toISOString(),
    status: state.totals.coveredMilestones === 14 ? "ready-for-independent-review" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    trainStateDigest: state.stateDigest,
    coveredMilestones: state.totals.coveredMilestones,
    remainingDomains: 14 - state.totals.coveredMilestones,
    handoffBacklog: state.versions.filter((version) => version.externalStatus === "hold").map((version) => ({ version: version.version, gate: version.externalGate })),
  };
  return { ...core, evidenceDigest: evidenceAcceptanceDigest(core) };
}

export function runEvidenceAuthorityCampaignTrainAcceptance() {
  const state = buildEvidenceAuthorityCampaignTrainState();
  const withoutDigest = { id: `evidence-authority-campaign-train-${randomUUID()}`, ...state };
  const receipt = { ...withoutDigest, evidenceDigest: evidenceAcceptanceDigest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readEvidenceAuthorityCampaignTrainEvidence() {
  const state = buildEvidenceAuthorityCampaignTrainState();
  const receipts = readDurableReceipts<ReturnType<typeof runEvidenceAuthorityCampaignTrainAcceptance>>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  return {
    ok: true as const,
    schemaVersion: "experiments.evidence-authority-campaign-train.v1" as const,
    ...state,
    promotionBundle: buildEvidenceAuthorityCampaignPromotionBundle(),
    latest: receipts[0]?.stateDigest === state.stateDigest ? receipts[0] : null,
    receipts,
    paths: {
      trainReceipts: RECEIPT_PATH,
      authorityCampaigns: getLocalAgentDataPath("experiments", "v4.8.0-v4.9.4-evidence-authority-campaigns.json"),
    },
  };
}
