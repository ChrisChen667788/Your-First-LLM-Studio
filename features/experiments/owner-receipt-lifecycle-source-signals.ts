import { createHash } from "node:crypto";

import {
  buildOwnerReceiptLifecycle,
  readOwnerReceiptLedger,
  type OwnerReceiptLifecycle,
} from "@/features/experiments/owner-receipt-lifecycle";
import { readOwnerWorkloadSourceSignals } from "@/features/experiments/owner-workload-source-signals";
import type { OwnerWorkloadProtocol } from "@/features/experiments/owner-workload-protocol";
import type { SourceBackedSignalStatus } from "@/features/experiments/source-backed-assurance-projection";

export const OWNER_RECEIPT_LIFECYCLE_SOURCE_SIGNALS_SCHEMA_VERSION =
  "experiments.owner-receipt-lifecycle-source-signals.v1" as const;

export type OwnerReceiptLifecycleSourceSignalId =
  | "provider-receipt-intake"
  | "retrieval-receipt-intake"
  | "model-supply-chain-receipt-intake"
  | "workspace-receipt-intake"
  | "runtime-receipt-intake"
  | "benchmark-receipt-intake"
  | "telemetry-receipt-intake"
  | "candidate-receipt-quarantine-ledger"
  | "compensation-rollback-reconciliation"
  | "independent-receipt-ledger-closure"
  | "owner-sla-breach-detection"
  | "escalation-acknowledgement-lifecycle"
  | "bounded-waiver-lifecycle"
  | "operational-decision-package"
  | "independent-exception-governance-closure";

export type OwnerReceiptLifecycleSourceSignal = {
  id: OwnerReceiptLifecycleSourceSignalId;
  label: string;
  status: SourceBackedSignalStatus;
  summary: string;
  checks: Record<string, boolean>;
  metrics: Record<string, string | number | boolean | null>;
  blockers: string[];
  evidenceUri: string;
};

export type OwnerReceiptLifecycleSourceSignalSnapshot = {
  ok: true;
  schemaVersion: typeof OWNER_RECEIPT_LIFECYCLE_SOURCE_SIGNALS_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "attention";
  productionStatus: "blocked";
  summary: {
    totalSignals: number;
    sourceOwnedSignals: number;
    passingSignals: number;
    attentionSignals: number;
    unavailableSignals: number;
    externalOnlySignals: number;
  };
  signals: OwnerReceiptLifecycleSourceSignal[];
  lifecycle: OwnerReceiptLifecycle;
  protocol: OwnerWorkloadProtocol;
  stateDigest: string;
};

const RECEIPT_SIGNALS: Array<{
  actionId: string;
  signalId: OwnerReceiptLifecycleSourceSignalId;
  label: string;
}> = [
  { actionId: "provider-release-probe", signalId: "provider-receipt-intake", label: "Provider receipt intake" },
  { actionId: "managed-retrieval-rehearsal", signalId: "retrieval-receipt-intake", label: "Retrieval receipt intake" },
  { actionId: "authenticated-model-transfer", signalId: "model-supply-chain-receipt-intake", label: "Model supply-chain receipt intake" },
  { actionId: "signed-workspace-action", signalId: "workspace-receipt-intake", label: "Workspace receipt intake" },
  { actionId: "runtime-recovery-rehearsal", signalId: "runtime-receipt-intake", label: "Runtime receipt intake" },
  { actionId: "benchmark-candidate-run", signalId: "benchmark-receipt-intake", label: "Benchmark receipt intake" },
  { actionId: "telemetry-export-reconciliation", signalId: "telemetry-receipt-intake", label: "Telemetry receipt intake" },
];

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function computedSignal(
  input: Omit<OwnerReceiptLifecycleSourceSignal, "status">,
): OwnerReceiptLifecycleSourceSignal {
  return {
    ...input,
    status: Object.values(input.checks).every(Boolean) ? "pass" : "attention",
  };
}

function externalSignal(
  id: OwnerReceiptLifecycleSourceSignalId,
  label: string,
  summary: string,
): OwnerReceiptLifecycleSourceSignal {
  return {
    id,
    label,
    status: "external-only",
    summary,
    checks: { localSubstitutionDenied: true, productionTransitionDenied: true },
    metrics: {},
    blockers: ["A distinct authority must verify and retain this evidence outside the Studio."],
    evidenceUri: "/experiments",
  };
}

export function buildOwnerReceiptLifecycleSourceSignalSnapshot(input: {
  protocol: OwnerWorkloadProtocol;
  lifecycle: OwnerReceiptLifecycle;
  now?: number;
}): OwnerReceiptLifecycleSourceSignalSnapshot {
  const now = input.now ?? Date.now();
  const latestByAction = new Map(input.lifecycle.requests.map((request) => [request.actionId, request]));
  const quarantinedEvents = input.lifecycle.events.filter((event) => event.eventType === "receipt-quarantined");
  const compensatedEventIds = new Set(
    input.lifecycle.events
      .filter((event) => event.eventType === "compensation-reconciled")
      .map((event) => event.referencedEventId),
  );
  const generatedAt = Date.parse(input.protocol.generatedAt);
  const overdueActions = input.protocol.requests.filter((request) =>
    Number.isFinite(generatedAt) &&
    now - generatedAt >= request.escalationAfterHours * 60 * 60 * 1000 &&
    latestByAction.get(request.actionId)?.state === "awaiting-receipt",
  );
  const acknowledgedActions = new Set(
    input.lifecycle.events
      .filter((event) => event.eventType === "escalation-acknowledged")
      .map((event) => event.actionId),
  );
  const activeWaiverEvents = input.lifecycle.events.filter((event) =>
    event.eventType === "waiver-requested" &&
    Boolean(event.expiresAt) &&
    Date.parse(event.expiresAt!) > now &&
    !input.lifecycle.events.some((candidate) => candidate.eventType === "waiver-expired" && candidate.referencedEventId === event.eventId),
  );
  const signals: OwnerReceiptLifecycleSourceSignal[] = [
    ...RECEIPT_SIGNALS.map((definition) => {
      const state = latestByAction.get(definition.actionId);
      const accepted = state?.state === "candidate-received" || state?.state === "compensated";
      return computedSignal({
        id: definition.signalId,
        label: definition.label,
        summary: accepted
          ? "A strict candidate receipt is retained by digest in the local event ledger; external signature verification is still pending."
          : state?.state === "quarantined"
            ? "The latest candidate failed strict validation and remains quarantined without production authority."
            : "No candidate owner receipt has been admitted into the local event ledger.",
        checks: {
          requestBound: Boolean(state),
          candidateAccepted: accepted,
          externalSignatureStillRequired: input.lifecycle.checks.externalSignatureStillRequired,
          productionTransitionDenied: input.lifecycle.checks.productionTransitionDenied,
        },
        metrics: {
          actionId: definition.actionId,
          state: state?.state || "unavailable",
          revision: input.lifecycle.revision,
        },
        blockers: accepted
          ? ["A distinct external authority must verify the detached signature and immutable archive read-back."]
          : ["Submit a current, digest-bound owner receipt through the authenticated intake action."],
        evidenceUri: "/experiments",
      });
    }),
    computedSignal({
      id: "candidate-receipt-quarantine-ledger",
      label: "Candidate receipt quarantine ledger",
      summary: "Candidate receipts are reduced to non-secret digests, appended with optimistic concurrency, and chained to the preceding event.",
      checks: {
        eventChainValid: input.lifecycle.checks.eventChainValid,
        strictRevisionSequence: input.lifecycle.checks.strictRevisionSequence,
        sensitivePayloadNotPersisted: input.lifecycle.checks.sensitivePayloadNotPersisted,
        productionTransitionDenied: input.lifecycle.checks.productionTransitionDenied,
      },
      metrics: {
        revision: input.lifecycle.revision,
        quarantinedCandidates: input.lifecycle.summary.quarantinedCandidates,
        ledgerDigest: input.lifecycle.ledgerDigest,
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "compensation-rollback-reconciliation",
      label: "Compensation and rollback reconciliation",
      summary: "Every quarantined receipt can be bound to a separate rollback evidence digest without rewriting the original intake event.",
      checks: {
        allQuarantinedReceiptsReconciled: quarantinedEvents.every((event) => compensatedEventIds.has(event.eventId)),
        evidenceDigestStrict: input.lifecycle.events.filter((event) => event.eventType === "compensation-reconciled").every((event) => /^[a-f0-9]{64}$/u.test(event.evidenceDigest || "")),
        appendOnlyEventChain: input.lifecycle.checks.eventChainValid,
        productionTransitionDenied: input.lifecycle.checks.productionTransitionDenied,
      },
      metrics: {
        quarantinedCandidates: quarantinedEvents.length,
        compensatedActions: input.lifecycle.summary.compensatedActions,
      },
      blockers: quarantinedEvents.some((event) => !compensatedEventIds.has(event.eventId))
        ? ["At least one quarantined receipt still needs rollback or compensation evidence."]
        : [],
      evidenceUri: "/experiments",
    }),
    externalSignal(
      "independent-receipt-ledger-closure",
      "Independent receipt ledger closure",
      "The complete receipt event chain requires detached signature verification and immutable archive retention by a distinct authority.",
    ),
    computedSignal({
      id: "owner-sla-breach-detection",
      label: "Owner SLA breach detection",
      summary: "The source read-model derives overdue owner actions from the request escalation threshold without silently changing admission state.",
      checks: {
        protocolTimestampValid: Number.isFinite(generatedAt),
        everyRequestHasEscalation: input.protocol.requests.every((request) => request.escalationAfterHours >= request.reviewWithinHours),
        overdueActionsIdentified: overdueActions.every((request) => Boolean(latestByAction.get(request.actionId))),
        productionTransitionDenied: true,
      },
      metrics: { overdueActions: overdueActions.length },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "escalation-acknowledgement-lifecycle",
      label: "Escalation acknowledgement lifecycle",
      summary: "Escalation acknowledgements are durable, actor-bound events and never mutate or close the underlying workload request.",
      checks: {
        everyOverdueActionAcknowledged: overdueActions.every((request) => acknowledgedActions.has(request.actionId)),
        acknowledgementsActorBound: input.lifecycle.events.filter((event) => event.eventType === "escalation-acknowledged").every((event) => event.actor.length >= 3),
        originalRequestPreserved: input.lifecycle.checks.eventChainValid,
        productionTransitionDenied: true,
      },
      metrics: {
        overdueActions: overdueActions.length,
        acknowledgedEscalations: input.lifecycle.summary.acknowledgedEscalations,
      },
      blockers: overdueActions.some((request) => !acknowledgedActions.has(request.actionId))
        ? ["One or more overdue owner actions still need an explicit acknowledgement event."]
        : [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "bounded-waiver-lifecycle",
      label: "Bounded waiver lifecycle",
      summary: "Waivers are scope-bound, non-renewable events with automatic time-based expiry and explicit revocation support.",
      checks: {
        activeWaiversRemainBounded: activeWaiverEvents.every((event) => Date.parse(event.expiresAt!) - Date.parse(event.occurredAt) <= input.protocol.waiverPolicy.maximumDurationHours * 60 * 60 * 1000),
        protectedScopesExcluded: activeWaiverEvents.every((event) => event.scopes.every((scope) => !input.protocol.waiverPolicy.forbiddenScopes.includes(scope))),
        renewalDenied: !input.protocol.waiverPolicy.renewalAllowed,
        productionOverrideDenied: !input.protocol.waiverPolicy.productionOverrideAllowed,
      },
      metrics: {
        activeWaivers: activeWaiverEvents.length,
        expiredWaivers: input.lifecycle.summary.expiredWaivers,
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "operational-decision-package",
      label: "Operational decision package",
      summary: "The package digest binds the current protocol, ledger, and terminal event while retaining an explicit blocked production decision.",
      checks: {
        protocolDigestBound: /^[a-f0-9]{64}$/u.test(input.lifecycle.protocolDigest),
        ledgerDigestBound: /^[a-f0-9]{64}$/u.test(input.lifecycle.ledgerDigest),
        decisionPackageDigestBound: /^[a-f0-9]{64}$/u.test(input.lifecycle.decisionPackageDigest),
        productionTransitionDenied: input.lifecycle.productionStatus === "blocked",
      },
      metrics: {
        decisionPackageDigest: input.lifecycle.decisionPackageDigest,
        revision: input.lifecycle.revision,
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    externalSignal(
      "independent-exception-governance-closure",
      "Independent exception governance closure",
      "A distinct operating authority must sign and retain SLA, acknowledgement, waiver, and decision-package evidence.",
    ),
  ];
  const sourceOwned = signals.filter((signal) => signal.status !== "external-only");
  const summary = {
    totalSignals: signals.length,
    sourceOwnedSignals: sourceOwned.length,
    passingSignals: signals.filter((signal) => signal.status === "pass").length,
    attentionSignals: signals.filter((signal) => signal.status === "attention").length,
    unavailableSignals: signals.filter((signal) => signal.status === "unavailable").length,
    externalOnlySignals: signals.filter((signal) => signal.status === "external-only").length,
  };
  const withoutDigest = {
    ok: true as const,
    schemaVersion: OWNER_RECEIPT_LIFECYCLE_SOURCE_SIGNALS_SCHEMA_VERSION,
    generatedAt: new Date(now).toISOString(),
    localStatus: sourceOwned.every((signal) => signal.status === "pass") ? "pass" as const : "attention" as const,
    productionStatus: "blocked" as const,
    summary,
    signals,
    lifecycle: input.lifecycle,
    protocol: input.protocol,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

export function readOwnerReceiptLifecycleSourceSignals() {
  const ownerWorkload = readOwnerWorkloadSourceSignals();
  const protocol = ownerWorkload.ownerWorkloadProtocol;
  return buildOwnerReceiptLifecycleSourceSignalSnapshot({
    protocol,
    lifecycle: buildOwnerReceiptLifecycle({ protocol, ledger: readOwnerReceiptLedger(protocol) }),
  });
}

