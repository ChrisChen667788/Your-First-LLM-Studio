import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildReleaseAuthorityDecisionLedgerState,
  readReleaseAuthorityDecisionLedger,
} from "@/features/experiments/release-authority-decision-ledger";

const now = Date.parse("2026-08-22T00:00:00.000Z");

function fixture() {
  return {
    decisionPresent: true,
    signatureVerified: true,
    trustAnchorPinned: true,
    now,
    evidenceAuthority: {
      schemaVersion: "experiments.production-evidence-authority.v1",
      evidenceStatus: "verified",
      bundleDigest: "a".repeat(64),
      issuerOrganizationId: "evidence-authority",
    },
    decision: {
      schemaVersion: "enterprise.release-authority-decision.v1",
      decisionId: "decision-2026-08-22",
      decision: "approved",
      generatedAt: "2026-08-21T00:00:00.000Z",
      expiresAt: "2026-08-29T00:00:00.000Z",
      evidence: { releaseVersion: "v2.0.0", bundleDigest: "a".repeat(64) },
      issuer: {
        organizationId: "release-authority",
        operatorId: "release-operator",
        keyId: "release-authority-rsa-2026",
      },
      rollback: { planId: "rollback-2026-08-22", evidenceDigest: "b".repeat(64) },
    },
  };
}

test("a valid independent approval is projected but cannot authorize local production", () => {
  const state = buildReleaseAuthorityDecisionLedgerState(
    fixture() as Parameters<typeof buildReleaseAuthorityDecisionLedgerState>[0],
  );
  assert.equal(state.decisionStatus, "approved");
  assert.equal(state.authorizationStatus, "not-authorized");
  assert.equal(state.productionStatus, "blocked");
  assert.equal(state.checks.localPromotionDenied, true);
});

test("a same-issuer decision or mismatched evidence digest fails closed", () => {
  const input = fixture();
  input.decision.issuer.organizationId = "evidence-authority";
  input.decision.evidence.bundleDigest = "c".repeat(64);
  const state = buildReleaseAuthorityDecisionLedgerState(
    input as Parameters<typeof buildReleaseAuthorityDecisionLedgerState>[0],
  );
  assert.equal(state.decisionStatus, "invalid");
  assert.equal(state.checks.issuerIndependentFromEvidence, false);
  assert.equal(state.checks.schemaAndEvidenceBound, false);
  assert.equal(state.productionStatus, "blocked");
});

test("a valid rejection remains visible as rejection rather than authorization", () => {
  const input = fixture();
  input.decision.decision = "rejected";
  const state = buildReleaseAuthorityDecisionLedgerState(
    input as Parameters<typeof buildReleaseAuthorityDecisionLedgerState>[0],
  );
  assert.equal(state.decisionStatus, "rejected");
  assert.equal(state.checks.approvedDecision, false);
  assert.equal(state.productionStatus, "blocked");
});

test("the real dual-signature path binds an independent decision to exact evidence", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "first-llm-v202-test-"));
  const configKeys = [
    "FIRST_LLM_PRODUCTION_EVIDENCE_BUNDLE_PATH",
    "FIRST_LLM_PRODUCTION_EVIDENCE_SIGNATURE_PATH",
    "FIRST_LLM_PRODUCTION_EVIDENCE_PUBLIC_KEY_PATH",
    "FIRST_LLM_PRODUCTION_EVIDENCE_KEY_SHA256",
    "FIRST_LLM_RELEASE_DECISION_PATH",
    "FIRST_LLM_RELEASE_DECISION_SIGNATURE_PATH",
    "FIRST_LLM_RELEASE_DECISION_PUBLIC_KEY_PATH",
    "FIRST_LLM_RELEASE_DECISION_KEY_SHA256",
  ] as const;
  const original = Object.fromEntries(
    configKeys.map((key) => [key, process.env[key]]),
  );
  try {
    const evidenceBundle = {
      schemaVersion: "enterprise.production-evidence-bundle.v1",
      bundleId: "evidence-2026-08-22",
      generatedAt: "2026-08-21T00:00:00.000Z",
      expiresAt: "2026-08-29T00:00:00.000Z",
      release: {
        version: "v2.0.0",
        artifactDigest: "a".repeat(64),
        sourceRevision: "main-20260822",
      },
      issuer: {
        organizationId: "evidence-authority",
        operatorId: "evidence-operator",
        keyId: "evidence-rsa-2026",
      },
      independentReview: true,
      receipts: [
        "identity",
        "data",
        "telemetry",
        "kms-archive",
        "failover",
        "billing",
        "security",
        "distribution",
        "organization",
      ].map((type, index) => ({
        id: `receipt-${type}`,
        type,
        status: "pass",
        issuedAt: "2026-08-21T00:00:00.000Z",
        expiresAt: "2026-08-29T00:00:00.000Z",
        evidenceDigest: String(index).padStart(64, "a"),
        independent: true,
        attestor: {
          organizationId: index % 2 ? "security-assessor" : "operations-authority",
          operatorId: `operator-${index}`,
          keyId: `key-${index}`,
        },
      })),
    };
    const evidenceKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const evidenceBody = Buffer.from(JSON.stringify(evidenceBundle), "utf8");
    const evidencePublicKey = Buffer.from(
      evidenceKeys.publicKey.export({ type: "spki", format: "pem" }),
    );
    const evidenceDigest = createHash("sha256").update(evidenceBody).digest("hex");
    const decision = {
      schemaVersion: "enterprise.release-authority-decision.v1",
      decisionId: "decision-2026-08-22",
      decision: "approved",
      generatedAt: "2026-08-21T00:00:00.000Z",
      expiresAt: "2026-08-29T00:00:00.000Z",
      evidence: { releaseVersion: "v2.0.0", bundleDigest: evidenceDigest },
      issuer: {
        organizationId: "release-authority",
        operatorId: "release-operator",
        keyId: "release-rsa-2026",
      },
      rollback: { planId: "rollback-2026-08-22", evidenceDigest: "b".repeat(64) },
    };
    const decisionKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const decisionBody = Buffer.from(JSON.stringify(decision), "utf8");
    const decisionPublicKey = Buffer.from(
      decisionKeys.publicKey.export({ type: "spki", format: "pem" }),
    );
    const write = (name: string, value: Buffer) => {
      const filePath = path.join(directory, name);
      writeFileSync(filePath, value);
      return filePath;
    };
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_BUNDLE_PATH = write(
      "evidence.json",
      evidenceBody,
    );
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_SIGNATURE_PATH = write(
      "evidence.sig",
      sign("RSA-SHA256", evidenceBody, evidenceKeys.privateKey),
    );
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_PUBLIC_KEY_PATH = write(
      "evidence.pub.pem",
      evidencePublicKey,
    );
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_KEY_SHA256 = createHash("sha256")
      .update(evidencePublicKey)
      .digest("hex");
    process.env.FIRST_LLM_RELEASE_DECISION_PATH = write("decision.json", decisionBody);
    process.env.FIRST_LLM_RELEASE_DECISION_SIGNATURE_PATH = write(
      "decision.sig",
      sign("RSA-SHA256", decisionBody, decisionKeys.privateKey),
    );
    process.env.FIRST_LLM_RELEASE_DECISION_PUBLIC_KEY_PATH = write(
      "decision.pub.pem",
      decisionPublicKey,
    );
    process.env.FIRST_LLM_RELEASE_DECISION_KEY_SHA256 = createHash("sha256")
      .update(decisionPublicKey)
      .digest("hex");

    const state = readReleaseAuthorityDecisionLedger({ now });
    assert.equal(state.decisionStatus, "approved");
    assert.equal(state.authorizationStatus, "not-authorized");
    assert.equal(state.productionStatus, "blocked");
  } finally {
    for (const key of configKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
