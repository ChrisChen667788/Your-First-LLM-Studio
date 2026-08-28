import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ASSURANCE_CLOSURE_DEFINITIONS,
  buildAssuranceClosureTrainState,
} from "@/features/experiments/assurance-closure-train";
import {
  CONTINUOUS_ASSURANCE_DEFINITIONS,
  buildContinuousAssuranceTrainState,
} from "@/features/experiments/continuous-assurance-train";
import type {
  ExternalAssuranceArtifact,
  ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import { readExternalAssuranceArtifact } from "@/features/experiments/external-assurance-chain";
import { RELEASE_TRAIN_MILESTONES } from "@/features/experiments/release-train";

const now = Date.parse("2026-08-28T00:00:00.000Z");

function digest(character: string) {
  return character.repeat(64);
}

function artifactsFor(
  definitions: ExternalAssuranceDefinition[],
  anchor: { version: string; digest: string; recordId: string },
) {
  return definitions.map((definition, index) => {
    const predecessor = index === 0
      ? anchor
      : {
          version: definitions[index - 1]!.version,
          digest: digest(String(index - 1)),
          recordId: `assurance-${index - 1}`,
        };
    const reviewedDigests = definitions
      .slice(0, index)
      .map((_, reviewedIndex) => digest(String(reviewedIndex)));
    return {
      present: true,
      digest: digest(String(index)),
      signatureVerified: true,
      trustAnchorPinned: true,
      payload: {
        schemaVersion: definition.schemaVersion,
        recordId: `assurance-${index}`,
        generatedAt: "2026-08-27T00:00:00.000Z",
        expiresAt: "2026-09-28T00:00:00.000Z",
        predecessor,
        control: {
          status: "passed",
          primaryEvidenceDigest: digest("a"),
          ...(definition.requireSecondaryDigest
            ? { secondaryEvidenceDigest: digest("b") }
            : {}),
          observationWindowHours: definition.minObservationWindowHours,
          coveragePct: definition.minimumCoveragePct,
          unresolvedCriticalFindings: 0,
          assertions: definition.requiredAssertions,
          ...(definition.finalReview
            ? { reviewedDigests, reviewDigest: digest("c") }
            : {}),
        },
        issuer: {
          organizationId: `assurance-authority-${index}`,
          operatorId: `assurance-operator-${index}`,
          keyId: `assurance-key-${index}`,
        },
      },
    } satisfies ExternalAssuranceArtifact;
  });
}

test("v2.2 complete assurance evidence verifies without authorizing production", () => {
  const anchor = {
    version: "v2.1.9",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "post-ga-independent-review",
    issuerOrganizationId: "post-ga-review-authority",
  };
  const state = buildContinuousAssuranceTrainState({
    anchor,
    artifacts: artifactsFor(CONTINUOUS_ASSURANCE_DEFINITIONS, {
      version: anchor.version,
      digest: anchor.digest,
      recordId: anchor.recordId,
    }),
    now,
  });

  assert.equal(state.summary.verifiedVersions, 10);
  assert.equal(state.summary.chainComplete, true);
  assert.equal(state.versions[9]?.evidenceStatus, "verified");
  assert.equal(state.productionStatus, "blocked");
});

test("strict schema, semantic failure, and predecessor break remain fail-closed", () => {
  const anchor = {
    version: "v2.1.9",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "post-ga-independent-review",
    issuerOrganizationId: "post-ga-review-authority",
  };
  const artifacts = artifactsFor(CONTINUOUS_ASSURANCE_DEFINITIONS, {
    version: anchor.version,
    digest: anchor.digest,
    recordId: anchor.recordId,
  });
  Object.assign(artifacts[1]!.payload!, { unexpected: true });
  artifacts[3]!.payload!.control!.coveragePct = 1;
  artifacts[5]!.payload!.predecessor!.digest = digest("f");

  const state = buildContinuousAssuranceTrainState({ anchor, artifacts, now });
  assert.equal(state.versions[1]?.checks.schemaStrict, false);
  assert.equal(state.versions[3]?.evidenceStatus, "invalid");
  assert.equal(state.versions[5]?.checks.chainBound, false);
  assert.equal(state.summary.chainComplete, false);
  assert.equal(state.productionStatus, "blocked");
});

test("v2.3 closure binds v2.2.9 and requires an independent final reviewer", () => {
  const anchor = {
    version: "v2.2.9",
    evidenceStatus: "verified" as const,
    digest: digest("e"),
    recordId: "continuous-assurance-review",
    issuerOrganizationId: "continuous-review-authority",
  };
  const artifacts = artifactsFor(ASSURANCE_CLOSURE_DEFINITIONS, {
    version: anchor.version,
    digest: anchor.digest,
    recordId: anchor.recordId,
  });
  const complete = buildAssuranceClosureTrainState({ anchor, artifacts, now });
  assert.equal(complete.summary.verifiedVersions, 5);
  assert.equal(complete.summary.chainComplete, true);
  assert.equal(complete.productionStatus, "blocked");

  artifacts[4]!.payload!.issuer!.organizationId = "assurance-authority-3";
  const invalid = buildAssuranceClosureTrainState({ anchor, artifacts, now });
  assert.equal(invalid.versions[4]?.checks.finalReviewerIndependent, false);
  assert.equal(invalid.versions[4]?.evidenceStatus, "invalid");
});

test("missing external evidence is visible and all fifteen milestones stay evidence-needed", () => {
  const state = buildContinuousAssuranceTrainState({
    anchor: {
      version: "v2.1.9",
      evidenceStatus: "missing",
      digest: null,
      recordId: null,
      issuerOrganizationId: null,
    },
    artifacts: [],
    now,
  });
  assert.equal(state.summary.verifiedVersions, 0);
  assert.ok(state.versions.every((version) => version.evidenceStatus === "missing"));

  const versions = new Set([
    ...CONTINUOUS_ASSURANCE_DEFINITIONS,
    ...ASSURANCE_CLOSURE_DEFINITIONS,
  ].map((definition) => definition.version));
  const milestones = RELEASE_TRAIN_MILESTONES.filter((milestone) =>
    versions.has(milestone.version),
  );
  assert.equal(milestones.length, 15);
  assert.ok(milestones.every((milestone) => milestone.status === "evidence-needed"));
});

test("configured evidence verifies a real detached signature and pinned public key", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "first-llm-assurance-"));
  const prefix = "FIRST_LLM_TEST_ASSURANCE";
  const bodyPath = path.join(directory, "record.json");
  const signaturePath = path.join(directory, "record.sig");
  const publicKeyPath = path.join(directory, "public.pem");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const body = Buffer.from('{"schemaVersion":"enterprise.test-assurance.v1"}\n', "utf8");
  const publicKeyBytes = publicKey.export({ type: "spki", format: "pem" });

  try {
    writeFileSync(bodyPath, body);
    writeFileSync(signaturePath, sign("RSA-SHA256", body, privateKey));
    writeFileSync(publicKeyPath, publicKeyBytes);
    process.env[`${prefix}_PATH`] = bodyPath;
    process.env[`${prefix}_SIGNATURE_PATH`] = signaturePath;
    process.env[`${prefix}_PUBLIC_KEY_PATH`] = publicKeyPath;
    process.env[`${prefix}_KEY_SHA256`] = createHash("sha256")
      .update(publicKeyBytes)
      .digest("hex");

    const artifact = readExternalAssuranceArtifact(prefix);
    assert.equal(artifact.present, true);
    assert.equal(artifact.signatureVerified, true);
    assert.equal(artifact.trustAnchorPinned, true);

    process.env[`${prefix}_KEY_SHA256`] = digest("f");
    assert.equal(readExternalAssuranceArtifact(prefix).trustAnchorPinned, false);
  } finally {
    delete process.env[`${prefix}_PATH`];
    delete process.env[`${prefix}_SIGNATURE_PATH`];
    delete process.env[`${prefix}_PUBLIC_KEY_PATH`];
    delete process.env[`${prefix}_KEY_SHA256`];
    rmSync(directory, { recursive: true, force: true });
  }
});
