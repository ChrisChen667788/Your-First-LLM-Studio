import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_ACCEPTANCE_LIFECYCLE_PLANS,
  EvidenceAcceptanceLifecycleError,
  buildPortableEvidenceAcceptanceManifest,
  createEvidenceAcceptanceAuthorityConfig,
  createEvidenceAcceptancePackage,
  emptyEvidenceAcceptanceStore,
  evidenceAcceptanceDigest,
  insertEvidenceAcceptancePackage,
  replaceEvidenceAcceptancePackage,
  revokeEvidenceAcceptancePackage,
  submitEvidenceAcceptancePackage,
  validateEvidenceAcceptanceAuthorityConfig,
  validateEvidenceAcceptancePackage,
  validateEvidenceReobservation,
  verifyEvidenceAcceptancePackage,
} from "@/features/evidence/acceptance-lifecycle";
import { buildEvidenceAcceptanceTrainState } from "@/features/experiments/evidence-acceptance-train";

const now = new Date("2026-09-08T02:00:00.000Z");
const digest = (seed: string) => evidenceAcceptanceDigest({ seed });

function authority() {
  return createEvidenceAcceptanceAuthorityConfig({
    issuerId: "studio-review-authority",
    organizationId: "studio-org",
    jwksUrl: "https://identity.example.com/.well-known/jwks.json",
    archiveReadbackUrl: "https://archive.example.com/evidence/readback",
    keyFingerprint: digest("key"),
  });
}

function draft() {
  return createEvidenceAcceptancePackage({
    organizationId: "studio-org",
    sourceMilestone: "v4.0.0",
    idempotencyKey: "acceptance-package-test-001",
    adjudicationDigest: digest("adjudication"),
    receiptDigest: digest("receipt"),
    attestationDigest: digest("attestation"),
    artifactDigest: digest("artifact"),
    policyDigest: digest("policy"),
    reobservationDigest: digest("reobservation"),
    now,
  });
}

test("v4.6-v4.7 catalog retains fifteen exact evidence acceptance boundaries", () => {
  assert.equal(EVIDENCE_ACCEPTANCE_LIFECYCLE_PLANS.length, 15);
  assert.deepEqual(
    EVIDENCE_ACCEPTANCE_LIFECYCLE_PLANS.map((plan) => plan.version),
    ["v4.6.0", "v4.6.1", "v4.6.2", "v4.6.3", "v4.6.4", "v4.6.5", "v4.6.6", "v4.6.7", "v4.6.8", "v4.6.9", "v4.7.0", "v4.7.1", "v4.7.2", "v4.7.3", "v4.7.4"],
  );
  assert.ok(EVIDENCE_ACCEPTANCE_LIFECYCLE_PLANS.every((plan) => plan.localGate && plan.externalGate));
});

test("authority configuration stays pinned, HTTPS-only, and digest-bound", () => {
  const configured = authority();
  assert.equal(validateEvidenceAcceptanceAuthorityConfig(configured).ok, true);
  assert.equal(validateEvidenceAcceptanceAuthorityConfig({ ...configured, jwksUrl: "http://identity.example.com/jwks" }).ok, false);
  assert.equal(validateEvidenceAcceptanceAuthorityConfig({ ...configured, issuerId: "local-issuer" }).ok, false);
  assert.equal(validateEvidenceAcceptanceAuthorityConfig({ ...configured, configDigest: digest("tampered") }).ok, false);
});

test("acceptance package state transitions are strict and preserve terminal revocation", () => {
  const packageDraft = draft();
  assert.equal(validateEvidenceAcceptancePackage(packageDraft).ok, true);
  const submitted = submitEvidenceAcceptancePackage({
    pkg: packageDraft,
    authority: authority(),
    actorId: "operator-001",
    expectedRevision: packageDraft.revision,
    now,
  });
  assert.equal(submitted.state, "submitted");
  assert.throws(
    () => submitEvidenceAcceptancePackage({ pkg: submitted, authority: authority(), actorId: "operator-001", expectedRevision: submitted.revision, now }),
    (error) => error instanceof EvidenceAcceptanceLifecycleError && error.code === "invalid-transition",
  );
  const revoked = revokeEvidenceAcceptancePackage({
    pkg: submitted,
    actorId: "governance-002",
    expectedRevision: submitted.revision,
    reason: "Issuer revocation receipt requires a new adjudication.",
    now,
  });
  assert.equal(revoked.state, "revoked");
  assert.equal(revoked.events[0]?.type, "revoked");
  assert.equal(validateEvidenceAcceptancePackage(revoked).ok, true);
});

test("re-observation and portable manifests reject identity or package drift", () => {
  const packageDraft = draft();
  const observationCore = {
    schemaVersion: "evidence.reobservation.v1" as const,
    observerId: "observer-002",
    organizationId: packageDraft.organizationId,
    workloadDigest: digest("workload"),
    artifactDigest: packageDraft.artifactDigest,
    policyDigest: packageDraft.policyDigest,
    observedAt: new Date().toISOString(),
  };
  const observation = { ...observationCore, observationDigest: evidenceAcceptanceDigest(observationCore) };
  assert.equal(validateEvidenceReobservation(observation, "operator-001").ok, true);
  assert.equal(validateEvidenceReobservation({ ...observation, observerId: "operator-001" }, "operator-001").ok, false);
  const manifest = buildPortableEvidenceAcceptanceManifest({ packages: [packageDraft], authority: authority() });
  assert.equal(manifest.packages[0]?.receiptDigest, undefined);
  assert.match(manifest.manifestDigest, /^[a-f0-9]{64}$/u);
});

test("external verification requires an injected authority and binds its exact response", async () => {
  const packageDraft = draft();
  const submitted = submitEvidenceAcceptancePackage({
    pkg: packageDraft,
    authority: authority(),
    actorId: "operator-001",
    expectedRevision: packageDraft.revision,
    now,
  });
  await assert.rejects(
    verifyEvidenceAcceptancePackage({ pkg: submitted, authority: authority(), actorId: "reviewer-003", now }),
    (error) => error instanceof EvidenceAcceptanceLifecycleError && error.code === "external-unavailable",
  );
  const { events: _events, ...core } = submitted;
  const verified = await verifyEvidenceAcceptancePackage({
    pkg: submitted,
    authority: authority(),
    actorId: "reviewer-003",
    now,
    port: {
      async verifyAuthorityConfig(input) {
        return { verified: true, issuerId: input.issuerId, configurationDigest: input.configDigest, verificationDigest: digest("authority-verification") };
      },
      async verifyPackage(input) {
        return {
          verified: true,
          packageId: input.package.id,
          packageDigest: evidenceAcceptanceDigest(core),
          artifactDigest: input.package.artifactDigest,
          decisionDigest: digest("decision"),
          verifiedAt: now.toISOString(),
        };
      },
    },
  });
  assert.equal(verified.state, "externally-verified");
  assert.equal(verified.externalVerificationDigest, digest("decision"));
});

test("store reducers retain idempotency and reject stale package writers", () => {
  const packageDraft = draft();
  const inserted = insertEvidenceAcceptancePackage(emptyEvidenceAcceptanceStore(), packageDraft);
  assert.equal(inserted.deduplicated, false);
  assert.equal(insertEvidenceAcceptancePackage(inserted.store, packageDraft).deduplicated, true);
  assert.throws(
    () => replaceEvidenceAcceptancePackage({ store: inserted.store, packageId: packageDraft.id, expectedRevision: 0, mutate: (value) => value }),
    (error) => error instanceof EvidenceAcceptanceLifecycleError && error.code === "revision-conflict",
  );
});

test("acceptance train is source complete and production blocked without external packages", () => {
  const state = buildEvidenceAcceptanceTrainState();
  assert.equal(state.totals.versions, 15);
  assert.equal(state.totals.sourcePassed, 15);
  assert.equal(state.totals.localPassed, 8);
  assert.equal(state.totals.verifiedMilestones, 0);
  assert.equal(state.externalStatus, "hold");
  assert.equal(state.productionStatus, "blocked");
});
