import { createHash, verify as verifySignature } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { readProductionEvidenceAuthority } from "@/features/experiments/production-evidence-authority";

export const RELEASE_AUTHORITY_DECISION_LEDGER_SCHEMA_VERSION =
  "experiments.release-authority-decision-ledger.v1" as const;
const DECISION_SCHEMA_VERSION = "enterprise.release-authority-decision.v1" as const;

type DecisionStatus = "missing" | "invalid" | "approved" | "rejected";
type Attestor = {
  organizationId?: string;
  operatorId?: string;
  keyId?: string;
};
type ReleaseDecision = {
  schemaVersion?: string;
  decisionId?: string;
  decision?: string;
  generatedAt?: string;
  expiresAt?: string;
  evidence?: { bundleDigest?: string; releaseVersion?: string };
  issuer?: Attestor;
  rollback?: { planId?: string; evidenceDigest?: string };
};

type EvidenceAuthorityInput = {
  schemaVersion: string;
  evidenceStatus: "missing" | "invalid" | "verified";
  bundleDigest: string | null;
  issuerOrganizationId: string | null;
};
type Inputs = {
  decisionPresent: boolean;
  decision: ReleaseDecision | null;
  signatureVerified: boolean;
  trustAnchorPinned: boolean;
  evidenceAuthority: EvidenceAuthorityInput;
  now: number;
};

export type ReleaseAuthorityDecisionLedgerState = {
  decisionStatus: DecisionStatus;
  authorizationStatus: "not-authorized";
  productionStatus: "blocked";
  checks: {
    decisionPresent: boolean;
    decisionParsed: boolean;
    decisionIdentityBound: boolean;
    evidenceAuthorityVerified: boolean;
    schemaAndEvidenceBound: boolean;
    signatureVerified: boolean;
    trustAnchorPinned: boolean;
    issuerDurable: boolean;
    issuerIndependentFromEvidence: boolean;
    decisionFresh: boolean;
    rollbackBound: boolean;
    approvedDecision: boolean;
    localPromotionDenied: true;
  };
  summary: {
    decisionId: string | null;
    declaredDecision: string | null;
    evidenceBundleDigest: string | null;
    issuerOrganizationId: string | null;
  };
  blockers: string[];
};

function isDurableIdentity(value: string | null | undefined) {
  return Boolean(value && !/^(local|test|fixture|rehearsal|unknown)/iu.test(value));
}

function isDigest(value: string | null | undefined) {
  return Boolean(value && /^[a-f0-9]{64}$/iu.test(value));
}

function isPastTimestamp(value: string | undefined, now: number) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp <= now;
}

function isFutureTimestamp(value: string | undefined, now: number) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > now;
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function readFile(filePath: string | undefined) {
  if (!filePath || !existsSync(filePath)) return null;
  try {
    return readFileSync(filePath);
  } catch {
    return null;
  }
}

function parseDecision(bytes: Buffer | null): ReleaseDecision | null {
  if (!bytes) return null;
  try {
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as ReleaseDecision)
      : null;
  } catch {
    return null;
  }
}

/**
 * Projects an external authority decision after validating it against a distinct
 * trust anchor and the verified evidence-bundle digest. It never authorizes a
 * deployment or mutates production state.
 */
export function buildReleaseAuthorityDecisionLedgerState(
  input: Inputs,
): ReleaseAuthorityDecisionLedgerState {
  const decision = input.decision;
  const checks = {
    decisionPresent: input.decisionPresent,
    decisionParsed: Boolean(decision),
    decisionIdentityBound: isDurableIdentity(decision?.decisionId),
    evidenceAuthorityVerified:
      input.evidenceAuthority.schemaVersion ===
        "experiments.production-evidence-authority.v1" &&
      input.evidenceAuthority.evidenceStatus === "verified" &&
      isDigest(input.evidenceAuthority.bundleDigest),
    schemaAndEvidenceBound:
      decision?.schemaVersion === DECISION_SCHEMA_VERSION &&
      decision.evidence?.releaseVersion === "v2.0.0" &&
      decision.evidence?.bundleDigest === input.evidenceAuthority.bundleDigest &&
      isDigest(decision.evidence?.bundleDigest),
    signatureVerified: input.signatureVerified,
    trustAnchorPinned: input.trustAnchorPinned,
    issuerDurable:
      isDurableIdentity(decision?.issuer?.organizationId) &&
      isDurableIdentity(decision?.issuer?.operatorId) &&
      isDurableIdentity(decision?.issuer?.keyId),
    issuerIndependentFromEvidence:
      isDurableIdentity(decision?.issuer?.organizationId) &&
      isDurableIdentity(input.evidenceAuthority.issuerOrganizationId) &&
      decision?.issuer?.organizationId !==
        input.evidenceAuthority.issuerOrganizationId,
    decisionFresh:
      isPastTimestamp(decision?.generatedAt, input.now) &&
      isFutureTimestamp(decision?.expiresAt, input.now),
    rollbackBound:
      isDurableIdentity(decision?.rollback?.planId) &&
      isDigest(decision?.rollback?.evidenceDigest),
    approvedDecision: decision?.decision === "approved",
    localPromotionDenied: true as const,
  };
  const decisionFoundations = [
    checks.decisionPresent,
    checks.decisionParsed,
    checks.decisionIdentityBound,
    checks.evidenceAuthorityVerified,
    checks.schemaAndEvidenceBound,
    checks.signatureVerified,
    checks.trustAnchorPinned,
    checks.issuerDurable,
    checks.issuerIndependentFromEvidence,
    checks.decisionFresh,
    checks.rollbackBound,
  ].every(Boolean);
  const decisionStatus: DecisionStatus = !checks.decisionPresent
    ? "missing"
    : decisionFoundations && decision?.decision === "rejected"
      ? "rejected"
      : decisionFoundations && checks.approvedDecision
        ? "approved"
        : "invalid";
  const blockers = [
    ...(!checks.decisionPresent
      ? ["No external release-authority decision has been supplied."]
      : []),
    ...(checks.decisionParsed
      ? []
      : ["The supplied release decision is not valid JSON."]),
    ...(checks.decisionIdentityBound
      ? []
      : ["The release decision does not provide a durable decision id."]),
    ...(checks.evidenceAuthorityVerified
      ? []
      : ["The referenced production evidence bundle is not independently verified."]),
    ...(checks.schemaAndEvidenceBound
      ? []
      : ["The release decision does not bind the verified v2.0.0 evidence bundle."]),
    ...(checks.signatureVerified
      ? []
      : ["The release-authority decision signature is missing or invalid."]),
    ...(checks.trustAnchorPinned
      ? []
      : ["The release-authority signer is not pinned through a distinct trust anchor."]),
    ...(checks.issuerDurable
      ? []
      : ["The decision issuer does not identify a durable organization, operator, and key."]),
    ...(checks.issuerIndependentFromEvidence
      ? []
      : ["The decision issuer must be independent from the evidence-bundle issuer."]),
    ...(checks.decisionFresh
      ? []
      : ["The release decision is expired, future-dated, or missing timestamps."]),
    ...(checks.rollbackBound
      ? []
      : ["The release decision does not bind an immutable rollback plan."]),
    ...(decisionStatus === "rejected"
      ? ["The independent release authority rejected this production transition."]
      : []),
    ...(decisionStatus === "invalid"
      ? ["The release decision cannot be treated as an independent approval."]
      : []),
    "This application only projects the external decision; deployment and production authorization remain outside the local studio.",
  ];
  return {
    decisionStatus,
    authorizationStatus: "not-authorized",
    productionStatus: "blocked",
    checks,
    summary: {
      decisionId: decision?.decisionId || null,
      declaredDecision: decision?.decision || null,
      evidenceBundleDigest: decision?.evidence?.bundleDigest || null,
      issuerOrganizationId: decision?.issuer?.organizationId || null,
    },
    blockers,
  };
}

export function readReleaseAuthorityDecisionLedger() {
  const decisionBytes = readFile(process.env.FIRST_LLM_RELEASE_DECISION_PATH);
  const signature = readFile(process.env.FIRST_LLM_RELEASE_DECISION_SIGNATURE_PATH);
  const publicKey = readFile(process.env.FIRST_LLM_RELEASE_DECISION_PUBLIC_KEY_PATH);
  const expectedPublicKeySha256 =
    process.env.FIRST_LLM_RELEASE_DECISION_KEY_SHA256?.trim() || "";
  const actualPublicKeySha256 = publicKey ? sha256(publicKey) : "";
  let signatureVerified = false;
  if (decisionBytes && signature && publicKey) {
    try {
      signatureVerified = verifySignature(
        "RSA-SHA256",
        decisionBytes,
        publicKey,
        signature,
      );
    } catch {
      signatureVerified = false;
    }
  }
  const evidenceAuthority = readProductionEvidenceAuthority();
  const state = buildReleaseAuthorityDecisionLedgerState({
    decisionPresent: Boolean(decisionBytes),
    decision: parseDecision(decisionBytes),
    signatureVerified,
    trustAnchorPinned: Boolean(
      expectedPublicKeySha256 &&
        actualPublicKeySha256 &&
        expectedPublicKeySha256 === actualPublicKeySha256,
    ),
    evidenceAuthority: {
      schemaVersion: evidenceAuthority.schemaVersion,
      evidenceStatus: evidenceAuthority.evidenceStatus,
      bundleDigest: evidenceAuthority.bundleDigest,
      issuerOrganizationId: evidenceAuthority.summary.issuerOrganizationId,
    },
    now: Date.now(),
  });
  return {
    ok: true as const,
    schemaVersion: RELEASE_AUTHORITY_DECISION_LEDGER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...state,
    decisionDigest: decisionBytes ? sha256(decisionBytes) : null,
    evidenceIssuerOrganizationId: evidenceAuthority.summary.issuerOrganizationId,
    configured: {
      decision: Boolean(decisionBytes),
      signature: Boolean(signature),
      publicKey: Boolean(publicKey),
      trustAnchor: Boolean(expectedPublicKeySha256),
    },
  };
}
