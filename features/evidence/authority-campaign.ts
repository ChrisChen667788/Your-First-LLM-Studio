import { createHash, randomUUID } from "node:crypto";

import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { evidenceAcceptanceDigest } from "@/features/evidence/acceptance-lifecycle";

export const EVIDENCE_AUTHORITY_CAMPAIGN_SCHEMA_VERSION =
  "evidence.authority-campaign.v1" as const;

export type EvidenceAuthorityCampaignPlan = {
  version: string;
  label: string;
  track: "profile" | "campaign" | "challenge" | "receipt" | "release";
  localGate: string;
  externalGate: string;
  requiresExternalReceipt: boolean;
};

export type EvidenceAuthorityCredentialReference = {
  schemaVersion: "evidence.authority-credential-reference.v1";
  kind: "vault" | "workload-identity" | "operator-approved";
  reference: string;
  referenceDigest: string;
};

export type EvidenceAuthorityProfile = {
  schemaVersion: "evidence.authority-profile.v1";
  id: string;
  organizationId: string;
  authorityConfigDigest: string;
  discoveryUrl: string;
  challengeUrl: string;
  receiptUrl: string;
  credentialReference: EvidenceAuthorityCredentialReference;
  maxReceiptAgeHours: number;
  profileDigest: string;
};

export type EvidenceAuthorityTrustSnapshot = {
  schemaVersion: "evidence.authority-trust-snapshot.v1";
  profileId: string;
  profileDigest: string;
  issuerId: string;
  jwksDigest: string;
  archivePolicyDigest: string;
  observedAt: string;
  snapshotDigest: string;
};

export type EvidenceAuthorityCampaign = {
  schemaVersion: "evidence.authority-campaign.v1";
  id: string;
  idempotencyKey: string;
  profileId: string;
  profileDigest: string;
  requesterId: string;
  sourceMilestones: string[];
  requestedAt: string;
  expiresAt: string;
  campaignDigest: string;
};

export type EvidenceAuthorityAssignment = {
  schemaVersion: "evidence.authority-assignment.v1";
  campaignId: string;
  campaignDigest: string;
  sourceMilestone: string;
  observerId: string;
  assignedBy: string;
  assignedAt: string;
  assignmentDigest: string;
};

export type EvidenceAuthorityChallenge = {
  schemaVersion: "evidence.authority-challenge.v1";
  id: string;
  campaignId: string;
  campaignDigest: string;
  profileDigest: string;
  packageId: string;
  sourceMilestone: string;
  nonceDigest: string;
  issuedAt: string;
  expiresAt: string;
  challengeDigest: string;
};

export type EvidenceAuthorityReceiptEnvelope = {
  schemaVersion: "evidence.authority-receipt-envelope.v1";
  id: string;
  campaignId: string;
  campaignDigest: string;
  challengeDigest: string;
  profileDigest: string;
  packageId: string;
  sourceMilestone: string;
  outcome: "verified" | "rejected";
  signerKeyFingerprint: string;
  observedAt: string;
  receiptDigest: string;
};

export type EvidenceAuthorityReceiptDisposition =
  | "pending-review"
  | "accepted-for-binding"
  | "quarantined";

export type EvidenceAuthorityReceiptRecord = {
  envelope: EvidenceAuthorityReceiptEnvelope;
  disposition: EvidenceAuthorityReceiptDisposition;
  reason: string | null;
  recordedAt: string;
};

export type EvidenceAuthorityCampaignStore = {
  schemaVersion: "evidence.authority-campaign-store.v1";
  revision: number;
  profiles: EvidenceAuthorityProfile[];
  campaigns: EvidenceAuthorityCampaign[];
  assignments: EvidenceAuthorityAssignment[];
  receipts: EvidenceAuthorityReceiptRecord[];
  idempotency: Record<string, string>;
};

export type EvidenceAuthorityExternalPort = {
  discoverTrust(input: EvidenceAuthorityProfile): Promise<EvidenceAuthorityTrustSnapshot>;
  dispatchChallenge(input: {
    profile: EvidenceAuthorityProfile;
    campaign: EvidenceAuthorityCampaign;
    challenge: EvidenceAuthorityChallenge;
  }): Promise<{ accepted: boolean; challengeDigest: string; dispatchDigest: string }>;
  readReceipt(input: {
    profile: EvidenceAuthorityProfile;
    challenge: EvidenceAuthorityChallenge;
  }): Promise<EvidenceAuthorityReceiptEnvelope>;
};

export class EvidenceAuthorityCampaignError extends Error {
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
    this.name = "EvidenceAuthorityCampaignError";
  }
}

const DAY = 24 * 60 * 60 * 1_000;
const HEX = /^[a-f0-9]{64}$/u;
const IDENTITY = /^[a-z0-9][a-z0-9._:@/-]{2,127}$/iu;
const MAX_PROFILES = 40;
const MAX_CAMPAIGNS = 200;
const MAX_ASSIGNMENTS = 2_000;
const MAX_RECEIPTS = 2_000;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown) {
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

function isExternalHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase()) &&
      !/^10\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\./u.test(url.hostname);
  } catch {
    return false;
  }
}

function onlyKeys(value: unknown, keys: readonly string[]) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)) &&
    Object.keys(value as Record<string, unknown>).every((key) => keys.includes(key));
}

function expectedMilestones(values: string[]) {
  return values.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length &&
    values.every((value, index) => value === EVIDENCE_COLLECTION_SOURCE_MILESTONES[index]);
}

function credentialCore(input: Omit<EvidenceAuthorityCredentialReference, "schemaVersion" | "referenceDigest">) {
  return {
    schemaVersion: "evidence.authority-credential-reference.v1" as const,
    kind: input.kind,
    reference: input.reference.trim(),
  };
}

export function createEvidenceAuthorityCredentialReference(input: Omit<EvidenceAuthorityCredentialReference, "schemaVersion" | "referenceDigest">) {
  const core = credentialCore(input);
  return { ...core, referenceDigest: digest(core) };
}

export function validateEvidenceAuthorityCredentialReference(input: unknown) {
  const reference = input as Partial<EvidenceAuthorityCredentialReference>;
  const core = reference.schemaVersion === "evidence.authority-credential-reference.v1" &&
    (reference.kind === "vault" || reference.kind === "workload-identity" || reference.kind === "operator-approved") &&
    typeof reference.reference === "string"
    ? credentialCore({ kind: reference.kind, reference: reference.reference })
    : null;
  const referenceValue = typeof reference.reference === "string" ? reference.reference.trim() : "";
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "kind", "reference", "referenceDigest"]),
    schemaVersion: reference.schemaVersion === "evidence.authority-credential-reference.v1",
    kind: reference.kind === "vault" || reference.kind === "workload-identity" || reference.kind === "operator-approved",
    opaqueReference: /^(?:vault|workload-identity|operator-approved):\/\/[a-z0-9][a-z0-9._:@/-]{2,255}$/iu.test(referenceValue) &&
      !/(?:sk-[a-z0-9]{12,}|(?:api[_-]?key|token|secret)=)/iu.test(referenceValue),
    digest: Boolean(core) && reference.referenceDigest === digest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function profileCore(input: Omit<EvidenceAuthorityProfile, "schemaVersion" | "profileDigest">) {
  return {
    schemaVersion: "evidence.authority-profile.v1" as const,
    id: input.id.trim(),
    organizationId: input.organizationId.trim(),
    authorityConfigDigest: input.authorityConfigDigest,
    discoveryUrl: input.discoveryUrl.trim(),
    challengeUrl: input.challengeUrl.trim(),
    receiptUrl: input.receiptUrl.trim(),
    credentialReference: input.credentialReference,
    maxReceiptAgeHours: input.maxReceiptAgeHours,
  };
}

export function createEvidenceAuthorityProfile(input: Omit<EvidenceAuthorityProfile, "schemaVersion" | "profileDigest">) {
  const core = profileCore(input);
  return { ...core, profileDigest: digest(core) };
}

export function validateEvidenceAuthorityProfile(input: unknown) {
  const profile = input as Partial<EvidenceAuthorityProfile>;
  const core = profile.id && profile.organizationId && profile.authorityConfigDigest && profile.discoveryUrl && profile.challengeUrl && profile.receiptUrl && profile.credentialReference && typeof profile.maxReceiptAgeHours === "number"
    ? profileCore({
      id: profile.id,
      organizationId: profile.organizationId,
      authorityConfigDigest: profile.authorityConfigDigest,
      discoveryUrl: profile.discoveryUrl,
      challengeUrl: profile.challengeUrl,
      receiptUrl: profile.receiptUrl,
      credentialReference: profile.credentialReference,
      maxReceiptAgeHours: profile.maxReceiptAgeHours,
    })
    : null;
  const urls = [profile.discoveryUrl, profile.challengeUrl, profile.receiptUrl];
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "id", "organizationId", "authorityConfigDigest", "discoveryUrl", "challengeUrl", "receiptUrl", "credentialReference", "maxReceiptAgeHours", "profileDigest"]),
    schemaVersion: profile.schemaVersion === "evidence.authority-profile.v1",
    identity: isIdentity(profile.id) && isIdentity(profile.organizationId),
    authorityConfig: isDigest(profile.authorityConfigDigest),
    endpoints: urls.every(isExternalHttpsUrl) && new Set(urls).size === 3,
    credential: validateEvidenceAuthorityCredentialReference(profile.credentialReference).ok,
    receiptAge: Number.isInteger(profile.maxReceiptAgeHours) && Number(profile.maxReceiptAgeHours) >= 1 && Number(profile.maxReceiptAgeHours) <= 24 * 30,
    digest: Boolean(core) && profile.profileDigest === digest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function snapshotCore(input: Omit<EvidenceAuthorityTrustSnapshot, "schemaVersion" | "snapshotDigest">) {
  return {
    schemaVersion: "evidence.authority-trust-snapshot.v1" as const,
    profileId: input.profileId,
    profileDigest: input.profileDigest,
    issuerId: input.issuerId,
    jwksDigest: input.jwksDigest,
    archivePolicyDigest: input.archivePolicyDigest,
    observedAt: input.observedAt,
  };
}

export function createEvidenceAuthorityTrustSnapshot(input: Omit<EvidenceAuthorityTrustSnapshot, "schemaVersion" | "snapshotDigest">) {
  const core = snapshotCore(input);
  return { ...core, snapshotDigest: digest(core) };
}

export function validateEvidenceAuthorityTrustSnapshot(input: unknown, profile: EvidenceAuthorityProfile, now = Date.now()) {
  const snapshot = input as Partial<EvidenceAuthorityTrustSnapshot>;
  const core = snapshot.profileId && snapshot.profileDigest && snapshot.issuerId && snapshot.jwksDigest && snapshot.archivePolicyDigest && snapshot.observedAt
    ? snapshotCore({
      profileId: snapshot.profileId,
      profileDigest: snapshot.profileDigest,
      issuerId: snapshot.issuerId,
      jwksDigest: snapshot.jwksDigest,
      archivePolicyDigest: snapshot.archivePolicyDigest,
      observedAt: snapshot.observedAt,
    })
    : null;
  const observedAt = snapshot.observedAt ? Date.parse(snapshot.observedAt) : NaN;
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "profileId", "profileDigest", "issuerId", "jwksDigest", "archivePolicyDigest", "observedAt", "snapshotDigest"]),
    schemaVersion: snapshot.schemaVersion === "evidence.authority-trust-snapshot.v1",
    profile: snapshot.profileId === profile.id && snapshot.profileDigest === profile.profileDigest,
    issuer: isIdentity(snapshot.issuerId),
    digests: [snapshot.jwksDigest, snapshot.archivePolicyDigest].every(isDigest),
    fresh: Number.isFinite(observedAt) && observedAt <= now + 5 * 60_000 && now - observedAt <= 7 * DAY,
    digest: Boolean(core) && snapshot.snapshotDigest === digest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function campaignCore(input: Omit<EvidenceAuthorityCampaign, "schemaVersion" | "id" | "campaignDigest">) {
  return {
    schemaVersion: "evidence.authority-campaign.v1" as const,
    idempotencyKey: input.idempotencyKey.trim(),
    profileId: input.profileId,
    profileDigest: input.profileDigest,
    requesterId: input.requesterId.trim(),
    sourceMilestones: [...input.sourceMilestones],
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
  };
}

export function createEvidenceAuthorityCampaign(input: Omit<EvidenceAuthorityCampaign, "schemaVersion" | "id" | "campaignDigest">) {
  const id = randomUUID();
  const core = campaignCore(input);
  return { id, ...core, campaignDigest: digest({ id, ...core }) };
}

export function validateEvidenceAuthorityCampaign(input: unknown, profile: EvidenceAuthorityProfile, now = Date.now()) {
  const campaign = input as Partial<EvidenceAuthorityCampaign>;
  const core = campaign.idempotencyKey && campaign.profileId && campaign.profileDigest && campaign.requesterId && Array.isArray(campaign.sourceMilestones) && campaign.requestedAt && campaign.expiresAt
    ? campaignCore({
      idempotencyKey: campaign.idempotencyKey,
      profileId: campaign.profileId,
      profileDigest: campaign.profileDigest,
      requesterId: campaign.requesterId,
      sourceMilestones: campaign.sourceMilestones,
      requestedAt: campaign.requestedAt,
      expiresAt: campaign.expiresAt,
    })
    : null;
  const requestedAt = campaign.requestedAt ? Date.parse(campaign.requestedAt) : NaN;
  const expiresAt = campaign.expiresAt ? Date.parse(campaign.expiresAt) : NaN;
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "id", "idempotencyKey", "profileId", "profileDigest", "requesterId", "sourceMilestones", "requestedAt", "expiresAt", "campaignDigest"]),
    schemaVersion: campaign.schemaVersion === "evidence.authority-campaign.v1",
    id: typeof campaign.id === "string" && campaign.id.length >= 12 && typeof campaign.idempotencyKey === "string" && campaign.idempotencyKey.length >= 8,
    profile: campaign.profileId === profile.id && campaign.profileDigest === profile.profileDigest,
    requester: isIdentity(campaign.requesterId),
    coverage: Array.isArray(campaign.sourceMilestones) && expectedMilestones(campaign.sourceMilestones),
    window: Number.isFinite(requestedAt) && Number.isFinite(expiresAt) && requestedAt <= now + 5 * 60_000 && expiresAt > requestedAt && expiresAt - requestedAt <= 30 * DAY,
    digest: Boolean(core) && campaign.campaignDigest === digest({ id: campaign.id, ...core }),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function assignmentCore(input: Omit<EvidenceAuthorityAssignment, "schemaVersion" | "assignmentDigest">) {
  return {
    schemaVersion: "evidence.authority-assignment.v1" as const,
    campaignId: input.campaignId,
    campaignDigest: input.campaignDigest,
    sourceMilestone: input.sourceMilestone,
    observerId: input.observerId.trim(),
    assignedBy: input.assignedBy.trim(),
    assignedAt: input.assignedAt,
  };
}

export function createEvidenceAuthorityAssignment(input: Omit<EvidenceAuthorityAssignment, "schemaVersion" | "assignmentDigest">) {
  const core = assignmentCore(input);
  return { ...core, assignmentDigest: digest(core) };
}

export function validateEvidenceAuthorityAssignment(input: unknown, campaign: EvidenceAuthorityCampaign) {
  const assignment = input as Partial<EvidenceAuthorityAssignment>;
  const core = assignment.campaignId && assignment.campaignDigest && assignment.sourceMilestone && assignment.observerId && assignment.assignedBy && assignment.assignedAt
    ? assignmentCore({
      campaignId: assignment.campaignId,
      campaignDigest: assignment.campaignDigest,
      sourceMilestone: assignment.sourceMilestone,
      observerId: assignment.observerId,
      assignedBy: assignment.assignedBy,
      assignedAt: assignment.assignedAt,
    })
    : null;
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "campaignId", "campaignDigest", "sourceMilestone", "observerId", "assignedBy", "assignedAt", "assignmentDigest"]),
    schemaVersion: assignment.schemaVersion === "evidence.authority-assignment.v1",
    campaign: assignment.campaignId === campaign.id && assignment.campaignDigest === campaign.campaignDigest,
    milestone: EVIDENCE_COLLECTION_SOURCE_MILESTONES.includes(assignment.sourceMilestone as typeof EVIDENCE_COLLECTION_SOURCE_MILESTONES[number]),
    independence: isIdentity(assignment.observerId) && isIdentity(assignment.assignedBy) && assignment.observerId !== campaign.requesterId && assignment.observerId !== assignment.assignedBy,
    timestamp: isTimestamp(assignment.assignedAt),
    digest: Boolean(core) && assignment.assignmentDigest === digest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function challengeCore(input: Omit<EvidenceAuthorityChallenge, "schemaVersion" | "id" | "challengeDigest">) {
  return {
    schemaVersion: "evidence.authority-challenge.v1" as const,
    campaignId: input.campaignId,
    campaignDigest: input.campaignDigest,
    profileDigest: input.profileDigest,
    packageId: input.packageId,
    sourceMilestone: input.sourceMilestone,
    nonceDigest: input.nonceDigest,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  };
}

export function createEvidenceAuthorityChallenge(input: Omit<EvidenceAuthorityChallenge, "schemaVersion" | "id" | "challengeDigest">) {
  const id = randomUUID();
  const core = challengeCore(input);
  return { id, ...core, challengeDigest: digest({ id, ...core }) };
}

export function validateEvidenceAuthorityChallenge(input: unknown, profile: EvidenceAuthorityProfile, campaign: EvidenceAuthorityCampaign, now = Date.now()) {
  const challenge = input as Partial<EvidenceAuthorityChallenge>;
  const core = challenge.campaignId && challenge.campaignDigest && challenge.profileDigest && challenge.packageId && challenge.sourceMilestone && challenge.nonceDigest && challenge.issuedAt && challenge.expiresAt
    ? challengeCore({
      campaignId: challenge.campaignId,
      campaignDigest: challenge.campaignDigest,
      profileDigest: challenge.profileDigest,
      packageId: challenge.packageId,
      sourceMilestone: challenge.sourceMilestone,
      nonceDigest: challenge.nonceDigest,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
    })
    : null;
  const issuedAt = challenge.issuedAt ? Date.parse(challenge.issuedAt) : NaN;
  const expiresAt = challenge.expiresAt ? Date.parse(challenge.expiresAt) : NaN;
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "id", "campaignId", "campaignDigest", "profileDigest", "packageId", "sourceMilestone", "nonceDigest", "issuedAt", "expiresAt", "challengeDigest"]),
    schemaVersion: challenge.schemaVersion === "evidence.authority-challenge.v1",
    id: typeof challenge.id === "string" && challenge.id.length >= 12 && typeof challenge.packageId === "string" && challenge.packageId.length >= 12,
    binding: challenge.campaignId === campaign.id && challenge.campaignDigest === campaign.campaignDigest && challenge.profileDigest === profile.profileDigest,
    milestone: EVIDENCE_COLLECTION_SOURCE_MILESTONES.includes(challenge.sourceMilestone as typeof EVIDENCE_COLLECTION_SOURCE_MILESTONES[number]),
    nonce: isDigest(challenge.nonceDigest),
    window: Number.isFinite(issuedAt) && Number.isFinite(expiresAt) && issuedAt <= now + 5 * 60_000 && expiresAt > issuedAt && expiresAt - issuedAt <= DAY,
    digest: Boolean(core) && challenge.challengeDigest === digest({ id: challenge.id, ...core }),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function receiptCore(input: Omit<EvidenceAuthorityReceiptEnvelope, "schemaVersion" | "id" | "receiptDigest">) {
  return {
    schemaVersion: "evidence.authority-receipt-envelope.v1" as const,
    campaignId: input.campaignId,
    campaignDigest: input.campaignDigest,
    challengeDigest: input.challengeDigest,
    profileDigest: input.profileDigest,
    packageId: input.packageId,
    sourceMilestone: input.sourceMilestone,
    outcome: input.outcome,
    signerKeyFingerprint: input.signerKeyFingerprint,
    observedAt: input.observedAt,
  };
}

export function createEvidenceAuthorityReceiptEnvelope(input: Omit<EvidenceAuthorityReceiptEnvelope, "schemaVersion" | "id" | "receiptDigest">) {
  const id = randomUUID();
  const core = receiptCore(input);
  return { id, ...core, receiptDigest: digest({ id, ...core }) };
}

export function validateEvidenceAuthorityReceiptEnvelope(input: unknown, profile: EvidenceAuthorityProfile, campaign: EvidenceAuthorityCampaign, challenge: EvidenceAuthorityChallenge, now = Date.now()) {
  const receipt = input as Partial<EvidenceAuthorityReceiptEnvelope>;
  const core = receipt.campaignId && receipt.campaignDigest && receipt.challengeDigest && receipt.profileDigest && receipt.packageId && receipt.sourceMilestone && receipt.outcome && receipt.signerKeyFingerprint && receipt.observedAt
    ? receiptCore({
      campaignId: receipt.campaignId,
      campaignDigest: receipt.campaignDigest,
      challengeDigest: receipt.challengeDigest,
      profileDigest: receipt.profileDigest,
      packageId: receipt.packageId,
      sourceMilestone: receipt.sourceMilestone,
      outcome: receipt.outcome,
      signerKeyFingerprint: receipt.signerKeyFingerprint,
      observedAt: receipt.observedAt,
    })
    : null;
  const observedAt = receipt.observedAt ? Date.parse(receipt.observedAt) : NaN;
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "id", "campaignId", "campaignDigest", "challengeDigest", "profileDigest", "packageId", "sourceMilestone", "outcome", "signerKeyFingerprint", "observedAt", "receiptDigest"]),
    schemaVersion: receipt.schemaVersion === "evidence.authority-receipt-envelope.v1",
    id: typeof receipt.id === "string" && receipt.id.length >= 12,
    binding: receipt.campaignId === campaign.id && receipt.campaignDigest === campaign.campaignDigest && receipt.challengeDigest === challenge.challengeDigest && receipt.profileDigest === profile.profileDigest && receipt.packageId === challenge.packageId && receipt.sourceMilestone === challenge.sourceMilestone,
    outcome: receipt.outcome === "verified" || receipt.outcome === "rejected",
    signer: isDigest(receipt.signerKeyFingerprint),
    freshness: Number.isFinite(observedAt) && observedAt <= now + 5 * 60_000 && now - observedAt <= profile.maxReceiptAgeHours * 60 * 60_000,
    digest: Boolean(core) && receipt.receiptDigest === digest({ id: receipt.id, ...core }),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function classifyEvidenceAuthorityReceipt(input: {
  envelope: EvidenceAuthorityReceiptEnvelope;
  profile: EvidenceAuthorityProfile;
  campaign: EvidenceAuthorityCampaign;
  challenge: EvidenceAuthorityChallenge;
  now?: number;
}): EvidenceAuthorityReceiptRecord {
  const validation = validateEvidenceAuthorityReceiptEnvelope(input.envelope, input.profile, input.campaign, input.challenge, input.now);
  const disposition = validation.ok && input.envelope.outcome === "verified"
    ? "accepted-for-binding" as const
    : "quarantined" as const;
  return {
    envelope: input.envelope,
    disposition,
    reason: validation.ok ? (disposition === "quarantined" ? "External authority rejected the challenge." : null) : "Envelope failed strict profile, campaign, challenge, signature, freshness, or digest binding.",
    recordedAt: new Date(input.now || Date.now()).toISOString(),
  };
}

export function buildEvidenceAuthorityEscrowBundle(input: {
  profile: EvidenceAuthorityProfile;
  campaign: EvidenceAuthorityCampaign;
  assignments: EvidenceAuthorityAssignment[];
  receipts: EvidenceAuthorityReceiptRecord[];
  now?: number;
}) {
  const assignmentMilestones = new Set(input.assignments.filter((assignment) => validateEvidenceAuthorityAssignment(assignment, input.campaign).ok).map((assignment) => assignment.sourceMilestone));
  const acceptedReceipts = input.receipts.filter((record) => record.disposition === "accepted-for-binding" && validateEvidenceAuthorityReceiptEnvelope(record.envelope, input.profile, input.campaign, {
    schemaVersion: "evidence.authority-challenge.v1", id: "escrow-challenge", campaignId: input.campaign.id, campaignDigest: input.campaign.campaignDigest, profileDigest: input.profile.profileDigest,
    packageId: record.envelope.packageId, sourceMilestone: record.envelope.sourceMilestone, nonceDigest: digest({ packageId: record.envelope.packageId }),
    issuedAt: record.envelope.observedAt, expiresAt: new Date(Date.parse(record.envelope.observedAt) + DAY).toISOString(), challengeDigest: record.envelope.challengeDigest,
  }, input.now).ok);
  const receiptMilestones = new Set(acceptedReceipts.map((record) => record.envelope.sourceMilestone));
  const covered = EVIDENCE_COLLECTION_SOURCE_MILESTONES.filter((milestone) => assignmentMilestones.has(milestone) && receiptMilestones.has(milestone));
  const core = {
    schemaVersion: "evidence.authority-escrow-bundle.v1" as const,
    profileDigest: input.profile.profileDigest,
    campaignDigest: input.campaign.campaignDigest,
    assignedMilestones: [...assignmentMilestones].sort(),
    receiptMilestones: [...receiptMilestones].sort(),
    coveredMilestones: covered,
  };
  return {
    ...core,
    status: covered.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length ? "ready-for-independent-review" as const : "hold" as const,
    bundleDigest: digest(core),
  };
}

export function createUnconfiguredEvidenceAuthorityPort(): EvidenceAuthorityExternalPort {
  const unavailable = async () => {
    throw new EvidenceAuthorityCampaignError("external-unavailable", "A controlled authority connector, secret reference resolver, and immutable archive adapter are not configured.");
  };
  return { discoverTrust: unavailable, dispatchChallenge: unavailable, readReceipt: unavailable };
}

export async function executeEvidenceAuthorityChallenge(input: {
  profile: EvidenceAuthorityProfile;
  campaign: EvidenceAuthorityCampaign;
  challenge: EvidenceAuthorityChallenge;
  port?: EvidenceAuthorityExternalPort;
  now?: number;
}) {
  if (!validateEvidenceAuthorityProfile(input.profile).ok || !validateEvidenceAuthorityCampaign(input.campaign, input.profile, input.now).ok || !validateEvidenceAuthorityChallenge(input.challenge, input.profile, input.campaign, input.now).ok) {
    throw new EvidenceAuthorityCampaignError("invalid-input", "A strict profile, campaign, and live challenge are required before external dispatch.");
  }
  const port = input.port || createUnconfiguredEvidenceAuthorityPort();
  const [snapshot, dispatch] = await Promise.all([
    port.discoverTrust(input.profile),
    port.dispatchChallenge({ profile: input.profile, campaign: input.campaign, challenge: input.challenge }),
  ]);
  if (!validateEvidenceAuthorityTrustSnapshot(snapshot, input.profile, input.now).ok || !dispatch.accepted || dispatch.challengeDigest !== input.challenge.challengeDigest || !isDigest(dispatch.dispatchDigest)) {
    throw new EvidenceAuthorityCampaignError("external-binding-failed", "The authority discovery or dispatch response did not bind the current profile and challenge.");
  }
  const envelope = await port.readReceipt({ profile: input.profile, challenge: input.challenge });
  return classifyEvidenceAuthorityReceipt({ envelope, profile: input.profile, campaign: input.campaign, challenge: input.challenge, now: input.now });
}

export function emptyEvidenceAuthorityCampaignStore(): EvidenceAuthorityCampaignStore {
  return { schemaVersion: "evidence.authority-campaign-store.v1", revision: 0, profiles: [], campaigns: [], assignments: [], receipts: [], idempotency: {} };
}

export function validateEvidenceAuthorityCampaignStore(input: unknown): input is EvidenceAuthorityCampaignStore {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const store = input as Partial<EvidenceAuthorityCampaignStore>;
  if (store.schemaVersion !== "evidence.authority-campaign-store.v1" || !Number.isInteger(store.revision) || Number(store.revision) < 0 || !Array.isArray(store.profiles) || !Array.isArray(store.campaigns) || !Array.isArray(store.assignments) || !Array.isArray(store.receipts) || !store.idempotency || typeof store.idempotency !== "object" || Array.isArray(store.idempotency)) return false;
  if (store.profiles.length > MAX_PROFILES || store.campaigns.length > MAX_CAMPAIGNS || store.assignments.length > MAX_ASSIGNMENTS || store.receipts.length > MAX_RECEIPTS) return false;
  const profiles = store.profiles as EvidenceAuthorityProfile[];
  const campaigns = store.campaigns as EvidenceAuthorityCampaign[];
  if (new Set(profiles.map((profile) => profile.id)).size !== profiles.length || new Set(campaigns.map((campaign) => campaign.id)).size !== campaigns.length || new Set(campaigns.map((campaign) => campaign.idempotencyKey)).size !== campaigns.length) return false;
  if (!profiles.every((profile) => validateEvidenceAuthorityProfile(profile).ok) || !campaigns.every((campaign) => {
    const profile = profiles.find((entry) => entry.id === campaign.profileId);
    if (!profile) return false;
    return validateEvidenceAuthorityCampaign(campaign, profile).ok;
  })) return false;
  const assignments = store.assignments as EvidenceAuthorityAssignment[];
  const receipts = store.receipts as EvidenceAuthorityReceiptRecord[];
  if (!assignments.every((assignment) => {
    const campaign = campaigns.find((entry) => entry.id === assignment.campaignId);
    if (!campaign) return false;
    return validateEvidenceAuthorityAssignment(assignment, campaign).ok;
  })) return false;
  return receipts.every((record) => {
    if (!record || typeof record !== "object" || !["pending-review", "accepted-for-binding", "quarantined"].includes(record.disposition) || !isTimestamp(record.recordedAt)) return false;
    const campaign = campaigns.find((entry) => entry.id === record.envelope.campaignId);
    const profile = campaign ? profiles.find((entry) => entry.id === campaign.profileId) : undefined;
    if (!campaign || !profile) return false;
    const challenge: EvidenceAuthorityChallenge = {
      schemaVersion: "evidence.authority-challenge.v1",
      id: "stored-envelope-challenge",
      campaignId: campaign.id,
      campaignDigest: campaign.campaignDigest,
      profileDigest: profile.profileDigest,
      packageId: record.envelope.packageId,
      sourceMilestone: record.envelope.sourceMilestone,
      nonceDigest: digest({ packageId: record.envelope.packageId }),
      issuedAt: record.envelope.observedAt,
      expiresAt: new Date(Date.parse(record.envelope.observedAt) + DAY).toISOString(),
      challengeDigest: record.envelope.challengeDigest,
    };
    const envelope = validateEvidenceAuthorityReceiptEnvelope(record.envelope, profile, campaign, challenge);
    if (!envelope.ok) return false;
    if (record.disposition === "accepted-for-binding") return record.envelope.outcome === "verified" && record.reason === null;
    if (record.disposition === "quarantined") return typeof record.reason === "string" && record.reason.length >= 8;
    return record.reason === null || typeof record.reason === "string";
  });
}

export function insertEvidenceAuthorityProfile(store: EvidenceAuthorityCampaignStore, profile: EvidenceAuthorityProfile) {
  if (!validateEvidenceAuthorityProfile(profile).ok) throw new EvidenceAuthorityCampaignError("invalid-input", "Authority profile failed strict validation.");
  const existing = store.profiles.find((entry) => entry.id === profile.id);
  if (existing) {
    if (existing.profileDigest !== profile.profileDigest) throw new EvidenceAuthorityCampaignError("revision-conflict", "Authority profile ID is already bound to another digest.");
    return { store, profile: existing, deduplicated: true };
  }
  if (store.profiles.length >= MAX_PROFILES) throw new EvidenceAuthorityCampaignError("capacity-exceeded", "Authority profile capacity reached without evicting existing configuration.");
  return { store: { ...store, revision: store.revision + 1, profiles: [profile, ...store.profiles] }, profile, deduplicated: false };
}

export function insertEvidenceAuthorityCampaign(store: EvidenceAuthorityCampaignStore, campaign: EvidenceAuthorityCampaign) {
  const profile = store.profiles.find((entry) => entry.id === campaign.profileId);
  if (!profile || !validateEvidenceAuthorityCampaign(campaign, profile).ok) throw new EvidenceAuthorityCampaignError("invalid-input", "Campaign failed strict profile and coverage validation.");
  const existingId = store.idempotency[campaign.idempotencyKey];
  const existing = existingId ? store.campaigns.find((entry) => entry.id === existingId) : undefined;
  if (existing) {
    if (existing.campaignDigest !== campaign.campaignDigest) throw new EvidenceAuthorityCampaignError("revision-conflict", "Campaign idempotency key is already bound to another digest.");
    return { store, campaign: existing, deduplicated: true };
  }
  if (store.campaigns.length >= MAX_CAMPAIGNS) throw new EvidenceAuthorityCampaignError("capacity-exceeded", "Campaign capacity reached without evicting existing evidence.");
  return {
    store: { ...store, revision: store.revision + 1, campaigns: [campaign, ...store.campaigns], idempotency: { ...store.idempotency, [campaign.idempotencyKey]: campaign.id } },
    campaign,
    deduplicated: false,
  };
}

export function appendEvidenceAuthorityReceipt(store: EvidenceAuthorityCampaignStore, record: EvidenceAuthorityReceiptRecord) {
  if (store.receipts.length >= MAX_RECEIPTS) throw new EvidenceAuthorityCampaignError("capacity-exceeded", "Receipt quarantine capacity reached without evicting evidence.");
  if (!isTimestamp(record.recordedAt) || !["pending-review", "accepted-for-binding", "quarantined"].includes(record.disposition)) throw new EvidenceAuthorityCampaignError("invalid-input", "Receipt record disposition is invalid.");
  return { ...store, revision: store.revision + 1, receipts: [record, ...store.receipts] };
}

export const EVIDENCE_AUTHORITY_CAMPAIGN_PLANS: EvidenceAuthorityCampaignPlan[] = [
  { version: "v4.8.0", label: "Authority Profile Registry", track: "profile", localGate: "Authority endpoints are distinct external HTTPS URLs and bind one digest-only profile.", externalGate: "A controlled organization authority must publish a usable profile.", requiresExternalReceipt: false },
  { version: "v4.8.1", label: "Credential Reference Boundary", track: "profile", localGate: "Only opaque vault, workload-identity, or operator-approved references are admitted; raw API keys are denied.", externalGate: "The secret manager or workload identity must resolve the reference at runtime.", requiresExternalReceipt: false },
  { version: "v4.8.2", label: "Trust Discovery Snapshot", track: "profile", localGate: "A fresh issuer, JWKS, and archive-policy snapshot is digest-bound to one profile.", externalGate: "The authority endpoint must return a current trust discovery response.", requiresExternalReceipt: true },
  { version: "v4.8.3", label: "Key Rotation Observation", track: "profile", localGate: "Rotation is visible as a new trust snapshot rather than a silent key replacement.", externalGate: "The issuer must attest the rotation and retirement window.", requiresExternalReceipt: true },
  { version: "v4.8.4", label: "Archive Retention Policy", track: "profile", localGate: "Archive retention is represented by a strict policy digest instead of a local path or mutable note.", externalGate: "Immutable storage must enforce and read back retention and legal hold.", requiresExternalReceipt: true },
  { version: "v4.8.5", label: "Fourteen-Domain Campaign Manifest", track: "campaign", localGate: "A campaign covers every source milestone exactly once with a bounded expiry.", externalGate: "An authorized organization requester must approve the evidence campaign.", requiresExternalReceipt: false },
  { version: "v4.8.6", label: "Independent Observer Assignment", track: "campaign", localGate: "Assignments require a distinct observer and retain campaign/milestone lineage.", externalGate: "Independent observers must accept and execute the assigned work.", requiresExternalReceipt: true },
  { version: "v4.8.7", label: "Challenge Nonce Lifecycle", track: "challenge", localGate: "Challenges bind one profile, campaign, package, milestone, nonce digest, and short expiry.", externalGate: "The authority must receive the exact issued challenge before a receipt is considered.", requiresExternalReceipt: false },
  { version: "v4.8.8", label: "External Dispatch Binding", track: "challenge", localGate: "Discovery and dispatch responses must echo the current profile and challenge digests.", externalGate: "A configured authority connector must perform the live dispatch.", requiresExternalReceipt: true },
  { version: "v4.8.9", label: "Receipt Envelope Intake", track: "receipt", localGate: "Receipt envelopes are strict, fresh, signer-bound, and tied to an issued challenge.", externalGate: "The authority must provide the signed external receipt.", requiresExternalReceipt: true },
  { version: "v4.9.0", label: "Receipt Quarantine and Reconciliation", track: "receipt", localGate: "Malformed, stale, mismatched, or rejected receipts remain quarantined with a reason.", externalGate: "A qualified authority owner must reconcile any discrepancy.", requiresExternalReceipt: false },
  { version: "v4.9.1", label: "Receipt Freshness Renewal", track: "receipt", localGate: "Receipt age is measured from the profile policy and stale evidence cannot cover a domain.", externalGate: "The authority must reissue or renew current evidence.", requiresExternalReceipt: true },
  { version: "v4.9.2", label: "Escrow Coverage Bundle", track: "release", localGate: "Coverage requires both an independent assignment and an accepted-for-binding receipt for each domain.", externalGate: "All fourteen receipts must be independently verified before review.", requiresExternalReceipt: true },
  { version: "v4.9.3", label: "Distribution Request Readiness", track: "release", localGate: "A digest-only escrow bundle exposes exact coverage gaps without granting distribution.", externalGate: "A separate distribution approver must accept the complete current bundle.", requiresExternalReceipt: true },
  { version: "v4.9.4", label: "Production Authority Separation", track: "release", localGate: "Campaign status cannot change production authority and retains an explicit blocked projection.", externalGate: "Production authority requires an independent authorized decision and execution witness.", requiresExternalReceipt: true },
];
