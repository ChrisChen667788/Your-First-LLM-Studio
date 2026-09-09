import { createHash, randomUUID } from "node:crypto";

import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import type {
  EvidenceAuthorityCampaign,
  EvidenceAuthorityProfile,
} from "@/features/evidence/authority-campaign";

export const EXTERNAL_EVIDENCE_HANDOFF_SCHEMA_VERSION =
  "evidence.external-handoff.v1" as const;

export type ExternalEvidenceHandoffPlan = {
  version: string;
  label: string;
  track: "handoff" | "witness" | "delivery" | "verification" | "decision";
  localGate: string;
  externalGate: string;
  requiresExternalWitness: boolean;
};

export type ExternalEvidenceHandoff = {
  schemaVersion: "evidence.external-handoff.v1";
  id: string;
  idempotencyKey: string;
  profileId: string;
  profileDigest: string;
  campaignId: string;
  campaignDigest: string;
  escrowDigest: string;
  requesterId: string;
  sourceMilestones: string[];
  requestedAt: string;
  expiresAt: string;
  handoffDigest: string;
};

export type ExternalEvidenceAuthorityWitness = {
  schemaVersion: "evidence.external-authority-witness.v1";
  handoffId: string;
  handoffDigest: string;
  profileDigest: string;
  kind: "credential-resolution" | "trust-discovery" | "rotation-continuity" | "archive-readback";
  subjectDigest: string;
  issuerId: string;
  signerKeyFingerprint: string;
  observedAt: string;
  validUntil: string;
  witnessDigest: string;
};

export type ExternalEvidenceObserverReceipt = {
  schemaVersion: "evidence.external-observer-receipt.v1";
  handoffId: string;
  handoffDigest: string;
  sourceMilestone: string;
  assignmentDigest: string;
  observerId: string;
  status: "acknowledged" | "declined";
  deliveredAt: string;
  acknowledgedAt: string;
  receiptDigest: string;
};

export type ExternalEvidenceDispatchReceipt = {
  schemaVersion: "evidence.external-dispatch-receipt.v1";
  handoffId: string;
  handoffDigest: string;
  endpointDigest: string;
  dispatchedAt: string;
  accepted: boolean;
  receiptDigest: string;
};

export type ExternalEvidenceVerification = {
  schemaVersion: "evidence.external-receipt-verification.v1";
  handoffId: string;
  handoffDigest: string;
  sourceMilestone: string;
  externalReceiptDigest: string;
  signerKeyFingerprint: string;
  signatureDigest: string;
  outcome: "verified" | "rejected";
  verifiedAt: string;
  verificationDigest: string;
};

export type ExternalEvidenceDiscrepancy = {
  schemaVersion: "evidence.external-discrepancy.v1";
  id: string;
  handoffId: string;
  handoffDigest: string;
  sourceMilestone: string;
  kind: "missing" | "mismatch" | "stale" | "rejected";
  status: "open" | "resolved" | "rejected";
  openedBy: string;
  openedAt: string;
  closedAt: string | null;
  resolutionDigest: string | null;
  discrepancyDigest: string;
};

export type ExternalEvidenceDecisionRequest = {
  schemaVersion: "evidence.external-decision-request.v1";
  id: string;
  handoffId: string;
  handoffDigest: string;
  coverageDigest: string;
  requesterId: string;
  requestedAt: string;
  expiresAt: string;
  requestDigest: string;
};

export type ExternalEvidenceDecisionEnvelope = {
  schemaVersion: "evidence.external-decision-envelope.v1";
  requestId: string;
  requestDigest: string;
  decision: "approved" | "rejected";
  signerId: string;
  signerKeyFingerprint: string;
  issuedAt: string;
  decisionDigest: string;
};

export type ExternalEvidenceHandoffStore = {
  schemaVersion: "evidence.external-handoff-store.v1";
  revision: number;
  handoffs: ExternalEvidenceHandoff[];
  witnesses: ExternalEvidenceAuthorityWitness[];
  observerReceipts: ExternalEvidenceObserverReceipt[];
  dispatchReceipts: ExternalEvidenceDispatchReceipt[];
  verifications: ExternalEvidenceVerification[];
  discrepancies: ExternalEvidenceDiscrepancy[];
  decisionRequests: ExternalEvidenceDecisionRequest[];
  decisionEnvelopes: ExternalEvidenceDecisionEnvelope[];
  idempotency: Record<string, string>;
};

export type ExternalEvidenceHandoffObservation =
  | { kind: "witness"; value: ExternalEvidenceAuthorityWitness }
  | { kind: "observer-receipt"; value: ExternalEvidenceObserverReceipt }
  | { kind: "dispatch-receipt"; value: ExternalEvidenceDispatchReceipt }
  | { kind: "verification"; value: ExternalEvidenceVerification }
  | { kind: "discrepancy"; value: ExternalEvidenceDiscrepancy }
  | { kind: "decision-request"; value: ExternalEvidenceDecisionRequest }
  | { kind: "decision-envelope"; value: ExternalEvidenceDecisionEnvelope };

export type ExternalEvidenceHandoffPort = {
  observeAuthority(input: {
    handoff: ExternalEvidenceHandoff;
    kind: ExternalEvidenceAuthorityWitness["kind"];
  }): Promise<ExternalEvidenceAuthorityWitness>;
  deliverToObserver(input: {
    handoff: ExternalEvidenceHandoff;
    sourceMilestone: string;
    assignmentDigest: string;
  }): Promise<ExternalEvidenceObserverReceipt>;
  dispatchHandoff(input: { handoff: ExternalEvidenceHandoff }): Promise<ExternalEvidenceDispatchReceipt>;
  verifyReceipt(input: {
    handoff: ExternalEvidenceHandoff;
    sourceMilestone: string;
    externalReceiptDigest: string;
  }): Promise<ExternalEvidenceVerification>;
  requestDecision(input: {
    handoff: ExternalEvidenceHandoff;
    request: ExternalEvidenceDecisionRequest;
  }): Promise<ExternalEvidenceDecisionEnvelope>;
};

export class ExternalEvidenceHandoffError extends Error {
  constructor(
    readonly code:
      | "invalid-input"
      | "revision-conflict"
      | "capacity-exceeded"
      | "external-unavailable"
      | "external-binding-failed",
    message: string,
  ) {
    super(message);
    this.name = "ExternalEvidenceHandoffError";
  }
}

const DAY = 24 * 60 * 60 * 1_000;
const HEX = /^[a-f0-9]{64}$/u;
const IDENTITY = /^[a-z0-9][a-z0-9._:@/-]{2,127}$/iu;
const MAX_HANDOFFS = 200;
const MAX_OBSERVATIONS = 4_000;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function externalEvidenceHandoffDigest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && IDENTITY.test(value.trim()) &&
    !/^(?:demo|fixture|local|test|unknown)(?:[-_.:]|$)/iu.test(value.trim());
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function hasOnlyKeys(value: unknown, keys: readonly string[]) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)) &&
    Object.keys(value as Record<string, unknown>).every((key) => keys.includes(key));
}

function hasExactMilestones(values: string[]) {
  return values.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length &&
    values.every((value, index) => value === EVIDENCE_COLLECTION_SOURCE_MILESTONES[index]);
}

function isShortWindow(start: string, end: string, maximumMs: number) {
  const started = Date.parse(start);
  const ended = Date.parse(end);
  return Number.isFinite(started) && Number.isFinite(ended) && ended > started && ended - started <= maximumMs;
}

function handoffCore(input: Omit<ExternalEvidenceHandoff, "schemaVersion" | "id" | "handoffDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-handoff.v1" as const,
    id: input.id?.trim() || `external-handoff-${randomUUID()}`,
    idempotencyKey: input.idempotencyKey.trim(),
    profileId: input.profileId.trim(),
    profileDigest: input.profileDigest,
    campaignId: input.campaignId.trim(),
    campaignDigest: input.campaignDigest,
    escrowDigest: input.escrowDigest,
    requesterId: input.requesterId.trim(),
    sourceMilestones: [...input.sourceMilestones],
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
  };
}

export function createExternalEvidenceHandoff(input: Omit<ExternalEvidenceHandoff, "schemaVersion" | "id" | "handoffDigest"> & { id?: string }) {
  const core = handoffCore(input);
  return { ...core, handoffDigest: externalEvidenceHandoffDigest(core) };
}

function validateExternalEvidenceHandoffShape(input: unknown) {
  const handoff = input as Partial<ExternalEvidenceHandoff>;
  const core = handoff.schemaVersion === "evidence.external-handoff.v1" &&
    typeof handoff.id === "string" && typeof handoff.idempotencyKey === "string" &&
    typeof handoff.profileId === "string" && typeof handoff.campaignId === "string" &&
    typeof handoff.requesterId === "string" && Array.isArray(handoff.sourceMilestones) &&
    typeof handoff.requestedAt === "string" && typeof handoff.expiresAt === "string"
    ? handoffCore({
      id: handoff.id,
      idempotencyKey: handoff.idempotencyKey,
      profileId: handoff.profileId,
      profileDigest: handoff.profileDigest || "",
      campaignId: handoff.campaignId,
      campaignDigest: handoff.campaignDigest || "",
      escrowDigest: handoff.escrowDigest || "",
      requesterId: handoff.requesterId,
      sourceMilestones: handoff.sourceMilestones,
      requestedAt: handoff.requestedAt,
      expiresAt: handoff.expiresAt,
    })
    : null;
  const values = Array.isArray(handoff.sourceMilestones) && handoff.sourceMilestones.every((value) => typeof value === "string")
    ? handoff.sourceMilestones as string[]
    : [];
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "idempotencyKey", "profileId", "profileDigest", "campaignId", "campaignDigest", "escrowDigest", "requesterId", "sourceMilestones", "requestedAt", "expiresAt", "handoffDigest"]),
    schemaVersion: handoff.schemaVersion === "evidence.external-handoff.v1",
    identity: isIdentity(handoff.id) && isIdentity(handoff.idempotencyKey) && isIdentity(handoff.profileId) && isIdentity(handoff.campaignId) && isIdentity(handoff.requesterId),
    digests: isDigest(handoff.profileDigest) && isDigest(handoff.campaignDigest) && isDigest(handoff.escrowDigest),
    milestones: hasExactMilestones(values),
    window: isTimestamp(handoff.requestedAt) && isTimestamp(handoff.expiresAt) && isShortWindow(handoff.requestedAt, handoff.expiresAt, 7 * DAY),
    digest: Boolean(core) && handoff.handoffDigest === externalEvidenceHandoffDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function validateExternalEvidenceHandoff(input: unknown, profile: EvidenceAuthorityProfile, campaign: EvidenceAuthorityCampaign) {
  const basic = validateExternalEvidenceHandoffShape(input);
  const handoff = input as Partial<ExternalEvidenceHandoff>;
  return {
    ok: basic.ok && handoff.profileId === profile.id && handoff.profileDigest === profile.profileDigest && handoff.campaignId === campaign.id && handoff.campaignDigest === campaign.campaignDigest,
    checks: {
      ...basic.checks,
      profileBinding: handoff.profileId === profile.id && handoff.profileDigest === profile.profileDigest,
      campaignBinding: handoff.campaignId === campaign.id && handoff.campaignDigest === campaign.campaignDigest,
    },
  };
}

function authorityWitnessCore(input: Omit<ExternalEvidenceAuthorityWitness, "schemaVersion" | "witnessDigest">) {
  return {
    schemaVersion: "evidence.external-authority-witness.v1" as const,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    profileDigest: input.profileDigest,
    kind: input.kind,
    subjectDigest: input.subjectDigest,
    issuerId: input.issuerId.trim(),
    signerKeyFingerprint: input.signerKeyFingerprint,
    observedAt: input.observedAt,
    validUntil: input.validUntil,
  };
}

export function createExternalEvidenceAuthorityWitness(input: Omit<ExternalEvidenceAuthorityWitness, "schemaVersion" | "witnessDigest">) {
  const core = authorityWitnessCore(input);
  return { ...core, witnessDigest: externalEvidenceHandoffDigest(core) };
}

export function validateExternalEvidenceAuthorityWitness(input: unknown, handoff: ExternalEvidenceHandoff) {
  const witness = input as Partial<ExternalEvidenceAuthorityWitness>;
  const core = witness.schemaVersion === "evidence.external-authority-witness.v1" && typeof witness.handoffId === "string" && typeof witness.issuerId === "string"
    ? authorityWitnessCore({
      handoffId: witness.handoffId,
      handoffDigest: witness.handoffDigest || "",
      profileDigest: witness.profileDigest || "",
      kind: witness.kind as ExternalEvidenceAuthorityWitness["kind"],
      subjectDigest: witness.subjectDigest || "",
      issuerId: witness.issuerId,
      signerKeyFingerprint: witness.signerKeyFingerprint || "",
      observedAt: witness.observedAt || "",
      validUntil: witness.validUntil || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "handoffId", "handoffDigest", "profileDigest", "kind", "subjectDigest", "issuerId", "signerKeyFingerprint", "observedAt", "validUntil", "witnessDigest"]),
    schemaVersion: witness.schemaVersion === "evidence.external-authority-witness.v1",
    handoffBinding: witness.handoffId === handoff.id && witness.handoffDigest === handoff.handoffDigest && witness.profileDigest === handoff.profileDigest,
    kind: ["credential-resolution", "trust-discovery", "rotation-continuity", "archive-readback"].includes(witness.kind || ""),
    identity: isIdentity(witness.issuerId),
    digests: isDigest(witness.subjectDigest) && isDigest(witness.signerKeyFingerprint),
    window: isTimestamp(witness.observedAt) && isTimestamp(witness.validUntil) && isShortWindow(witness.observedAt, witness.validUntil, 31 * DAY),
    digest: Boolean(core) && witness.witnessDigest === externalEvidenceHandoffDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function observerReceiptCore(input: Omit<ExternalEvidenceObserverReceipt, "schemaVersion" | "receiptDigest">) {
  return {
    schemaVersion: "evidence.external-observer-receipt.v1" as const,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    sourceMilestone: input.sourceMilestone,
    assignmentDigest: input.assignmentDigest,
    observerId: input.observerId.trim(),
    status: input.status,
    deliveredAt: input.deliveredAt,
    acknowledgedAt: input.acknowledgedAt,
  };
}

export function createExternalEvidenceObserverReceipt(input: Omit<ExternalEvidenceObserverReceipt, "schemaVersion" | "receiptDigest">) {
  const core = observerReceiptCore(input);
  return { ...core, receiptDigest: externalEvidenceHandoffDigest(core) };
}

export function validateExternalEvidenceObserverReceipt(input: unknown, handoff: ExternalEvidenceHandoff) {
  const receipt = input as Partial<ExternalEvidenceObserverReceipt>;
  const core = receipt.schemaVersion === "evidence.external-observer-receipt.v1" && typeof receipt.handoffId === "string" && typeof receipt.observerId === "string"
    ? observerReceiptCore({
      handoffId: receipt.handoffId,
      handoffDigest: receipt.handoffDigest || "",
      sourceMilestone: receipt.sourceMilestone || "",
      assignmentDigest: receipt.assignmentDigest || "",
      observerId: receipt.observerId,
      status: receipt.status as ExternalEvidenceObserverReceipt["status"],
      deliveredAt: receipt.deliveredAt || "",
      acknowledgedAt: receipt.acknowledgedAt || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "handoffId", "handoffDigest", "sourceMilestone", "assignmentDigest", "observerId", "status", "deliveredAt", "acknowledgedAt", "receiptDigest"]),
    schemaVersion: receipt.schemaVersion === "evidence.external-observer-receipt.v1",
    handoffBinding: receipt.handoffId === handoff.id && receipt.handoffDigest === handoff.handoffDigest,
    milestone: handoff.sourceMilestones.includes(receipt.sourceMilestone || ""),
    assignment: isDigest(receipt.assignmentDigest),
    observer: isIdentity(receipt.observerId),
    status: receipt.status === "acknowledged" || receipt.status === "declined",
    timeline: isTimestamp(receipt.deliveredAt) && isTimestamp(receipt.acknowledgedAt) && Date.parse(receipt.acknowledgedAt) >= Date.parse(receipt.deliveredAt),
    digest: Boolean(core) && receipt.receiptDigest === externalEvidenceHandoffDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function dispatchReceiptCore(input: Omit<ExternalEvidenceDispatchReceipt, "schemaVersion" | "receiptDigest">) {
  return {
    schemaVersion: "evidence.external-dispatch-receipt.v1" as const,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    endpointDigest: input.endpointDigest,
    dispatchedAt: input.dispatchedAt,
    accepted: input.accepted,
  };
}

export function createExternalEvidenceDispatchReceipt(input: Omit<ExternalEvidenceDispatchReceipt, "schemaVersion" | "receiptDigest">) {
  const core = dispatchReceiptCore(input);
  return { ...core, receiptDigest: externalEvidenceHandoffDigest(core) };
}

export function validateExternalEvidenceDispatchReceipt(input: unknown, handoff: ExternalEvidenceHandoff) {
  const receipt = input as Partial<ExternalEvidenceDispatchReceipt>;
  const core = receipt.schemaVersion === "evidence.external-dispatch-receipt.v1" && typeof receipt.handoffId === "string"
    ? dispatchReceiptCore({ handoffId: receipt.handoffId, handoffDigest: receipt.handoffDigest || "", endpointDigest: receipt.endpointDigest || "", dispatchedAt: receipt.dispatchedAt || "", accepted: receipt.accepted === true })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "handoffId", "handoffDigest", "endpointDigest", "dispatchedAt", "accepted", "receiptDigest"]),
    schemaVersion: receipt.schemaVersion === "evidence.external-dispatch-receipt.v1",
    handoffBinding: receipt.handoffId === handoff.id && receipt.handoffDigest === handoff.handoffDigest,
    endpoint: isDigest(receipt.endpointDigest),
    dispatchedAt: isTimestamp(receipt.dispatchedAt),
    accepted: typeof receipt.accepted === "boolean",
    digest: Boolean(core) && receipt.receiptDigest === externalEvidenceHandoffDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function verificationCore(input: Omit<ExternalEvidenceVerification, "schemaVersion" | "verificationDigest">) {
  return {
    schemaVersion: "evidence.external-receipt-verification.v1" as const,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    sourceMilestone: input.sourceMilestone,
    externalReceiptDigest: input.externalReceiptDigest,
    signerKeyFingerprint: input.signerKeyFingerprint,
    signatureDigest: input.signatureDigest,
    outcome: input.outcome,
    verifiedAt: input.verifiedAt,
  };
}

export function createExternalEvidenceVerification(input: Omit<ExternalEvidenceVerification, "schemaVersion" | "verificationDigest">) {
  const core = verificationCore(input);
  return { ...core, verificationDigest: externalEvidenceHandoffDigest(core) };
}

export function validateExternalEvidenceVerification(input: unknown, handoff: ExternalEvidenceHandoff) {
  const verification = input as Partial<ExternalEvidenceVerification>;
  const core = verification.schemaVersion === "evidence.external-receipt-verification.v1" && typeof verification.handoffId === "string"
    ? verificationCore({
      handoffId: verification.handoffId,
      handoffDigest: verification.handoffDigest || "",
      sourceMilestone: verification.sourceMilestone || "",
      externalReceiptDigest: verification.externalReceiptDigest || "",
      signerKeyFingerprint: verification.signerKeyFingerprint || "",
      signatureDigest: verification.signatureDigest || "",
      outcome: verification.outcome as ExternalEvidenceVerification["outcome"],
      verifiedAt: verification.verifiedAt || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "handoffId", "handoffDigest", "sourceMilestone", "externalReceiptDigest", "signerKeyFingerprint", "signatureDigest", "outcome", "verifiedAt", "verificationDigest"]),
    schemaVersion: verification.schemaVersion === "evidence.external-receipt-verification.v1",
    handoffBinding: verification.handoffId === handoff.id && verification.handoffDigest === handoff.handoffDigest,
    milestone: handoff.sourceMilestones.includes(verification.sourceMilestone || ""),
    digests: isDigest(verification.externalReceiptDigest) && isDigest(verification.signerKeyFingerprint) && isDigest(verification.signatureDigest),
    outcome: verification.outcome === "verified" || verification.outcome === "rejected",
    verifiedAt: isTimestamp(verification.verifiedAt),
    digest: Boolean(core) && verification.verificationDigest === externalEvidenceHandoffDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function discrepancyCore(input: Omit<ExternalEvidenceDiscrepancy, "schemaVersion" | "id" | "discrepancyDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-discrepancy.v1" as const,
    id: input.id?.trim() || `external-discrepancy-${randomUUID()}`,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    sourceMilestone: input.sourceMilestone,
    kind: input.kind,
    status: input.status,
    openedBy: input.openedBy.trim(),
    openedAt: input.openedAt,
    closedAt: input.closedAt,
    resolutionDigest: input.resolutionDigest,
  };
}

export function createExternalEvidenceDiscrepancy(input: Omit<ExternalEvidenceDiscrepancy, "schemaVersion" | "id" | "discrepancyDigest"> & { id?: string }) {
  const core = discrepancyCore(input);
  return { ...core, discrepancyDigest: externalEvidenceHandoffDigest(core) };
}

export function validateExternalEvidenceDiscrepancy(input: unknown, handoff: ExternalEvidenceHandoff) {
  const discrepancy = input as Partial<ExternalEvidenceDiscrepancy>;
  const core = discrepancy.schemaVersion === "evidence.external-discrepancy.v1" && typeof discrepancy.handoffId === "string" && typeof discrepancy.openedBy === "string"
    ? discrepancyCore({
      id: discrepancy.id,
      handoffId: discrepancy.handoffId,
      handoffDigest: discrepancy.handoffDigest || "",
      sourceMilestone: discrepancy.sourceMilestone || "",
      kind: discrepancy.kind as ExternalEvidenceDiscrepancy["kind"],
      status: discrepancy.status as ExternalEvidenceDiscrepancy["status"],
      openedBy: discrepancy.openedBy,
      openedAt: discrepancy.openedAt || "",
      closedAt: discrepancy.closedAt === null ? null : discrepancy.closedAt || null,
      resolutionDigest: discrepancy.resolutionDigest === null ? null : discrepancy.resolutionDigest || null,
    })
    : null;
  const closed = discrepancy.closedAt === null || (isTimestamp(discrepancy.closedAt) && Date.parse(discrepancy.closedAt) >= Date.parse(discrepancy.openedAt || ""));
  const terminal = discrepancy.status === "open"
    ? discrepancy.closedAt === null && discrepancy.resolutionDigest === null
    : isTimestamp(discrepancy.closedAt) && isDigest(discrepancy.resolutionDigest);
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "handoffId", "handoffDigest", "sourceMilestone", "kind", "status", "openedBy", "openedAt", "closedAt", "resolutionDigest", "discrepancyDigest"]),
    schemaVersion: discrepancy.schemaVersion === "evidence.external-discrepancy.v1",
    identity: isIdentity(discrepancy.id) && isIdentity(discrepancy.openedBy),
    handoffBinding: discrepancy.handoffId === handoff.id && discrepancy.handoffDigest === handoff.handoffDigest,
    milestone: handoff.sourceMilestones.includes(discrepancy.sourceMilestone || ""),
    kind: ["missing", "mismatch", "stale", "rejected"].includes(discrepancy.kind || ""),
    status: ["open", "resolved", "rejected"].includes(discrepancy.status || ""),
    timeline: isTimestamp(discrepancy.openedAt) && closed,
    terminal,
    digest: Boolean(core) && discrepancy.discrepancyDigest === externalEvidenceHandoffDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function decisionRequestCore(input: Omit<ExternalEvidenceDecisionRequest, "schemaVersion" | "id" | "requestDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-decision-request.v1" as const,
    id: input.id?.trim() || `external-decision-request-${randomUUID()}`,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    coverageDigest: input.coverageDigest,
    requesterId: input.requesterId.trim(),
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
  };
}

export function createExternalEvidenceDecisionRequest(input: Omit<ExternalEvidenceDecisionRequest, "schemaVersion" | "id" | "requestDigest"> & { id?: string }) {
  const core = decisionRequestCore(input);
  return { ...core, requestDigest: externalEvidenceHandoffDigest(core) };
}

export function validateExternalEvidenceDecisionRequest(input: unknown, handoff: ExternalEvidenceHandoff) {
  const request = input as Partial<ExternalEvidenceDecisionRequest>;
  const core = request.schemaVersion === "evidence.external-decision-request.v1" && typeof request.handoffId === "string" && typeof request.requesterId === "string"
    ? decisionRequestCore({
      id: request.id,
      handoffId: request.handoffId,
      handoffDigest: request.handoffDigest || "",
      coverageDigest: request.coverageDigest || "",
      requesterId: request.requesterId,
      requestedAt: request.requestedAt || "",
      expiresAt: request.expiresAt || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "handoffId", "handoffDigest", "coverageDigest", "requesterId", "requestedAt", "expiresAt", "requestDigest"]),
    schemaVersion: request.schemaVersion === "evidence.external-decision-request.v1",
    identity: isIdentity(request.id) && isIdentity(request.requesterId),
    handoffBinding: request.handoffId === handoff.id && request.handoffDigest === handoff.handoffDigest,
    coverage: isDigest(request.coverageDigest),
    window: isTimestamp(request.requestedAt) && isTimestamp(request.expiresAt) && isShortWindow(request.requestedAt, request.expiresAt, 7 * DAY),
    digest: Boolean(core) && request.requestDigest === externalEvidenceHandoffDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function decisionEnvelopeCore(input: Omit<ExternalEvidenceDecisionEnvelope, "schemaVersion" | "decisionDigest">) {
  return {
    schemaVersion: "evidence.external-decision-envelope.v1" as const,
    requestId: input.requestId.trim(),
    requestDigest: input.requestDigest,
    decision: input.decision,
    signerId: input.signerId.trim(),
    signerKeyFingerprint: input.signerKeyFingerprint,
    issuedAt: input.issuedAt,
  };
}

export function createExternalEvidenceDecisionEnvelope(input: Omit<ExternalEvidenceDecisionEnvelope, "schemaVersion" | "decisionDigest">) {
  const core = decisionEnvelopeCore(input);
  return { ...core, decisionDigest: externalEvidenceHandoffDigest(core) };
}

export function validateExternalEvidenceDecisionEnvelope(input: unknown, request: ExternalEvidenceDecisionRequest) {
  const envelope = input as Partial<ExternalEvidenceDecisionEnvelope>;
  const core = envelope.schemaVersion === "evidence.external-decision-envelope.v1" && typeof envelope.requestId === "string" && typeof envelope.signerId === "string"
    ? decisionEnvelopeCore({
      requestId: envelope.requestId,
      requestDigest: envelope.requestDigest || "",
      decision: envelope.decision as ExternalEvidenceDecisionEnvelope["decision"],
      signerId: envelope.signerId,
      signerKeyFingerprint: envelope.signerKeyFingerprint || "",
      issuedAt: envelope.issuedAt || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "requestId", "requestDigest", "decision", "signerId", "signerKeyFingerprint", "issuedAt", "decisionDigest"]),
    schemaVersion: envelope.schemaVersion === "evidence.external-decision-envelope.v1",
    requestBinding: envelope.requestId === request.id && envelope.requestDigest === request.requestDigest,
    decision: envelope.decision === "approved" || envelope.decision === "rejected",
    signer: isIdentity(envelope.signerId) && isDigest(envelope.signerKeyFingerprint),
    issuedAt: isTimestamp(envelope.issuedAt),
    digest: Boolean(core) && envelope.decisionDigest === externalEvidenceHandoffDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function buildExternalEvidenceCoverage(input: {
  handoff: ExternalEvidenceHandoff;
  observerReceipts: ExternalEvidenceObserverReceipt[];
  dispatchReceipts: ExternalEvidenceDispatchReceipt[];
  verifications: ExternalEvidenceVerification[];
  discrepancies: ExternalEvidenceDiscrepancy[];
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const current = now < Date.parse(input.handoff.expiresAt);
  const dispatched = input.dispatchReceipts.some((receipt) => receipt.handoffDigest === input.handoff.handoffDigest && receipt.accepted);
  const coveredMilestones = input.handoff.sourceMilestones.filter((sourceMilestone) => {
    const acknowledged = input.observerReceipts.some((receipt) => receipt.handoffDigest === input.handoff.handoffDigest && receipt.sourceMilestone === sourceMilestone && receipt.status === "acknowledged");
    const verified = input.verifications.some((verification) => verification.handoffDigest === input.handoff.handoffDigest && verification.sourceMilestone === sourceMilestone && verification.outcome === "verified");
    const unresolved = input.discrepancies.some((discrepancy) => discrepancy.handoffDigest === input.handoff.handoffDigest && discrepancy.sourceMilestone === sourceMilestone && discrepancy.status === "open");
    return acknowledged && verified && !unresolved;
  });
  const core = {
    handoffDigest: input.handoff.handoffDigest,
    current,
    dispatched,
    coveredMilestones,
    unresolvedDiscrepancies: input.discrepancies.filter((entry) => entry.handoffDigest === input.handoff.handoffDigest && entry.status === "open").length,
  };
  return {
    ...core,
    status: current && dispatched && coveredMilestones.length === input.handoff.sourceMilestones.length && core.unresolvedDiscrepancies === 0
      ? "ready-for-independent-decision" as const
      : "hold" as const,
    coverageDigest: externalEvidenceHandoffDigest(core),
  };
}

export function createUnconfiguredExternalEvidenceHandoffPort(): ExternalEvidenceHandoffPort {
  const unavailable = async () => {
    throw new ExternalEvidenceHandoffError("external-unavailable", "A controlled credential resolver, authority witness endpoint, archive reader, observer channel, and decision authority are not configured.");
  };
  return {
    observeAuthority: unavailable,
    deliverToObserver: unavailable,
    dispatchHandoff: unavailable,
    verifyReceipt: unavailable,
    requestDecision: unavailable,
  };
}

export async function executeExternalEvidenceHandoff(input: {
  handoff: ExternalEvidenceHandoff;
  profile: EvidenceAuthorityProfile;
  campaign: EvidenceAuthorityCampaign;
  assignmentDigests: Record<string, string>;
  externalReceiptDigests: Record<string, string>;
  port?: ExternalEvidenceHandoffPort;
}) {
  if (!validateExternalEvidenceHandoff(input.handoff, input.profile, input.campaign).ok || !input.handoff.sourceMilestones.every((milestone) => isDigest(input.assignmentDigests[milestone]) && isDigest(input.externalReceiptDigests[milestone]))) {
    throw new ExternalEvidenceHandoffError("invalid-input", "A strict handoff, matching profile/campaign, assignment digests, and external receipt digests are required.");
  }
  const port = input.port || createUnconfiguredExternalEvidenceHandoffPort();
  const witnesses = await Promise.all(([
    "credential-resolution",
    "trust-discovery",
    "rotation-continuity",
    "archive-readback",
  ] as const).map((kind) => port.observeAuthority({ handoff: input.handoff, kind })));
  if (!witnesses.every((witness) => validateExternalEvidenceAuthorityWitness(witness, input.handoff).ok)) {
    throw new ExternalEvidenceHandoffError("external-binding-failed", "Authority witnesses did not bind the current handoff and profile.");
  }
  const observerReceipts = await Promise.all(input.handoff.sourceMilestones.map((sourceMilestone) => port.deliverToObserver({
    handoff: input.handoff,
    sourceMilestone,
    assignmentDigest: input.assignmentDigests[sourceMilestone],
  })));
  const dispatchReceipt = await port.dispatchHandoff({ handoff: input.handoff });
  const verifications = await Promise.all(input.handoff.sourceMilestones.map((sourceMilestone) => port.verifyReceipt({
    handoff: input.handoff,
    sourceMilestone,
    externalReceiptDigest: input.externalReceiptDigests[sourceMilestone],
  })));
  if (!observerReceipts.every((receipt) => validateExternalEvidenceObserverReceipt(receipt, input.handoff).ok) || !validateExternalEvidenceDispatchReceipt(dispatchReceipt, input.handoff).ok || !verifications.every((verification) => validateExternalEvidenceVerification(verification, input.handoff).ok)) {
    throw new ExternalEvidenceHandoffError("external-binding-failed", "Observer, dispatch, or receipt verification output did not bind the current handoff.");
  }
  const coverage = buildExternalEvidenceCoverage({ handoff: input.handoff, observerReceipts, dispatchReceipts: [dispatchReceipt], verifications, discrepancies: [] });
  const request = createExternalEvidenceDecisionRequest({
    handoffId: input.handoff.id,
    handoffDigest: input.handoff.handoffDigest,
    coverageDigest: coverage.coverageDigest,
    requesterId: input.handoff.requesterId,
    requestedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + DAY).toISOString(),
  });
  const envelope = await port.requestDecision({ handoff: input.handoff, request });
  if (!validateExternalEvidenceDecisionRequest(request, input.handoff).ok || !validateExternalEvidenceDecisionEnvelope(envelope, request).ok) {
    throw new ExternalEvidenceHandoffError("external-binding-failed", "Decision output did not bind the exact decision request.");
  }
  return { witnesses, observerReceipts, dispatchReceipt, verifications, coverage, request, envelope };
}

export function emptyExternalEvidenceHandoffStore(): ExternalEvidenceHandoffStore {
  return {
    schemaVersion: "evidence.external-handoff-store.v1",
    revision: 0,
    handoffs: [],
    witnesses: [],
    observerReceipts: [],
    dispatchReceipts: [],
    verifications: [],
    discrepancies: [],
    decisionRequests: [],
    decisionEnvelopes: [],
    idempotency: {},
  };
}

function observationDigest(observation: ExternalEvidenceHandoffObservation) {
  switch (observation.kind) {
    case "witness": return observation.value.witnessDigest;
    case "observer-receipt": return observation.value.receiptDigest;
    case "dispatch-receipt": return observation.value.receiptDigest;
    case "verification": return observation.value.verificationDigest;
    case "discrepancy": return observation.value.discrepancyDigest;
    case "decision-request": return observation.value.requestDigest;
    case "decision-envelope": return observation.value.decisionDigest;
  }
}

function validStoreHandoff(input: unknown) {
  return validateExternalEvidenceHandoffShape(input).ok;
}

export function validateExternalEvidenceHandoffStore(input: unknown): input is ExternalEvidenceHandoffStore {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const store = input as Partial<ExternalEvidenceHandoffStore>;
  const idempotency = store.idempotency;
  if (store.schemaVersion !== "evidence.external-handoff-store.v1" || !Number.isInteger(store.revision) || Number(store.revision) < 0 || !Array.isArray(store.handoffs) || !Array.isArray(store.witnesses) || !Array.isArray(store.observerReceipts) || !Array.isArray(store.dispatchReceipts) || !Array.isArray(store.verifications) || !Array.isArray(store.discrepancies) || !Array.isArray(store.decisionRequests) || !Array.isArray(store.decisionEnvelopes) || !idempotency || typeof idempotency !== "object" || Array.isArray(idempotency)) return false;
  const total = store.witnesses.length + store.observerReceipts.length + store.dispatchReceipts.length + store.verifications.length + store.discrepancies.length + store.decisionRequests.length + store.decisionEnvelopes.length;
  if (store.handoffs.length > MAX_HANDOFFS || total > MAX_OBSERVATIONS) return false;
  const handoffs = store.handoffs as ExternalEvidenceHandoff[];
  if (new Set(handoffs.map((handoff) => handoff.id)).size !== handoffs.length || new Set(handoffs.map((handoff) => handoff.idempotencyKey)).size !== handoffs.length || !handoffs.every(validStoreHandoff)) return false;
  if (
    Object.keys(idempotency).length !== handoffs.length ||
    !handoffs.every((handoff) => idempotency[handoff.idempotencyKey] === handoff.id) ||
    !Object.entries(idempotency).every(([key, id]) => typeof id === "string" && handoffs.some((handoff) => handoff.idempotencyKey === key && handoff.id === id))
  ) return false;
  const findHandoff = (id: string, handoffDigest: string) => handoffs.find((handoff) => handoff.id === id && handoff.handoffDigest === handoffDigest);
  const witnesses = store.witnesses as ExternalEvidenceAuthorityWitness[];
  const observerReceipts = store.observerReceipts as ExternalEvidenceObserverReceipt[];
  const dispatchReceipts = store.dispatchReceipts as ExternalEvidenceDispatchReceipt[];
  const verifications = store.verifications as ExternalEvidenceVerification[];
  const discrepancies = store.discrepancies as ExternalEvidenceDiscrepancy[];
  const decisionRequests = store.decisionRequests as ExternalEvidenceDecisionRequest[];
  const decisionEnvelopes = store.decisionEnvelopes as ExternalEvidenceDecisionEnvelope[];
  if (!witnesses.every((value) => {
    const handoff = findHandoff(value.handoffId, value.handoffDigest);
    return Boolean(handoff && validateExternalEvidenceAuthorityWitness(value, handoff).ok);
  }) || !observerReceipts.every((value) => {
    const handoff = findHandoff(value.handoffId, value.handoffDigest);
    return Boolean(handoff && validateExternalEvidenceObserverReceipt(value, handoff).ok);
  }) || !dispatchReceipts.every((value) => {
    const handoff = findHandoff(value.handoffId, value.handoffDigest);
    return Boolean(handoff && validateExternalEvidenceDispatchReceipt(value, handoff).ok);
  }) || !verifications.every((value) => {
    const handoff = findHandoff(value.handoffId, value.handoffDigest);
    return Boolean(handoff && validateExternalEvidenceVerification(value, handoff).ok);
  }) || !discrepancies.every((value) => {
    const handoff = findHandoff(value.handoffId, value.handoffDigest);
    return Boolean(handoff && validateExternalEvidenceDiscrepancy(value, handoff).ok);
  }) || !decisionRequests.every((value) => {
    const handoff = findHandoff(value.handoffId, value.handoffDigest);
    return Boolean(handoff && validateExternalEvidenceDecisionRequest(value, handoff).ok);
  }) || !decisionEnvelopes.every((value) => {
    const request = decisionRequests.find((entry) => entry.id === value.requestId && entry.requestDigest === value.requestDigest);
    return Boolean(request && validateExternalEvidenceDecisionEnvelope(value, request).ok);
  })) return false;
  const allDigests = [
    ...witnesses.map((value) => value.witnessDigest),
    ...observerReceipts.map((value) => value.receiptDigest),
    ...dispatchReceipts.map((value) => value.receiptDigest),
    ...verifications.map((value) => value.verificationDigest),
    ...discrepancies.map((value) => value.discrepancyDigest),
    ...decisionRequests.map((value) => value.requestDigest),
    ...decisionEnvelopes.map((value) => value.decisionDigest),
  ];
  return new Set(allDigests).size === allDigests.length;
}

export function insertExternalEvidenceHandoff(store: ExternalEvidenceHandoffStore, handoff: ExternalEvidenceHandoff) {
  if (!validStoreHandoff(handoff)) throw new ExternalEvidenceHandoffError("invalid-input", "External evidence handoff failed strict validation.");
  const existingId = store.idempotency[handoff.idempotencyKey];
  const existing = existingId ? store.handoffs.find((entry) => entry.id === existingId) : undefined;
  if (existing) {
    if (existing.handoffDigest !== handoff.handoffDigest) throw new ExternalEvidenceHandoffError("revision-conflict", "Handoff idempotency key is already bound to another digest.");
    return { store, handoff: existing, deduplicated: true };
  }
  if (store.handoffs.length >= MAX_HANDOFFS) throw new ExternalEvidenceHandoffError("capacity-exceeded", "Handoff capacity reached without evicting existing evidence.");
  return {
    store: {
      ...store,
      revision: store.revision + 1,
      handoffs: [handoff, ...store.handoffs],
      idempotency: { ...store.idempotency, [handoff.idempotencyKey]: handoff.id },
    },
    handoff,
    deduplicated: false,
  };
}

export function appendExternalEvidenceHandoffObservation(store: ExternalEvidenceHandoffStore, observation: ExternalEvidenceHandoffObservation) {
  const handoffId = observation.kind === "decision-envelope" ? null : observation.value.handoffId;
  const handoffDigest = observation.kind === "decision-envelope" ? null : observation.value.handoffDigest;
  const handoff = handoffId && handoffDigest ? store.handoffs.find((entry) => entry.id === handoffId && entry.handoffDigest === handoffDigest) : null;
  if (observation.kind === "decision-envelope") {
    const request = store.decisionRequests.find((entry) => entry.id === observation.value.requestId && entry.requestDigest === observation.value.requestDigest);
    if (!request || !validateExternalEvidenceDecisionEnvelope(observation.value, request).ok) throw new ExternalEvidenceHandoffError("invalid-input", "Decision envelope failed strict request binding.");
  } else if (!handoff) {
    throw new ExternalEvidenceHandoffError("invalid-input", "Observation does not bind a stored handoff.");
  } else {
    const valid = observation.kind === "witness" ? validateExternalEvidenceAuthorityWitness(observation.value, handoff).ok
      : observation.kind === "observer-receipt" ? validateExternalEvidenceObserverReceipt(observation.value, handoff).ok
        : observation.kind === "dispatch-receipt" ? validateExternalEvidenceDispatchReceipt(observation.value, handoff).ok
          : observation.kind === "verification" ? validateExternalEvidenceVerification(observation.value, handoff).ok
            : observation.kind === "discrepancy" ? validateExternalEvidenceDiscrepancy(observation.value, handoff).ok
              : validateExternalEvidenceDecisionRequest(observation.value, handoff).ok;
    if (!valid) throw new ExternalEvidenceHandoffError("invalid-input", "Observation failed strict handoff binding.");
  }
  const recordDigest = observationDigest(observation);
  const existing = [
    ...store.witnesses.map((value) => value.witnessDigest),
    ...store.observerReceipts.map((value) => value.receiptDigest),
    ...store.dispatchReceipts.map((value) => value.receiptDigest),
    ...store.verifications.map((value) => value.verificationDigest),
    ...store.discrepancies.map((value) => value.discrepancyDigest),
    ...store.decisionRequests.map((value) => value.requestDigest),
    ...store.decisionEnvelopes.map((value) => value.decisionDigest),
  ];
  if (existing.includes(recordDigest)) return store;
  if (existing.length >= MAX_OBSERVATIONS) throw new ExternalEvidenceHandoffError("capacity-exceeded", "Handoff observation capacity reached without evicting evidence.");
  const next = { ...store, revision: store.revision + 1 };
  switch (observation.kind) {
    case "witness": return { ...next, witnesses: [observation.value, ...store.witnesses] };
    case "observer-receipt": return { ...next, observerReceipts: [observation.value, ...store.observerReceipts] };
    case "dispatch-receipt": return { ...next, dispatchReceipts: [observation.value, ...store.dispatchReceipts] };
    case "verification": return { ...next, verifications: [observation.value, ...store.verifications] };
    case "discrepancy": return { ...next, discrepancies: [observation.value, ...store.discrepancies] };
    case "decision-request": return { ...next, decisionRequests: [observation.value, ...store.decisionRequests] };
    case "decision-envelope": return { ...next, decisionEnvelopes: [observation.value, ...store.decisionEnvelopes] };
  }
}

export const EXTERNAL_EVIDENCE_HANDOFF_PLANS: ExternalEvidenceHandoffPlan[] = [
  { version: "v5.0.0", label: "External Handoff Request Contract", track: "handoff", localGate: "A fourteen-domain digest-only handoff binds one authority profile, campaign, escrow digest, requester, and expiry.", externalGate: "An authorized organization requester must submit the handoff to a controlled authority.", requiresExternalWitness: false },
  { version: "v5.0.1", label: "Credential Resolution Witness", track: "witness", localGate: "Credential-resolution proof is a short-lived signed digest record, never a raw token or secret value.", externalGate: "A controlled secret resolver or workload identity must issue the live resolution witness.", requiresExternalWitness: true },
  { version: "v5.0.2", label: "Trust Discovery Witness", track: "witness", localGate: "Trust discovery is bound to the exact handoff and profile with a signer fingerprint and validity window.", externalGate: "The authority discovery endpoint must return the current trust witness.", requiresExternalWitness: true },
  { version: "v5.0.3", label: "Rotation Continuity Witness", track: "witness", localGate: "Key rotation is an explicit continuation witness rather than an unrecorded signer change.", externalGate: "The authority must attest the active and retiring key continuity window.", requiresExternalWitness: true },
  { version: "v5.0.4", label: "Immutable Archive Read-back Witness", track: "witness", localGate: "Archive evidence references policy and object digests with a bounded signed read-back window.", externalGate: "Immutable storage must read back current retention and legal-hold state.", requiresExternalWitness: true },
  { version: "v5.0.5", label: "Independent Observer Delivery", track: "delivery", localGate: "Each domain delivery binds an assignment digest and independent observer acknowledgement.", externalGate: "Each assigned observer must accept or decline the delivered workload.", requiresExternalWitness: true },
  { version: "v5.0.6", label: "Authority Dispatch Receipt", track: "delivery", localGate: "One digest-bound dispatch receipt records delivery without carrying endpoint payloads.", externalGate: "The controlled authority endpoint must acknowledge the live handoff.", requiresExternalWitness: true },
  { version: "v5.0.7", label: "Signed Receipt Verification", track: "verification", localGate: "Per-domain verification binds external receipt, signer, signature, outcome, and handoff identity.", externalGate: "The authority must provide each independently signed receipt for verification.", requiresExternalWitness: true },
  { version: "v5.0.8", label: "Receipt Reverification Window", track: "verification", localGate: "Receipt validity is derived from a current handoff window and cannot silently survive expiry.", externalGate: "The authority must renew current verification when a window expires.", requiresExternalWitness: true },
  { version: "v5.0.9", label: "Discrepancy Case Ledger", track: "verification", localGate: "Missing, mismatched, stale, and rejected evidence stays in a strict append-only case state.", externalGate: "A qualified authority owner must resolve discrepancies with external evidence.", requiresExternalWitness: false },
  { version: "v5.1.0", label: "Fourteen-Domain Coverage Projection", track: "verification", localGate: "Coverage requires an acknowledged observer, accepted dispatch, verified receipt, and no open discrepancy per domain.", externalGate: "All fourteen independent authority outcomes must be current.", requiresExternalWitness: true },
  { version: "v5.1.1", label: "External Evidence Renewal Queue", track: "verification", localGate: "Expired handoffs remain visible as held work and cannot contribute stale coverage.", externalGate: "The authority and observers must reissue fresh evidence after expiry.", requiresExternalWitness: true },
  { version: "v5.1.2", label: "Distribution Decision Request", track: "decision", localGate: "A decision request binds only the current coverage digest and expires independently from evidence.", externalGate: "A separate distribution authority must receive and evaluate the request.", requiresExternalWitness: true },
  { version: "v5.1.3", label: "Independent Decision Envelope", track: "decision", localGate: "A signed decision envelope must bind the exact request but cannot alter local release state.", externalGate: "An independent decision authority must issue the actual distribution outcome.", requiresExternalWitness: true },
  { version: "v5.1.4", label: "Production Safety Interlock", track: "decision", localGate: "Every completed handoff remains explicitly non-authorizing for distribution and production.", externalGate: "Production authority requires a separate authorized control-plane transition and witness.", requiresExternalWitness: true },
];
