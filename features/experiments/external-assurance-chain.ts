import { createHash, verify as verifySignature } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export type ExternalEvidenceStatus = "missing" | "invalid" | "verified";

export type ExternalAssuranceAnchor = {
  version: string;
  evidenceStatus: ExternalEvidenceStatus;
  digest: string | null;
  recordId: string | null;
  issuerOrganizationId: string | null;
};

export type ExternalAssuranceRecord = {
  schemaVersion?: string;
  recordId?: string;
  generatedAt?: string;
  expiresAt?: string;
  predecessor?: { version?: string; digest?: string; recordId?: string };
  control?: {
    status?: string;
    primaryEvidenceDigest?: string;
    secondaryEvidenceDigest?: string;
    observationWindowHours?: number;
    coveragePct?: number;
    unresolvedCriticalFindings?: number;
    assertions?: string[];
    reviewedDigests?: string[];
    reviewDigest?: string;
  };
  issuer?: { organizationId?: string; operatorId?: string; keyId?: string };
};

export type ExternalAssuranceArtifact = {
  present: boolean;
  payload: ExternalAssuranceRecord | null;
  digest: string | null;
  signatureVerified: boolean;
  trustAnchorPinned: boolean;
};

export type ExternalAssuranceDefinition = {
  version: string;
  key: string;
  label: string;
  schemaVersion: string;
  sourceContracts: string[];
  externalBlocker: string;
  requiredAssertions: string[];
  minObservationWindowHours: number;
  minimumCoveragePct: number;
  requireSecondaryDigest?: boolean;
  finalReview?: boolean;
};

export type ExternalAssuranceChainState = {
  sourceStatus: "pass";
  externalStatus: "hold";
  productionStatus: "blocked";
  versions: Array<{
    version: string;
    label: string;
    evidenceStatus: ExternalEvidenceStatus;
    digest: string | null;
    recordId: string | null;
    issuerOrganizationId: string | null;
    sourceContracts: string[];
    checks: Record<string, boolean>;
    blockers: string[];
    externalBlocker: string;
  }>;
  summary: {
    verifiedVersions: number;
    requiredVersions: number;
    chainComplete: boolean;
    anchorVerified: boolean;
  };
  blockers: string[];
  stateDigest: string;
};

const RECORD_KEYS = new Set([
  "schemaVersion",
  "recordId",
  "generatedAt",
  "expiresAt",
  "predecessor",
  "control",
  "issuer",
]);
const PREDECESSOR_KEYS = new Set(["version", "digest", "recordId"]);
const CONTROL_KEYS = new Set([
  "status",
  "primaryEvidenceDigest",
  "secondaryEvidenceDigest",
  "observationWindowHours",
  "coveragePct",
  "unresolvedCriticalFindings",
  "assertions",
  "reviewedDigests",
  "reviewDigest",
]);
const ISSUER_KEYS = new Set(["organizationId", "operatorId", "keyId"]);

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isDigest(value: string | null | undefined) {
  return Boolean(value && /^[a-f0-9]{64}$/iu.test(value));
}

function isDurableIdentity(value: string | null | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && !/^(local|test|fixture|rehearsal|unknown)/iu.test(normalized));
}

function hasOnlyKeys(value: unknown, allowed: Set<string>) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).every((key) => allowed.has(key)),
  );
}

function hasStrictSchema(record: ExternalAssuranceRecord | null) {
  return Boolean(
    record &&
      hasOnlyKeys(record, RECORD_KEYS) &&
      hasOnlyKeys(record.predecessor, PREDECESSOR_KEYS) &&
      hasOnlyKeys(record.control, CONTROL_KEYS) &&
      hasOnlyKeys(record.issuer, ISSUER_KEYS),
  );
}

function isPastTimestamp(value: string | undefined, now: number) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp <= now;
}

function isFutureTimestamp(value: string | undefined, now: number) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > now;
}

function readFile(filePath: string | undefined) {
  if (!filePath || !existsSync(filePath)) return null;
  try {
    return readFileSync(filePath);
  } catch {
    return null;
  }
}

function parseRecord(bytes: Buffer | null): ExternalAssuranceRecord | null {
  if (!bytes) return null;
  try {
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as ExternalAssuranceRecord)
      : null;
  } catch {
    return null;
  }
}

export function readExternalAssuranceArtifact(prefix: string): ExternalAssuranceArtifact {
  const body = readFile(process.env[`${prefix}_PATH`]);
  const signature = readFile(process.env[`${prefix}_SIGNATURE_PATH`]);
  const publicKey = readFile(process.env[`${prefix}_PUBLIC_KEY_PATH`]);
  let signatureVerified = false;
  if (body && signature && publicKey) {
    try {
      signatureVerified = verifySignature("RSA-SHA256", body, publicKey, signature);
    } catch {
      signatureVerified = false;
    }
  }
  return {
    present: Boolean(body),
    payload: parseRecord(body),
    digest: body ? sha256(body) : null,
    signatureVerified,
    trustAnchorPinned: Boolean(
      process.env[`${prefix}_KEY_SHA256`]?.trim() &&
        publicKey &&
        process.env[`${prefix}_KEY_SHA256`]?.trim() === sha256(publicKey),
    ),
  };
}

function semanticChecks(
  definition: ExternalAssuranceDefinition,
  record: ExternalAssuranceRecord | null,
  reviewedDigests: Array<string | null>,
) {
  const control = record?.control;
  const assertionSet = new Set(control?.assertions || []);
  return {
    controlPassed: control?.status === "passed",
    primaryEvidenceBound: isDigest(control?.primaryEvidenceDigest),
    secondaryEvidenceBound:
      !definition.requireSecondaryDigest || isDigest(control?.secondaryEvidenceDigest),
    observationWindowSatisfied:
      typeof control?.observationWindowHours === "number" &&
      control.observationWindowHours >= definition.minObservationWindowHours,
    coverageSatisfied:
      typeof control?.coveragePct === "number" &&
      control.coveragePct >= definition.minimumCoveragePct &&
      control.coveragePct <= 100,
    noCriticalFindings: control?.unresolvedCriticalFindings === 0,
    assertionsSatisfied: definition.requiredAssertions.every((assertion) =>
      assertionSet.has(assertion),
    ),
    reviewDigestBound: !definition.finalReview || isDigest(control?.reviewDigest),
    reviewedChainComplete:
      !definition.finalReview ||
      (control?.reviewedDigests?.length === reviewedDigests.length &&
        control.reviewedDigests.every((digest, index) => digest === reviewedDigests[index])),
  };
}

function buildBlockers(input: {
  checks: Record<string, boolean>;
  definition: ExternalAssuranceDefinition;
}) {
  const { checks, definition } = input;
  return [
    ...(!checks.present ? [`No external ${definition.label} record is supplied.`] : []),
    ...(checks.parsed ? [] : ["The supplied record is not a JSON object."]),
    ...(checks.digestValid ? [] : ["The record digest is missing or not a SHA-256 hex digest."]),
    ...(checks.schemaBound ? [] : [`The record does not use ${definition.schemaVersion}.`]),
    ...(checks.schemaStrict ? [] : ["The record contains unknown or malformed schema fields."]),
    ...(checks.chainBound ? [] : ["The record does not bind the required verified predecessor."]),
    ...(checks.signatureVerified ? [] : ["The detached RSA-SHA256 signature is missing or invalid."]),
    ...(checks.trustAnchorPinned ? [] : ["The signer is not pinned by the configured public-key digest."]),
    ...(checks.issuerDurable ? [] : ["The record or signer identity is incomplete or non-durable."]),
    ...(checks.issuerIndependentFromAnchor ? [] : ["The signer is not independent from the predecessor authority."]),
    ...(checks.finalReviewerIndependent ? [] : ["The final reviewer is not independent from the reviewed control issuers."]),
    ...(checks.fresh ? [] : ["The record is expired, future-dated, or missing timestamps."]),
    ...(checks.semantic ? [] : [`The ${definition.label} semantic assertions are incomplete or failed.`]),
  ];
}

/**
 * Validates a read-only chain of externally authored assurance records. The
 * builder cannot sign records, execute controls, or change production state.
 */
export function buildExternalAssuranceChainState(input: {
  definitions: ExternalAssuranceDefinition[];
  anchor: ExternalAssuranceAnchor;
  artifacts: ExternalAssuranceArtifact[];
  now: number;
}): ExternalAssuranceChainState {
  const versions: ExternalAssuranceChainState["versions"] = [];
  for (const [index, definition] of input.definitions.entries()) {
    const artifact = input.artifacts[index] || {
      present: false,
      payload: null,
      digest: null,
      signatureVerified: false,
      trustAnchorPinned: false,
    };
    const predecessor = versions[index - 1] || input.anchor;
    const record = artifact.payload;
    const reviewedDigests = versions.map((version) => version.digest);
    const semantic = semanticChecks(definition, record, reviewedDigests);
    const checks: Record<string, boolean> = {
      present: artifact.present,
      parsed: Boolean(record),
      digestValid: isDigest(artifact.digest),
      schemaBound: record?.schemaVersion === definition.schemaVersion,
      schemaStrict: hasStrictSchema(record),
      chainBound:
        predecessor.evidenceStatus === "verified" &&
        record?.predecessor?.version === predecessor.version &&
        record.predecessor.digest === predecessor.digest &&
        record.predecessor.recordId === predecessor.recordId,
      signatureVerified: artifact.signatureVerified,
      trustAnchorPinned: artifact.trustAnchorPinned,
      issuerDurable:
        isDurableIdentity(record?.recordId) &&
        isDurableIdentity(record?.issuer?.organizationId) &&
        isDurableIdentity(record?.issuer?.operatorId) &&
        isDurableIdentity(record?.issuer?.keyId),
      issuerIndependentFromAnchor:
        isDurableIdentity(record?.issuer?.organizationId) &&
        record?.issuer?.organizationId !== input.anchor.issuerOrganizationId,
      finalReviewerIndependent:
        !definition.finalReview ||
        (isDurableIdentity(record?.issuer?.organizationId) &&
          versions.every(
            (version) => version.issuerOrganizationId !== record?.issuer?.organizationId,
          )),
      fresh:
        isPastTimestamp(record?.generatedAt, input.now) &&
        isFutureTimestamp(record?.expiresAt, input.now),
      semantic: Object.values(semantic).every(Boolean),
      localProductionTransitionDenied: true,
    };
    const verified = Object.values(checks).every(Boolean);
    versions.push({
      version: definition.version,
      label: definition.label,
      evidenceStatus: !checks.present ? "missing" : verified ? "verified" : "invalid",
      digest: artifact.digest,
      recordId: record?.recordId || null,
      issuerOrganizationId: record?.issuer?.organizationId || null,
      sourceContracts: definition.sourceContracts,
      checks,
      blockers: buildBlockers({ checks, definition }),
      externalBlocker: definition.externalBlocker,
    });
  }

  const verifiedVersions = versions.filter(
    (version) => version.evidenceStatus === "verified",
  ).length;
  const withoutDigest = {
    sourceStatus: "pass" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    versions,
    summary: {
      verifiedVersions,
      requiredVersions: input.definitions.length,
      chainComplete: verifiedVersions === input.definitions.length,
      anchorVerified:
        input.anchor.evidenceStatus === "verified" &&
        isDigest(input.anchor.digest) &&
        isDurableIdentity(input.anchor.recordId),
    },
    blockers: [
      ...versions.flatMap((version) => version.blockers),
      "All assurance records are external signed inputs. This repository only verifies and projects them; it cannot execute controls or authorize production.",
    ],
  };
  return { ...withoutDigest, stateDigest: sha256(stableJson(withoutDigest)) };
}
