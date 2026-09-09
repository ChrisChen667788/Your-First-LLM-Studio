import { createHash, randomUUID } from "node:crypto";

import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import type { ExternalEvidenceHandoff } from "@/features/evidence/external-handoff";

export const EXTERNAL_EVIDENCE_RELAY_SCHEMA_VERSION = "evidence.external-relay.v1" as const;

export type ExternalEvidenceRelayPlan = {
  version: string;
  label: string;
  track: "configuration" | "transport" | "intake" | "reconciliation" | "decision";
  localGate: string;
  externalGate: string;
  requiresLiveRelay: boolean;
};

export const EXTERNAL_EVIDENCE_RELAY_PLANS: ExternalEvidenceRelayPlan[] = [
  { version: "v5.2.0", label: "Authority Relay Descriptor", track: "configuration", localGate: "A relay descriptor pins profile, authority identity, HTTPS endpoints, opaque credential reference digest, and trust anchor fingerprint.", externalGate: "An organization-controlled authority must publish and own the active relay descriptor.", requiresLiveRelay: false },
  { version: "v5.2.1", label: "Egress Boundary Contract", track: "configuration", localGate: "Relay endpoints reject local, credential-bearing, IP-literal, non-HTTPS, and unpinned destination shapes.", externalGate: "The organization egress policy must allow only the controlled authority destinations.", requiresLiveRelay: false },
  { version: "v5.2.2", label: "Opaque Credential Resolution", track: "configuration", localGate: "A one-shot credential resolver binds an authorization value to the configured opaque reference digest without persisting it.", externalGate: "A controlled workload identity, vault, or secret resolver must issue the live authorization value.", requiresLiveRelay: true },
  { version: "v5.2.3", label: "Trust Discovery Relay", track: "transport", localGate: "A discovery request and returned receipt bind one relay, handoff, endpoint fingerprint, signer fingerprint, and expiry window.", externalGate: "The authority discovery endpoint must return the current trusted observation.", requiresLiveRelay: true },
  { version: "v5.2.4", label: "Rotation Continuity Relay", track: "transport", localGate: "Rotation continuity remains a separate digest-bound relay operation rather than an implicit signer replacement.", externalGate: "The authority must publish an active and retiring signer continuity record.", requiresLiveRelay: true },
  { version: "v5.2.5", label: "Archive Read-back Relay", track: "transport", localGate: "Archive read-back travels as a bounded digest-only request and receipt without retaining object content.", externalGate: "Immutable storage must return a current retention and legal-hold read-back result.", requiresLiveRelay: true },
  { version: "v5.2.6", label: "Idempotent Handoff Dispatch", track: "transport", localGate: "Relay dispatch uses a single digest-bound request identity, short expiry, payload ceiling, timeout, and redirect denial.", externalGate: "The controlled authority endpoint must accept the live handoff request.", requiresLiveRelay: true },
  { version: "v5.2.7", label: "Strict Relay Response Intake", track: "intake", localGate: "Responses must match an exact receipt schema and the configured endpoint, request, handoff, signer, and signature fingerprints.", externalGate: "The authority must issue an authentic signed response under the pinned trust anchor.", requiresLiveRelay: true },
  { version: "v5.2.8", label: "Observer Delivery Relay", track: "intake", localGate: "Per-domain observer delivery is imported only through a source-milestone-bound relay receipt.", externalGate: "Each independent observer must accept or decline its assigned external workload.", requiresLiveRelay: true },
  { version: "v5.2.9", label: "Receipt Quarantine Ledger", track: "intake", localGate: "Malformed, stale, mismatched, duplicate, and failed transports retain only bounded reason and payload digests in quarantine.", externalGate: "The authority owner must investigate and resolve quarantined imports with source records.", requiresLiveRelay: false },
  { version: "v5.3.0", label: "Fourteen-Domain Relay Reconciliation", track: "reconciliation", localGate: "Coverage is computed from current accepted per-domain verification relay receipts and visible quarantines.", externalGate: "All fourteen independently operated domains must provide current signed verification receipts.", requiresLiveRelay: true },
  { version: "v5.3.1", label: "Freshness and Replay Window", track: "reconciliation", localGate: "Expired receipts, duplicate request keys, and stale replay windows cannot contribute to coverage.", externalGate: "The authority and observers must renew evidence within the configured validity windows.", requiresLiveRelay: true },
  { version: "v5.3.2", label: "Discrepancy Relay Case", track: "reconciliation", localGate: "A discrepancy case preserves handoff, domain, reason, and resolution digests without overwriting the underlying receipt history.", externalGate: "A qualified authority owner must provide the independently resolved case evidence.", requiresLiveRelay: true },
  { version: "v5.3.3", label: "Independent Decision Relay", track: "decision", localGate: "A decision relay receipt must bind the exact short-lived decision request and pinned authority fingerprint.", externalGate: "A separate distribution authority must issue the live decision outcome.", requiresLiveRelay: true },
  { version: "v5.3.4", label: "Production Transition Firewall", track: "decision", localGate: "Every relay projection remains non-authorizing for distribution and production, including an accepted local receipt shape.", externalGate: "Production requires a separately controlled transition, execution witness, and independent authorization outside this application.", requiresLiveRelay: false },
];

export type ExternalEvidenceRelayOperation =
  | "trust-discovery"
  | "rotation-continuity"
  | "archive-readback"
  | "handoff-dispatch"
  | "observer-delivery"
  | "receipt-verification"
  | "decision-request";

export type ExternalEvidenceRelayConfiguration = {
  schemaVersion: "evidence.external-relay-configuration.v1";
  id: string;
  profileDigest: string;
  authorityId: string;
  relayUrl: string;
  receiptUrl: string;
  credentialReferenceDigest: string;
  trustAnchorFingerprint: string;
  maxRequestAgeMinutes: number;
  createdAt: string;
  configurationDigest: string;
};

export type ExternalEvidenceRelayRequest = {
  schemaVersion: "evidence.external-relay-request.v1";
  id: string;
  idempotencyKey: string;
  configurationId: string;
  configurationDigest: string;
  handoffId: string;
  handoffDigest: string;
  operation: ExternalEvidenceRelayOperation;
  sourceMilestone: string | null;
  payloadDigest: string;
  requestedAt: string;
  expiresAt: string;
  requestDigest: string;
};

export type ExternalEvidenceRelayReceipt = {
  schemaVersion: "evidence.external-relay-receipt.v1";
  id: string;
  requestId: string;
  requestDigest: string;
  configurationId: string;
  configurationDigest: string;
  handoffId: string;
  handoffDigest: string;
  operation: ExternalEvidenceRelayOperation;
  sourceMilestone: string | null;
  endpointDigest: string;
  externalReceiptDigest: string;
  signerKeyFingerprint: string;
  signatureDigest: string;
  status: "accepted" | "rejected";
  receivedAt: string;
  validUntil: string;
  receiptDigest: string;
};

export type ExternalEvidenceRelayQuarantine = {
  schemaVersion: "evidence.external-relay-quarantine.v1";
  id: string;
  configurationId: string;
  configurationDigest: string;
  requestId: string | null;
  requestDigest: string | null;
  code: "schema-invalid" | "binding-mismatch" | "stale" | "duplicate" | "transport-failure";
  payloadDigest: string;
  detailDigest: string;
  observedAt: string;
  quarantineDigest: string;
};

export type ExternalEvidenceRelayReconciliation = {
  schemaVersion: "evidence.external-relay-reconciliation.v1";
  configurationId: string;
  configurationDigest: string;
  handoffId: string;
  handoffDigest: string;
  expectedMilestones: string[];
  coveredMilestones: string[];
  staleReceiptCount: number;
  quarantinedImportCount: number;
  observedAt: string;
  status: "hold" | "ready-for-independent-decision";
  reconciliationDigest: string;
};

export type ExternalEvidenceRelayStore = {
  schemaVersion: "evidence.external-relay-store.v1";
  revision: number;
  configurations: ExternalEvidenceRelayConfiguration[];
  requests: ExternalEvidenceRelayRequest[];
  receipts: ExternalEvidenceRelayReceipt[];
  quarantines: ExternalEvidenceRelayQuarantine[];
  idempotency: Record<string, string>;
};

export type ExternalEvidenceRelayCredentialResolution = {
  authorization: string;
  credentialReferenceDigest: string;
  expiresAt: string;
};

export type ExternalEvidenceRelayCredentialResolver = {
  resolveAuthorization(input: {
    configuration: ExternalEvidenceRelayConfiguration;
    request: ExternalEvidenceRelayRequest;
  }): Promise<ExternalEvidenceRelayCredentialResolution>;
};

export type ExternalEvidenceRelayTransport = {
  transmit(input: {
    configuration: ExternalEvidenceRelayConfiguration;
    request: ExternalEvidenceRelayRequest;
  }): Promise<ExternalEvidenceRelayReceipt>;
};

export type ExternalEvidenceRelayHttpClient = (input: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
  redirect: "error";
  signal: AbortSignal;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export class ExternalEvidenceRelayError extends Error {
  constructor(
    readonly code:
      | "invalid-input"
      | "unsafe-endpoint"
      | "revision-conflict"
      | "capacity-exceeded"
      | "external-unavailable"
      | "external-binding-failed"
      | "transport-failed",
    message: string,
  ) {
    super(message);
    this.name = "ExternalEvidenceRelayError";
  }
}

const DAY = 24 * 60 * 60 * 1_000;
const HEX = /^[a-f0-9]{64}$/u;
const IDENTITY = /^[a-z0-9][a-z0-9._:@/-]{2,127}$/iu;
const MAX_CONFIGURATIONS = 50;
const MAX_REQUESTS = 400;
const MAX_RECEIPTS = 4_000;
const MAX_QUARANTINES = 1_000;
const MAX_REQUEST_BYTES = 64 * 1_024;
const MAX_RESPONSE_BYTES = 128 * 1_024;
const RELAY_OPERATIONS: readonly ExternalEvidenceRelayOperation[] = [
  "trust-discovery",
  "rotation-continuity",
  "archive-readback",
  "handoff-dispatch",
  "observer-delivery",
  "receipt-verification",
  "decision-request",
];

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function externalEvidenceRelayDigest(value: unknown) {
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

function isShortWindow(start: string, end: string, maximumMs: number) {
  const started = Date.parse(start);
  const ended = Date.parse(end);
  return Number.isFinite(started) && Number.isFinite(ended) && ended > started && ended - started <= maximumMs;
}

function hasExactMilestones(values: string[]) {
  return values.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length &&
    values.every((value, index) => value === EVIDENCE_COLLECTION_SOURCE_MILESTONES[index]);
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function isSafeExternalUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
    if (!hostname.includes(".") || hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateIpv4(hostname)) return false;
    if (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:")) return false;
    return true;
  } catch {
    return false;
  }
}

function endpointDigest(configuration: ExternalEvidenceRelayConfiguration, operation: ExternalEvidenceRelayOperation) {
  return externalEvidenceRelayDigest({ url: operation === "receipt-verification" ? configuration.receiptUrl : configuration.relayUrl });
}

function sourceMilestoneRequired(operation: ExternalEvidenceRelayOperation) {
  return operation === "observer-delivery" || operation === "receipt-verification";
}

function configurationCore(input: Omit<ExternalEvidenceRelayConfiguration, "schemaVersion" | "id" | "configurationDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-relay-configuration.v1" as const,
    id: input.id?.trim() || `external-relay-${randomUUID()}`,
    profileDigest: input.profileDigest,
    authorityId: input.authorityId.trim(),
    relayUrl: input.relayUrl,
    receiptUrl: input.receiptUrl,
    credentialReferenceDigest: input.credentialReferenceDigest,
    trustAnchorFingerprint: input.trustAnchorFingerprint,
    maxRequestAgeMinutes: input.maxRequestAgeMinutes,
    createdAt: input.createdAt,
  };
}

export function createExternalEvidenceRelayConfiguration(input: Omit<ExternalEvidenceRelayConfiguration, "schemaVersion" | "id" | "configurationDigest"> & { id?: string }) {
  const core = configurationCore(input);
  return { ...core, configurationDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceRelayConfiguration(input: unknown) {
  const configuration = input as Partial<ExternalEvidenceRelayConfiguration>;
  const core = configuration.schemaVersion === "evidence.external-relay-configuration.v1" && typeof configuration.authorityId === "string" && typeof configuration.id === "string"
    ? configurationCore({
      id: configuration.id,
      profileDigest: configuration.profileDigest || "",
      authorityId: configuration.authorityId,
      relayUrl: configuration.relayUrl || "",
      receiptUrl: configuration.receiptUrl || "",
      credentialReferenceDigest: configuration.credentialReferenceDigest || "",
      trustAnchorFingerprint: configuration.trustAnchorFingerprint || "",
      maxRequestAgeMinutes: Number(configuration.maxRequestAgeMinutes),
      createdAt: configuration.createdAt || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "profileDigest", "authorityId", "relayUrl", "receiptUrl", "credentialReferenceDigest", "trustAnchorFingerprint", "maxRequestAgeMinutes", "createdAt", "configurationDigest"]),
    schemaVersion: configuration.schemaVersion === "evidence.external-relay-configuration.v1",
    identity: isIdentity(configuration.id) && isIdentity(configuration.authorityId),
    digests: isDigest(configuration.profileDigest) && isDigest(configuration.credentialReferenceDigest) && isDigest(configuration.trustAnchorFingerprint),
    endpoints: isSafeExternalUrl(configuration.relayUrl) && isSafeExternalUrl(configuration.receiptUrl),
    requestWindow: Number.isInteger(configuration.maxRequestAgeMinutes) && Number(configuration.maxRequestAgeMinutes) >= 1 && Number(configuration.maxRequestAgeMinutes) <= 1_440,
    createdAt: isTimestamp(configuration.createdAt),
    digest: Boolean(core) && configuration.configurationDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function relayRequestCore(input: Omit<ExternalEvidenceRelayRequest, "schemaVersion" | "id" | "requestDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-relay-request.v1" as const,
    id: input.id?.trim() || `external-relay-request-${randomUUID()}`,
    idempotencyKey: input.idempotencyKey.trim(),
    configurationId: input.configurationId.trim(),
    configurationDigest: input.configurationDigest,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    operation: input.operation,
    sourceMilestone: input.sourceMilestone,
    payloadDigest: input.payloadDigest,
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
  };
}

export function createExternalEvidenceRelayRequest(input: Omit<ExternalEvidenceRelayRequest, "schemaVersion" | "id" | "requestDigest"> & { id?: string }) {
  const core = relayRequestCore(input);
  return { ...core, requestDigest: externalEvidenceRelayDigest(core) };
}

function validateExternalEvidenceRelayRequestShape(input: unknown) {
  const request = input as Partial<ExternalEvidenceRelayRequest>;
  const core = request.schemaVersion === "evidence.external-relay-request.v1" && typeof request.id === "string" && typeof request.idempotencyKey === "string" && typeof request.configurationId === "string" && typeof request.handoffId === "string"
    ? relayRequestCore({
      id: request.id,
      idempotencyKey: request.idempotencyKey,
      configurationId: request.configurationId,
      configurationDigest: request.configurationDigest || "",
      handoffId: request.handoffId,
      handoffDigest: request.handoffDigest || "",
      operation: request.operation as ExternalEvidenceRelayOperation,
      sourceMilestone: request.sourceMilestone === null ? null : request.sourceMilestone || null,
      payloadDigest: request.payloadDigest || "",
      requestedAt: request.requestedAt || "",
      expiresAt: request.expiresAt || "",
    })
    : null;
  const operation = request.operation as ExternalEvidenceRelayOperation;
  const matchingMilestone = sourceMilestoneRequired(operation)
    ? typeof request.sourceMilestone === "string" && EVIDENCE_COLLECTION_SOURCE_MILESTONES.includes(request.sourceMilestone as typeof EVIDENCE_COLLECTION_SOURCE_MILESTONES[number])
    : request.sourceMilestone === null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "idempotencyKey", "configurationId", "configurationDigest", "handoffId", "handoffDigest", "operation", "sourceMilestone", "payloadDigest", "requestedAt", "expiresAt", "requestDigest"]),
    schemaVersion: request.schemaVersion === "evidence.external-relay-request.v1",
    identity: isIdentity(request.id) && isIdentity(request.idempotencyKey) && isIdentity(request.configurationId) && isIdentity(request.handoffId),
    digests: isDigest(request.configurationDigest) && isDigest(request.handoffDigest) && isDigest(request.payloadDigest),
    operation: RELAY_OPERATIONS.includes(operation),
    milestone: matchingMilestone,
    timestamps: isTimestamp(request.requestedAt) && isTimestamp(request.expiresAt),
    digest: Boolean(core) && request.requestDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function validateExternalEvidenceRelayRequest(
  input: unknown,
  configuration: ExternalEvidenceRelayConfiguration,
  handoff: Pick<ExternalEvidenceHandoff, "id" | "handoffDigest">,
) {
  const basic = validateExternalEvidenceRelayRequestShape(input);
  const request = input as Partial<ExternalEvidenceRelayRequest>;
  const checks = {
    ...basic.checks,
    configurationBinding: request.configurationId === configuration.id && request.configurationDigest === configuration.configurationDigest,
    handoffBinding: request.handoffId === handoff.id && request.handoffDigest === handoff.handoffDigest,
    window: isTimestamp(request.requestedAt) && isTimestamp(request.expiresAt) && isShortWindow(request.requestedAt, request.expiresAt, configuration.maxRequestAgeMinutes * 60 * 1_000),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function receiptCore(input: Omit<ExternalEvidenceRelayReceipt, "schemaVersion" | "id" | "receiptDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-relay-receipt.v1" as const,
    id: input.id?.trim() || `external-relay-receipt-${randomUUID()}`,
    requestId: input.requestId.trim(),
    requestDigest: input.requestDigest,
    configurationId: input.configurationId.trim(),
    configurationDigest: input.configurationDigest,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    operation: input.operation,
    sourceMilestone: input.sourceMilestone,
    endpointDigest: input.endpointDigest,
    externalReceiptDigest: input.externalReceiptDigest,
    signerKeyFingerprint: input.signerKeyFingerprint,
    signatureDigest: input.signatureDigest,
    status: input.status,
    receivedAt: input.receivedAt,
    validUntil: input.validUntil,
  };
}

export function createExternalEvidenceRelayReceipt(input: Omit<ExternalEvidenceRelayReceipt, "schemaVersion" | "id" | "receiptDigest"> & { id?: string }) {
  const core = receiptCore(input);
  return { ...core, receiptDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceRelayReceipt(
  input: unknown,
  configuration: ExternalEvidenceRelayConfiguration,
  request: ExternalEvidenceRelayRequest,
) {
  const receipt = input as Partial<ExternalEvidenceRelayReceipt>;
  const core = receipt.schemaVersion === "evidence.external-relay-receipt.v1" && typeof receipt.id === "string" && typeof receipt.requestId === "string" && typeof receipt.configurationId === "string" && typeof receipt.handoffId === "string"
    ? receiptCore({
      id: receipt.id,
      requestId: receipt.requestId,
      requestDigest: receipt.requestDigest || "",
      configurationId: receipt.configurationId,
      configurationDigest: receipt.configurationDigest || "",
      handoffId: receipt.handoffId,
      handoffDigest: receipt.handoffDigest || "",
      operation: receipt.operation as ExternalEvidenceRelayOperation,
      sourceMilestone: receipt.sourceMilestone === null ? null : receipt.sourceMilestone || null,
      endpointDigest: receipt.endpointDigest || "",
      externalReceiptDigest: receipt.externalReceiptDigest || "",
      signerKeyFingerprint: receipt.signerKeyFingerprint || "",
      signatureDigest: receipt.signatureDigest || "",
      status: receipt.status as ExternalEvidenceRelayReceipt["status"],
      receivedAt: receipt.receivedAt || "",
      validUntil: receipt.validUntil || "",
    })
    : null;
  const operation = receipt.operation as ExternalEvidenceRelayOperation;
  const matchingMilestone = sourceMilestoneRequired(operation)
    ? receipt.sourceMilestone === request.sourceMilestone && typeof receipt.sourceMilestone === "string"
    : receipt.sourceMilestone === null && request.sourceMilestone === null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "requestId", "requestDigest", "configurationId", "configurationDigest", "handoffId", "handoffDigest", "operation", "sourceMilestone", "endpointDigest", "externalReceiptDigest", "signerKeyFingerprint", "signatureDigest", "status", "receivedAt", "validUntil", "receiptDigest"]),
    schemaVersion: receipt.schemaVersion === "evidence.external-relay-receipt.v1",
    identity: isIdentity(receipt.id) && isIdentity(receipt.requestId) && isIdentity(receipt.configurationId) && isIdentity(receipt.handoffId),
    requestBinding: receipt.requestId === request.id && receipt.requestDigest === request.requestDigest,
    configurationBinding: receipt.configurationId === configuration.id && receipt.configurationDigest === configuration.configurationDigest,
    handoffBinding: receipt.handoffId === request.handoffId && receipt.handoffDigest === request.handoffDigest,
    operation: RELAY_OPERATIONS.includes(operation) && operation === request.operation,
    milestone: matchingMilestone,
    endpoint: receipt.endpointDigest === endpointDigest(configuration, request.operation),
    signatureBinding: receipt.signerKeyFingerprint === configuration.trustAnchorFingerprint && isDigest(receipt.signatureDigest),
    digests: isDigest(receipt.externalReceiptDigest) && isDigest(receipt.endpointDigest),
    status: receipt.status === "accepted" || receipt.status === "rejected",
    window: isTimestamp(receipt.receivedAt) && isTimestamp(receipt.validUntil) && isShortWindow(receipt.receivedAt, receipt.validUntil, 31 * DAY),
    digest: Boolean(core) && receipt.receiptDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function quarantineCore(input: Omit<ExternalEvidenceRelayQuarantine, "schemaVersion" | "id" | "quarantineDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-relay-quarantine.v1" as const,
    id: input.id?.trim() || `external-relay-quarantine-${randomUUID()}`,
    configurationId: input.configurationId.trim(),
    configurationDigest: input.configurationDigest,
    requestId: input.requestId,
    requestDigest: input.requestDigest,
    code: input.code,
    payloadDigest: input.payloadDigest,
    detailDigest: input.detailDigest,
    observedAt: input.observedAt,
  };
}

export function createExternalEvidenceRelayQuarantine(input: Omit<ExternalEvidenceRelayQuarantine, "schemaVersion" | "id" | "quarantineDigest"> & { id?: string }) {
  const core = quarantineCore(input);
  return { ...core, quarantineDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceRelayQuarantine(
  input: unknown,
  configuration: ExternalEvidenceRelayConfiguration,
  request?: ExternalEvidenceRelayRequest,
) {
  const quarantine = input as Partial<ExternalEvidenceRelayQuarantine>;
  const core = quarantine.schemaVersion === "evidence.external-relay-quarantine.v1" && typeof quarantine.id === "string" && typeof quarantine.configurationId === "string"
    ? quarantineCore({
      id: quarantine.id,
      configurationId: quarantine.configurationId,
      configurationDigest: quarantine.configurationDigest || "",
      requestId: quarantine.requestId === null ? null : quarantine.requestId || null,
      requestDigest: quarantine.requestDigest === null ? null : quarantine.requestDigest || null,
      code: quarantine.code as ExternalEvidenceRelayQuarantine["code"],
      payloadDigest: quarantine.payloadDigest || "",
      detailDigest: quarantine.detailDigest || "",
      observedAt: quarantine.observedAt || "",
    })
    : null;
  const requestShape = quarantine.requestId === null && quarantine.requestDigest === null ||
    typeof quarantine.requestId === "string" && isIdentity(quarantine.requestId) && isDigest(quarantine.requestDigest);
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "configurationId", "configurationDigest", "requestId", "requestDigest", "code", "payloadDigest", "detailDigest", "observedAt", "quarantineDigest"]),
    schemaVersion: quarantine.schemaVersion === "evidence.external-relay-quarantine.v1",
    identity: isIdentity(quarantine.id) && isIdentity(quarantine.configurationId),
    configurationBinding: quarantine.configurationId === configuration.id && quarantine.configurationDigest === configuration.configurationDigest,
    requestBinding: !request ? quarantine.requestId === null && quarantine.requestDigest === null : quarantine.requestId === request.id && quarantine.requestDigest === request.requestDigest,
    requestShape,
    code: ["schema-invalid", "binding-mismatch", "stale", "duplicate", "transport-failure"].includes(quarantine.code || ""),
    digests: isDigest(quarantine.payloadDigest) && isDigest(quarantine.detailDigest),
    observedAt: isTimestamp(quarantine.observedAt),
    digest: Boolean(core) && quarantine.quarantineDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function buildExternalEvidenceRelayReconciliation(input: {
  configuration: ExternalEvidenceRelayConfiguration;
  handoff: ExternalEvidenceHandoff;
  receipts: ExternalEvidenceRelayReceipt[];
  quarantines: ExternalEvidenceRelayQuarantine[];
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const matchingReceipts = input.receipts.filter((receipt) =>
    receipt.configurationId === input.configuration.id &&
    receipt.configurationDigest === input.configuration.configurationDigest &&
    receipt.handoffId === input.handoff.id &&
    receipt.handoffDigest === input.handoff.handoffDigest &&
    receipt.operation === "receipt-verification",
  );
  const current = matchingReceipts.filter((receipt) => receipt.status === "accepted" && Date.parse(receipt.validUntil) >= now);
  const coveredMilestones = input.handoff.sourceMilestones.filter((milestone) => current.some((receipt) => receipt.sourceMilestone === milestone));
  const staleReceiptCount = matchingReceipts.filter((receipt) => Date.parse(receipt.validUntil) < now).length;
  const quarantinedImportCount = input.quarantines.filter((quarantine) =>
    quarantine.configurationId === input.configuration.id &&
    quarantine.configurationDigest === input.configuration.configurationDigest,
  ).length;
  const status = hasExactMilestones(coveredMilestones) && staleReceiptCount === 0 && quarantinedImportCount === 0
    ? "ready-for-independent-decision" as const
    : "hold" as const;
  const core = {
    schemaVersion: "evidence.external-relay-reconciliation.v1" as const,
    configurationId: input.configuration.id,
    configurationDigest: input.configuration.configurationDigest,
    handoffId: input.handoff.id,
    handoffDigest: input.handoff.handoffDigest,
    expectedMilestones: [...input.handoff.sourceMilestones],
    coveredMilestones,
    staleReceiptCount,
    quarantinedImportCount,
    observedAt: new Date(now).toISOString(),
    status,
  };
  return { ...core, reconciliationDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceRelayReconciliation(input: unknown, configuration: ExternalEvidenceRelayConfiguration, handoff: ExternalEvidenceHandoff) {
  const reconciliation = input as Partial<ExternalEvidenceRelayReconciliation>;
  const core = reconciliation.schemaVersion === "evidence.external-relay-reconciliation.v1" && typeof reconciliation.configurationId === "string" && typeof reconciliation.handoffId === "string" && Array.isArray(reconciliation.expectedMilestones) && Array.isArray(reconciliation.coveredMilestones)
    ? {
      schemaVersion: "evidence.external-relay-reconciliation.v1" as const,
      configurationId: reconciliation.configurationId,
      configurationDigest: reconciliation.configurationDigest || "",
      handoffId: reconciliation.handoffId,
      handoffDigest: reconciliation.handoffDigest || "",
      expectedMilestones: reconciliation.expectedMilestones,
      coveredMilestones: reconciliation.coveredMilestones,
      staleReceiptCount: Number(reconciliation.staleReceiptCount),
      quarantinedImportCount: Number(reconciliation.quarantinedImportCount),
      observedAt: reconciliation.observedAt || "",
      status: reconciliation.status as ExternalEvidenceRelayReconciliation["status"],
    }
    : null;
  const expected = Array.isArray(reconciliation.expectedMilestones) && reconciliation.expectedMilestones.every((value) => typeof value === "string") ? reconciliation.expectedMilestones as string[] : [];
  const covered = Array.isArray(reconciliation.coveredMilestones) && reconciliation.coveredMilestones.every((value) => typeof value === "string") ? reconciliation.coveredMilestones as string[] : [];
  const ready = hasExactMilestones(covered) && Number(reconciliation.staleReceiptCount) === 0 && Number(reconciliation.quarantinedImportCount) === 0;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "configurationId", "configurationDigest", "handoffId", "handoffDigest", "expectedMilestones", "coveredMilestones", "staleReceiptCount", "quarantinedImportCount", "observedAt", "status", "reconciliationDigest"]),
    schemaVersion: reconciliation.schemaVersion === "evidence.external-relay-reconciliation.v1",
    bindings: reconciliation.configurationId === configuration.id && reconciliation.configurationDigest === configuration.configurationDigest && reconciliation.handoffId === handoff.id && reconciliation.handoffDigest === handoff.handoffDigest,
    expectedMilestones: hasExactMilestones(expected) && expected.every((value, index) => value === handoff.sourceMilestones[index]),
    coveredMilestones: new Set(covered).size === covered.length && covered.every((value) => handoff.sourceMilestones.includes(value)),
    counts: Number.isInteger(reconciliation.staleReceiptCount) && Number(reconciliation.staleReceiptCount) >= 0 && Number.isInteger(reconciliation.quarantinedImportCount) && Number(reconciliation.quarantinedImportCount) >= 0,
    observedAt: isTimestamp(reconciliation.observedAt),
    status: reconciliation.status === "hold" || reconciliation.status === "ready-for-independent-decision",
    semanticStatus: reconciliation.status === (ready ? "ready-for-independent-decision" : "hold"),
    digest: Boolean(core) && reconciliation.reconciliationDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function emptyExternalEvidenceRelayStore(): ExternalEvidenceRelayStore {
  return {
    schemaVersion: "evidence.external-relay-store.v1",
    revision: 0,
    configurations: [],
    requests: [],
    receipts: [],
    quarantines: [],
    idempotency: {},
  };
}

export function validateExternalEvidenceRelayStore(input: unknown): input is ExternalEvidenceRelayStore {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const store = input as Partial<ExternalEvidenceRelayStore>;
  const idempotency = store.idempotency;
  if (!hasOnlyKeys(input, ["schemaVersion", "revision", "configurations", "requests", "receipts", "quarantines", "idempotency"]) || store.schemaVersion !== "evidence.external-relay-store.v1" || !Number.isInteger(store.revision) || Number(store.revision) < 0 || !Array.isArray(store.configurations) || !Array.isArray(store.requests) || !Array.isArray(store.receipts) || !Array.isArray(store.quarantines) || !idempotency || typeof idempotency !== "object" || Array.isArray(idempotency)) return false;
  if (store.configurations.length > MAX_CONFIGURATIONS || store.requests.length > MAX_REQUESTS || store.receipts.length > MAX_RECEIPTS || store.quarantines.length > MAX_QUARANTINES) return false;
  const configurations = store.configurations as ExternalEvidenceRelayConfiguration[];
  const requests = store.requests as ExternalEvidenceRelayRequest[];
  const receipts = store.receipts as ExternalEvidenceRelayReceipt[];
  const quarantines = store.quarantines as ExternalEvidenceRelayQuarantine[];
  if (new Set(configurations.map((configuration) => configuration.id)).size !== configurations.length || !configurations.every((configuration) => validateExternalEvidenceRelayConfiguration(configuration).ok)) return false;
  if (new Set(requests.map((request) => request.id)).size !== requests.length || new Set(requests.map((request) => request.idempotencyKey)).size !== requests.length) return false;
  if (!requests.every((request) => {
    const configuration = configurations.find((entry) => entry.id === request.configurationId && entry.configurationDigest === request.configurationDigest);
    return Boolean(configuration && validateExternalEvidenceRelayRequestShape(request).ok && isShortWindow(request.requestedAt, request.expiresAt, configuration.maxRequestAgeMinutes * 60 * 1_000));
  })) return false;
  if (new Set(receipts.map((receipt) => receipt.id)).size !== receipts.length || !receipts.every((receipt) => {
    const request = requests.find((entry) => entry.id === receipt.requestId && entry.requestDigest === receipt.requestDigest);
    const configuration = request && configurations.find((entry) => entry.id === request.configurationId && entry.configurationDigest === request.configurationDigest);
    return Boolean(configuration && request && validateExternalEvidenceRelayReceipt(receipt, configuration, request).ok);
  })) return false;
  if (new Set(quarantines.map((quarantine) => quarantine.id)).size !== quarantines.length || !quarantines.every((quarantine) => {
    const configuration = configurations.find((entry) => entry.id === quarantine.configurationId && entry.configurationDigest === quarantine.configurationDigest);
    const request = quarantine.requestId ? requests.find((entry) => entry.id === quarantine.requestId && entry.requestDigest === quarantine.requestDigest) : undefined;
    return Boolean(configuration && validateExternalEvidenceRelayQuarantine(quarantine, configuration, request).ok);
  })) return false;
  return Object.keys(idempotency).length === requests.length &&
    requests.every((request) => idempotency[request.idempotencyKey] === request.id) &&
    Object.entries(idempotency).every(([key, id]) => typeof id === "string" && requests.some((request) => request.idempotencyKey === key && request.id === id));
}

export function insertExternalEvidenceRelayConfiguration(store: ExternalEvidenceRelayStore, configuration: ExternalEvidenceRelayConfiguration) {
  if (!validateExternalEvidenceRelayConfiguration(configuration).ok) throw new ExternalEvidenceRelayError("invalid-input", "External evidence relay configuration failed strict validation.");
  const existing = store.configurations.find((entry) => entry.id === configuration.id);
  if (existing) {
    if (existing.configurationDigest !== configuration.configurationDigest) throw new ExternalEvidenceRelayError("revision-conflict", "Relay configuration id is already bound to another digest.");
    return { store, configuration: existing, deduplicated: true };
  }
  if (store.configurations.length >= MAX_CONFIGURATIONS) throw new ExternalEvidenceRelayError("capacity-exceeded", "Relay configuration capacity reached without eviction.");
  return { store: { ...store, revision: store.revision + 1, configurations: [configuration, ...store.configurations] }, configuration, deduplicated: false };
}

export function insertExternalEvidenceRelayRequest(store: ExternalEvidenceRelayStore, request: ExternalEvidenceRelayRequest) {
  const configuration = store.configurations.find((entry) => entry.id === request.configurationId && entry.configurationDigest === request.configurationDigest);
  if (!configuration || !validateExternalEvidenceRelayRequestShape(request).ok || !isShortWindow(request.requestedAt, request.expiresAt, configuration.maxRequestAgeMinutes * 60 * 1_000)) throw new ExternalEvidenceRelayError("invalid-input", "External evidence relay request failed strict validation.");
  const existingId = store.idempotency[request.idempotencyKey];
  const existing = existingId ? store.requests.find((entry) => entry.id === existingId) : undefined;
  if (existing) {
    if (existing.requestDigest !== request.requestDigest) throw new ExternalEvidenceRelayError("revision-conflict", "Relay request idempotency key is already bound to another digest.");
    return { store, request: existing, deduplicated: true };
  }
  if (store.requests.length >= MAX_REQUESTS) throw new ExternalEvidenceRelayError("capacity-exceeded", "Relay request capacity reached without eviction.");
  return {
    store: { ...store, revision: store.revision + 1, requests: [request, ...store.requests], idempotency: { ...store.idempotency, [request.idempotencyKey]: request.id } },
    request,
    deduplicated: false,
  };
}

export function appendExternalEvidenceRelayReceipt(store: ExternalEvidenceRelayStore, receipt: ExternalEvidenceRelayReceipt) {
  const request = store.requests.find((entry) => entry.id === receipt.requestId && entry.requestDigest === receipt.requestDigest);
  const configuration = request && store.configurations.find((entry) => entry.id === request.configurationId && entry.configurationDigest === request.configurationDigest);
  if (!configuration || !request || !validateExternalEvidenceRelayReceipt(receipt, configuration, request).ok) throw new ExternalEvidenceRelayError("invalid-input", "External evidence relay receipt failed strict validation.");
  const existing = store.receipts.find((entry) => entry.id === receipt.id);
  if (existing) {
    if (existing.receiptDigest !== receipt.receiptDigest) throw new ExternalEvidenceRelayError("revision-conflict", "Relay receipt id is already bound to another digest.");
    return { store, receipt: existing, deduplicated: true };
  }
  if (store.receipts.length >= MAX_RECEIPTS) throw new ExternalEvidenceRelayError("capacity-exceeded", "Relay receipt capacity reached without eviction.");
  return { store: { ...store, revision: store.revision + 1, receipts: [receipt, ...store.receipts] }, receipt, deduplicated: false };
}

export function appendExternalEvidenceRelayQuarantine(store: ExternalEvidenceRelayStore, quarantine: ExternalEvidenceRelayQuarantine) {
  const configuration = store.configurations.find((entry) => entry.id === quarantine.configurationId && entry.configurationDigest === quarantine.configurationDigest);
  const request = quarantine.requestId ? store.requests.find((entry) => entry.id === quarantine.requestId && entry.requestDigest === quarantine.requestDigest) : undefined;
  if (!configuration || !validateExternalEvidenceRelayQuarantine(quarantine, configuration, request).ok) throw new ExternalEvidenceRelayError("invalid-input", "External evidence relay quarantine record failed strict validation.");
  const existing = store.quarantines.find((entry) => entry.id === quarantine.id);
  if (existing) {
    if (existing.quarantineDigest !== quarantine.quarantineDigest) throw new ExternalEvidenceRelayError("revision-conflict", "Relay quarantine id is already bound to another digest.");
    return { store, quarantine: existing, deduplicated: true };
  }
  if (store.quarantines.length >= MAX_QUARANTINES) throw new ExternalEvidenceRelayError("capacity-exceeded", "Relay quarantine capacity reached without eviction.");
  return { store: { ...store, revision: store.revision + 1, quarantines: [quarantine, ...store.quarantines] }, quarantine, deduplicated: false };
}

export function createUnconfiguredExternalEvidenceRelayTransport(): ExternalEvidenceRelayTransport {
  return {
    async transmit() {
      throw new ExternalEvidenceRelayError("external-unavailable", "A controlled credential resolver and external evidence relay are not configured.");
    },
  };
}

export function createFetchExternalEvidenceRelayTransport(input: {
  credentialResolver: ExternalEvidenceRelayCredentialResolver;
  fetcher?: ExternalEvidenceRelayHttpClient;
  timeoutMs?: number;
}): ExternalEvidenceRelayTransport {
  const timeoutMs = input.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) throw new ExternalEvidenceRelayError("invalid-input", "Relay timeout must be between one and thirty seconds.");
  const fetcher: ExternalEvidenceRelayHttpClient = input.fetcher || ((url, init) => fetch(url, init));
  return {
    async transmit({ configuration, request }) {
      if (!validateExternalEvidenceRelayConfiguration(configuration).ok || !validateExternalEvidenceRelayRequestShape(request).ok || request.configurationId !== configuration.id || request.configurationDigest !== configuration.configurationDigest) {
        throw new ExternalEvidenceRelayError("invalid-input", "Relay transmission requires an exact configuration and request binding.");
      }
      if (!isSafeExternalUrl(configuration.relayUrl)) throw new ExternalEvidenceRelayError("unsafe-endpoint", "Relay endpoint is not eligible for external egress.");
      const credential = await input.credentialResolver.resolveAuthorization({ configuration, request });
      if (credential.credentialReferenceDigest !== configuration.credentialReferenceDigest || !isTimestamp(credential.expiresAt) || Date.parse(credential.expiresAt) <= Date.now() || typeof credential.authorization !== "string" || credential.authorization.trim().length < 8 || credential.authorization.length > 8_192) {
        throw new ExternalEvidenceRelayError("external-binding-failed", "Credential resolution did not match the configured opaque reference and validity window.");
      }
      const wire = JSON.stringify({ schemaVersion: "evidence.external-relay-wire-request.v1", request });
      if (Buffer.byteLength(wire, "utf8") > MAX_REQUEST_BYTES) throw new ExternalEvidenceRelayError("invalid-input", "Relay request exceeds the bounded digest-only payload ceiling.");
      let response: { ok: boolean; status: number; text(): Promise<string> };
      try {
        response = await fetcher(configuration.relayUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: credential.authorization,
            "x-evidence-relay-idempotency": request.idempotencyKey,
          },
          body: wire,
          redirect: "error",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new ExternalEvidenceRelayError("transport-failed", "External relay transport failed without persisting a remote response.");
      }
      const body = await response.text();
      if (!response.ok || Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) throw new ExternalEvidenceRelayError("transport-failed", "External relay returned a failed or oversized response.");
      let receipt: unknown;
      try {
        receipt = JSON.parse(body);
      } catch {
        throw new ExternalEvidenceRelayError("external-binding-failed", "External relay response is not valid receipt JSON.");
      }
      if (!validateExternalEvidenceRelayReceipt(receipt, configuration, request).ok) throw new ExternalEvidenceRelayError("external-binding-failed", "External relay response did not bind the configured request and trust anchor.");
      return receipt as ExternalEvidenceRelayReceipt;
    },
  };
}

export async function executeExternalEvidenceRelay(input: {
  configuration: ExternalEvidenceRelayConfiguration;
  request: ExternalEvidenceRelayRequest;
  handoff: Pick<ExternalEvidenceHandoff, "id" | "handoffDigest">;
  transport?: ExternalEvidenceRelayTransport;
}) {
  if (!validateExternalEvidenceRelayConfiguration(input.configuration).ok || !validateExternalEvidenceRelayRequest(input.request, input.configuration, input.handoff).ok) {
    throw new ExternalEvidenceRelayError("invalid-input", "External relay execution requires exact configuration, request, and handoff binding.");
  }
  const transport = input.transport || createUnconfiguredExternalEvidenceRelayTransport();
  const receipt = await transport.transmit({ configuration: input.configuration, request: input.request });
  if (!validateExternalEvidenceRelayReceipt(receipt, input.configuration, input.request).ok) throw new ExternalEvidenceRelayError("external-binding-failed", "External relay receipt did not bind the active request.");
  return receipt;
}
