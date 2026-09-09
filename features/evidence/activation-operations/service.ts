import { readExternalEvidenceActivationStore } from "@/features/evidence/external-activation-store";
import { createActivationLedgerStore } from "@/features/evidence/activation-intake/store";
import { loadIntakeContext } from "@/features/evidence/activation-intake/service";
import { ActivationIntakeError, type ActivationLedger, type SignedActivationEnvelope } from "@/features/evidence/activation-intake/contracts";
import { activationEnvelopeDigest, verifyActivationEnvelope, type IntakeContext } from "@/features/evidence/activation-intake/verify";
import { ActivationOperationsError, operationsIdentitySchema, operationsStoreSchema, type ActivationOperationsExport, type ActivationOperationsPolicy, type ActivationOperationsStore } from "./contracts";
import { buildActivationTrustSnapshot, operationsSha256, requireValidOperationsPolicy, validateActivationTrustSnapshot } from "./canonical";
import { projectActivationOperations } from "./projection";
import { createActivationOperationsStore, loadOperationsPolicyFile } from "./store";

type LedgerStore = ReturnType<typeof createActivationLedgerStore>;
type OperationsStore = ReturnType<typeof createActivationOperationsStore>;
type PolicyProvider = (snapshot: ReturnType<typeof buildActivationTrustSnapshot>) => unknown;
type RotationEnvelope = Extract<SignedActivationEnvelope, { kind: "rotation" }>;
type DecisionEnvelope = Extract<SignedActivationEnvelope, { kind: "decision" }>;

function defaultPolicyProvider(snapshot: ReturnType<typeof buildActivationTrustSnapshot>) {
  const filePath = process.env.FIRST_LLM_ACTIVATION_OPERATIONS_POLICY_PATH;
  if (!filePath) throw new ActivationOperationsError("unconfigured", 503);
  return loadOperationsPolicyFile(filePath);
}

function identity(value: string) {
  if (!operationsIdentitySchema.safeParse(value).success) throw new ActivationOperationsError("schema-invalid", 400);
  return value;
}

function operationContext(
  contextProvider: () => IntakeContext,
  policyProvider: PolicyProvider,
) {
  const context = contextProvider();
  const snapshot = buildActivationTrustSnapshot(context.trust);
  const policy = requireValidOperationsPolicy(policyProvider(snapshot), snapshot);
  if (!validateActivationTrustSnapshot(snapshot)) throw new ActivationOperationsError("policy-invalid", 503);
  return { context, snapshot, policy };
}

function findLedgerRecord(ledger: ActivationLedger, digest: string) {
  const record = ledger.records.find((entry) => entry.digest === digest);
  if (!record) throw new ActivationOperationsError("schema-invalid", 400);
  return record;
}

function requireRotationEnvelope(envelope: SignedActivationEnvelope): RotationEnvelope {
  if (envelope.kind !== "rotation") throw new ActivationOperationsError("schema-invalid", 400);
  return envelope as RotationEnvelope;
}

function requireDecisionEnvelope(envelope: SignedActivationEnvelope): DecisionEnvelope {
  if (envelope.kind !== "decision") throw new ActivationOperationsError("schema-invalid", 400);
  return envelope as DecisionEnvelope;
}

export function createActivationOperationsService(
  ledgerStore: LedgerStore = createActivationLedgerStore(),
  operationsStore: OperationsStore = createActivationOperationsStore(),
  contextProvider: () => IntakeContext = loadIntakeContext,
  policyProvider: PolicyProvider = defaultPolicyProvider,
) {
  function readState(now = Date.now()) {
    const ledger = ledgerStore.read();
    const operations = operationsStore.read();
    const { context, snapshot, policy } = operationContext(contextProvider, policyProvider);
    return { ledger, operations, context, snapshot, policy, projection: projectActivationOperations({ ledger, operations, context, policy, snapshot, now }) };
  }

  function summary() {
    try {
      const state = readState();
      return { ok: true as const, configured: true, ...state.projection,
        trust: { audience: state.context.trust.audience, activeKeys: state.context.trust.keys.filter((key) => key.status === "active").length },
        policy: { id: state.policy.id, maxClockSkewSeconds: state.policy.maxClockSkewSeconds, quarantineLeaseSeconds: state.policy.quarantineLeaseSeconds },
      };
    } catch (error) {
      if (!(error instanceof ActivationIntakeError || error instanceof ActivationOperationsError) || !["unconfigured", "policy-invalid", "trust-invalid"].includes(error.code)) throw error;
      const ledger = ledgerStore.read(); const operations = operationsStore.read();
      return { ok: true as const, configured: false, configurationCode: error.code, revision: operations.revision,
        ledgerRevision: ledger.revision, trustSnapshotDigest: null, policyDigest: null, rotationCount: operations.rotations.length,
        staleManifests: [], conflicts: [], quarantineCases: ledger.quarantines.map((entry) => ({ id: entry.id, manifestDigest: entry.manifestDigest, code: entry.code, status: "open" as const, claimedBy: null, leaseUntil: null })),
        decisionAdmissions: [], manifests: [], stageCount: 8, milestoneCount: 14, requiredStageCount: 0, requiredMilestoneCount: 0,
        distributionStatus: "hold" as const, productionStatus: "blocked" as const, currentRecords: 0, records: ledger.records.length,
        trust: null, policy: null, stateDigest: null,
      };
    }
  }

  function preflightRotation(envelopeDigest: string) {
    const state = readState(); const record = findLedgerRecord(state.ledger, envelopeDigest);
    const verified = verifyActivationEnvelope(record.envelope, state.context, Date.now());
    const rotation = record.envelope.kind === "rotation" ? record.envelope as RotationEnvelope : null;
    const checks = {
      kind: Boolean(rotation), currentAuthority: Boolean(rotation && rotation.body.predecessorFingerprint === state.context.manifests.find((manifest) => manifest.manifestDigest === rotation.manifestDigest)?.authorityKeyFingerprint),
      notAlreadyAdmitted: !state.operations.rotations.some((rotation) => rotation.envelopeDigest === envelopeDigest),
      successorTrusted: Boolean(rotation && state.context.trust.keys.some((key) => key.fingerprint === rotation.body.successorFingerprint && key.status === "active")),
    };
    return { ok: Object.values(checks).every(Boolean), checks, envelopeDigest: verified.digest, trustSnapshotDigest: state.snapshot.snapshotDigest };
  }

  function admitRotation(envelopeDigest: string, expectedRevision: number) {
    const state = readState(); const record = findLedgerRecord(state.ledger, envelopeDigest);
    const verified = verifyActivationEnvelope(record.envelope, state.context, Date.now());
    const rotation = requireRotationEnvelope(record.envelope);
    let result: ActivationOperationsStore | undefined;
    operationsStore.update((current) => {
      if (current.revision !== expectedRevision) throw new ActivationOperationsError("revision-conflict", 409);
      if (current.rotations.some((entry) => entry.envelopeDigest === envelopeDigest || entry.manifestDigest === rotation.manifestDigest)) throw new ActivationOperationsError("trust-rotation-invalid", 409);
      if (current.rotations.length >= 1000) throw new ActivationOperationsError("capacity-exceeded", 413);
      result = { ...current, revision: current.revision + 1, rotations: [...current.rotations, {
        id: operationsSha256(`rotation:${envelopeDigest}`), manifestDigest: rotation.manifestDigest, envelopeDigest,
        predecessorFingerprint: rotation.body.predecessorFingerprint, successorIssuerId: rotation.body.successorIssuerId,
        successorKeyId: rotation.body.successorKeyId, successorFingerprint: rotation.body.successorFingerprint,
        admittedAt: verified.receivedAt,
      }] };
      return result;
    });
    return { ok: true as const, revision: result!.revision, rotation: result!.rotations.at(-1), summary: summary() };
  }

  function claimQuarantine(caseId: string, ownerId: string, expectedRevision: number, now = Date.now()) {
    identity(ownerId); const state = readState(); const quarantine = state.ledger.quarantines.find((entry) => entry.id === caseId);
    if (!quarantine) throw new ActivationOperationsError("case-not-found", 404);
    const current = state.projection.quarantineCases.find((entry) => entry.id === caseId);
    if (current?.status === "resolved") throw new ActivationOperationsError("case-not-found", 409);
    let result: ActivationOperationsStore | undefined;
    operationsStore.update((store) => {
      if (store.revision !== expectedRevision) throw new ActivationOperationsError("revision-conflict", 409);
      const existing = store.quarantineCases.find((entry) => entry.id === caseId);
      if (existing?.status === "claimed" && existing.claimedBy !== ownerId && existing.leaseUntil && Date.parse(existing.leaseUntil) > now) throw new ActivationOperationsError("lease-held", 409);
      const next = { id: caseId, manifestDigest: quarantine.manifestDigest, status: "claimed" as const, claimedBy: ownerId,
        leaseUntil: new Date(now + state.policy.quarantineLeaseSeconds * 1000).toISOString(), resolutionDigest: existing?.resolutionDigest || null, updatedAt: new Date(now).toISOString() };
      result = { ...store, revision: store.revision + 1, quarantineCases: [...store.quarantineCases.filter((entry) => entry.id !== caseId), next] }; return result;
    });
    return { ok: true as const, revision: result!.revision, case: result!.quarantineCases.find((entry) => entry.id === caseId), summary: summary() };
  }

  function releaseQuarantine(caseId: string, ownerId: string, expectedRevision: number, now = Date.now()) {
    identity(ownerId); const state = readState(); const existing = state.operations.quarantineCases.find((entry) => entry.id === caseId);
    if (!existing || existing.status !== "claimed" || existing.claimedBy !== ownerId) throw new ActivationOperationsError("case-not-found", 409);
    let result: ActivationOperationsStore | undefined;
    operationsStore.update((store) => {
      if (store.revision !== expectedRevision) throw new ActivationOperationsError("revision-conflict", 409);
      result = { ...store, revision: store.revision + 1, quarantineCases: store.quarantineCases.map((entry) => entry.id === caseId ? { ...entry, status: "open" as const, claimedBy: null, leaseUntil: null, updatedAt: new Date(now).toISOString() } : entry) }; return result;
    });
    return { ok: true as const, revision: result!.revision, summary: summary() };
  }

  function admitDecision(envelopeDigest: string, expectedRevision: number) {
    const state = readState(); const record = findLedgerRecord(state.ledger, envelopeDigest);
    const verified = verifyActivationEnvelope(record.envelope, state.context, Date.now());
    const decision = requireDecisionEnvelope(record.envelope);
    const target = state.projection.manifests.find((manifest) => manifest.digest === decision.manifestDigest);
    if (!target?.eligibleForReview) throw new ActivationOperationsError("not-eligible", 409);
    if (state.operations.decisionAdmissions.some((entry) => entry.requestId === decision.body.requestId)) throw new ActivationOperationsError("decision-used", 409);
    let result: ActivationOperationsStore | undefined;
    operationsStore.update((store) => {
      if (store.revision !== expectedRevision) throw new ActivationOperationsError("revision-conflict", 409);
      if (store.decisionAdmissions.some((entry) => entry.requestId === decision.body.requestId)) throw new ActivationOperationsError("decision-used", 409);
      if (store.decisionAdmissions.length >= 1000) throw new ActivationOperationsError("capacity-exceeded", 413);
      result = { ...store, revision: store.revision + 1, decisionAdmissions: [...store.decisionAdmissions, { id: operationsSha256(`decision:${verified.digest}`), manifestDigest: decision.manifestDigest, requestId: decision.body.requestId, requestDigest: decision.body.requestDigest, envelopeDigest: verified.digest, decision: decision.body.decision, admittedAt: verified.receivedAt }] }; return result;
    });
    return { ok: true as const, revision: result!.revision, admission: result!.decisionAdmissions.at(-1), summary: summary() };
  }

  function exportBundle() {
    const state = readState();
    const core = { schemaVersion: "evidence.activation-operations-export.v1" as const, capturedAt: new Date().toISOString(), trustSnapshot: state.snapshot, policy: state.policy, ledger: state.ledger, operations: state.operations, projection: state.projection };
    const bundle = { ...core, exportDigest: operationsSha256(JSON.stringify(core)) };
    operationsStore.update((store) => ({ ...store, revision: store.revision + 1, exportReceipts: [...store.exportReceipts, { id: operationsSha256(`export:${bundle.exportDigest}`), ledgerRevision: state.ledger.revision, operationsRevision: state.operations.revision, trustSnapshotDigest: state.snapshot.snapshotDigest, policyDigest: state.policy.policyDigest, exportDigest: bundle.exportDigest, createdAt: bundle.capturedAt }] }));
    return bundle;
  }

  function restoreBundle(input: unknown, expectedRevision: number) {
    const parsed = operationsStoreSchema.safeParse(input && typeof input === "object" && "operations" in (input as object) ? (input as { operations: unknown }).operations : null);
    const bundle = input as Partial<ActivationOperationsExport>;
    if (!bundle || bundle.schemaVersion !== "evidence.activation-operations-export.v1" || !parsed.success || !bundle.ledger || !bundle.trustSnapshot || !bundle.policy) throw new ActivationOperationsError("schema-invalid", 400);
    const core = { schemaVersion: bundle.schemaVersion, capturedAt: bundle.capturedAt, trustSnapshot: bundle.trustSnapshot, policy: bundle.policy, ledger: bundle.ledger, operations: bundle.operations, projection: bundle.projection };
    if (bundle.exportDigest !== operationsSha256(JSON.stringify(core))) throw new ActivationOperationsError("ledger-invalid", 400);
    const state = readState();
    if (bundle.trustSnapshot.snapshotDigest !== state.snapshot.snapshotDigest || bundle.policy.policyDigest !== state.policy.policyDigest) throw new ActivationOperationsError("policy-invalid", 409);
    if (!bundle.ledger.records.every((entry) => state.ledger.records.some((current) => current.digest === entry.digest))) throw new ActivationOperationsError("ledger-invalid", 409);
    let result: ActivationOperationsStore | undefined;
    operationsStore.update((store) => {
      if (store.revision !== expectedRevision) throw new ActivationOperationsError("revision-conflict", 409);
      const merge = <T extends { id: string }>(current: T[], incoming: T[]) => { const byId = new Map(current.map((entry) => [entry.id, entry])); for (const entry of incoming) { const old = byId.get(entry.id); if (old && JSON.stringify(old) !== JSON.stringify(entry)) throw new ActivationOperationsError("conflict", 409); byId.set(entry.id, entry); } return [...byId.values()]; };
      result = { ...store, revision: store.revision + 1, rotations: merge(store.rotations, bundle.operations!.rotations), quarantineCases: merge(store.quarantineCases, bundle.operations!.quarantineCases), decisionAdmissions: merge(store.decisionAdmissions, bundle.operations!.decisionAdmissions), exportReceipts: merge(store.exportReceipts, bundle.operations!.exportReceipts) }; return result;
    });
    return { ok: true as const, revision: result!.revision, merged: true, summary: summary() };
  }

  return { summary, preflightRotation, admitRotation, claimQuarantine, releaseQuarantine, admitDecision, exportBundle, restoreBundle };
}
