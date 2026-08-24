import { createHash, verify as verifySignature } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { readProductionLifecycleClosure } from "@/features/experiments/production-lifecycle-closure";

export const POST_GA_OPERATIONS_TRAIN_SCHEMA_VERSION =
  "experiments.post-ga-operations-train.v1" as const;

type EvidenceStatus = "missing" | "invalid" | "verified";
type VersionId =
  | "v2.1.0"
  | "v2.1.1"
  | "v2.1.2"
  | "v2.1.3"
  | "v2.1.4"
  | "v2.1.5"
  | "v2.1.6"
  | "v2.1.7"
  | "v2.1.8"
  | "v2.1.9";

type Attestor = {
  organizationId?: string;
  operatorId?: string;
  keyId?: string;
};

type OperationsAttestation = {
  schemaVersion?: string;
  recordId?: string;
  generatedAt?: string;
  expiresAt?: string;
  predecessor?: { version?: string; digest?: string; recordId?: string };
  release?: { releaseVersion?: string; closureArchiveDigest?: string };
  continuity?: {
    status?: string;
    observationWindowHours?: number;
    telemetryEvidenceDigest?: string;
    incidentStatus?: string;
  };
  slo?: {
    status?: string;
    observationWindowHours?: number;
    metricsDigest?: string;
    errorBudgetStatus?: string;
  };
  change?: {
    status?: string;
    changeReviewDigest?: string;
    incidentLedgerDigest?: string;
    unresolvedCriticalIncidents?: number;
  };
  data?: {
    retentionPolicyDigest?: string;
    deletionPropagation?: string;
    auditArchiveIntegrity?: string;
    unresolvedLegalHoldConflicts?: number;
  };
  identity?: {
    accessReviewStatus?: string;
    lifecycleEvidenceDigest?: string;
    privilegedAccessReviewDigest?: string;
    unresolvedCriticalFindings?: number;
  };
  supplyChain?: {
    artifactInventoryDigest?: string;
    vulnerabilityReview?: string;
    revocationStatus?: string;
    unsignedArtifactCount?: number;
  };
  quality?: {
    policyDigest?: string;
    qualityStatus?: string;
    safetyStatus?: string;
    driftStatus?: string;
  };
  capacity?: {
    capacityPlanDigest?: string;
    budgetStatus?: string;
    settlementStatus?: string;
    headroomPct?: number;
  };
  recovery?: {
    rehearsalDigest?: string;
    status?: string;
    measuredRpoMs?: number;
    measuredRtoMs?: number;
    crossRegion?: string;
  };
  review?: { status?: string; chainDigests?: string[]; reviewDigest?: string };
  issuer?: Attestor;
};

type SignedArtifact = {
  present: boolean;
  payload: OperationsAttestation | null;
  digest: string | null;
  signatureVerified: boolean;
  trustAnchorPinned: boolean;
};

type ClosureInput = {
  productionStatus: "blocked";
  stages: { closure: { status: EvidenceStatus; digest: string | null; issuerOrganizationId: string | null } };
};

type Definition = {
  version: VersionId;
  key: string;
  label: string;
  schemaVersion: string;
  sourceContracts: string[];
  externalBlocker: string;
};

const DEFINITIONS: Definition[] = [
  {
    version: "v2.1.0",
    key: "CONTINUITY",
    label: "External Operations Continuity",
    schemaVersion: "enterprise.external-operations-continuity.v1",
    sourceContracts: [
      "signed continuity record bound to the v2.0.5 closure archive",
      "minimum observation window, telemetry digest, and unresolved-critical-incident assertion",
      "pinned trust anchor and read-only evidence projection",
    ],
    externalBlocker: "An independently operated observability service must supply a fresh signed continuity record.",
  },
  {
    version: "v2.1.1",
    key: "SLO",
    label: "Production SLO Attestation",
    schemaVersion: "enterprise.production-slo-attestation.v1",
    sourceContracts: [
      "predecessor-bound SLO observation record",
      "metric digest, observation window, and error-budget assertion",
      "pinned independent evidence intake without local SLO declaration",
    ],
    externalBlocker: "SLO measurements and error-budget judgement must be produced by the independent production observability owner.",
  },
  {
    version: "v2.1.2",
    key: "CHANGE_INCIDENT",
    label: "Change and Incident Provenance",
    schemaVersion: "enterprise.change-incident-provenance.v1",
    sourceContracts: [
      "reviewed change and incident-ledger digest binding",
      "critical-incident count and closed-operation assertion",
      "immutable predecessor link for operational change history",
    ],
    externalBlocker: "A managed change-control and incident system must provide the authoritative records and severity review.",
  },
  {
    version: "v2.1.3",
    key: "DATA_GOVERNANCE",
    label: "Data Retention and Deletion Attestation",
    schemaVersion: "enterprise.data-governance-attestation.v1",
    sourceContracts: [
      "retention-policy and archive-integrity digest binding",
      "deletion propagation and legal-hold conflict assertion",
      "read-only attestation that cannot purge or retain local data",
    ],
    externalBlocker: "Deployed stores, indexes, caches, legal holds, and immutable archives need independently retained deletion evidence.",
  },
  {
    version: "v2.1.4",
    key: "IDENTITY_ACCESS",
    label: "Identity and Access Recertification",
    schemaVersion: "enterprise.identity-access-recertification.v1",
    sourceContracts: [
      "access-review and workforce-lifecycle digest binding",
      "privileged-access review and critical-finding assertion",
      "externally signed identity governance projection",
    ],
    externalBlocker: "Real IdP, SCIM lifecycle, privileged-access review, and organization acceptance remain external controls.",
  },
  {
    version: "v2.1.5",
    key: "SUPPLY_CHAIN",
    label: "Production Supply Chain Reverification",
    schemaVersion: "enterprise.production-supply-chain-reverification.v1",
    sourceContracts: [
      "artifact inventory, vulnerability review, and revocation-state binding",
      "unsigned-artifact denial assertion",
      "pinned evidence intake without package mutation or promotion",
    ],
    externalBlocker: "Authoritative inventories, vulnerability decisions, revocation propagation, and publisher controls belong to external supply-chain operators.",
  },
  {
    version: "v2.1.6",
    key: "QUALITY_SAFETY",
    label: "Quality Drift and Safety Review",
    schemaVersion: "enterprise.quality-drift-safety-review.v1",
    sourceContracts: [
      "versioned quality-policy digest binding",
      "quality, safety, and drift-status assertions",
      "no local waiver, policy rewrite, or release transition",
    ],
    externalBlocker: "Independent evaluators, calibrated judges, red-team evidence, and release-owner review are required outside this repository.",
  },
  {
    version: "v2.1.7",
    key: "CAPACITY_COST",
    label: "Capacity and Cost Reconciliation",
    schemaVersion: "enterprise.capacity-cost-reconciliation.v1",
    sourceContracts: [
      "capacity-plan, settlement, and budget-status binding",
      "non-negative capacity headroom assertion",
      "external billing authority remains the only financial system of record",
    ],
    externalBlocker: "Managed usage, settlement, billing, allocation, and capacity sources must be independently reconciled.",
  },
  {
    version: "v2.1.8",
    key: "RECOVERY",
    label: "Disaster Recovery Cadence",
    schemaVersion: "enterprise.disaster-recovery-cadence.v1",
    sourceContracts: [
      "rehearsal digest with RPO, RTO, and cross-region assertions",
      "predecessor-bound recovery evidence",
      "read-only recovery validation without executing a failover",
    ],
    externalBlocker: "Cross-region rehearsal, traffic recovery, durable storage restoration, and independent disaster-recovery witnesses are externally controlled.",
  },
  {
    version: "v2.1.9",
    key: "INDEPENDENT_REVIEW",
    label: "Independent Operations Review",
    schemaVersion: "enterprise.independent-operations-review.v1",
    sourceContracts: [
      "complete v2.1.0–v2.1.8 digest-chain review",
      "distinct reviewer identity and review digest",
      "terminal evidence projection with local production transition disabled",
    ],
    externalBlocker: "A distinct external operations-review authority must sign the complete chain; the studio cannot self-review or authorize production.",
  },
];

export type PostGaOperationsTrainState = {
  sourceStatus: "pass";
  externalStatus: "hold";
  productionStatus: "blocked";
  versions: Array<{
    version: VersionId;
    label: string;
    evidenceStatus: EvidenceStatus;
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
    requiredVersions: 10;
    chainComplete: boolean;
    closureArchiveVerified: boolean;
  };
  blockers: string[];
  stateDigest: string;
};

type Inputs = { closure: ClosureInput; artifacts: SignedArtifact[]; now: number };

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

function parseObject(bytes: Buffer | null): OperationsAttestation | null {
  if (!bytes) return null;
  try {
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as OperationsAttestation)
      : null;
  } catch {
    return null;
  }
}

function readSignedArtifact(input: {
  bodyPath?: string;
  signaturePath?: string;
  publicKeyPath?: string;
  expectedKeySha256?: string;
}): SignedArtifact {
  const body = readFile(input.bodyPath);
  const signature = readFile(input.signaturePath);
  const publicKey = readFile(input.publicKeyPath);
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
    payload: parseObject(body),
    digest: body ? sha256(body) : null,
    signatureVerified,
    trustAnchorPinned: Boolean(
      input.expectedKeySha256 &&
        publicKey &&
        input.expectedKeySha256.trim() === sha256(publicKey),
    ),
  };
}

function semanticChecks(definition: Definition, record: OperationsAttestation | null) {
  switch (definition.version) {
    case "v2.1.0":
      return {
        continuityWitnessed:
          record?.continuity?.status === "active" &&
          typeof record.continuity.observationWindowHours === "number" &&
          record.continuity.observationWindowHours >= 24 &&
          isDigest(record.continuity.telemetryEvidenceDigest) &&
          record.continuity.incidentStatus === "no-unresolved-critical",
      };
    case "v2.1.1":
      return {
        sloWitnessed:
          record?.slo?.status === "met" &&
          typeof record.slo.observationWindowHours === "number" &&
          record.slo.observationWindowHours >= 24 &&
          isDigest(record.slo.metricsDigest) &&
          record.slo.errorBudgetStatus === "within-budget",
      };
    case "v2.1.2":
      return {
        changeAndIncidentWitnessed:
          record?.change?.status === "closed" &&
          isDigest(record.change.changeReviewDigest) &&
          isDigest(record.change.incidentLedgerDigest) &&
          record.change.unresolvedCriticalIncidents === 0,
      };
    case "v2.1.3":
      return {
        dataGovernanceWitnessed:
          isDigest(record?.data?.retentionPolicyDigest) &&
          record?.data?.deletionPropagation === "verified" &&
          record.data.auditArchiveIntegrity === "verified" &&
          record.data.unresolvedLegalHoldConflicts === 0,
      };
    case "v2.1.4":
      return {
        identityWitnessed:
          record?.identity?.accessReviewStatus === "passed" &&
          isDigest(record.identity.lifecycleEvidenceDigest) &&
          isDigest(record.identity.privilegedAccessReviewDigest) &&
          record.identity.unresolvedCriticalFindings === 0,
      };
    case "v2.1.5":
      return {
        supplyChainWitnessed:
          isDigest(record?.supplyChain?.artifactInventoryDigest) &&
          record?.supplyChain?.vulnerabilityReview === "passed" &&
          record.supplyChain.revocationStatus === "clear" &&
          record.supplyChain.unsignedArtifactCount === 0,
      };
    case "v2.1.6":
      return {
        qualityWitnessed:
          isDigest(record?.quality?.policyDigest) &&
          record?.quality?.qualityStatus === "within-policy" &&
          record.quality.safetyStatus === "passed" &&
          record.quality.driftStatus === "none",
      };
    case "v2.1.7":
      return {
        capacityWitnessed:
          isDigest(record?.capacity?.capacityPlanDigest) &&
          record?.capacity?.budgetStatus === "within-budget" &&
          record.capacity.settlementStatus === "reconciled" &&
          typeof record.capacity.headroomPct === "number" &&
          record.capacity.headroomPct >= 0,
      };
    case "v2.1.8":
      return {
        recoveryWitnessed:
          isDigest(record?.recovery?.rehearsalDigest) &&
          record?.recovery?.status === "passed" &&
          typeof record.recovery.measuredRpoMs === "number" &&
          record.recovery.measuredRpoMs >= 0 &&
          typeof record.recovery.measuredRtoMs === "number" &&
          record.recovery.measuredRtoMs > 0 &&
          record.recovery.crossRegion === "verified",
      };
    case "v2.1.9":
      return {
        independentReviewWitnessed:
          record?.review?.status === "accepted" && isDigest(record.review.reviewDigest),
      };
  }
}

function blockersFor(input: {
  checks: Record<string, boolean>;
  definition: Definition;
  finalReview: boolean;
}) {
  const { checks, definition, finalReview } = input;
  return [
    ...(!checks.present ? [`No external ${definition.label} record is supplied.`] : []),
    ...(checks.digestValid ? [] : ["The attestation digest is missing or not a SHA-256 hex digest."]),
    ...(checks.schemaBound ? [] : [`The record does not use the required ${definition.schemaVersion} schema.`]),
    ...(checks.chainBound ? [] : ["The record does not bind its required verified predecessor."]),
    ...(checks.signatureVerified ? [] : ["The detached signature is missing or invalid."]),
    ...(checks.trustAnchorPinned ? [] : ["The signer is not pinned by its configured trust anchor."]),
    ...(checks.issuerDurable ? [] : ["The issuer identity is incomplete or non-durable."]),
    ...(checks.issuerIndependentFromClosure ? [] : ["The issuer is not independent from the v2.0 closure archive issuer."]),
    ...(checks.fresh ? [] : ["The attestation is expired, future-dated, or missing timestamps."]),
    ...(checks.semantic ? [] : [`The ${definition.label} control assertions are incomplete or failed.`]),
    ...(finalReview && !checks.completeChainReviewed
      ? ["The independent review does not bind all v2.1 operational record digests in order."]
      : []),
  ];
}

/**
 * Validates externally created v2.1 post-GA operations attestations only.
 * It cannot sign records, call an operator, mutate a runtime, or change local
 * production authorization.
 */
export function buildPostGaOperationsTrainState(input: Inputs): PostGaOperationsTrainState {
  const versions: PostGaOperationsTrainState["versions"] = [];
  for (const [index, definition] of DEFINITIONS.entries()) {
    const artifact = input.artifacts[index] || {
      present: false,
      payload: null,
      digest: null,
      signatureVerified: false,
      trustAnchorPinned: false,
    };
    const predecessor = versions[index - 1];
    const record = artifact.payload;
    const closureVerified =
      input.closure.productionStatus === "blocked" &&
      input.closure.stages.closure.status === "verified" &&
      isDigest(input.closure.stages.closure.digest);
    const expectedChainDigests = versions.map((version) => version.digest);
    const checks: Record<string, boolean> = {
      present: artifact.present,
      parsed: Boolean(record),
      digestValid: isDigest(artifact.digest),
      schemaBound: record?.schemaVersion === definition.schemaVersion,
      chainBound:
        index === 0
          ? closureVerified &&
            record?.release?.releaseVersion === "v2.0.0" &&
            record.release.closureArchiveDigest === input.closure.stages.closure.digest
          : predecessor?.evidenceStatus === "verified" &&
            record?.predecessor?.version === predecessor.version &&
            record.predecessor.digest === predecessor.digest &&
            record.predecessor.recordId === predecessor.recordId,
      signatureVerified: artifact.signatureVerified,
      trustAnchorPinned: artifact.trustAnchorPinned,
      issuerDurable:
        isDurableIdentity(record?.issuer?.organizationId) &&
        isDurableIdentity(record?.issuer?.operatorId) &&
        isDurableIdentity(record?.issuer?.keyId) &&
        isDurableIdentity(record?.recordId),
      issuerIndependentFromClosure:
        isDurableIdentity(record?.issuer?.organizationId) &&
        record?.issuer?.organizationId !== input.closure.stages.closure.issuerOrganizationId,
      fresh:
        isPastTimestamp(record?.generatedAt, input.now) &&
        isFutureTimestamp(record?.expiresAt, input.now),
      semantic: Object.values(semanticChecks(definition, record)).every(Boolean),
      completeChainReviewed:
        definition.version !== "v2.1.9" ||
        (record?.review?.chainDigests?.length === 9 &&
          record.review.chainDigests.every((value, digestIndex) => value === expectedChainDigests[digestIndex]) &&
          isDurableIdentity(record?.issuer?.organizationId) &&
          versions.every((version) => version.issuerOrganizationId !== record.issuer?.organizationId)),
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
      blockers: blockersFor({ checks, definition, finalReview: definition.version === "v2.1.9" }),
      externalBlocker: definition.externalBlocker,
    });
  }
  const verifiedVersions = versions.filter((version) => version.evidenceStatus === "verified").length;
  const withoutDigest = {
    sourceStatus: "pass" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    versions,
    summary: {
      verifiedVersions,
      requiredVersions: 10 as const,
      chainComplete: verifiedVersions === 10,
      closureArchiveVerified:
        input.closure.stages.closure.status === "verified" && isDigest(input.closure.stages.closure.digest),
    },
    blockers: [
      ...versions.flatMap((version) => version.blockers),
      "All v2.1 records are external, signed inputs. This repository only projects verification and cannot authorize, operate, or alter production.",
    ],
  };
  return { ...withoutDigest, stateDigest: sha256(stableJson(withoutDigest)) };
}

function readArtifactFor(definition: Definition): SignedArtifact {
  const prefix = `FIRST_LLM_POST_GA_${definition.key}`;
  return readSignedArtifact({
    bodyPath: process.env[`${prefix}_PATH`],
    signaturePath: process.env[`${prefix}_SIGNATURE_PATH`],
    publicKeyPath: process.env[`${prefix}_PUBLIC_KEY_PATH`],
    expectedKeySha256: process.env[`${prefix}_KEY_SHA256`]?.trim(),
  });
}

export function readPostGaOperationsTrain() {
  const closure = readProductionLifecycleClosure();
  const artifacts = DEFINITIONS.map(readArtifactFor);
  const state = buildPostGaOperationsTrainState({
    closure: {
      productionStatus: closure.productionStatus,
      stages: { closure: closure.stages.closure },
    },
    artifacts,
    now: Date.now(),
  });
  return {
    ok: true as const,
    schemaVersion: POST_GA_OPERATIONS_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...state,
    configuredVersions: DEFINITIONS.filter((_, index) => artifacts[index]?.present).map(
      (definition) => definition.version,
    ),
  };
}
