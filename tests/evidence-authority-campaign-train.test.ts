import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_AUTHORITY_CAMPAIGN_PLANS,
  EvidenceAuthorityCampaignError,
  appendEvidenceAuthorityReceipt,
  classifyEvidenceAuthorityReceipt,
  createEvidenceAuthorityAssignment,
  createEvidenceAuthorityCampaign,
  createEvidenceAuthorityChallenge,
  createEvidenceAuthorityCredentialReference,
  createEvidenceAuthorityProfile,
  createEvidenceAuthorityReceiptEnvelope,
  createEvidenceAuthorityTrustSnapshot,
  emptyEvidenceAuthorityCampaignStore,
  executeEvidenceAuthorityChallenge,
  insertEvidenceAuthorityCampaign,
  insertEvidenceAuthorityProfile,
  validateEvidenceAuthorityCampaignStore,
  validateEvidenceAuthorityCredentialReference,
  validateEvidenceAuthorityProfile,
  validateEvidenceAuthorityReceiptEnvelope,
} from "@/features/evidence/authority-campaign";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { evidenceAcceptanceDigest } from "@/features/evidence/acceptance-lifecycle";
import { buildEvidenceAuthorityCampaignTrainState } from "@/features/experiments/evidence-authority-campaign-train";

const digest = (seed: string) => evidenceAcceptanceDigest({ seed });

function fixture() {
  const now = new Date();
  const credential = createEvidenceAuthorityCredentialReference({ kind: "vault", reference: "vault://studio-org/evidence-authority-client" });
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
  const campaign = createEvidenceAuthorityCampaign({
    idempotencyKey: "authority-campaign-test-001",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const challenge = createEvidenceAuthorityChallenge({
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    profileDigest: profile.profileDigest,
    packageId: "package-v400-001",
    sourceMilestone: "v4.0.0",
    nonceDigest: digest("nonce"),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
  });
  const snapshot = createEvidenceAuthorityTrustSnapshot({
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    issuerId: "studio-review-authority",
    jwksDigest: digest("jwks"),
    archivePolicyDigest: digest("archive"),
    observedAt: now.toISOString(),
  });
  const envelope = createEvidenceAuthorityReceiptEnvelope({
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    challengeDigest: challenge.challengeDigest,
    profileDigest: profile.profileDigest,
    packageId: challenge.packageId,
    sourceMilestone: challenge.sourceMilestone,
    outcome: "verified",
    signerKeyFingerprint: digest("signer"),
    observedAt: now.toISOString(),
  });
  return { now, credential, profile, campaign, challenge, snapshot, envelope };
}

test("v4.8-v4.9 catalog retains fifteen exact authority campaign boundaries", () => {
  assert.equal(EVIDENCE_AUTHORITY_CAMPAIGN_PLANS.length, 15);
  assert.deepEqual(
    EVIDENCE_AUTHORITY_CAMPAIGN_PLANS.map((plan) => plan.version),
    ["v4.8.0", "v4.8.1", "v4.8.2", "v4.8.3", "v4.8.4", "v4.8.5", "v4.8.6", "v4.8.7", "v4.8.8", "v4.8.9", "v4.9.0", "v4.9.1", "v4.9.2", "v4.9.3", "v4.9.4"],
  );
  assert.ok(EVIDENCE_AUTHORITY_CAMPAIGN_PLANS.every((plan) => plan.localGate && plan.externalGate));
});

test("credential references are opaque and profiles reject local or duplicate endpoints", () => {
  const { credential, profile } = fixture();
  assert.equal(validateEvidenceAuthorityCredentialReference(credential).ok, true);
  assert.equal(validateEvidenceAuthorityCredentialReference({ ...credential, reference: "vault://studio-org/token=placeholder" }).ok, false);
  assert.equal(validateEvidenceAuthorityProfile(profile).ok, true);
  assert.equal(validateEvidenceAuthorityProfile({ ...profile, discoveryUrl: "http://127.0.0.1:9000/discovery" }).ok, false);
  assert.equal(validateEvidenceAuthorityProfile({ ...profile, receiptUrl: profile.challengeUrl }).ok, false);
});

test("campaign assignment, challenge, and receipt envelopes keep exact digest bindings", () => {
  const { now, profile, campaign, challenge, envelope } = fixture();
  const assignment = createEvidenceAuthorityAssignment({
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    sourceMilestone: "v4.0.0",
    observerId: "observer-002",
    assignedBy: "coordinator-001",
    assignedAt: now.toISOString(),
  });
  assert.equal(validateEvidenceAuthorityReceiptEnvelope(envelope, profile, campaign, challenge, now.getTime()).ok, true);
  assert.equal(validateEvidenceAuthorityReceiptEnvelope({ ...envelope, packageId: "package-v400-002" }, profile, campaign, challenge, now.getTime()).ok, false);
  const record = classifyEvidenceAuthorityReceipt({ envelope, profile, campaign, challenge, now: now.getTime() });
  assert.equal(record.disposition, "accepted-for-binding");
  assert.equal(assignment.observerId === campaign.requesterId, false);
});

test("unconfigured authority ports fail closed while injected ports bind discovery, dispatch, and receipt", async () => {
  const { now, profile, campaign, challenge, snapshot, envelope } = fixture();
  await assert.rejects(
    executeEvidenceAuthorityChallenge({ profile, campaign, challenge, now: now.getTime() }),
    (error) => error instanceof EvidenceAuthorityCampaignError && error.code === "external-unavailable",
  );
  const record = await executeEvidenceAuthorityChallenge({
    profile,
    campaign,
    challenge,
    now: now.getTime(),
    port: {
      async discoverTrust() { return snapshot; },
      async dispatchChallenge() { return { accepted: true, challengeDigest: challenge.challengeDigest, dispatchDigest: digest("dispatch") }; },
      async readReceipt() { return envelope; },
    },
  });
  assert.equal(record.disposition, "accepted-for-binding");
});

test("authority campaign store reducers preserve profile and campaign idempotency plus receipt quarantine", () => {
  const { profile, campaign, challenge, envelope } = fixture();
  const profileInsert = insertEvidenceAuthorityProfile(emptyEvidenceAuthorityCampaignStore(), profile);
  assert.equal(profileInsert.deduplicated, false);
  assert.equal(insertEvidenceAuthorityProfile(profileInsert.store, profile).deduplicated, true);
  const campaignInsert = insertEvidenceAuthorityCampaign(profileInsert.store, campaign);
  assert.equal(campaignInsert.deduplicated, false);
  assert.equal(insertEvidenceAuthorityCampaign(campaignInsert.store, campaign).deduplicated, true);
  const record = classifyEvidenceAuthorityReceipt({ envelope, profile, campaign, challenge });
  const stored = appendEvidenceAuthorityReceipt(campaignInsert.store, record);
  assert.equal(validateEvidenceAuthorityCampaignStore(stored), true);
  assert.equal(validateEvidenceAuthorityCampaignStore({
    ...stored,
    receipts: [{ ...record, envelope: { ...record.envelope, signerKeyFingerprint: digest("tampered-signer") } }],
  }), false);
});

test("authority campaign train is source complete and production blocked without external coverage", () => {
  const state = buildEvidenceAuthorityCampaignTrainState();
  assert.equal(state.totals.versions, 15);
  assert.equal(state.totals.sourcePassed, 15);
  assert.equal(state.totals.localPassed, 9);
  assert.equal(state.totals.coveredMilestones, 0);
  assert.equal(state.externalStatus, "hold");
  assert.equal(state.productionStatus, "blocked");
});
