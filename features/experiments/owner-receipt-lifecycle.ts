import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import {
  readDurableJsonStore,
  updateDurableJsonStore,
  type DurableJsonStoreOptions,
} from "@/features/persistence/durable-json-store";
import {
  validateOwnerWorkloadReceipt,
  type OwnerWorkloadProtocol,
  type OwnerWorkloadReceipt,
  type OwnerWorkloadReceiptValidation,
} from "@/features/experiments/owner-workload-protocol";

export const OWNER_RECEIPT_LEDGER_SCHEMA_VERSION =
  "experiments.owner-receipt-ledger.v1" as const;
export const OWNER_RECEIPT_LIFECYCLE_SCHEMA_VERSION =
  "experiments.owner-receipt-lifecycle.v1" as const;

export type OwnerReceiptEventType =
  | "receipt-accepted"
  | "receipt-quarantined"
  | "compensation-reconciled"
  | "escalation-acknowledged"
  | "waiver-requested"
  | "waiver-expired";

export type OwnerReceiptLedgerEvent = {
  sequence: number;
  eventId: string;
  eventType: OwnerReceiptEventType;
  occurredAt: string;
  actor: string;
  actionId: string | null;
  requestDigest: string | null;
  receiptDigest: string | null;
  receiptOutcome: string | null;
  validationStatus: OwnerWorkloadReceiptValidation["status"] | null;
  blockers: string[];
  reason: string | null;
  scopes: string[];
  expiresAt: string | null;
  referencedEventId: string | null;
  evidenceDigest: string | null;
  externalSignaturePending: true;
  productionTransitionDenied: true;
  previousEventDigest: string | null;
  eventDigest: string;
};

export type OwnerReceiptLedger = {
  schemaVersion: typeof OWNER_RECEIPT_LEDGER_SCHEMA_VERSION;
  revision: number;
  protocolDigest: string;
  events: OwnerReceiptLedgerEvent[];
  productionStatus: "blocked";
};

export type OwnerReceiptLifecycle = {
  ok: true;
  schemaVersion: typeof OWNER_RECEIPT_LIFECYCLE_SCHEMA_VERSION;
  generatedAt: string;
  sourceStatus: "pass";
  localStatus: "pass" | "attention";
  externalStatus: "hold";
  productionStatus: "blocked";
  revision: number;
  protocolDigest: string;
  ledgerDigest: string;
  decisionPackageDigest: string;
  checks: {
    protocolDigestCurrent: boolean;
    eventChainValid: boolean;
    strictRevisionSequence: boolean;
    sensitivePayloadNotPersisted: true;
    externalSignatureStillRequired: true;
    productionTransitionDenied: true;
  };
  summary: {
    totalRequests: number;
    acceptedCandidates: number;
    quarantinedCandidates: number;
    compensatedActions: number;
    acknowledgedEscalations: number;
    activeWaivers: number;
    expiredWaivers: number;
  };
  requests: Array<{
    actionId: string;
    owner: string;
    state: "awaiting-receipt" | "candidate-received" | "quarantined" | "compensated";
    receiptEventId: string | null;
    escalationAcknowledged: boolean;
    activeWaiverEventId: string | null;
  }>;
  events: OwnerReceiptLedgerEvent[];
  blockers: string[];
};

export class OwnerReceiptLifecycleError extends Error {
  constructor(
    readonly code: "invalid_input" | "revision_conflict" | "not_found" | "policy_denied",
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "OwnerReceiptLifecycleError";
  }
}

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
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function eventWithoutDigest(event: OwnerReceiptLedgerEvent) {
  const { eventDigest: _eventDigest, ...rest } = event;
  return rest;
}

function eventChainIsValid(events: OwnerReceiptLedgerEvent[]) {
  return events.every((event, index) =>
    event.sequence === index + 1 &&
    event.previousEventDigest === (index === 0 ? null : events[index - 1]!.eventDigest) &&
    event.eventDigest === digest(eventWithoutDigest(event)),
  );
}

function isLedger(value: unknown): value is OwnerReceiptLedger {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ledger = value as OwnerReceiptLedger;
  return ledger.schemaVersion === OWNER_RECEIPT_LEDGER_SCHEMA_VERSION &&
    Number.isInteger(ledger.revision) && ledger.revision >= 0 &&
    isDigest(ledger.protocolDigest) &&
    ledger.productionStatus === "blocked" &&
    Array.isArray(ledger.events) && ledger.revision === ledger.events.length &&
    eventChainIsValid(ledger.events);
}

function ledgerPath() {
  return process.env.FIRST_LLM_OWNER_RECEIPT_LEDGER_PATH?.trim() ||
    path.join(process.cwd(), "data", "experiments", "owner-receipt-ledger.json");
}

function storeOptions(protocol: OwnerWorkloadProtocol): DurableJsonStoreOptions<OwnerReceiptLedger> {
  return {
    filePath: ledgerPath(),
    initial: () => ({
      schemaVersion: OWNER_RECEIPT_LEDGER_SCHEMA_VERSION,
      revision: 0,
      protocolDigest: protocol.protocolDigest,
      events: [],
      productionStatus: "blocked",
    }),
    validate: isLedger,
  };
}

function normalizedActor(value: unknown) {
  const actor = typeof value === "string" ? value.trim() : "";
  if (actor.length < 3 || actor.length > 160) {
    throw new OwnerReceiptLifecycleError("invalid_input", 400, "A durable actor identity between 3 and 160 characters is required.");
  }
  return actor;
}

function normalizedReason(value: unknown) {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 10 || reason.length > 500) {
    throw new OwnerReceiptLifecycleError("invalid_input", 400, "A reason between 10 and 500 characters is required.");
  }
  return reason;
}

function assertKnownAction(protocol: OwnerWorkloadProtocol, actionId: unknown) {
  const normalized = typeof actionId === "string" ? actionId.trim() : "";
  const request = protocol.requests.find((candidate) => candidate.actionId === normalized);
  if (!request) throw new OwnerReceiptLifecycleError("not_found", 404, "The owner workload action is unknown.");
  return request;
}

function appendEvent(input: {
  protocol: OwnerWorkloadProtocol;
  expectedRevision: number;
  event: Omit<OwnerReceiptLedgerEvent, "sequence" | "eventId" | "previousEventDigest" | "eventDigest">;
}) {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new OwnerReceiptLifecycleError("invalid_input", 400, "expectedRevision must be a non-negative integer.");
  }
  return updateDurableJsonStore(storeOptions(input.protocol), (current) => {
    if (current.revision !== input.expectedRevision) {
      throw new OwnerReceiptLifecycleError(
        "revision_conflict",
        409,
        `Ledger revision changed from ${input.expectedRevision} to ${current.revision}; refresh before retrying.`,
      );
    }
    const withoutDigest = {
      ...input.event,
      sequence: current.revision + 1,
      eventId: randomUUID(),
      previousEventDigest: current.events.at(-1)?.eventDigest || null,
    };
    const event: OwnerReceiptLedgerEvent = {
      ...withoutDigest,
      eventDigest: digest(withoutDigest),
    };
    return {
      ...current,
      revision: current.revision + 1,
      protocolDigest: input.protocol.protocolDigest,
      events: [...current.events, event],
    };
  });
}

function baseEvent(input: { now: number; actor: string; actionId?: string | null }) {
  return {
    occurredAt: new Date(input.now).toISOString(),
    actor: input.actor,
    actionId: input.actionId || null,
    requestDigest: null,
    receiptDigest: null,
    receiptOutcome: null,
    validationStatus: null,
    blockers: [] as string[],
    reason: null,
    scopes: [] as string[],
    expiresAt: null,
    referencedEventId: null,
    evidenceDigest: null,
    externalSignaturePending: true as const,
    productionTransitionDenied: true as const,
  };
}

export function readOwnerReceiptLedger(protocol: OwnerWorkloadProtocol) {
  return readDurableJsonStore(storeOptions(protocol));
}

export function intakeOwnerWorkloadReceipt(input: {
  protocol: OwnerWorkloadProtocol;
  receipt: unknown;
  expectedRevision: number;
  actor: unknown;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const validation = validateOwnerWorkloadReceipt({ receipt: input.receipt, protocol: input.protocol, now });
  const candidate = input.receipt && typeof input.receipt === "object" && !Array.isArray(input.receipt)
    ? input.receipt as OwnerWorkloadReceipt
    : null;
  const request = input.protocol.requests.find((entry) => entry.actionId === candidate?.actionId);
  const ledger = appendEvent({
    protocol: input.protocol,
    expectedRevision: input.expectedRevision,
    event: {
      ...baseEvent({ now, actor: normalizedActor(input.actor), actionId: request?.actionId || null }),
      eventType: validation.ok ? "receipt-accepted" : "receipt-quarantined",
      requestDigest: isDigest(candidate?.requestDigest) ? candidate!.requestDigest! : null,
      receiptDigest: digest(input.receipt),
      receiptOutcome: typeof candidate?.outcome === "string" ? candidate.outcome : null,
      validationStatus: validation.status,
      blockers: validation.blockers,
    },
  });
  return { ledger, validation };
}

export function acknowledgeOwnerEscalation(input: {
  protocol: OwnerWorkloadProtocol;
  actionId: unknown;
  expectedRevision: number;
  actor: unknown;
  reason: unknown;
  now?: number;
}) {
  const request = assertKnownAction(input.protocol, input.actionId);
  return appendEvent({
    protocol: input.protocol,
    expectedRevision: input.expectedRevision,
    event: {
      ...baseEvent({ now: input.now ?? Date.now(), actor: normalizedActor(input.actor), actionId: request.actionId }),
      eventType: "escalation-acknowledged",
      requestDigest: request.requestDigest,
      reason: normalizedReason(input.reason),
    },
  });
}

export function requestOwnerWaiver(input: {
  protocol: OwnerWorkloadProtocol;
  actionId: unknown;
  expectedRevision: number;
  actor: unknown;
  reason: unknown;
  durationHours: unknown;
  scopes: unknown;
  now?: number;
}) {
  const request = assertKnownAction(input.protocol, input.actionId);
  const durationHours = Number(input.durationHours);
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > input.protocol.waiverPolicy.maximumDurationHours) {
    throw new OwnerReceiptLifecycleError("policy_denied", 400, "Waivers must be whole hours within the 24-hour policy maximum.");
  }
  const scopes = Array.isArray(input.scopes)
    ? [...new Set(input.scopes.filter((scope): scope is string => typeof scope === "string").map((scope) => scope.trim()).filter(Boolean))]
    : [];
  if (!scopes.length || scopes.some((scope) => input.protocol.waiverPolicy.forbiddenScopes.includes(scope))) {
    throw new OwnerReceiptLifecycleError("policy_denied", 400, "Waiver scopes are required and cannot include a protected control.");
  }
  const now = input.now ?? Date.now();
  return appendEvent({
    protocol: input.protocol,
    expectedRevision: input.expectedRevision,
    event: {
      ...baseEvent({ now, actor: normalizedActor(input.actor), actionId: request.actionId }),
      eventType: "waiver-requested",
      requestDigest: request.requestDigest,
      reason: normalizedReason(input.reason),
      scopes,
      expiresAt: new Date(now + durationHours * 60 * 60 * 1000).toISOString(),
    },
  });
}

export function expireOwnerWaiver(input: {
  protocol: OwnerWorkloadProtocol;
  waiverEventId: unknown;
  expectedRevision: number;
  actor: unknown;
  reason: unknown;
  now?: number;
}) {
  const current = readOwnerReceiptLedger(input.protocol);
  const waiverEventId = typeof input.waiverEventId === "string" ? input.waiverEventId : "";
  const waiver = current.events.find((event) => event.eventId === waiverEventId && event.eventType === "waiver-requested");
  if (!waiver) throw new OwnerReceiptLifecycleError("not_found", 404, "The waiver event is unknown.");
  if (current.events.some((event) => event.eventType === "waiver-expired" && event.referencedEventId === waiver.eventId)) {
    throw new OwnerReceiptLifecycleError("policy_denied", 400, "The waiver is already expired or revoked.");
  }
  return appendEvent({
    protocol: input.protocol,
    expectedRevision: input.expectedRevision,
    event: {
      ...baseEvent({ now: input.now ?? Date.now(), actor: normalizedActor(input.actor), actionId: waiver.actionId }),
      eventType: "waiver-expired",
      requestDigest: waiver.requestDigest,
      reason: normalizedReason(input.reason),
      referencedEventId: waiver.eventId,
    },
  });
}

export function reconcileOwnerCompensation(input: {
  protocol: OwnerWorkloadProtocol;
  actionId: unknown;
  receiptEventId: unknown;
  expectedRevision: number;
  actor: unknown;
  reason: unknown;
  rollbackEvidenceDigest: unknown;
  now?: number;
}) {
  const request = assertKnownAction(input.protocol, input.actionId);
  const current = readOwnerReceiptLedger(input.protocol);
  const receiptEventId = typeof input.receiptEventId === "string" ? input.receiptEventId : "";
  const receipt = current.events.find((event) =>
    event.eventId === receiptEventId &&
    event.actionId === request.actionId &&
    (event.eventType === "receipt-accepted" || event.eventType === "receipt-quarantined"),
  );
  if (!receipt) throw new OwnerReceiptLifecycleError("not_found", 404, "The receipt event is not available for this action.");
  if (!isDigest(input.rollbackEvidenceDigest)) {
    throw new OwnerReceiptLifecycleError("invalid_input", 400, "A SHA-256 rollback evidence digest is required.");
  }
  return appendEvent({
    protocol: input.protocol,
    expectedRevision: input.expectedRevision,
    event: {
      ...baseEvent({ now: input.now ?? Date.now(), actor: normalizedActor(input.actor), actionId: request.actionId }),
      eventType: "compensation-reconciled",
      requestDigest: request.requestDigest,
      reason: normalizedReason(input.reason),
      referencedEventId: receipt.eventId,
      evidenceDigest: input.rollbackEvidenceDigest,
    },
  });
}

export function buildOwnerReceiptLifecycle(input: {
  protocol: OwnerWorkloadProtocol;
  ledger: OwnerReceiptLedger;
  now?: number;
}): OwnerReceiptLifecycle {
  const now = input.now ?? Date.now();
  const accepted = input.ledger.events.filter((event) => event.eventType === "receipt-accepted");
  const quarantined = input.ledger.events.filter((event) => event.eventType === "receipt-quarantined");
  const compensated = input.ledger.events.filter((event) => event.eventType === "compensation-reconciled");
  const acknowledgements = input.ledger.events.filter((event) => event.eventType === "escalation-acknowledged");
  const waiverRequests = input.ledger.events.filter((event) => event.eventType === "waiver-requested");
  const explicitExpiryIds = new Set(input.ledger.events.filter((event) => event.eventType === "waiver-expired").map((event) => event.referencedEventId));
  const activeWaivers = waiverRequests.filter((event) =>
    !explicitExpiryIds.has(event.eventId) && Boolean(event.expiresAt) && Date.parse(event.expiresAt!) > now,
  );
  const expiredWaivers = waiverRequests.filter((event) => !activeWaivers.includes(event));
  const requests = input.protocol.requests.map((request) => {
    const receipt = [...input.ledger.events].reverse().find((event) =>
      event.actionId === request.actionId &&
      (event.eventType === "receipt-accepted" || event.eventType === "receipt-quarantined"),
    );
    const compensation = [...compensated].reverse().find((event) => event.actionId === request.actionId);
    return {
      actionId: request.actionId,
      owner: request.owner,
      state: compensation ? "compensated" as const : receipt?.eventType === "receipt-accepted" ? "candidate-received" as const : receipt ? "quarantined" as const : "awaiting-receipt" as const,
      receiptEventId: receipt?.eventId || null,
      escalationAcknowledged: acknowledgements.some((event) => event.actionId === request.actionId),
      activeWaiverEventId: activeWaivers.find((event) => event.actionId === request.actionId)?.eventId || null,
    };
  });
  const checks = {
    protocolDigestCurrent: input.ledger.protocolDigest === input.protocol.protocolDigest,
    eventChainValid: eventChainIsValid(input.ledger.events),
    strictRevisionSequence: input.ledger.revision === input.ledger.events.length,
    sensitivePayloadNotPersisted: true as const,
    externalSignatureStillRequired: true as const,
    productionTransitionDenied: true as const,
  };
  const blockers = [
    ...(requests.some((request) => request.state === "awaiting-receipt") ? ["One or more owner workloads still have no candidate receipt."] : []),
    ...(quarantined.length ? ["Quarantined receipt candidates require correction or compensation evidence."] : []),
    ...(!checks.protocolDigestCurrent ? ["The persisted ledger is bound to an older owner workload protocol digest."] : []),
    "Detached signature verification, pinned trust, and immutable external archive are still required.",
  ];
  const ledgerDigest = digest(input.ledger);
  return {
    ok: true,
    schemaVersion: OWNER_RECEIPT_LIFECYCLE_SCHEMA_VERSION,
    generatedAt: new Date(now).toISOString(),
    sourceStatus: "pass",
    localStatus: blockers.length === 1 ? "pass" : "attention",
    externalStatus: "hold",
    productionStatus: "blocked",
    revision: input.ledger.revision,
    protocolDigest: input.protocol.protocolDigest,
    ledgerDigest,
    decisionPackageDigest: digest({
      schemaVersion: "experiments.owner-receipt-decision-package.v1",
      protocolDigest: input.protocol.protocolDigest,
      ledgerDigest,
      terminalEventDigest: input.ledger.events.at(-1)?.eventDigest || null,
      productionStatus: "blocked",
    }),
    checks,
    summary: {
      totalRequests: input.protocol.requests.length,
      acceptedCandidates: accepted.length,
      quarantinedCandidates: quarantined.length,
      compensatedActions: new Set(compensated.map((event) => event.actionId)).size,
      acknowledgedEscalations: new Set(acknowledgements.map((event) => event.actionId)).size,
      activeWaivers: activeWaivers.length,
      expiredWaivers: expiredWaivers.length,
    },
    requests,
    events: input.ledger.events,
    blockers,
  };
}

