import { randomUUID } from "node:crypto";

import {
  createEvidenceAuthorityCampaign,
  createEvidenceAuthorityCredentialReference,
  createEvidenceAuthorityProfile,
} from "@/features/evidence/authority-campaign";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { readExternalEvidenceHandoffStore } from "@/features/evidence/external-handoff-store";
import {
  EXTERNAL_EVIDENCE_RELAY_PLANS,
  buildExternalEvidenceRelayReconciliation,
  createExternalEvidenceRelayConfiguration,
  createExternalEvidenceRelayQuarantine,
  createExternalEvidenceRelayReceipt,
  createExternalEvidenceRelayRequest,
  createUnconfiguredExternalEvidenceRelayTransport,
  externalEvidenceRelayDigest,
  validateExternalEvidenceRelayConfiguration,
  validateExternalEvidenceRelayQuarantine,
  validateExternalEvidenceRelayReceipt,
  validateExternalEvidenceRelayReconciliation,
  validateExternalEvidenceRelayRequest,
} from "@/features/evidence/external-relay";
import { createExternalEvidenceHandoff } from "@/features/evidence/external-handoff";
import { readExternalEvidenceRelayStore } from "@/features/evidence/external-relay-store";
import { evidenceAcceptanceDigest } from "@/features/evidence/acceptance-lifecycle";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_SCHEMA_VERSION = "experiments.evidence-external-relay-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("experiments", "v5.2.0-v5.3.4-external-evidence-relay-train.json");
const digest = (seed: string) => operationalEvidenceDigest({ seed });
const RELAY_URL = "https://relay.example.com/v1/handoffs";
const RECEIPT_URL = "https://relay.example.com/v1/receipts";

function runExternalEvidenceRelayConformance() {
  const now = new Date();
  const credential = createEvidenceAuthorityCredentialReference({
    kind: "workload-identity",
    reference: "workload-identity://studio-org/external-relay",
  });
  const profile = createEvidenceAuthorityProfile({
    id: "relay-authority-profile",
    organizationId: "studio-org",
    authorityConfigDigest: digest("relay-authority-config"),
    discoveryUrl: "https://authority.example.com/relay/discovery",
    challengeUrl: "https://authority.example.com/relay/challenges",
    receiptUrl: "https://authority.example.com/relay/receipts",
    credentialReference: credential,
    maxReceiptAgeHours: 72,
  });
  const campaign = createEvidenceAuthorityCampaign({
    idempotencyKey: "relay-authority-campaign",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const handoff = createExternalEvidenceHandoff({
    idempotencyKey: "relay-source-handoff",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    escrowDigest: digest("relay-escrow"),
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const configuration = createExternalEvidenceRelayConfiguration({
    id: "relay-authority-001",
    profileDigest: profile.profileDigest,
    authorityId: "authority-001",
    relayUrl: RELAY_URL,
    receiptUrl: RECEIPT_URL,
    credentialReferenceDigest: digest("relay-credential-reference"),
    trustAnchorFingerprint: digest("relay-trust-anchor"),
    maxRequestAgeMinutes: 60,
    createdAt: now.toISOString(),
  });
  const request = createExternalEvidenceRelayRequest({
    id: "relay-request-001",
    idempotencyKey: "relay-request-key-001",
    configurationId: configuration.id,
    configurationDigest: configuration.configurationDigest,
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    operation: "receipt-verification",
    sourceMilestone: EVIDENCE_COLLECTION_SOURCE_MILESTONES[0],
    payloadDigest: digest("relay-request-payload"),
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
    endpointDigest: externalEvidenceRelayDigest({ url: RECEIPT_URL }),
    externalReceiptDigest: digest("relay-external-receipt"),
    signerKeyFingerprint: configuration.trustAnchorFingerprint,
    signatureDigest: digest("relay-signature"),
    status: "accepted",
    receivedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  const quarantined = createExternalEvidenceRelayQuarantine({
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
  const verificationReceipts = EVIDENCE_COLLECTION_SOURCE_MILESTONES.map((sourceMilestone, index) => {
    const verificationRequest = createExternalEvidenceRelayRequest({
      id: `relay-verification-${String(index + 1).padStart(2, "0")}`,
      idempotencyKey: `relay-verification-key-${String(index + 1).padStart(2, "0")}`,
      configurationId: configuration.id,
      configurationDigest: configuration.configurationDigest,
      handoffId: handoff.id,
      handoffDigest: handoff.handoffDigest,
      operation: "receipt-verification",
      sourceMilestone,
      payloadDigest: digest(`relay-verification-payload-${index}`),
      requestedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1_000).toISOString(),
    });
    return createExternalEvidenceRelayReceipt({
      id: `relay-verification-receipt-${String(index + 1).padStart(2, "0")}`,
      requestId: verificationRequest.id,
      requestDigest: verificationRequest.requestDigest,
      configurationId: configuration.id,
      configurationDigest: configuration.configurationDigest,
      handoffId: handoff.id,
      handoffDigest: handoff.handoffDigest,
      operation: verificationRequest.operation,
      sourceMilestone,
      endpointDigest: externalEvidenceRelayDigest({ url: RECEIPT_URL }),
      externalReceiptDigest: digest(`relay-verification-external-${index}`),
      signerKeyFingerprint: configuration.trustAnchorFingerprint,
      signatureDigest: digest(`relay-verification-signature-${index}`),
      status: "accepted",
      receivedAt: now.toISOString(),
      validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
    });
  });
  const reconciliation = buildExternalEvidenceRelayReconciliation({
    configuration,
    handoff,
    receipts: verificationReceipts,
    quarantines: [],
    now: now.getTime(),
  });
  return {
    checks: {
      relayPlans: EXTERNAL_EVIDENCE_RELAY_PLANS.length === 15,
      configuration: validateExternalEvidenceRelayConfiguration(configuration).ok,
      request: validateExternalEvidenceRelayRequest(request, configuration, handoff).ok,
      receipt: validateExternalEvidenceRelayReceipt(receipt, configuration, request).ok,
      quarantine: validateExternalEvidenceRelayQuarantine(quarantined, configuration, request).ok,
      reconciliation: validateExternalEvidenceRelayReconciliation(reconciliation, configuration, handoff).ok && reconciliation.status === "ready-for-independent-decision",
      unconfiguredTransportConstructed: Boolean(createUnconfiguredExternalEvidenceRelayTransport()),
    },
  };
}

export function buildExternalEvidenceRelayTrainState() {
  const conformance = runExternalEvidenceRelayConformance();
  const store = readExternalEvidenceRelayStore();
  const handoffStore = readExternalEvidenceHandoffStore();
  const reconciliations = store.requests.flatMap((request) => {
    const configuration = store.configurations.find((entry) => entry.id === request.configurationId && entry.configurationDigest === request.configurationDigest);
    const handoff = handoffStore.handoffs.find((entry) => entry.id === request.handoffId && entry.handoffDigest === request.handoffDigest);
    return configuration && handoff
      ? [buildExternalEvidenceRelayReconciliation({ configuration, handoff, receipts: store.receipts, quarantines: store.quarantines })]
      : [];
  });
  const coveredMilestones = new Set(reconciliations.flatMap((entry) => entry.coveredMilestones));
  const localVersions = new Set([
    "v5.2.0", "v5.2.1", "v5.2.5", "v5.2.6", "v5.2.7",
    "v5.2.8", "v5.2.9", "v5.3.0", "v5.3.4",
  ]);
  const checksPass = Object.values(conformance.checks).every(Boolean);
  const versions = EXTERNAL_EVIDENCE_RELAY_PLANS.map((plan) => {
    const localPass = localVersions.has(plan.version) && checksPass;
    return {
      ...plan,
      sourceStatus: "pass" as const,
      localStatus: localPass ? "pass" as const : "hold" as const,
      externalStatus: "hold" as const,
      productionStatus: "blocked" as const,
      coverage: coveredMilestones.size,
      blockers: localPass
        ? []
        : plan.requiresLiveRelay
          ? [`Current controlled relay receipt coverage is ${coveredMilestones.size}/14.`]
          : ["A controlled external relay configuration is required for this capability."],
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
      versions: EXTERNAL_EVIDENCE_RELAY_PLANS.length,
      sourcePassed: versions.length,
      localPassed,
      localHeld: versions.length - localPassed,
      configurations: store.configurations.length,
      requests: store.requests.length,
      receipts: store.receipts.length,
      quarantines: store.quarantines.length,
      reconciliations: reconciliations.length,
      coveredMilestones: coveredMilestones.size,
    },
    conformance,
    versions,
    disclosure: "All v5.2-v5.3 source contracts are implemented. A relay descriptor, opaque credential resolver contract, injected transport, local receipt, quarantine record, or reconciliation projection does not prove a controlled credential, external authority, immutable archive, independent observer, distribution approval, or production authorization.",
    stateDigest: evidenceAcceptanceDigest({ core, relayStoreRevision: store.revision, handoffStoreRevision: handoffStore.revision }),
  };
}

export function buildExternalEvidenceRelayPromotionBundle() {
  const state = buildExternalEvidenceRelayTrainState();
  const core = {
    schemaVersion: "experiments.evidence-external-relay-promotion-bundle.v1" as const,
    generatedAt: new Date().toISOString(),
    status: state.totals.coveredMilestones === 14 && state.totals.quarantines === 0 ? "ready-for-independent-decision" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    trainStateDigest: state.stateDigest,
    coveredMilestones: state.totals.coveredMilestones,
    remainingDomains: 14 - state.totals.coveredMilestones,
    relayBacklog: state.versions.filter((version) => version.externalStatus === "hold").map((version) => ({ version: version.version, gate: version.externalGate })),
  };
  return { ...core, evidenceDigest: evidenceAcceptanceDigest(core) };
}

export function runExternalEvidenceRelayTrainAcceptance() {
  const state = buildExternalEvidenceRelayTrainState();
  const receiptCore = { id: `external-evidence-relay-train-${randomUUID()}`, ...state };
  const receipt = { ...receiptCore, evidenceDigest: externalEvidenceRelayDigest(receiptCore) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readExternalEvidenceRelayTrainEvidence() {
  const state = buildExternalEvidenceRelayTrainState();
  const receipts = readDurableReceipts<ReturnType<typeof runExternalEvidenceRelayTrainAcceptance>>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  return {
    ok: true as const,
    schemaVersion: "experiments.evidence-external-relay-train.v1" as const,
    ...state,
    promotionBundle: buildExternalEvidenceRelayPromotionBundle(),
    latest: receipts[0]?.stateDigest === state.stateDigest ? receipts[0] : null,
    receipts,
    paths: {
      trainReceipts: RECEIPT_PATH,
      relays: getLocalAgentDataPath("experiments", "v5.2.0-v5.3.4-external-evidence-relay.json"),
      handoffs: getLocalAgentDataPath("experiments", "v5.0.0-v5.1.4-external-evidence-handoffs.json"),
    },
  };
}
