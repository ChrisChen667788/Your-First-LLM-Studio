import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildProductionEvidenceAuthorityState,
  readProductionEvidenceAuthority,
} from "@/features/experiments/production-evidence-authority";

const now = Date.parse("2026-08-22T00:00:00.000Z");
const receiptTypes = [
  "identity",
  "data",
  "telemetry",
  "kms-archive",
  "failover",
  "billing",
  "security",
  "distribution",
  "organization",
];

function fixture() {
  return {
    bundlePresent: true,
    signatureVerified: true,
    trustAnchorPinned: true,
    now,
    bundle: {
      schemaVersion: "enterprise.production-evidence-bundle.v1",
      bundleId: "release-authority-2026-08-22",
      generatedAt: "2026-08-21T00:00:00.000Z",
      expiresAt: "2026-08-29T00:00:00.000Z",
      release: {
        version: "v2.0.0",
        artifactDigest: "a".repeat(64),
        sourceRevision: "main-20260822",
      },
      issuer: {
        organizationId: "release-authority",
        operatorId: "release-operator",
        keyId: "release-authority-rsa-2026",
      },
      independentReview: true,
      receipts: receiptTypes.map((type, index) => ({
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
    },
  };
}

test("a complete trusted evidence bundle is verified but cannot authorize production", () => {
  const state = buildProductionEvidenceAuthorityState(
    fixture() as Parameters<typeof buildProductionEvidenceAuthorityState>[0],
  );
  assert.equal(state.evidenceStatus, "verified");
  assert.equal(state.authorizationStatus, "not-authorized");
  assert.equal(state.productionStatus, "blocked");
  assert.equal(state.checks.localPromotionDenied, true);
});

test("an unpinned signer or local-looking issuer fails closed", () => {
  const input = fixture();
  input.trustAnchorPinned = false;
  input.bundle.issuer.organizationId = "local-fixture";
  const state = buildProductionEvidenceAuthorityState(
    input as Parameters<typeof buildProductionEvidenceAuthorityState>[0],
  );
  assert.equal(state.evidenceStatus, "invalid");
  assert.equal(state.checks.trustAnchorPinned, false);
  assert.equal(state.checks.issuerDurable, false);
  assert.equal(state.productionStatus, "blocked");
});

test("the real detached-signature intake verifies without gaining production authority", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "first-llm-v201-test-"));
  const configKeys = [
    "FIRST_LLM_PRODUCTION_EVIDENCE_BUNDLE_PATH",
    "FIRST_LLM_PRODUCTION_EVIDENCE_SIGNATURE_PATH",
    "FIRST_LLM_PRODUCTION_EVIDENCE_PUBLIC_KEY_PATH",
    "FIRST_LLM_PRODUCTION_EVIDENCE_KEY_SHA256",
  ] as const;
  const original = Object.fromEntries(
    configKeys.map((key) => [key, process.env[key]]),
  );
  try {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const body = Buffer.from(JSON.stringify(fixture().bundle), "utf8");
    const publicKeyBytes = Buffer.from(
      publicKey.export({ type: "spki", format: "pem" }),
    );
    const bundlePath = path.join(directory, "bundle.json");
    const signaturePath = path.join(directory, "bundle.json.sig");
    const publicKeyPath = path.join(directory, "bundle.pub.pem");
    writeFileSync(bundlePath, body);
    writeFileSync(signaturePath, sign("RSA-SHA256", body, privateKey));
    writeFileSync(publicKeyPath, publicKeyBytes);
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_BUNDLE_PATH = bundlePath;
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_SIGNATURE_PATH = signaturePath;
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_PUBLIC_KEY_PATH = publicKeyPath;
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_KEY_SHA256 = createHash("sha256")
      .update(publicKeyBytes)
      .digest("hex");

    const state = readProductionEvidenceAuthority({ now });
    assert.equal(state.evidenceStatus, "verified");
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
