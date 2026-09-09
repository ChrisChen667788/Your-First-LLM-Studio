import { ActivationIntakeError, envelopeSchema, ledgerSchema, type ActivationLedger, type SignedActivationEnvelope } from "./contracts";
import { activationEnvelopeDigest, sha256, verifyActivationEnvelope, type IntakeContext } from "./verify";

export function validateActivationLedger(input: unknown): input is ActivationLedger {
  const parsed = ledgerSchema.safeParse(input);
  if (!parsed.success) return false;
  const { records, quarantines } = parsed.data;
  const ids = new Set<string>();
  const nonces = new Set<string>();
  const digests = new Set<string>();
  for (const record of records) {
    const { envelope } = record;
    const nonce = `${envelope.issuerId}:${envelope.nonce}`;
    if (record.digest !== activationEnvelopeDigest(envelope) || ids.has(envelope.id) || nonces.has(nonce) || digests.has(record.digest) ||
        Date.parse(record.receivedAt) < Date.parse(envelope.issuedAt) || Date.parse(record.receivedAt) >= Date.parse(envelope.expiresAt)) return false;
    ids.add(envelope.id); nonces.add(nonce); digests.add(record.digest);
  }
  return new Set(quarantines.map((entry) => entry.id)).size === quarantines.length;
}

function sameObservationScope(a: SignedActivationEnvelope, b: SignedActivationEnvelope) {
  return a.kind === "observation" && b.kind === "observation" && a.manifestDigest === b.manifestDigest &&
    a.issuerId === b.issuerId && a.body.stage === b.body.stage && a.body.sourceMilestone === b.body.sourceMilestone;
}

function checkLineage(envelope: SignedActivationEnvelope, ledger: ActivationLedger) {
  if (envelope.kind === "observation" && envelope.body.supersedesDigest) {
    const predecessor = ledger.records.find((entry) => entry.digest === envelope.body.supersedesDigest);
    if (!predecessor || !sameObservationScope(envelope, predecessor.envelope) ||
        Date.parse(envelope.issuedAt) < Date.parse(predecessor.envelope.issuedAt) ||
        ledger.records.some((entry) => entry.envelope.kind === "observation" && entry.envelope.body.supersedesDigest === predecessor.digest)) {
      throw new ActivationIntakeError("binding-mismatch");
    }
  }
  if (envelope.kind === "revocation") {
    const target = ledger.records.find((entry) => entry.digest === envelope.body.targetEnvelopeDigest);
    if (!target || !["observation", "decision"].includes(target.envelope.kind) ||
        target.envelope.manifestDigest !== envelope.manifestDigest || target.envelope.issuerId !== envelope.issuerId ||
        target.envelope.keyId !== envelope.keyId || Date.parse(envelope.issuedAt) < Date.parse(target.envelope.issuedAt)) {
      throw new ActivationIntakeError("binding-mismatch");
    }
  }
  if (envelope.kind === "resolution" && !ledger.quarantines.some((entry) => entry.id === envelope.body.quarantineId && entry.manifestDigest === envelope.manifestDigest)) {
    throw new ActivationIntakeError("binding-mismatch");
  }
  if (envelope.kind === "rotation" && ledger.records.some((entry) => entry.envelope.kind === "rotation" && entry.envelope.manifestDigest === envelope.manifestDigest)) {
    throw new ActivationIntakeError("replay", 409);
  }
}

export function applyActivationBatch(ledger: ActivationLedger, inputs: unknown[], context: IntakeContext, expectedRevision: number, now = Date.now()) {
  if (!validateActivationLedger(ledger)) throw new ActivationIntakeError("ledger-invalid", 503);
  if (ledger.revision !== expectedRevision) throw new ActivationIntakeError("revision-conflict", 409);
  if (inputs.length === 0 || inputs.length > 100) throw new ActivationIntakeError("capacity-exceeded", 413);
  const parsed = inputs.map((input) => envelopeSchema.safeParse(input));
  if (parsed.some((entry) => !entry.success)) throw new ActivationIntakeError("schema-invalid", 400);
  const manifestDigests = new Set(parsed.map((entry) => entry.data!.manifestDigest));
  if (manifestDigests.size !== 1) throw new ActivationIntakeError("binding-mismatch");
  const manifestDigest = [...manifestDigests][0];
  let candidate: ActivationLedger = { ...ledger, records: [...ledger.records] };
  let added = 0;
  try {
    for (const input of inputs) {
      const record = verifyActivationEnvelope(input, context, now);
      const { envelope } = record;
      const duplicate = candidate.records.find((entry) => entry.digest === record.digest);
      if (duplicate) continue;
      if (candidate.records.some((entry) => entry.envelope.id === envelope.id ||
          (entry.envelope.issuerId === envelope.issuerId && entry.envelope.nonce === envelope.nonce))) throw new ActivationIntakeError("replay", 409);
      checkLineage(envelope, candidate);
      if (candidate.records.length >= 8000) throw new ActivationIntakeError("capacity-exceeded", 413);
      candidate.records.push(record);
      added++;
    }
    candidate = { ...candidate, revision: ledger.revision + (added > 0 ? 1 : 0) };
    return { ok: true as const, ledger: candidate, added, deduplicated: inputs.length - added };
  } catch (error) {
    if (!(error instanceof ActivationIntakeError)) throw new ActivationIntakeError("schema-invalid", 400);
    const payloadDigest = sha256(JSON.stringify(inputs));
    const id = sha256(`${payloadDigest}:${error.code}`);
    const exists = ledger.quarantines.some((entry) => entry.id === id);
    if (!exists && ledger.quarantines.length >= 2000) throw new ActivationIntakeError("capacity-exceeded", 413);
    return { ok: false as const, code: error.code, status: error.status, added: 0, deduplicated: 0,
      ledger: exists ? ledger : { ...ledger, revision: ledger.revision + 1, quarantines: [...ledger.quarantines, { id, manifestDigest, payloadDigest, code: error.code, observedAt: new Date(now).toISOString() }] },
    };
  }
}

// Expiry is evaluated at read time; historical revocation never revives a record.
export function verifyLedgerHistory(ledger: ActivationLedger, context: IntakeContext) {
  if (!validateActivationLedger(ledger)) throw new ActivationIntakeError("ledger-invalid", 503);
  const historical = { ...context, trust: { ...context.trust, keys: context.trust.keys.map((key) => ({ ...key, status: "active" as const })) } };
  let prefix: ActivationLedger = { ...ledger, records: [] };
  for (const record of ledger.records) {
    verifyActivationEnvelope(record.envelope, historical, Date.parse(record.receivedAt));
    checkLineage(record.envelope, prefix);
    prefix = { ...prefix, records: [...prefix.records, record] };
  }
}
