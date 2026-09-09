import assert from "node:assert/strict";
import test from "node:test";

import {
  createEvidenceAuthorityCampaign,
  createEvidenceAuthorityCredentialReference,
  createEvidenceAuthorityProfile,
} from "@/features/evidence/authority-campaign";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import {
  EXTERNAL_EVIDENCE_HANDOFF_PLANS,
  ExternalEvidenceHandoffError,
  appendExternalEvidenceHandoffObservation,
  buildExternalEvidenceCoverage,
  createExternalEvidenceAuthorityWitness,
  createExternalEvidenceDecisionEnvelope,
  createExternalEvidenceDecisionRequest,
  createExternalEvidenceDispatchReceipt,
  createExternalEvidenceHandoff,
  createExternalEvidenceObserverReceipt,
  createExternalEvidenceVerification,
  createUnconfiguredExternalEvidenceHandoffPort,
  emptyExternalEvidenceHandoffStore,
  executeExternalEvidenceHandoff,
  externalEvidenceHandoffDigest,
  insertExternalEvidenceHandoff,
  validateExternalEvidenceHandoff,
  validateExternalEvidenceHandoffStore,
} from "@/features/evidence/external-handoff";
import { buildExternalEvidenceHandoffTrainState } from "@/features/experiments/evidence-external-handoff-train";

const digest = (seed: string) => externalEvidenceHandoffDigest({ seed });

function fixture() {
  const now = new Date();
  const credential = createEvidenceAuthorityCredentialReference({ kind: "vault", reference: "vault://studio-org/external-handoff" });
  const profile = createEvidenceAuthorityProfile({
    id: "handoff-authority-profile",
    organizationId: "studio-org",
    authorityConfigDigest: digest("authority-config"),
    discoveryUrl: "https://authority.example.com/handoff/discovery",
    challengeUrl: "https://authority.example.com/handoff/challenge",
    receiptUrl: "https://authority.example.com/handoff/receipt",
    credentialReference: credential,
    maxReceiptAgeHours: 72,
  });
  const campaign = createEvidenceAuthorityCampaign({
    idempotencyKey: "handoff-campaign-key",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const handoff = createExternalEvidenceHandoff({
    idempotencyKey: "external-handoff-key",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    escrowDigest: digest("escrow"),
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  return { now, profile, campaign, handoff };
}

test("v5.0-v5.1 catalog retains fifteen exact external handoff boundaries", () => {
  assert.deepEqual(
    EXTERNAL_EVIDENCE_HANDOFF_PLANS.map((plan) => plan.version),
    ["v5.0.0", "v5.0.1", "v5.0.2", "v5.0.3", "v5.0.4", "v5.0.5", "v5.0.6", "v5.0.7", "v5.0.8", "v5.0.9", "v5.1.0", "v5.1.1", "v5.1.2", "v5.1.3", "v5.1.4"],
  );
  assert.ok(EXTERNAL_EVIDENCE_HANDOFF_PLANS.every((plan) => plan.localGate && plan.externalGate));
});

test("handoffs bind exact profile, campaign, all source domains, and short expiry", () => {
  const { profile, campaign, handoff } = fixture();
  assert.equal(validateExternalEvidenceHandoff(handoff, profile, campaign).ok, true);
  assert.equal(validateExternalEvidenceHandoff({ ...handoff, campaignDigest: digest("another-campaign") }, profile, campaign).ok, false);
  assert.equal(validateExternalEvidenceHandoff({ ...handoff, sourceMilestones: handoff.sourceMilestones.slice(1) }, profile, campaign).ok, false);
});

test("witnesses, observer receipts, dispatch, verification, coverage, and decision retain strict bindings", () => {
  const { now, handoff } = fixture();
  const witness = createExternalEvidenceAuthorityWitness({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    profileDigest: handoff.profileDigest,
    kind: "trust-discovery",
    subjectDigest: digest("trust-document"),
    issuerId: "independent-authority",
    signerKeyFingerprint: digest("trust-signer"),
    observedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  const observerReceipts = handoff.sourceMilestones.map((sourceMilestone, index) => createExternalEvidenceObserverReceipt({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    sourceMilestone,
    assignmentDigest: digest(`assignment-${index}`),
    observerId: `observer-${String(index + 1).padStart(2, "0")}`,
    status: "acknowledged",
    deliveredAt: now.toISOString(),
    acknowledgedAt: now.toISOString(),
  }));
  const dispatchReceipt = createExternalEvidenceDispatchReceipt({ handoffId: handoff.id, handoffDigest: handoff.handoffDigest, endpointDigest: digest("dispatch"), dispatchedAt: now.toISOString(), accepted: true });
  const verifications = handoff.sourceMilestones.map((sourceMilestone, index) => createExternalEvidenceVerification({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    sourceMilestone,
    externalReceiptDigest: digest(`external-${index}`),
    signerKeyFingerprint: digest("receipt-signer"),
    signatureDigest: digest(`signature-${index}`),
    outcome: "verified",
    verifiedAt: now.toISOString(),
  }));
  const coverage = buildExternalEvidenceCoverage({ handoff, observerReceipts, dispatchReceipts: [dispatchReceipt], verifications, discrepancies: [], now: now.getTime() });
  const request = createExternalEvidenceDecisionRequest({ handoffId: handoff.id, handoffDigest: handoff.handoffDigest, coverageDigest: coverage.coverageDigest, requesterId: "operator-001", requestedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString() });
  const envelope = createExternalEvidenceDecisionEnvelope({ requestId: request.id, requestDigest: request.requestDigest, decision: "approved", signerId: "independent-decision-authority", signerKeyFingerprint: digest("decision-signer"), issuedAt: now.toISOString() });
  assert.equal(witness.handoffDigest, handoff.handoffDigest);
  assert.equal(coverage.status, "ready-for-independent-decision");
  assert.equal(coverage.coveredMilestones.length, 14);
  assert.equal(envelope.requestDigest, request.requestDigest);
  assert.equal(buildExternalEvidenceCoverage({ handoff, observerReceipts, dispatchReceipts: [dispatchReceipt], verifications, discrepancies: [], now: Date.parse(handoff.expiresAt) + 1 }).status, "hold");
});

test("unconfigured port fails closed and injected port returns exact bound evidence", async () => {
  const { handoff, profile, campaign } = fixture();
  await assert.rejects(
    () => createUnconfiguredExternalEvidenceHandoffPort().dispatchHandoff({ handoff }),
    (error: unknown) => error instanceof ExternalEvidenceHandoffError && error.code === "external-unavailable",
  );
  const output = await executeExternalEvidenceHandoff({
    handoff,
    profile,
    campaign,
    assignmentDigests: Object.fromEntries(handoff.sourceMilestones.map((sourceMilestone, index) => [sourceMilestone, digest(`assignment-${index}`)])),
    externalReceiptDigests: Object.fromEntries(handoff.sourceMilestones.map((sourceMilestone, index) => [sourceMilestone, digest(`receipt-${index}`)])),
    port: {
      observeAuthority: async ({ kind }) => createExternalEvidenceAuthorityWitness({ handoffId: handoff.id, handoffDigest: handoff.handoffDigest, profileDigest: handoff.profileDigest, kind, subjectDigest: digest(`subject-${kind}`), issuerId: "independent-authority", signerKeyFingerprint: digest(`signer-${kind}`), observedAt: new Date().toISOString(), validUntil: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString() }),
      deliverToObserver: async ({ sourceMilestone, assignmentDigest }) => createExternalEvidenceObserverReceipt({ handoffId: handoff.id, handoffDigest: handoff.handoffDigest, sourceMilestone, assignmentDigest, observerId: `observer-${sourceMilestone.slice(-2).padStart(2, "0")}`, status: "acknowledged", deliveredAt: new Date().toISOString(), acknowledgedAt: new Date().toISOString() }),
      dispatchHandoff: async () => createExternalEvidenceDispatchReceipt({ handoffId: handoff.id, handoffDigest: handoff.handoffDigest, endpointDigest: digest("dispatch"), dispatchedAt: new Date().toISOString(), accepted: true }),
      verifyReceipt: async ({ sourceMilestone, externalReceiptDigest }) => createExternalEvidenceVerification({ handoffId: handoff.id, handoffDigest: handoff.handoffDigest, sourceMilestone, externalReceiptDigest, signerKeyFingerprint: digest("receipt-signer"), signatureDigest: digest(`signature-${sourceMilestone}`), outcome: "verified", verifiedAt: new Date().toISOString() }),
      requestDecision: async ({ request }) => createExternalEvidenceDecisionEnvelope({ requestId: request.id, requestDigest: request.requestDigest, decision: "approved", signerId: "independent-decision-authority", signerKeyFingerprint: digest("decision-signer"), issuedAt: new Date().toISOString() }),
    },
  });
  assert.equal(output.coverage.status, "ready-for-independent-decision");
  assert.equal(output.envelope.decision, "approved");
});

test("durable handoff store preserves idempotency and rejects tampered verification", () => {
  const { now, handoff } = fixture();
  const inserted = insertExternalEvidenceHandoff(emptyExternalEvidenceHandoffStore(), handoff);
  assert.equal(inserted.deduplicated, false);
  assert.equal(insertExternalEvidenceHandoff(inserted.store, handoff).deduplicated, true);
  const verification = createExternalEvidenceVerification({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    sourceMilestone: handoff.sourceMilestones[0],
    externalReceiptDigest: digest("receipt"),
    signerKeyFingerprint: digest("signer"),
    signatureDigest: digest("signature"),
    outcome: "verified",
    verifiedAt: now.toISOString(),
  });
  const stored = appendExternalEvidenceHandoffObservation(inserted.store, { kind: "verification", value: verification });
  assert.equal(validateExternalEvidenceHandoffStore(stored), true);
  assert.equal(validateExternalEvidenceHandoffStore({ ...stored, idempotency: {} }), false);
  assert.throws(() => appendExternalEvidenceHandoffObservation(inserted.store, { kind: "verification", value: { ...verification, signatureDigest: digest("tampered") } }), ExternalEvidenceHandoffError);
});

test("external handoff train is source complete and production blocked without external coverage", () => {
  const state = buildExternalEvidenceHandoffTrainState();
  assert.equal(state.sourceStatus, "pass");
  assert.equal(state.productionStatus, "blocked");
  assert.equal(state.totals.versions, 15);
  assert.equal(state.totals.sourcePassed, 15);
  assert.equal(state.totals.coveredMilestones, 0);
});
