import assert from "node:assert/strict";
import test from "node:test";

import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { createExternalEvidenceHandoff } from "@/features/evidence/external-handoff";
import {
  EXTERNAL_EVIDENCE_ACTIVATION_PLANS,
  EXTERNAL_EVIDENCE_ACTIVATION_STAGES,
  ExternalEvidenceActivationError,
  appendExternalEvidenceActivationObservation,
  appendExternalEvidenceActivationQuarantine,
  buildExternalEvidenceActivationReconciliation,
  createExternalEvidenceActivationDecisionReceipt,
  createExternalEvidenceActivationDecisionRequest,
  createExternalEvidenceActivationManifest,
  createExternalEvidenceActivationObservation,
  createExternalEvidenceActivationQuarantine,
  createUnconfiguredExternalEvidenceActivationPort,
  emptyExternalEvidenceActivationStore,
  insertExternalEvidenceActivationDecisionRequest,
  insertExternalEvidenceActivationManifest,
  validateExternalEvidenceActivationDecisionReceipt,
  validateExternalEvidenceActivationDecisionRequest,
  validateExternalEvidenceActivationManifest,
  validateExternalEvidenceActivationObservation,
  validateExternalEvidenceActivationStore,
} from "@/features/evidence/external-activation";
import {
  createExternalEvidenceRelayConfiguration,
  externalEvidenceRelayDigest,
} from "@/features/evidence/external-relay";
import { buildExternalEvidenceActivationTrainState } from "@/features/experiments/evidence-external-activation-train";

const digest = (seed: string) => externalEvidenceRelayDigest({ seed });

function fixture() {
  const now = new Date();
  const configuration = createExternalEvidenceRelayConfiguration({
    id: "activation-relay-001",
    profileDigest: digest("activation-profile"),
    authorityId: "activation-authority-001",
    relayUrl: "https://relay.example.com/v1/handoffs",
    receiptUrl: "https://relay.example.com/v1/receipts",
    credentialReferenceDigest: digest("activation-credential"),
    trustAnchorFingerprint: digest("activation-trust-anchor"),
    maxRequestAgeMinutes: 60,
    createdAt: now.toISOString(),
  });
  const handoff = createExternalEvidenceHandoff({
    idempotencyKey: "activation-handoff-key-001",
    profileId: "activation-authority-profile",
    profileDigest: digest("activation-profile"),
    campaignId: "activation-authority-campaign",
    campaignDigest: digest("activation-campaign"),
    escrowDigest: digest("activation-escrow"),
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  const manifest = createExternalEvidenceActivationManifest({
    id: "activation-manifest-001",
    relayConfigurationId: configuration.id,
    relayConfigurationDigest: configuration.configurationDigest,
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    authorityId: configuration.authorityId,
    authorityKeyFingerprint: configuration.trustAnchorFingerprint,
    activationPolicyDigest: digest("activation-policy"),
    requiredStages: [...EXTERNAL_EVIDENCE_ACTIVATION_STAGES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  return { now, configuration, handoff, manifest };
}

function observation(input: ReturnType<typeof fixture>, stage: typeof EXTERNAL_EVIDENCE_ACTIVATION_STAGES[number], sourceMilestone: string | null, suffix: string) {
  return createExternalEvidenceActivationObservation({
    id: `activation-observation-${suffix}`,
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.manifestDigest,
    stage,
    sourceMilestone,
    externalEvidenceDigest: digest(`activation-evidence-${suffix}`),
    signerKeyFingerprint: input.manifest.authorityKeyFingerprint,
    signatureDigest: digest(`activation-signature-${suffix}`),
    status: "verified",
    receivedAt: input.now.toISOString(),
    validUntil: new Date(input.now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
}

function completeObservations(input: ReturnType<typeof fixture>) {
  const global = EXTERNAL_EVIDENCE_ACTIVATION_STAGES
    .filter((stage) => stage !== "observer-attestation" && stage !== "receipt-verification")
    .map((stage, index) => observation(input, stage, null, `global-${index + 1}`));
  const milestones = EVIDENCE_COLLECTION_SOURCE_MILESTONES.flatMap((sourceMilestone, index) => [
    observation(input, "observer-attestation", sourceMilestone, `observer-${index + 1}`),
    observation(input, "receipt-verification", sourceMilestone, `receipt-${index + 1}`),
  ]);
  return [...global, ...milestones];
}

test("v5.4-v5.5 catalog retains fifteen exact external activation boundaries", () => {
  assert.deepEqual(
    EXTERNAL_EVIDENCE_ACTIVATION_PLANS.map((plan) => plan.version),
    ["v5.4.0", "v5.4.1", "v5.4.2", "v5.4.3", "v5.4.4", "v5.4.5", "v5.4.6", "v5.4.7", "v5.4.8", "v5.4.9", "v5.5.0", "v5.5.1", "v5.5.2", "v5.5.3", "v5.5.4"],
  );
  assert.ok(EXTERNAL_EVIDENCE_ACTIVATION_PLANS.every((plan) => plan.localGate && plan.externalGate));
});

test("activation manifests bind one relay configuration, handoff, authority, stages, and expiry", () => {
  const { configuration, handoff, manifest } = fixture();
  assert.equal(validateExternalEvidenceActivationManifest(manifest, configuration, handoff).ok, true);
  assert.equal(validateExternalEvidenceActivationManifest({ ...manifest, authorityId: "other-authority-001" }, configuration, handoff).ok, false);
  assert.equal(validateExternalEvidenceActivationManifest({ ...manifest, requiredStages: manifest.requiredStages.slice(1) }, configuration, handoff).ok, false);
});

test("activation observations require their manifest signer and source-milestone shape", () => {
  const input = fixture();
  const observer = observation(input, "observer-attestation", EVIDENCE_COLLECTION_SOURCE_MILESTONES[0], "observer-01");
  assert.equal(validateExternalEvidenceActivationObservation(observer, input.manifest).ok, true);
  assert.equal(validateExternalEvidenceActivationObservation({ ...observer, sourceMilestone: null }, input.manifest).ok, false);
  assert.equal(validateExternalEvidenceActivationObservation({ ...observer, signerKeyFingerprint: digest("wrong-signer") }, input.manifest).ok, false);
});

test("currentness requires every global stage and both observer and receipt records for fourteen domains", () => {
  const input = fixture();
  const records = completeObservations(input);
  const ready = buildExternalEvidenceActivationReconciliation({
    manifest: input.manifest,
    handoff: input.handoff,
    observations: records,
    quarantines: [],
    now: input.now.getTime(),
  });
  assert.equal(ready.status, "eligible-for-independent-decision");
  assert.equal(ready.coveredMilestones.length, 14);

  const quarantine = createExternalEvidenceActivationQuarantine({
    id: "activation-quarantine-001",
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.manifestDigest,
    observationId: null,
    observationDigest: null,
    code: "policy-denied",
    payloadDigest: digest("rejected-payload"),
    detailDigest: digest("rejected-detail"),
    observedAt: input.now.toISOString(),
  });
  const held = buildExternalEvidenceActivationReconciliation({
    manifest: input.manifest,
    handoff: input.handoff,
    observations: records,
    quarantines: [quarantine],
    now: input.now.getTime(),
  });
  assert.equal(held.status, "hold");
});

test("decision request and receipt require a separately pinned authority and exact binding", () => {
  const input = fixture();
  const reconciliation = buildExternalEvidenceActivationReconciliation({
    manifest: input.manifest,
    handoff: input.handoff,
    observations: completeObservations(input),
    quarantines: [],
    now: input.now.getTime(),
  });
  const request = createExternalEvidenceActivationDecisionRequest({
    id: "activation-decision-request-001",
    idempotencyKey: "activation-decision-key-001",
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.manifestDigest,
    reconciliationDigest: reconciliation.reconciliationDigest,
    decisionAuthorityId: "distribution-authority-001",
    decisionAuthorityKeyFingerprint: digest("distribution-authority-key"),
    requestedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + 6 * 60 * 60 * 1_000).toISOString(),
  });
  const receipt = createExternalEvidenceActivationDecisionReceipt({
    id: "activation-decision-receipt-001",
    requestId: request.id,
    requestDigest: request.requestDigest,
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.manifestDigest,
    externalDecisionDigest: digest("decision-evidence"),
    signerKeyFingerprint: request.decisionAuthorityKeyFingerprint,
    signatureDigest: digest("decision-signature"),
    status: "accepted",
    receivedAt: input.now.toISOString(),
    validUntil: new Date(input.now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  assert.equal(validateExternalEvidenceActivationDecisionRequest(request, input.manifest, reconciliation).ok, true);
  assert.equal(validateExternalEvidenceActivationDecisionReceipt(receipt, request).ok, true);
  assert.equal(validateExternalEvidenceActivationDecisionRequest({ ...request, decisionAuthorityId: input.manifest.authorityId }, input.manifest, reconciliation).ok, false);
  assert.equal(validateExternalEvidenceActivationDecisionReceipt({ ...receipt, signerKeyFingerprint: digest("wrong-decision-key") }, request).ok, false);
});

test("activation store retains exact idempotent manifests, evidence, quarantine, and decision request records", () => {
  const input = fixture();
  const manifestResult = insertExternalEvidenceActivationManifest(emptyExternalEvidenceActivationStore(), input.manifest);
  assert.equal(insertExternalEvidenceActivationManifest(manifestResult.store, input.manifest).deduplicated, true);
  const observed = appendExternalEvidenceActivationObservation(manifestResult.store, observation(input, "workload-identity-attestation", null, "identity-01"));
  const quarantined = appendExternalEvidenceActivationQuarantine(observed.store, createExternalEvidenceActivationQuarantine({
    id: "activation-quarantine-002",
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.manifestDigest,
    observationId: null,
    observationDigest: null,
    code: "schema-invalid",
    payloadDigest: digest("malformed-payload"),
    detailDigest: digest("malformed-detail"),
    observedAt: input.now.toISOString(),
  }));
  const decision = createExternalEvidenceActivationDecisionRequest({
    id: "activation-decision-request-002",
    idempotencyKey: "activation-decision-key-002",
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.manifestDigest,
    reconciliationDigest: digest("activation-reconciliation"),
    decisionAuthorityId: "distribution-authority-002",
    decisionAuthorityKeyFingerprint: digest("distribution-authority-key-002"),
    requestedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + 6 * 60 * 60 * 1_000).toISOString(),
  });
  const requested = insertExternalEvidenceActivationDecisionRequest(quarantined.store, decision);
  assert.equal(validateExternalEvidenceActivationStore(requested.store), true);
  assert.equal(insertExternalEvidenceActivationDecisionRequest(requested.store, decision).deduplicated, true);
  assert.throws(() => appendExternalEvidenceActivationObservation(manifestResult.store, { ...observation(input, "workload-identity-attestation", null, "identity-02"), manifestDigest: digest("tampered") }), ExternalEvidenceActivationError);
});

test("unconfigured activation port fails closed while the train remains external hold and production blocked", async () => {
  await assert.rejects(
    () => createUnconfiguredExternalEvidenceActivationPort().importObservation({
      manifest: fixture().manifest,
      stage: "workload-identity-attestation",
      sourceMilestone: null,
    }),
    (error: unknown) => error instanceof ExternalEvidenceActivationError && error.code === "external-unavailable",
  );
  const state = buildExternalEvidenceActivationTrainState();
  assert.equal(state.sourceStatus, "pass");
  assert.equal(state.localStatus, "hold");
  assert.equal(state.externalStatus, "hold");
  assert.equal(state.productionStatus, "blocked");
  assert.equal(state.totals.versions, 15);
  assert.equal(state.totals.sourcePassed, 15);
  assert.equal(state.totals.localPassed, 9);
  assert.equal(state.totals.coveredMilestones, 0);
});
