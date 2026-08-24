import { createHash, verify as verifySignature } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export const PRODUCTION_EVIDENCE_AUTHORITY_SCHEMA_VERSION =
  "experiments.production-evidence-authority.v1" as const;
const BUNDLE_SCHEMA_VERSION = "enterprise.production-evidence-bundle.v1" as const;
const REQUIRED_RECEIPT_TYPES = [
  "identity",
  "data",
  "telemetry",
  "kms-archive",
  "failover",
  "billing",
  "security",
  "distribution",
  "organization",
] as const;

type RequiredReceiptType = (typeof REQUIRED_RECEIPT_TYPES)[number];
type EvidenceStatus = "missing" | "invalid" | "verified";
type Attestor = {
  organizationId?: string;
  operatorId?: string;
  keyId?: string;
};
type ExternalReceipt = {
  id?: string;
  type?: string;
  status?: string;
  issuedAt?: string;
  expiresAt?: string;
  evidenceDigest?: string;
  independent?: boolean;
  attestor?: Attestor;
};
type ProductionEvidenceBundle = {
  schemaVersion?: string;
  bundleId?: string;
  generatedAt?: string;
  expiresAt?: string;
  release?: { version?: string; artifactDigest?: string; sourceRevision?: string };
  issuer?: Attestor;
  independentReview?: boolean;
  receipts?: ExternalReceipt[];
};

export type ProductionEvidenceAuthorityState = {
  evidenceStatus: EvidenceStatus;
  authorizationStatus: "not-authorized";
  productionStatus: "blocked";
  checks: {
    bundlePresent: boolean;
    bundleParsed: boolean;
    schemaAndReleaseBound: boolean;
    signatureVerified: boolean;
    trustAnchorPinned: boolean;
    issuerDurable: boolean;
    independentReviewDeclared: boolean;
    receiptSetComplete: boolean;
    receiptIntegrityBound: boolean;
    receiptFresh: boolean;
    receiptAttestorsIndependent: boolean;
    localPromotionDenied: true;
  };
  summary: {
    bundleId: string | null;
    issuerOrganizationId: string | null;
    releaseVersion: string | null;
    receiptTypes: string[];
    requiredReceiptTypes: readonly RequiredReceiptType[];
    independentAttestorOrganizations: number;
  };
  blockers: string[];
};

type Inputs = {
  bundlePresent: boolean;
  bundle: ProductionEvidenceBundle | null;
  signatureVerified: boolean;
  trustAnchorPinned: boolean;
  now: number;
};

function isDurableIdentity(value: string | undefined) {
  return Boolean(value && !/^(local|test|fixture|rehearsal|unknown)/iu.test(value));
}

function isDigest(value: string | undefined) {
  return Boolean(value && /^[a-f0-9]{64}$/iu.test(value));
}

function isFutureTimestamp(value: string | undefined, now: number) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > now;
}

function isPastTimestamp(value: string | undefined, now: number) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp <= now;
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

function parseBundle(bytes: Buffer | null): ProductionEvidenceBundle | null {
  if (!bytes) return null;
  try {
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (
      !Array.isArray(candidate.receipts) ||
      !candidate.receipts.every(
        (receipt) => receipt && typeof receipt === "object" && !Array.isArray(receipt),
      )
    ) {
      return null;
    }
    return candidate as ProductionEvidenceBundle;
  } catch {
    return null;
  }
}

/**
 * Validates an independently supplied evidence bundle. This module never writes a
 * receipt, signs an artifact, or changes production authorization.
 */
export function buildProductionEvidenceAuthorityState(
  input: Inputs,
): ProductionEvidenceAuthorityState {
  const bundle = input.bundle;
  const receipts = Array.isArray(bundle?.receipts) ? bundle.receipts : [];
  const receiptTypes = Array.from(
    new Set(receipts.map((receipt) => receipt.type).filter(Boolean)),
  ) as string[];
  const independentAttestorOrganizations = new Set(
    receipts
      .map((receipt) => receipt.attestor?.organizationId)
      .filter((value): value is string => isDurableIdentity(value)),
  ).size;
  const checks = {
    bundlePresent: input.bundlePresent,
    bundleParsed: Boolean(bundle),
    schemaAndReleaseBound:
      bundle?.schemaVersion === BUNDLE_SCHEMA_VERSION &&
      bundle.release?.version === "v2.0.0" &&
      isDigest(bundle.release?.artifactDigest) &&
      isDurableIdentity(bundle.release?.sourceRevision),
    signatureVerified: input.signatureVerified,
    trustAnchorPinned: input.trustAnchorPinned,
    issuerDurable:
      isDurableIdentity(bundle?.issuer?.organizationId) &&
      isDurableIdentity(bundle?.issuer?.operatorId) &&
      isDurableIdentity(bundle?.issuer?.keyId),
    independentReviewDeclared: bundle?.independentReview === true,
    receiptSetComplete: REQUIRED_RECEIPT_TYPES.every((type) =>
      receipts.some((receipt) => receipt.type === type && receipt.status === "pass"),
    ),
    receiptIntegrityBound:
      receipts.length >= REQUIRED_RECEIPT_TYPES.length &&
      new Set(receipts.map((receipt) => receipt.id).filter(Boolean)).size === receipts.length &&
      receipts.every(
        (receipt) =>
          isDigest(receipt.evidenceDigest) &&
          receipt.independent === true &&
          isDurableIdentity(receipt.attestor?.organizationId) &&
          isDurableIdentity(receipt.attestor?.operatorId) &&
          isDurableIdentity(receipt.attestor?.keyId),
      ),
    receiptFresh:
      isPastTimestamp(bundle?.generatedAt, input.now) &&
      isFutureTimestamp(bundle?.expiresAt, input.now) &&
      receipts.every(
        (receipt) =>
          isPastTimestamp(receipt.issuedAt, input.now) &&
          isFutureTimestamp(receipt.expiresAt, input.now),
      ),
    receiptAttestorsIndependent: independentAttestorOrganizations >= 2,
    localPromotionDenied: true as const,
  };
  const verified = Object.values(checks).every(Boolean);
  const blockers = [
    ...(!checks.bundlePresent
      ? ["No production evidence bundle has been supplied to the verifier."]
      : []),
    ...(checks.bundleParsed
      ? []
      : ["The supplied production evidence bundle is not a valid JSON receipt inventory."]),
    ...(checks.schemaAndReleaseBound
      ? []
      : ["The bundle does not bind the v2.0.0 release, source revision, and artifact digest."]),
    ...(checks.signatureVerified
      ? []
      : ["The detached bundle signature is missing or invalid."]),
    ...(checks.trustAnchorPinned
      ? []
      : ["The signer public key is not pinned through an out-of-band trust anchor."]),
    ...(checks.issuerDurable
      ? []
      : ["The bundle issuer does not identify a durable external organization, operator, and key."]),
    ...(checks.independentReviewDeclared
      ? []
      : ["The bundle does not declare independent review."]),
    ...(checks.receiptSetComplete
      ? []
      : ["The required identity, data, telemetry, archive, failover, billing, security, distribution, and organization receipt set is incomplete."]),
    ...(checks.receiptIntegrityBound
      ? []
      : ["One or more external receipts lack a unique id, durable attestor, independent flag, or SHA-256 digest."]),
    ...(checks.receiptFresh
      ? []
      : ["The production evidence bundle or a contained receipt is expired, future-dated, or missing timestamps."]),
    ...(checks.receiptAttestorsIndependent
      ? []
      : ["At least two durable independent attestor organizations are required."]),
    "Final production authorization must occur in the independently operated release authority; this application never performs that transition.",
  ];
  return {
    evidenceStatus: !checks.bundlePresent
      ? "missing"
      : verified
        ? "verified"
        : "invalid",
    authorizationStatus: "not-authorized",
    productionStatus: "blocked",
    checks,
    summary: {
      bundleId: bundle?.bundleId || null,
      issuerOrganizationId: bundle?.issuer?.organizationId || null,
      releaseVersion: bundle?.release?.version || null,
      receiptTypes,
      requiredReceiptTypes: REQUIRED_RECEIPT_TYPES,
      independentAttestorOrganizations,
    },
    blockers,
  };
}

export function readProductionEvidenceAuthority() {
  const bundleBytes = readFile(process.env.FIRST_LLM_PRODUCTION_EVIDENCE_BUNDLE_PATH);
  const signature = readFile(process.env.FIRST_LLM_PRODUCTION_EVIDENCE_SIGNATURE_PATH);
  const publicKey = readFile(process.env.FIRST_LLM_PRODUCTION_EVIDENCE_PUBLIC_KEY_PATH);
  const expectedPublicKeySha256 =
    process.env.FIRST_LLM_PRODUCTION_EVIDENCE_KEY_SHA256?.trim() || "";
  const actualPublicKeySha256 = publicKey ? sha256(publicKey) : "";
  let signatureVerified = false;
  if (bundleBytes && signature && publicKey) {
    try {
      signatureVerified = verifySignature("RSA-SHA256", bundleBytes, publicKey, signature);
    } catch {
      signatureVerified = false;
    }
  }
  const state = buildProductionEvidenceAuthorityState({
    bundlePresent: Boolean(bundleBytes),
    bundle: parseBundle(bundleBytes),
    signatureVerified,
    trustAnchorPinned: Boolean(
      expectedPublicKeySha256 &&
        actualPublicKeySha256 &&
        expectedPublicKeySha256 === actualPublicKeySha256,
    ),
    now: Date.now(),
  });
  return {
    ok: true as const,
    schemaVersion: PRODUCTION_EVIDENCE_AUTHORITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...state,
    bundleDigest: bundleBytes ? sha256(bundleBytes) : null,
    configured: {
      bundle: Boolean(bundleBytes),
      signature: Boolean(signature),
      publicKey: Boolean(publicKey),
      trustAnchor: Boolean(expectedPublicKeySha256),
    },
  };
}
