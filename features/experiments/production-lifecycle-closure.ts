import { createHash, verify as verifySignature } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { readReleaseAuthorityDecisionLedger } from "@/features/experiments/release-authority-decision-ledger";

export const PRODUCTION_LIFECYCLE_CLOSURE_SCHEMA_VERSION =
  "experiments.production-lifecycle-closure.v1" as const;

type StageStatus = "missing" | "invalid" | "verified";
type Attestor = {
  organizationId?: string;
  operatorId?: string;
  keyId?: string;
};
type TransitionWitness = {
  schemaVersion?: string;
  witnessId?: string;
  generatedAt?: string;
  expiresAt?: string;
  decision?: { digest?: string; decisionId?: string; releaseVersion?: string };
  transition?: {
    environment?: string;
    outcome?: string;
    controlPlaneRevision?: string;
    multiRegionFailover?: boolean;
    targetIsolation?: boolean;
    postDeployHealth?: boolean;
  };
  issuer?: Attestor;
};
type RollbackWitness = {
  schemaVersion?: string;
  witnessId?: string;
  generatedAt?: string;
  expiresAt?: string;
  transition?: { digest?: string; witnessId?: string; releaseVersion?: string };
  rollback?: {
    planId?: string;
    planDigest?: string;
    rehearsal?: string;
    measuredRpoMs?: number;
    measuredRtoMs?: number;
  };
  issuer?: Attestor;
};
type ClosureArchive = {
  schemaVersion?: string;
  archiveId?: string;
  generatedAt?: string;
  expiresAt?: string;
  closure?: { status?: string; releaseVersion?: string };
  chain?: {
    decisionDigest?: string;
    transitionDigest?: string;
    rollbackDigest?: string;
  };
  issuer?: Attestor;
};
type SignedArtifact<T> = {
  present: boolean;
  payload: T | null;
  digest: string | null;
  signatureVerified: boolean;
  trustAnchorPinned: boolean;
};
type DecisionInput = {
  decisionStatus: "missing" | "invalid" | "approved" | "rejected";
  decisionDigest: string | null;
  issuerOrganizationId: string | null;
  evidenceIssuerOrganizationId: string | null;
};

export type ProductionLifecycleClosureState = {
  productionStatus: "blocked";
  stages: {
    transition: StageState;
    rollback: StageState;
    closure: StageState;
  };
  summary: {
    verifiedStages: number;
    requiredStages: 3;
    chainComplete: boolean;
  };
  blockers: string[];
};
type StageState = {
  status: StageStatus;
  digest: string | null;
  issuerOrganizationId: string | null;
  checks: Record<string, boolean>;
  blockers: string[];
};
type Inputs = {
  decision: DecisionInput;
  transition: SignedArtifact<TransitionWitness>;
  rollback: SignedArtifact<RollbackWitness>;
  closure: SignedArtifact<ClosureArchive>;
  now: number;
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

function parseObject<T>(bytes: Buffer | null): T | null {
  if (!bytes) return null;
  try {
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as T)
      : null;
  } catch {
    return null;
  }
}

function readSignedArtifact<T>(input: {
  bodyPath?: string;
  signaturePath?: string;
  publicKeyPath?: string;
  expectedKeySha256?: string;
}): SignedArtifact<T> {
  const body = readFile(input.bodyPath);
  const signature = readFile(input.signaturePath);
  const publicKey = readFile(input.publicKeyPath);
  const actualKeySha256 = publicKey ? sha256(publicKey) : "";
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
    payload: parseObject<T>(body),
    digest: body ? sha256(body) : null,
    signatureVerified,
    trustAnchorPinned: Boolean(
      input.expectedKeySha256 &&
        actualKeySha256 &&
        input.expectedKeySha256 === actualKeySha256,
    ),
  };
}

function stageState(input: {
  status: StageStatus;
  artifact: { digest: string | null; payload: { issuer?: Attestor } | null };
  checks: Record<string, boolean>;
  blockers: string[];
}): StageState {
  return {
    status: input.status,
    digest: input.artifact.digest,
    issuerOrganizationId: input.artifact.payload?.issuer?.organizationId || null,
    checks: input.checks,
    blockers: input.blockers,
  };
}

function transitionState(input: Inputs): StageState {
  const artifact = input.transition;
  const witness = artifact.payload;
  const checks = {
    present: artifact.present,
    parsed: Boolean(witness),
    approvedDecisionBound:
      input.decision.decisionStatus === "approved" && isDigest(input.decision.decisionDigest),
    schemaAndDecisionBound:
      witness?.schemaVersion === "enterprise.external-transition-witness.v1" &&
      witness.decision?.releaseVersion === "v2.0.0" &&
      witness.decision?.digest === input.decision.decisionDigest &&
      isDurableIdentity(witness.decision?.decisionId),
    signatureVerified: artifact.signatureVerified,
    trustAnchorPinned: artifact.trustAnchorPinned,
    issuerDurable:
      isDurableIdentity(witness?.issuer?.organizationId) &&
      isDurableIdentity(witness?.issuer?.operatorId) &&
      isDurableIdentity(witness?.issuer?.keyId),
    issuerIndependent:
      isDurableIdentity(witness?.issuer?.organizationId) &&
      isDurableIdentity(input.decision.issuerOrganizationId) &&
      witness?.issuer?.organizationId !== input.decision.issuerOrganizationId,
    fresh:
      isPastTimestamp(witness?.generatedAt, input.now) &&
      isFutureTimestamp(witness?.expiresAt, input.now),
    transitionWitnessed:
      witness?.transition?.environment === "production" &&
      witness.transition?.outcome === "completed" &&
      isDurableIdentity(witness.transition?.controlPlaneRevision) &&
      witness.transition?.multiRegionFailover === true &&
      witness.transition?.targetIsolation === true &&
      witness.transition?.postDeployHealth === true,
    localPromotionDenied: true,
  };
  const verified = Object.values(checks).every(Boolean);
  return stageState({
    status: !checks.present ? "missing" : verified ? "verified" : "invalid",
    artifact,
    checks,
    blockers: [
      ...(!checks.present ? ["No external transition witness is supplied."] : []),
      ...(checks.schemaAndDecisionBound ? [] : ["The transition witness does not bind the approved v2.0.0 decision."]),
      ...(checks.signatureVerified ? [] : ["The transition witness signature is missing or invalid."]),
      ...(checks.trustAnchorPinned ? [] : ["The transition witness signer is not pinned."]),
      ...(checks.issuerIndependent ? [] : ["The transition witness issuer is not independent from the decision issuer."]),
      ...(checks.transitionWitnessed ? [] : ["The witness does not prove production outcome, failover, isolation, and health checks."]),
    ],
  });
}

function rollbackState(input: Inputs, transition: StageState): StageState {
  const artifact = input.rollback;
  const witness = artifact.payload;
  const checks = {
    present: artifact.present,
    parsed: Boolean(witness),
    transitionBound: transition.status === "verified" && isDigest(transition.digest),
    schemaAndTransitionBound:
      witness?.schemaVersion === "enterprise.independent-rollback-witness.v1" &&
      witness.transition?.releaseVersion === "v2.0.0" &&
      witness.transition?.digest === transition.digest &&
      isDurableIdentity(witness.transition?.witnessId),
    signatureVerified: artifact.signatureVerified,
    trustAnchorPinned: artifact.trustAnchorPinned,
    issuerDurable:
      isDurableIdentity(witness?.issuer?.organizationId) &&
      isDurableIdentity(witness?.issuer?.operatorId) &&
      isDurableIdentity(witness?.issuer?.keyId),
    issuerIndependent:
      isDurableIdentity(witness?.issuer?.organizationId) &&
      witness?.issuer?.organizationId !== transition.issuerOrganizationId &&
      witness?.issuer?.organizationId !== input.decision.issuerOrganizationId &&
      witness?.issuer?.organizationId !== input.decision.evidenceIssuerOrganizationId,
    fresh:
      isPastTimestamp(witness?.generatedAt, input.now) &&
      isFutureTimestamp(witness?.expiresAt, input.now),
    rollbackWitnessed:
      isDurableIdentity(witness?.rollback?.planId) &&
      isDigest(witness?.rollback?.planDigest) &&
      witness?.rollback?.rehearsal === "passed" &&
      typeof witness.rollback?.measuredRpoMs === "number" &&
      witness.rollback.measuredRpoMs >= 0 &&
      typeof witness.rollback?.measuredRtoMs === "number" &&
      witness.rollback.measuredRtoMs > 0,
    localPromotionDenied: true,
  };
  const verified = Object.values(checks).every(Boolean);
  return stageState({
    status: !checks.present ? "missing" : verified ? "verified" : "invalid",
    artifact,
    checks,
    blockers: [
      ...(!checks.present ? ["No independent rollback witness is supplied."] : []),
      ...(checks.schemaAndTransitionBound ? [] : ["The rollback witness does not bind the verified transition witness."]),
      ...(checks.signatureVerified ? [] : ["The rollback witness signature is missing or invalid."]),
      ...(checks.trustAnchorPinned ? [] : ["The rollback witness signer is not pinned."]),
      ...(checks.issuerIndependent ? [] : ["The rollback witness issuer is not independent from transition and decision issuers."]),
      ...(checks.rollbackWitnessed ? [] : ["The rollback witness lacks a passed rehearsal with RPO/RTO and immutable plan digest."]),
    ],
  });
}

function closureState(input: Inputs, transition: StageState, rollback: StageState): StageState {
  const artifact = input.closure;
  const archive = artifact.payload;
  const checks = {
    present: artifact.present,
    parsed: Boolean(archive),
    upstreamVerified:
      input.decision.decisionStatus === "approved" &&
      transition.status === "verified" &&
      rollback.status === "verified",
    schemaAndChainBound:
      archive?.schemaVersion === "enterprise.release-closure-archive.v1" &&
      archive.closure?.status === "closed" &&
      archive.closure?.releaseVersion === "v2.0.0" &&
      archive.chain?.decisionDigest === input.decision.decisionDigest &&
      archive.chain?.transitionDigest === transition.digest &&
      archive.chain?.rollbackDigest === rollback.digest,
    signatureVerified: artifact.signatureVerified,
    trustAnchorPinned: artifact.trustAnchorPinned,
    issuerDurable:
      isDurableIdentity(archive?.issuer?.organizationId) &&
      isDurableIdentity(archive?.issuer?.operatorId) &&
      isDurableIdentity(archive?.issuer?.keyId),
    issuerIndependent:
      isDurableIdentity(archive?.issuer?.organizationId) &&
      archive?.issuer?.organizationId !== input.decision.issuerOrganizationId &&
      archive?.issuer?.organizationId !== transition.issuerOrganizationId &&
      archive?.issuer?.organizationId !== rollback.issuerOrganizationId &&
      archive?.issuer?.organizationId !== input.decision.evidenceIssuerOrganizationId,
    fresh:
      isPastTimestamp(archive?.generatedAt, input.now) &&
      isFutureTimestamp(archive?.expiresAt, input.now),
    archiveIdentityBound: isDurableIdentity(archive?.archiveId),
    localPromotionDenied: true,
  };
  const verified = Object.values(checks).every(Boolean);
  return stageState({
    status: !checks.present ? "missing" : verified ? "verified" : "invalid",
    artifact,
    checks,
    blockers: [
      ...(!checks.present ? ["No release-closure archive is supplied."] : []),
      ...(checks.schemaAndChainBound ? [] : ["The closure archive does not bind the approved decision and verified witness chain."]),
      ...(checks.signatureVerified ? [] : ["The closure archive signature is missing or invalid."]),
      ...(checks.trustAnchorPinned ? [] : ["The closure archive signer is not pinned."]),
      ...(checks.issuerIndependent ? [] : ["The closure archive issuer is not independent from prior release authorities."]),
      ...(checks.archiveIdentityBound ? [] : ["The closure archive lacks a durable archive id."]),
    ],
  });
}

/** Validates all v2.0.3–v2.0.5 artifacts; it never changes production state. */
export function buildProductionLifecycleClosureState(
  input: Inputs,
): ProductionLifecycleClosureState {
  const transition = transitionState(input);
  const rollback = rollbackState(input, transition);
  const closure = closureState(input, transition, rollback);
  const stages = { transition, rollback, closure };
  const verifiedStages = Object.values(stages).filter(
    (stage) => stage.status === "verified",
  ).length;
  return {
    productionStatus: "blocked",
    stages,
    summary: {
      verifiedStages,
      requiredStages: 3,
      chainComplete: verifiedStages === 3,
    },
    blockers: [
      ...transition.blockers,
      ...rollback.blockers,
      ...closure.blockers,
      "The local studio validates a release-lifecycle chain only; production authorization and execution remain external.",
    ],
  };
}

export function readProductionLifecycleClosure() {
  const transition = readSignedArtifact<TransitionWitness>({
    bodyPath: process.env.FIRST_LLM_TRANSITION_WITNESS_PATH,
    signaturePath: process.env.FIRST_LLM_TRANSITION_WITNESS_SIGNATURE_PATH,
    publicKeyPath: process.env.FIRST_LLM_TRANSITION_WITNESS_PUBLIC_KEY_PATH,
    expectedKeySha256: process.env.FIRST_LLM_TRANSITION_WITNESS_KEY_SHA256?.trim(),
  });
  const rollback = readSignedArtifact<RollbackWitness>({
    bodyPath: process.env.FIRST_LLM_ROLLBACK_WITNESS_PATH,
    signaturePath: process.env.FIRST_LLM_ROLLBACK_WITNESS_SIGNATURE_PATH,
    publicKeyPath: process.env.FIRST_LLM_ROLLBACK_WITNESS_PUBLIC_KEY_PATH,
    expectedKeySha256: process.env.FIRST_LLM_ROLLBACK_WITNESS_KEY_SHA256?.trim(),
  });
  const closure = readSignedArtifact<ClosureArchive>({
    bodyPath: process.env.FIRST_LLM_RELEASE_CLOSURE_ARCHIVE_PATH,
    signaturePath: process.env.FIRST_LLM_RELEASE_CLOSURE_ARCHIVE_SIGNATURE_PATH,
    publicKeyPath: process.env.FIRST_LLM_RELEASE_CLOSURE_ARCHIVE_PUBLIC_KEY_PATH,
    expectedKeySha256: process.env.FIRST_LLM_RELEASE_CLOSURE_ARCHIVE_KEY_SHA256?.trim(),
  });
  const decision = readReleaseAuthorityDecisionLedger();
  const state = buildProductionLifecycleClosureState({
    decision: {
      decisionStatus: decision.decisionStatus,
      decisionDigest: decision.decisionDigest,
      issuerOrganizationId: decision.summary.issuerOrganizationId,
      evidenceIssuerOrganizationId: decision.evidenceIssuerOrganizationId,
    },
    transition,
    rollback,
    closure,
    now: Date.now(),
  });
  return {
    ok: true as const,
    schemaVersion: PRODUCTION_LIFECYCLE_CLOSURE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...state,
    configured: {
      transition: transition.present,
      rollback: rollback.present,
      closure: closure.present,
    },
  };
}
