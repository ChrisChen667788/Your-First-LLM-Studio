import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES as milestones } from "@/features/evidence/collection-catalog";
import { createExternalEvidenceActivationManifest, createExternalEvidenceActivationDecisionRequest, EXTERNAL_EVIDENCE_ACTIVATION_STAGES as stages } from "@/features/evidence/external-activation";
import { ActivationIntakeError, emptyActivationLedger, type SignedActivationEnvelope } from "@/features/evidence/activation-intake/contracts";
import { parseActivationTrust, publicKeyFingerprint, loadActivationTrust } from "@/features/evidence/activation-intake/trust";
import { activationSigningBytes, activationEnvelopeDigest, verifyActivationEnvelope, sha256 } from "@/features/evidence/activation-intake/verify";
import { applyActivationBatch } from "@/features/evidence/activation-intake/ledger";
import { projectActivationIntake } from "@/features/evidence/activation-intake/read-model";
import { createActivationLedgerStore } from "@/features/evidence/activation-intake/store";
import { createActivationIntakeService } from "@/features/evidence/activation-intake/service";
import { createIntakeHandlers } from "@/features/evidence/activation-intake/application";

const digest = (value: string) => sha256(value);
function fixture() {
  const now = Date.now();
  const iso = (offset: number) => new Date(now + offset).toISOString();
  const roles = ["authority", "observer", "verifier", "decision"] as const;
  const pairs = roles.map(() => generateKeyPairSync("ed25519"));
  const trust = parseActivationTrust({ schemaVersion: "evidence.activation-trust.v1", audience: "studio-acceptance", keys: roles.map((role, i) => {
    const pem = pairs[i].publicKey.export({ type: "spki", format: "pem" }).toString();
    return { issuerId: `issuer-${role}`, keyId: `signing-${role}`, role, publicKeyPem: pem, fingerprint: publicKeyFingerprint(pem), status: "active", notBefore: iso(-60000), notAfter: iso(86400000), stages: [...stages], milestones: [...milestones] };
  }) });
  const manifest = createExternalEvidenceActivationManifest({
    id: "activation-crypto-001", relayConfigurationId: "relay-crypto-001", relayConfigurationDigest: digest("relay"),
    handoffId: "handoff-crypto-001", handoffDigest: digest("handoff"), authorityId: trust.keys[0].issuerId,
    authorityKeyFingerprint: trust.keys[0].fingerprint, activationPolicyDigest: digest("policy"),
    requiredStages: [...stages], requestedAt: iso(-10000), expiresAt: iso(3600000),
  });
  const request = createExternalEvidenceActivationDecisionRequest({ id: "decision-request-001", idempotencyKey: "decision-idempotency-001",
    manifestId: manifest.id, manifestDigest: manifest.manifestDigest, reconciliationDigest: digest("reconciliation"),
    decisionAuthorityId: trust.keys[3].issuerId, decisionAuthorityKeyFingerprint: trust.keys[3].fingerprint, requestedAt: iso(-10000), expiresAt: iso(3000000),
  });
  const context = { trust, manifests: [manifest], decisionRequests: [request] };
  function seal(envelope: SignedActivationEnvelope, keyIndex: number) {
    return { ...envelope, signature: sign(null, activationSigningBytes(envelope), pairs[keyIndex].privateKey).toString("base64") };
  }
  function envelope(keyIndex = 0, partial: Partial<SignedActivationEnvelope> = {}): SignedActivationEnvelope {
    return seal({ schemaVersion: "evidence.activation-envelope.v1", kind: "observation", id: `envelope-${randomUUID()}`,
      issuerId: trust.keys[keyIndex].issuerId, keyId: trust.keys[keyIndex].keyId, audience: trust.audience,
      manifestDigest: manifest.manifestDigest, issuedAt: iso(-1000), expiresAt: iso(600000), nonce: randomUUID(),
      body: { stage: "authority-discovery", sourceMilestone: null, evidenceDigest: digest("evidence"), supersedesDigest: null },
      signature: "", ...partial,
    } as SignedActivationEnvelope, keyIndex);
  }
  function complete() {
    return [
      ...stages.filter((stage) => !["observer-attestation", "receipt-verification"].includes(stage)).map((stage) => envelope(0, { body: { stage, sourceMilestone: null, evidenceDigest: digest(stage), supersedesDigest: null } })),
      ...milestones.flatMap((sourceMilestone) => [envelope(1, { body: { stage: "observer-attestation", sourceMilestone, evidenceDigest: digest(sourceMilestone), supersedesDigest: null } }), envelope(2, { body: { stage: "receipt-verification", sourceMilestone, evidenceDigest: digest(sourceMilestone), supersedesDigest: null } })]),
    ];
  }
  return { now, iso, trust, manifest, request, context, envelope, seal, complete };
}
const rejects = (code: string) => (error: unknown) => error instanceof ActivationIntakeError && error.code === code;

test("v5.6.0 strict envelopes reject malformed inputs and arbitrary fields", () => {
  const f = fixture();
  for (const input of [null, [], {}, { ...f.envelope(), privateKey: "must-not-be-stored" }]) assert.throws(() => verifyActivationEnvelope(input, f.context, f.now), rejects("schema-invalid"));
});

test("v5.6.1 trust requires pinned Ed25519 material and server-side configuration", () => {
  const f = fixture();
  assert.throws(() => parseActivationTrust({ ...f.trust, keys: [{ ...f.trust.keys[0], fingerprint: digest("wrong") }] }), rejects("trust-invalid"));
  assert.throws(() => parseActivationTrust({ ...f.trust, keys: [f.trust.keys[0], f.trust.keys[0]] }), rejects("trust-invalid"));
  const prior = process.env.FIRST_LLM_EVIDENCE_TRUST_PATH;
  delete process.env.FIRST_LLM_EVIDENCE_TRUST_PATH;
  try { assert.throws(loadActivationTrust, rejects("unconfigured")); } finally { if (prior) process.env.FIRST_LLM_EVIDENCE_TRUST_PATH = prior; }
});

test("v5.6.2 detached signatures detect tampering even when JSON digests are recomputed", () => {
  const f = fixture();
  const signed = f.envelope();
  assert.ok(verifyActivationEnvelope(signed, f.context, f.now));
  assert.throws(() => verifyActivationEnvelope({ ...signed, nonce: randomUUID() }, f.context, f.now), rejects("signature-invalid"));
  const reordered = Object.fromEntries(Object.entries(signed).reverse());
  assert.equal(verifyActivationEnvelope(reordered, f.context, f.now).digest, activationEnvelopeDigest(signed));
});

test("v5.6.3 audience, manifest, issuer role and milestone scope are enforced", () => {
  const f = fixture();
  assert.throws(() => verifyActivationEnvelope(f.envelope(0, { audience: "other-audience" }), f.context, f.now), rejects("binding-mismatch"));
  assert.throws(() => verifyActivationEnvelope(f.envelope(0, { manifestDigest: digest("other") }), f.context, f.now), rejects("binding-mismatch"));
  assert.throws(() => verifyActivationEnvelope(f.envelope(1), f.context, f.now), rejects("key-denied"));
});

test("v5.6.4 validity windows and key revocation exclude evidence immediately", () => {
  const f = fixture();
  assert.throws(() => verifyActivationEnvelope(f.envelope(0, { issuedAt: f.iso(1000) }), f.context, f.now), rejects("stale"));
  assert.throws(() => verifyActivationEnvelope(f.envelope(0, { expiresAt: f.iso(-10) }), f.context, f.now), rejects("stale"));
  f.trust.keys[0].status = "revoked";
  assert.throws(() => verifyActivationEnvelope(f.envelope(), f.context, f.now), rejects("key-denied"));
});

test("v5.6.5 batch signature failure rolls back all candidate records into digest-only quarantine", () => {
  const f = fixture();
  const result = applyActivationBatch(emptyActivationLedger(), [f.envelope(), { ...f.envelope(), signature: Buffer.alloc(64).toString("base64") }], f.context, 0, f.now);
  assert.equal(result.ok, false); assert.equal(result.ledger.records.length, 0); assert.equal(result.ledger.quarantines.length, 1);
  assert.equal(Object.keys(result.ledger.quarantines[0]).includes("signature"), false);
  assert.equal(JSON.stringify(result.ledger).includes("publicKeyPem"), false);
});

test("v5.6.6 exact retries deduplicate and changed nonce reuse is quarantined", () => {
  const f = fixture(); const envelope = f.envelope();
  const first = applyActivationBatch(emptyActivationLedger(), [envelope], f.context, 0, f.now);
  const retry = applyActivationBatch(first.ledger, [envelope], f.context, 1, f.now);
  assert.equal(retry.ledger.revision, 1); assert.equal(retry.deduplicated, 1);
  const replay = applyActivationBatch(first.ledger, [f.envelope(0, { nonce: envelope.nonce })], f.context, 1, f.now);
  assert.equal(replay.ok, false); if (!replay.ok) assert.equal(replay.code, "replay");
});

test("v5.6.7 persisted revision conflicts reject a competing writer after restart", () => {
  const f = fixture(); const directory = mkdtempSync(path.join(os.tmpdir(), "activation-cas-"));
  try {
    const file = path.join(directory, "ledger.json");
    const a = createActivationIntakeService(createActivationLedgerStore(file), () => f.context);
    a.importBatch([f.envelope()], 0);
    const b = createActivationIntakeService(createActivationLedgerStore(file), () => f.context);
    assert.throws(() => b.importBatch([f.envelope()], 0), rejects("revision-conflict"));
    assert.equal(b.summary().records, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("v5.6.8 dry-run leaves no durable ledger or quarantine", () => {
  const f = fixture(); const directory = mkdtempSync(path.join(os.tmpdir(), "activation-dry-"));
  try {
    const store = createActivationLedgerStore(path.join(directory, "ledger.json"));
    const service = createActivationIntakeService(store, () => f.context);
    assert.equal(service.importBatch([f.envelope()], 0, true).added, 1);
    assert.equal(store.read().revision, 0); assert.equal(store.read().records.length, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("v5.6.9 fourteen-domain coverage needs independently signed matching evidence pairs", () => {
  const f = fixture(); const input = f.complete();
  const complete = applyActivationBatch(emptyActivationLedger(), input, f.context, 0, f.now);
  const projected = projectActivationIntake(complete.ledger, f.context, f.now);
  assert.equal(projected.manifests[0].eligibleForReview, true);
  assert.equal(projected.manifests[0].coveredMilestones.length, 14);
  const incomplete = applyActivationBatch(emptyActivationLedger(), input.slice(1), f.context, 0, f.now);
  assert.equal(projectActivationIntake(incomplete.ledger, f.context, f.now).manifests[0].eligibleForReview, false);
  assert.equal(projectActivationIntake(complete.ledger, f.context, f.now + 3600000).manifests[0].eligibleForReview, false);
});

test("v5.7.0 supersession retires stale history without reviving revoked evidence", () => {
  const f = fixture(); const old = f.envelope(0, { expiresAt: f.iso(1000) });
  const first = applyActivationBatch(emptyActivationLedger(), [old], f.context, 0, f.now);
  const renewal = f.envelope(0, { body: { stage: "authority-discovery", sourceMilestone: null, evidenceDigest: digest("renewed"), supersedesDigest: activationEnvelopeDigest(old) } });
  const next = applyActivationBatch(first.ledger, [renewal], f.context, 1, f.now);
  assert.equal(projectActivationIntake(next.ledger, f.context, f.now + 2000).currentRecords, 1);
  const revocation = f.envelope(0, { kind: "revocation", body: { targetEnvelopeDigest: activationEnvelopeDigest(renewal), reasonDigest: digest("withdrawn") }, expiresAt: f.iso(3000) });
  const revoked = applyActivationBatch(next.ledger, [revocation], f.context, 2, f.now);
  assert.equal(projectActivationIntake(revoked.ledger, f.context, f.now + 4000).currentRecords, 0);
});

test("v5.7.1 only an authority-signed resolution can close quarantine", () => {
  const f = fixture();
  const rejected = applyActivationBatch(emptyActivationLedger(), [{ ...f.envelope(), signature: Buffer.alloc(64).toString("base64") }], f.context, 0, f.now);
  const body = { quarantineId: rejected.ledger.quarantines[0].id, reasonDigest: digest("reviewed") };
  assert.throws(() => verifyActivationEnvelope(f.envelope(1, { kind: "resolution", body }), f.context, f.now), rejects("key-denied"));
  const resolved = applyActivationBatch(rejected.ledger, [f.envelope(0, { kind: "resolution", body })], f.context, 1, f.now);
  assert.equal(projectActivationIntake(resolved.ledger, f.context, f.now).openQuarantines, 0);
});

test("v5.7.2 decisions require their distinct authority and exact request binding", () => {
  const f = fixture(); const body = { requestId: f.request.id, requestDigest: f.request.requestDigest, decision: "accepted" as const, evidenceDigest: digest("decision") };
  const envelope = f.envelope(3, { kind: "decision", body });
  assert.ok(verifyActivationEnvelope(envelope, f.context, f.now));
  assert.throws(() => verifyActivationEnvelope(f.envelope(0, { kind: "decision", body }), f.context, f.now), rejects("binding-mismatch"));
  const accepted = applyActivationBatch(emptyActivationLedger(), [envelope], f.context, 0, f.now);
  assert.equal(projectActivationIntake(accepted.ledger, f.context, f.now).productionStatus, "blocked");
});

test("v5.7.3 export/restore reverify signatures and preserve newer revocations", () => {
  const f = fixture(); const directory = mkdtempSync(path.join(os.tmpdir(), "activation-backup-"));
  try {
    const file = path.join(directory, "ledger.json");
    const service = createActivationIntakeService(createActivationLedgerStore(file), () => f.context);
    const envelope = f.envelope(); service.importBatch([envelope], 0);
    const backup = service.backup();
    service.importBatch([f.envelope(0, { kind: "revocation", body: { targetEnvelopeDigest: activationEnvelopeDigest(envelope), reasonDigest: digest("revoked") } })], 1);
    service.restore(backup, 2); assert.equal(service.summary().revoked, 1);
    const restored = createActivationIntakeService(createActivationLedgerStore(path.join(directory, "restored.json")), () => f.context);
    restored.restore(service.backup(), 0); assert.equal(restored.summary().revoked, 1);
    const bad = structuredClone(backup); bad.ledger.records[0].envelope.nonce = randomUUID(); bad.ledger.records[0].digest = activationEnvelopeDigest(bad.ledger.records[0].envelope); bad.ledgerDigest = sha256(JSON.stringify(bad.ledger));
    assert.throws(() => restored.restore(bad, 1), rejects("signature-invalid"));
    writeFileSync(file, "corrupt"); assert.throws(service.summary, rejects("ledger-invalid"));
    assert.equal(readFileSync(file, "utf8"), "corrupt");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("v5.7.4 authorized HTTP import rejects CSRF, oversized bodies and leaks no raw errors", async () => {
  const f = fixture(); const directory = mkdtempSync(path.join(os.tmpdir(), "activation-http-"));
  try {
    const handlers = createIntakeHandlers(createActivationIntakeService(createActivationLedgerStore(path.join(directory, "ledger.json")), () => f.context));
    const request = (body: string, extra: Record<string, string> = {}) => new Request("http://127.0.0.1/api/experiments/activation-intake", { method: "POST", headers: { "content-type": "application/json", ...extra }, body });
    const csrf = await handlers.POST(request("{}", { origin: "https://untrusted.example" })); assert.equal(csrf.status, 401);
    const oversized = await handlers.POST(request(" ".repeat(2 * 1024 * 1024 + 1))); assert.equal(oversized.status, 413);
    const response = await handlers.POST(request(JSON.stringify({ action: "import", expectedRevision: 0, envelopes: [f.envelope()] })));
    assert.equal(response.status, 200); assert.equal((await response.json()).added, 1);
    const invalid = await handlers.POST(request("null")); assert.equal(invalid.status, 400);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("CLI performs real loopback import, dry-run, backup and status against the application handler", async () => {
  const f = fixture(); const directory = mkdtempSync(path.join(os.tmpdir(), "activation-cli-"));
  const service = createActivationIntakeService(createActivationLedgerStore(path.join(directory, "ledger.json")), () => f.context);
  const handlers = createIntakeHandlers(service);
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const request = new Request(`http://127.0.0.1:${(server.address() as { port: number }).port}${incoming.url}`, {
        method: incoming.method, headers: incoming.headers as Record<string, string>,
        body: incoming.method === "POST" ? Buffer.concat(chunks) : undefined,
      });
      const response = incoming.method === "POST" ? await handlers.POST(request) : await handlers.GET(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(await response.text());
    } catch { outgoing.writeHead(500); outgoing.end("{}"); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  async function cli(args: string[]) {
    const child = spawn(process.execPath, ["scripts/activation-intake.mjs", "--url", base, ...args], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = ""; child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
    assert.equal(code, 0, stderr); return JSON.parse(stdout);
  }
  try {
    const file = path.join(directory, "envelopes.json"); writeFileSync(file, JSON.stringify([f.envelope()]));
    assert.equal((await cli(["--action", "import", "--file", file, "--expected-revision", "0", "--dry-run"])).added, 1);
    assert.equal(service.summary().records, 0);
    assert.equal((await cli(["--action", "import", "--file", file, "--expected-revision", "0"])).added, 1);
    assert.equal((await cli(["--action", "status"])).records, 1);
    const output = path.join(directory, "backup.json"); await cli(["--action", "export", "--output", output]);
    assert.equal(JSON.parse(readFileSync(output, "utf8")).ledger.records.length, 1);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); rmSync(directory, { recursive: true, force: true }); }
});

test("mismatched domain digests and same-issuer observer/verifier cannot establish coverage", () => {
  const f = fixture(); const records = f.complete();
  const index = records.findIndex((entry) => entry.kind === "observation" && entry.body.stage === "receipt-verification");
  const original = records[index];
  if (original.kind !== "observation") throw new Error("Expected observation.");
  records[index] = f.seal({ ...original, body: { ...original.body, evidenceDigest: digest("unrelated") } }, 2);
  const result = applyActivationBatch(emptyActivationLedger(), records, f.context, 0, f.now);
  assert.equal(projectActivationIntake(result.ledger, f.context, f.now).manifests[0].coveredMilestones.length, 13);
});

test("revoked public keys invalidate current coverage while retaining historical verification", () => {
  const f = fixture(); const first = applyActivationBatch(emptyActivationLedger(), [f.envelope()], f.context, 0, f.now);
  f.trust.keys[0].status = "revoked";
  assert.equal(projectActivationIntake(first.ledger, f.context, f.now).currentRecords, 0);
});

test("quarantine resolution is scoped to its manifest and batches cannot mix manifests", () => {
  const f = fixture();
  const other = createExternalEvidenceActivationManifest({ ...f.manifest, id: "activation-crypto-002", activationPolicyDigest: digest("second-policy") });
  f.context.manifests.push(other);
  const rejected = applyActivationBatch(emptyActivationLedger(), [{ ...f.envelope(), signature: Buffer.alloc(64).toString("base64") }], f.context, 0, f.now);
  const crossResolution = f.envelope(0, { kind: "resolution", manifestDigest: other.manifestDigest,
    body: { quarantineId: rejected.ledger.quarantines[0].id, reasonDigest: digest("cross-scope") },
  });
  const result = applyActivationBatch(rejected.ledger, [crossResolution], f.context, 1, f.now);
  assert.equal(result.ok, false);
  assert.throws(() => applyActivationBatch(emptyActivationLedger(), [f.envelope(), f.envelope(0, { manifestDigest: other.manifestDigest })], f.context, 0, f.now), rejects("binding-mismatch"));
});
