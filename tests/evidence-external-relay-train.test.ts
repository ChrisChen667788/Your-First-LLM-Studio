import assert from "node:assert/strict";
import test from "node:test";

import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { createExternalEvidenceHandoff } from "@/features/evidence/external-handoff";
import {
  EXTERNAL_EVIDENCE_RELAY_PLANS,
  ExternalEvidenceRelayError,
  appendExternalEvidenceRelayQuarantine,
  appendExternalEvidenceRelayReceipt,
  buildExternalEvidenceRelayReconciliation,
  createExternalEvidenceRelayConfiguration,
  createExternalEvidenceRelayQuarantine,
  createExternalEvidenceRelayReceipt,
  createExternalEvidenceRelayRequest,
  createFetchExternalEvidenceRelayTransport,
  emptyExternalEvidenceRelayStore,
  executeExternalEvidenceRelay,
  externalEvidenceRelayDigest,
  insertExternalEvidenceRelayConfiguration,
  insertExternalEvidenceRelayRequest,
  validateExternalEvidenceRelayConfiguration,
  validateExternalEvidenceRelayReceipt,
  validateExternalEvidenceRelayRequest,
  validateExternalEvidenceRelayStore,
} from "@/features/evidence/external-relay";
import { buildExternalEvidenceRelayTrainState } from "@/features/experiments/evidence-external-relay-train";

const digest = (seed: string) => externalEvidenceRelayDigest({ seed });

function fixture() {
  const now = new Date();
  const configuration = createExternalEvidenceRelayConfiguration({
    id: "relay-authority-001",
    profileDigest: digest("relay-profile"),
    authorityId: "authority-001",
    relayUrl: "https://relay.example.com/v1/handoffs",
    receiptUrl: "https://relay.example.com/v1/receipts",
    credentialReferenceDigest: digest("relay-credential-reference"),
    trustAnchorFingerprint: digest("relay-trust-anchor"),
    maxRequestAgeMinutes: 60,
    createdAt: now.toISOString(),
  });
  const handoff = createExternalEvidenceHandoff({
    idempotencyKey: "relay-handoff-key-001",
    profileId: "relay-authority-profile",
    profileDigest: digest("relay-profile"),
    campaignId: "relay-authority-campaign",
    campaignDigest: digest("relay-campaign"),
    escrowDigest: digest("relay-escrow"),
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  const request = createExternalEvidenceRelayRequest({
    id: "relay-request-001",
    idempotencyKey: "relay-request-key-001",
    configurationId: configuration.id,
    configurationDigest: configuration.configurationDigest,
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    operation: "handoff-dispatch",
    sourceMilestone: null,
    payloadDigest: digest("relay-wire-payload"),
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1_000).toISOString(),
  });
  const receipt = createExternalEvidenceRelayReceipt({
    id: "relay-receipt-001",
    requestId: request.id,
    requestDigest: request.requestDigest,
    configurationId: configuration.id,
    configurationDigest: configuration.configurationDigest,
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    operation: request.operation,
    sourceMilestone: request.sourceMilestone,
    endpointDigest: externalEvidenceRelayDigest({ url: configuration.relayUrl }),
    externalReceiptDigest: digest("relay-external-receipt"),
    signerKeyFingerprint: configuration.trustAnchorFingerprint,
    signatureDigest: digest("relay-signature"),
    status: "accepted",
    receivedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  return { now, configuration, handoff, request, receipt };
}

function verificationReceipt(input: ReturnType<typeof fixture>, sourceMilestone: string, index: number) {
  const request = createExternalEvidenceRelayRequest({
    id: `relay-verification-${String(index + 1).padStart(2, "0")}`,
    idempotencyKey: `relay-verification-key-${String(index + 1).padStart(2, "0")}`,
    configurationId: input.configuration.id,
    configurationDigest: input.configuration.configurationDigest,
    handoffId: input.handoff.id,
    handoffDigest: input.handoff.handoffDigest,
    operation: "receipt-verification",
    sourceMilestone,
    payloadDigest: digest(`relay-verification-payload-${index}`),
    requestedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + 30 * 60 * 1_000).toISOString(),
  });
  return createExternalEvidenceRelayReceipt({
    id: `relay-verification-receipt-${String(index + 1).padStart(2, "0")}`,
    requestId: request.id,
    requestDigest: request.requestDigest,
    configurationId: input.configuration.id,
    configurationDigest: input.configuration.configurationDigest,
    handoffId: input.handoff.id,
    handoffDigest: input.handoff.handoffDigest,
    operation: request.operation,
    sourceMilestone,
    endpointDigest: externalEvidenceRelayDigest({ url: input.configuration.receiptUrl }),
    externalReceiptDigest: digest(`relay-verification-external-${index}`),
    signerKeyFingerprint: input.configuration.trustAnchorFingerprint,
    signatureDigest: digest(`relay-verification-signature-${index}`),
    status: "accepted",
    receivedAt: input.now.toISOString(),
    validUntil: new Date(input.now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
}

test("v5.2-v5.3 catalog retains fifteen exact external relay boundaries", () => {
  assert.deepEqual(
    EXTERNAL_EVIDENCE_RELAY_PLANS.map((plan) => plan.version),
    ["v5.2.0", "v5.2.1", "v5.2.2", "v5.2.3", "v5.2.4", "v5.2.5", "v5.2.6", "v5.2.7", "v5.2.8", "v5.2.9", "v5.3.0", "v5.3.1", "v5.3.2", "v5.3.3", "v5.3.4"],
  );
  assert.ok(EXTERNAL_EVIDENCE_RELAY_PLANS.every((plan) => plan.localGate && plan.externalGate));
});

test("relay configurations deny unsafe egress shapes and bind bounded requests", () => {
  const { now, configuration, handoff, request } = fixture();
  assert.equal(validateExternalEvidenceRelayConfiguration(configuration).ok, true);
  assert.equal(validateExternalEvidenceRelayConfiguration({ ...configuration, relayUrl: "https://127.0.0.1/relay" }).ok, false);
  assert.equal(validateExternalEvidenceRelayRequest(request, configuration, handoff).ok, true);
  assert.equal(validateExternalEvidenceRelayRequest({ ...request, sourceMilestone: EVIDENCE_COLLECTION_SOURCE_MILESTONES[0] }, configuration, handoff).ok, false);
  assert.equal(validateExternalEvidenceRelayRequest({ ...request, expiresAt: new Date(now.getTime() + 61 * 60 * 1_000).toISOString() }, configuration, handoff).ok, false);
});

test("unconfigured relay fails closed while an injected resolver keeps authorization transient", async () => {
  const input = fixture();
  await assert.rejects(
    () => executeExternalEvidenceRelay(input),
    (error: unknown) => error instanceof ExternalEvidenceRelayError && error.code === "external-unavailable",
  );

  let observedAuthorization = "";
  let observedBody = "";
  const transport = createFetchExternalEvidenceRelayTransport({
    credentialResolver: {
      async resolveAuthorization() {
        return {
          authorization: "Bearer ephemeral-relay-token",
          credentialReferenceDigest: input.configuration.credentialReferenceDigest,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
      },
    },
    fetcher: async (_url, init) => {
      observedAuthorization = init.headers.authorization;
      observedBody = init.body;
      return { ok: true, status: 200, text: async () => JSON.stringify(input.receipt) };
    },
  });
  const receipt = await executeExternalEvidenceRelay({ ...input, transport });
  assert.equal(receipt.receiptDigest, input.receipt.receiptDigest);
  assert.equal(observedAuthorization, "Bearer ephemeral-relay-token");
  assert.ok(!observedBody.includes("ephemeral-relay-token"));
  assert.ok(!JSON.stringify(receipt).includes("ephemeral-relay-token"));
});

test("relay receipts reject mismatched endpoint and signer bindings", () => {
  const { configuration, request, receipt } = fixture();
  assert.equal(validateExternalEvidenceRelayReceipt(receipt, configuration, request).ok, true);
  assert.equal(validateExternalEvidenceRelayReceipt({ ...receipt, endpointDigest: digest("wrong-endpoint") }, configuration, request).ok, false);
  assert.equal(validateExternalEvidenceRelayReceipt({ ...receipt, signerKeyFingerprint: digest("wrong-signer") }, configuration, request).ok, false);
});

test("relay store retains only exact idempotent configurations, requests, receipts, and quarantines", () => {
  const { now, configuration, request, receipt } = fixture();
  const configured = insertExternalEvidenceRelayConfiguration(emptyExternalEvidenceRelayStore(), configuration);
  assert.equal(configured.deduplicated, false);
  assert.equal(insertExternalEvidenceRelayConfiguration(configured.store, configuration).deduplicated, true);
  const requested = insertExternalEvidenceRelayRequest(configured.store, request);
  const received = appendExternalEvidenceRelayReceipt(requested.store, receipt);
  const quarantine = createExternalEvidenceRelayQuarantine({
    id: "relay-quarantine-001",
    configurationId: configuration.id,
    configurationDigest: configuration.configurationDigest,
    requestId: request.id,
    requestDigest: request.requestDigest,
    code: "binding-mismatch",
    payloadDigest: digest("rejected-wire-payload"),
    detailDigest: digest("rejected-wire-detail"),
    observedAt: now.toISOString(),
  });
  const quarantined = appendExternalEvidenceRelayQuarantine(received.store, quarantine);
  assert.equal(validateExternalEvidenceRelayStore(quarantined.store), true);
  assert.equal(validateExternalEvidenceRelayStore({ ...quarantined.store, idempotency: {} }), false);
  assert.throws(() => appendExternalEvidenceRelayReceipt(requested.store, { ...receipt, signatureDigest: digest("tampered") }), ExternalEvidenceRelayError);
});

test("fourteen current verification receipts reconcile only when no import is quarantined", () => {
  const input = fixture();
  const receipts = EVIDENCE_COLLECTION_SOURCE_MILESTONES.map((sourceMilestone, index) => verificationReceipt(input, sourceMilestone, index));
  const ready = buildExternalEvidenceRelayReconciliation({
    configuration: input.configuration,
    handoff: input.handoff,
    receipts,
    quarantines: [],
    now: input.now.getTime(),
  });
  assert.equal(ready.status, "ready-for-independent-decision");
  assert.equal(ready.coveredMilestones.length, 14);

  const quarantined = buildExternalEvidenceRelayReconciliation({
    configuration: input.configuration,
    handoff: input.handoff,
    receipts,
    quarantines: [createExternalEvidenceRelayQuarantine({
      id: "relay-quarantine-002",
      configurationId: input.configuration.id,
      configurationDigest: input.configuration.configurationDigest,
      requestId: null,
      requestDigest: null,
      code: "schema-invalid",
      payloadDigest: digest("quarantined-payload"),
      detailDigest: digest("quarantined-detail"),
      observedAt: input.now.toISOString(),
    })],
    now: input.now.getTime(),
  });
  assert.equal(quarantined.status, "hold");
});

test("relay train is source complete but remains external hold and production blocked", () => {
  const state = buildExternalEvidenceRelayTrainState();
  assert.equal(state.sourceStatus, "pass");
  assert.equal(state.localStatus, "hold");
  assert.equal(state.externalStatus, "hold");
  assert.equal(state.productionStatus, "blocked");
  assert.equal(state.totals.versions, 15);
  assert.equal(state.totals.sourcePassed, 15);
  assert.equal(state.totals.localPassed, 9);
  assert.equal(state.totals.coveredMilestones, 0);
});
