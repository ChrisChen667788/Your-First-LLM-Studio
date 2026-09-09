import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { EVIDENCE_COLLECTION_SOURCE_MILESTONES as milestones } from "@/features/evidence/collection-catalog";
import { createExternalEvidenceActivationDecisionRequest, createExternalEvidenceActivationManifest, EXTERNAL_EVIDENCE_ACTIVATION_STAGES as stages } from "@/features/evidence/external-activation";
import { applyActivationBatch } from "@/features/evidence/activation-intake/ledger";
import { activationEnvelopeDigest, activationSigningBytes, sha256, verifyActivationEnvelope } from "@/features/evidence/activation-intake/verify";
import { parseActivationTrust, publicKeyFingerprint } from "@/features/evidence/activation-intake/trust";
import { ActivationIntakeError, emptyActivationLedger, type SignedActivationEnvelope } from "@/features/evidence/activation-intake/contracts";
import { createActivationLedgerStore } from "@/features/evidence/activation-intake/store";
import { createActivationIntakeService } from "@/features/evidence/activation-intake/service";
import { createActivationOperationsPolicy, buildActivationTrustSnapshot, validateActivationOperationsPolicy, validateActivationTrustSnapshot } from "@/features/evidence/activation-operations/canonical";
import { ACTIVATION_OPERATIONS_PLANS } from "@/features/evidence/activation-operations/catalog";
import { ActivationOperationsError, emptyActivationOperationsStore, emptyOperationsPolicy } from "@/features/evidence/activation-operations/contracts";
import { createActivationOperationsStore } from "@/features/evidence/activation-operations/store";
import { createActivationOperationsService } from "@/features/evidence/activation-operations/service";
import { projectActivationOperations } from "@/features/evidence/activation-operations/projection";

const digest = (value: string) => sha256(value);
const rejectCode = (code: string) => (error: unknown) => (error instanceof ActivationOperationsError || error instanceof ActivationIntakeError) && error.code === code;
const rejectIntakeCode = (code: string) => (error: unknown) => error instanceof ActivationIntakeError && error.code === code;

function fixture() {
  const now = Date.now(); const iso = (offset: number) => new Date(now + offset).toISOString();
  const roles = ["authority", "authority", "observer", "verifier", "decision"] as const;
  const pairs = roles.map(() => generateKeyPairSync("ed25519"));
  const trust = parseActivationTrust({ schemaVersion: "evidence.activation-trust.v1", audience: "operations-acceptance", keys: roles.map((role, index) => {
    const pem = pairs[index].publicKey.export({ type: "spki", format: "pem" }).toString();
    return { issuerId: index < 2 ? `issuer-authority-${index + 1}` : `issuer-${role}`, keyId: `operations-key-${index + 1}`, role, publicKeyPem: pem, fingerprint: publicKeyFingerprint(pem), status: "active", notBefore: iso(-60_000), notAfter: iso(7 * 86_400_000), stages: [...stages], milestones: [...milestones] };
  }) });
  const manifest = createExternalEvidenceActivationManifest({ id: "operations-manifest-001", relayConfigurationId: "operations-relay-001", relayConfigurationDigest: digest("relay"), handoffId: "operations-handoff-001", handoffDigest: digest("handoff"), authorityId: trust.keys[0].issuerId, authorityKeyFingerprint: trust.keys[0].fingerprint, activationPolicyDigest: digest("policy"), requiredStages: [...stages], requestedAt: iso(-10_000), expiresAt: iso(3_600_000) });
  const request = createExternalEvidenceActivationDecisionRequest({ id: "operations-request-001", idempotencyKey: "operations-request-key-001", manifestId: manifest.id, manifestDigest: manifest.manifestDigest, reconciliationDigest: digest("reconciliation"), decisionAuthorityId: trust.keys[4].issuerId, decisionAuthorityKeyFingerprint: trust.keys[4].fingerprint, requestedAt: iso(-10_000), expiresAt: iso(1_800_000) });
  const context = { trust, manifests: [manifest], decisionRequests: [request] };
  const snapshot = buildActivationTrustSnapshot(trust, iso(-1_000));
  const policy = createActivationOperationsPolicy({ ...emptyOperationsPolicy({ audience: trust.audience, trustSnapshotDigest: snapshot.snapshotDigest }), policyDigest: undefined });
  function seal(envelope: SignedActivationEnvelope, index: number) { return { ...envelope, signature: sign(null, activationSigningBytes(envelope), pairs[index].privateKey).toString("base64") }; }
  function envelope(index = 0, partial: Partial<SignedActivationEnvelope> = {}) { return seal({ schemaVersion: "evidence.activation-envelope.v1", kind: "observation", id: `operations-envelope-${randomUUID()}`, issuerId: trust.keys[index].issuerId, keyId: trust.keys[index].keyId, audience: trust.audience, manifestDigest: manifest.manifestDigest, issuedAt: iso(-1_000), expiresAt: iso(600_000), nonce: randomUUID(), body: { stage: "authority-discovery", sourceMilestone: null, evidenceDigest: digest("evidence"), supersedesDigest: null }, signature: "", ...partial } as SignedActivationEnvelope, index); }
  function complete() { return [...stages.filter((stage) => !["observer-attestation", "receipt-verification"].includes(stage)).map((stage) => envelope(0, { body: { stage, sourceMilestone: null, evidenceDigest: digest(stage), supersedesDigest: null } })), ...milestones.flatMap((milestone) => [envelope(2, { body: { stage: "observer-attestation", sourceMilestone: milestone, evidenceDigest: digest(milestone), supersedesDigest: null } }), envelope(3, { body: { stage: "receipt-verification", sourceMilestone: milestone, evidenceDigest: digest(milestone), supersedesDigest: null } })])]; }
  function rotation() { return envelope(0, { kind: "rotation", body: { predecessorFingerprint: trust.keys[0].fingerprint, successorIssuerId: trust.keys[1].issuerId, successorKeyId: trust.keys[1].keyId, successorFingerprint: trust.keys[1].fingerprint, rotationDigest: digest("rotation") } }); }
  function decision() { return envelope(4, { kind: "decision", body: { requestId: request.id, requestDigest: request.requestDigest, decision: "accepted", evidenceDigest: digest("decision") } }); }
  return { now, iso, trust, manifest, request, context, snapshot, policy, envelope, seal, complete, rotation, decision };
}

function services(f: ReturnType<typeof fixture>, directory = mkdtempSync(path.join(os.tmpdir(), "activation-operations-"))) {
  const ledgerStore = createActivationLedgerStore(path.join(directory, "intake.json"));
  const operationsStore = createActivationOperationsStore(path.join(directory, "operations.json"));
  const contextProvider = () => f.context;
  const policyProvider = () => f.policy;
  const intake = createActivationIntakeService(ledgerStore, contextProvider);
  const operations = createActivationOperationsService(ledgerStore, operationsStore, contextProvider, policyProvider);
  return { directory, ledgerStore, operationsStore, intake, operations };
}

test("v5.8.0 catalog defines fifteen operational activation boundaries", () => {
  assert.deepEqual(ACTIVATION_OPERATIONS_PLANS.map((plan) => plan.version), ["v5.8.0", "v5.8.1", "v5.8.2", "v5.8.3", "v5.8.4", "v5.8.5", "v5.8.6", "v5.8.7", "v5.8.8", "v5.8.9", "v5.9.0", "v5.9.1", "v5.9.2", "v5.9.3", "v5.9.4"]);
  assert.ok(ACTIVATION_OPERATIONS_PLANS.every((plan) => plan.acceptance.length > 20));
});

test("v5.8.0 policy validation binds all required stages, domains and bounded windows", () => {
  const f = fixture();
  assert.equal(validateActivationOperationsPolicy(f.policy, f.snapshot).ok, true);
  assert.equal(validateActivationOperationsPolicy({ ...f.policy, maxClockSkewSeconds: 301 }, f.snapshot).ok, false);
  assert.equal(validateActivationOperationsPolicy({ ...f.policy, requiredMilestones: f.policy.requiredMilestones.slice(1) }, f.snapshot).ok, false);
});

test("v5.8.1 trust snapshots are deterministic and contain no public key material", () => {
  const f = fixture(); const reordered = { ...f.trust, keys: [...f.trust.keys].reverse() };
  const second = buildActivationTrustSnapshot(reordered, f.snapshot.capturedAt);
  assert.equal(f.snapshot.snapshotDigest, second.snapshotDigest); assert.equal(validateActivationTrustSnapshot(f.snapshot), true);
  assert.equal(JSON.stringify(f.snapshot).includes("publicKeyPem"), false); assert.notEqual(f.snapshot.snapshotDigest, f.snapshot.sourceDigest);
});

test("v5.8.2 rotation envelope requires the current authority and trusted successor", () => {
  const f = fixture(); const rotation = f.rotation();
  assert.ok(f.context.trust.keys.some((key) => key.fingerprint === rotation.body.successorFingerprint));
  assert.equal(verifyActivationEnvelope(rotation, f.context, f.now).digest, activationEnvelopeDigest(rotation));
  assert.throws(() => verifyActivationEnvelope(f.envelope(2, { kind: "rotation", body: rotation.body }), f.context, f.now), rejectIntakeCode("binding-mismatch"));
  assert.throws(() => verifyActivationEnvelope(f.seal({ ...rotation, body: { ...rotation.body, successorFingerprint: digest("other") } }, 0), f.context, f.now), rejectIntakeCode("binding-mismatch"));
});

test("v5.8.3 rotation admission persists a signed transition with an optimistic revision", () => {
  const f = fixture(); const s = services(f);
  try { const rotation = f.rotation(); s.intake.importBatch([rotation], 0); const digestValue = activationEnvelopeDigest(rotation); const preflight = s.operations.preflightRotation(digestValue); assert.equal(preflight.ok, true); const admitted = s.operations.admitRotation(digestValue, 0); assert.equal(admitted.revision, 1); assert.equal(s.operations.summary().rotationCount, 1); } finally { rmSync(s.directory, { recursive: true, force: true }); }
});

test("v5.8.4 rotation replay is denied and exact operational state remains unchanged", () => {
  const f = fixture(); const s = services(f);
  try { const rotation = f.rotation(); s.intake.importBatch([rotation], 0); const digestValue = activationEnvelopeDigest(rotation); s.operations.admitRotation(digestValue, 0); assert.throws(() => s.operations.admitRotation(digestValue, 1), rejectCode("trust-rotation-invalid")); assert.equal(s.operations.summary().rotationCount, 1); } finally { rmSync(s.directory, { recursive: true, force: true }); }
});

test("v5.8.5 scoped freshness marks a manifest stale after authority rotation", () => {
  const f = fixture(); const s = services(f); try { const rotation = f.rotation(); s.intake.importBatch([rotation], 0); s.operations.admitRotation(activationEnvelopeDigest(rotation), 0); const summary = s.operations.summary(); assert.deepEqual(summary.staleManifests, [f.manifest.manifestDigest]); } finally { rmSync(s.directory, { recursive: true, force: true }); }
});

test("v5.8.6 conflicting current evidence is preserved as a discrepancy projection", () => {
  const f = fixture(); const ledger = applyActivationBatch(emptyActivationLedger(), [f.envelope(0), f.envelope(0, { body: { stage: "authority-discovery", sourceMilestone: null, evidenceDigest: digest("conflict"), supersedesDigest: null } })], f.context, 0, f.now).ledger;
  const projection = projectActivationOperations({ ledger, operations: emptyActivationOperationsStore(), context: f.context, policy: f.policy, snapshot: f.snapshot, now: f.now });
  assert.equal(projection.conflicts.length, 1); assert.equal(projection.conflicts[0].evidenceDigests.length, 2); assert.equal(projection.manifests[0].eligibleForReview, false);
});

test("v5.8.7 quarantine cases can be claimed and lease expiry returns them to open", () => {
  const f = fixture(); const s = services(f); try { const rejected = s.intake.importBatch([{ ...f.envelope(), signature: Buffer.alloc(64).toString("base64") }], 0, false, f.now); const caseId = s.ledgerStore.read().quarantines[0].id; const claimed = s.operations.claimQuarantine(caseId, "operator-a", 0, f.now); assert.equal(claimed.case.status, "claimed"); const later = projectActivationOperations({ ledger: s.ledgerStore.read(), operations: { ...s.operationsStore.read(), quarantineCases: s.operationsStore.read().quarantineCases.map((item) => ({ ...item, leaseUntil: f.iso(-1) })) }, context: f.context, policy: f.policy, snapshot: f.snapshot, now: f.now }); assert.equal(later.quarantineCases[0].status, "open"); void rejected; } finally { rmSync(s.directory, { recursive: true, force: true }); } });

test("v5.8.8 quarantine ownership is fenced by lease and revision", () => {
  const f = fixture(); const s = services(f); try { s.intake.importBatch([{ ...f.envelope(), signature: Buffer.alloc(64).toString("base64") }], 0, false, f.now); const caseId = s.ledgerStore.read().quarantines[0].id; s.operations.claimQuarantine(caseId, "operator-a", 0, f.now); assert.throws(() => s.operations.claimQuarantine(caseId, "operator-b", 1, f.now), rejectCode("lease-held")); assert.throws(() => s.operations.releaseQuarantine(caseId, "operator-a", 0), rejectCode("revision-conflict")); s.operations.releaseQuarantine(caseId, "operator-a", 1); assert.equal(s.operations.summary().quarantineCases[0].status, "open"); } finally { rmSync(s.directory, { recursive: true, force: true }); } });

test("v5.8.9 currentness requires verified policy, no conflict/case, six globals and fourteen pairs", () => {
  const f = fixture(); const s = services(f); try { s.intake.importBatch(f.complete(), 0, false, f.now); const summary = s.operations.summary(); assert.equal(summary.manifests[0].eligibleForReview, true); assert.equal(summary.requiredStageCount, 8); assert.equal(summary.requiredMilestoneCount, 14); } finally { rmSync(s.directory, { recursive: true, force: true }); } });

test("v5.9.0 decision admission requires current review eligibility and exact request binding", () => {
  const f = fixture(); const s = services(f); try { s.intake.importBatch(f.complete(), 0, false, f.now); const decision = f.decision(); s.intake.importBatch([decision], 1, false, f.now); const admission = s.operations.admitDecision(activationEnvelopeDigest(decision), 0); assert.equal(admission.admission?.requestId, f.request.id); assert.equal(admission.summary.productionStatus, "blocked"); } finally { rmSync(s.directory, { recursive: true, force: true }); } });

test("v5.9.1 decision consumption is one-shot even for a second valid envelope", () => {
  const f = fixture(); const s = services(f); try { s.intake.importBatch(f.complete(), 0, false, f.now); const first = f.decision(); s.intake.importBatch([first], 1, false, f.now); s.operations.admitDecision(activationEnvelopeDigest(first), 0); const second = f.decision(); s.intake.importBatch([second], 2, false, f.now); assert.throws(() => s.operations.admitDecision(activationEnvelopeDigest(second), 1), rejectCode("decision-used")); } finally { rmSync(s.directory, { recursive: true, force: true }); } });

test("v5.9.2 admission firewall remains HOLD/BLOCKED after accepted evidence", () => {
  const f = fixture(); const s = services(f); try { s.intake.importBatch(f.complete(), 0, false, f.now); const decision = f.decision(); s.intake.importBatch([decision], 1, false, f.now); const result = s.operations.admitDecision(activationEnvelopeDigest(decision), 0); assert.equal(result.summary.distributionStatus, "hold"); assert.equal(result.summary.productionStatus, "blocked"); } finally { rmSync(s.directory, { recursive: true, force: true }); } });

test("v5.9.3 audit export is digest-bound and contains no public or private key material", () => {
  const f = fixture(); const s = services(f); try { s.intake.importBatch(f.complete(), 0, false, f.now); const bundle = s.operations.exportBundle(); assert.equal(bundle.exportDigest, digest(JSON.stringify({ schemaVersion: bundle.schemaVersion, capturedAt: bundle.capturedAt, trustSnapshot: bundle.trustSnapshot, policy: bundle.policy, ledger: bundle.ledger, operations: bundle.operations, projection: bundle.projection }))); assert.equal(JSON.stringify(bundle).includes("publicKeyPem"), false); assert.equal(JSON.stringify(bundle).includes("privateKey"), false); assert.equal(s.operations.summary().stateDigest !== null, true); } finally { rmSync(s.directory, { recursive: true, force: true }); } });

test("v5.9.4 operator merge is non-destructive, rechecks bundle lineage and rejects stale writers", () => {
  const f = fixture(); const a = services(f); const b = services(f); const bOperations = createActivationOperationsService(a.ledgerStore, b.operationsStore, () => f.context, () => f.policy); try { a.intake.importBatch(f.complete(), 0, false, f.now); const bad = a.operations.exportBundle(); const restored = bOperations.restoreBundle(bad, 0); assert.equal(restored.ok, true); assert.equal(bOperations.summary().ledgerRevision, a.operations.summary().ledgerRevision); assert.throws(() => bOperations.restoreBundle(bad, 0), rejectCode("revision-conflict")); const tampered = structuredClone(bad); tampered.exportDigest = digest("tampered"); assert.throws(() => a.operations.restoreBundle(tampered, a.operations.summary().revision), rejectCode("ledger-invalid")); } finally { rmSync(a.directory, { recursive: true, force: true }); rmSync(b.directory, { recursive: true, force: true }); } });
