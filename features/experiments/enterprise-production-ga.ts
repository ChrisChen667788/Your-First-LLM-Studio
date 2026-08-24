import { createHash, randomUUID } from "node:crypto";

import { readDesktopExternalAcceptance } from "@/features/desktop/external-acceptance";
import { readEnterpriseControlPlaneCandidateEvidence } from "@/features/deployment/enterprise-control-plane-candidate";
import { buildGaReleaseEvidenceBundle } from "@/features/experiments/ga-release-evidence-bundle";
import { readExternalProductionReadiness } from "@/features/experiments/external-production-readiness";
import { readProductionEvidenceAuthority } from "@/features/experiments/production-evidence-authority";
import { readReleaseAuthorityDecisionLedger } from "@/features/experiments/release-authority-decision-ledger";
import { readProductionLifecycleClosure } from "@/features/experiments/production-lifecycle-closure";
import { readReleaseSecurityEvidence } from "@/features/experiments/release-security-evidence";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const ENTERPRISE_PRODUCTION_GA_SCHEMA_VERSION =
  "experiments.enterprise-production-ga.v1" as const;
const STORE_SCHEMA_VERSION =
  "experiments.enterprise-production-ga-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v2.0.0-enterprise-production-ga.json",
);

type LocalStatus = "pass" | "hold";

type Inputs = {
  controlPlane: {
    localStatus: LocalStatus;
    stateDigest: string;
  };
  externalReadiness: {
    schemaVersion: string;
    status: "blocked" | "ready";
    checks: Array<{ id: string; accepted: boolean }>;
    blockers: string[];
  };
  desktopAcceptance: {
    schemaVersion: string;
    ready: boolean;
    checks: Record<string, boolean>;
    blockers: string[];
  };
  releaseSecurity: {
    status: "pass" | "evidence-needed" | "blocked";
    integrity: { status: "verified" | "invalid" | "missing" };
  };
  releaseBundle: {
    productionReadiness: { status: string };
    integrity: { verified: boolean; digest: string };
  };
  evidenceAuthority: {
    schemaVersion: string;
    evidenceStatus: "missing" | "invalid" | "verified";
    productionStatus: "blocked";
  };
  releaseDecision: {
    schemaVersion: string;
    decisionStatus: "missing" | "invalid" | "approved" | "rejected";
    productionStatus: "blocked";
  };
  lifecycle: {
    schemaVersion: string;
    productionStatus: "blocked";
    stages: {
      transition: { status: "missing" | "invalid" | "verified" };
      rollback: { status: "missing" | "invalid" | "verified" };
      closure: { status: "missing" | "invalid" | "verified" };
    };
  };
};

export type EnterpriseProductionGaState = {
  localStatus: LocalStatus;
  externalStatus: "hold";
  productionStatus: "blocked";
  checks: {
    controlPlaneCandidateBound: boolean;
    controlPlaneStateDigestBound: boolean;
    releaseEvidenceIntegrityBound: boolean;
    releaseSecurityIntegrityVerified: boolean;
    externalReadinessContractBound: boolean;
    desktopAcceptanceContractBound: boolean;
    evidenceAuthorityContractBound: boolean;
    releaseDecisionLedgerContractBound: boolean;
    lifecycleClosureContractBound: boolean;
    localPromotionDenied: true;
  };
  externalGates: {
    managedIdentityDataAndTelemetry: boolean;
    independentDesktopDistribution: boolean;
    independentMultiRegionFailover: false;
    independentBillingSettlement: false;
    independentSecurityAssessment: false;
    organizationSignoff: false;
    productionEvidenceBundleVerified: boolean;
    externalReleaseDecisionApproved: boolean;
    externalTransitionWitnessVerified: boolean;
    externalRollbackWitnessVerified: boolean;
    externalClosureArchiveVerified: boolean;
  };
  summary: {
    controlPlaneStatus: LocalStatus;
    externalReadinessStatus: "blocked" | "ready";
    desktopAcceptanceReady: boolean;
    releaseSecurityStatus: Inputs["releaseSecurity"]["status"];
    releaseBundleProductionStatus: string;
    productionEvidenceBundleStatus: Inputs["evidenceAuthority"]["evidenceStatus"];
    externalReleaseDecisionStatus: Inputs["releaseDecision"]["decisionStatus"];
    lifecycleVerifiedStages: number;
    localChecksPassed: number;
    localChecksTotal: number;
  };
  blockers: string[];
  stateDigest: string;
};

export type EnterpriseProductionGaReceipt = EnterpriseProductionGaState & {
  id: string;
  generatedAt: string;
  evidenceDigest: string;
};

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

function digest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

/**
 * Source-owned reconciliation only. Production remains blocked even if callers
 * construct a fully passing local fixture: independent receipts must be checked
 * by the externally controlled release authority, not by this process.
 */
export function buildEnterpriseProductionGaState(
  input: Inputs,
): EnterpriseProductionGaState {
  const checks = {
    controlPlaneCandidateBound: input.controlPlane.localStatus === "pass",
    controlPlaneStateDigestBound: /^[a-f0-9]{64}$/iu.test(
      input.controlPlane.stateDigest,
    ),
    releaseEvidenceIntegrityBound:
      input.releaseBundle.integrity.verified &&
      /^[a-f0-9]{64}$/iu.test(input.releaseBundle.integrity.digest),
    releaseSecurityIntegrityVerified:
      input.releaseSecurity.status === "pass" &&
      input.releaseSecurity.integrity.status === "verified",
    externalReadinessContractBound:
      input.externalReadiness.schemaVersion ===
        "experiments.external-production-readiness.v1" &&
      input.externalReadiness.checks.length >= 5,
    desktopAcceptanceContractBound:
      input.desktopAcceptance.schemaVersion === "desktop.external-acceptance.v1" &&
      Object.keys(input.desktopAcceptance.checks).length >= 6,
    evidenceAuthorityContractBound:
      input.evidenceAuthority.schemaVersion ===
        "experiments.production-evidence-authority.v1" &&
      input.evidenceAuthority.productionStatus === "blocked",
    releaseDecisionLedgerContractBound:
      input.releaseDecision.schemaVersion ===
        "experiments.release-authority-decision-ledger.v1" &&
      input.releaseDecision.productionStatus === "blocked",
    lifecycleClosureContractBound:
      input.lifecycle.schemaVersion === "experiments.production-lifecycle-closure.v1" &&
      input.lifecycle.productionStatus === "blocked",
    localPromotionDenied: true as const,
  };
  const localCheckValues = Object.values(checks).filter(Boolean);
  const externalGates = {
    managedIdentityDataAndTelemetry: input.externalReadiness.status === "ready",
    independentDesktopDistribution: input.desktopAcceptance.ready,
    independentMultiRegionFailover: false as const,
    independentBillingSettlement: false as const,
    independentSecurityAssessment: false as const,
    organizationSignoff: false as const,
    productionEvidenceBundleVerified:
      input.evidenceAuthority.evidenceStatus === "verified",
    externalReleaseDecisionApproved:
      input.releaseDecision.decisionStatus === "approved",
    externalTransitionWitnessVerified:
      input.lifecycle.stages.transition.status === "verified",
    externalRollbackWitnessVerified:
      input.lifecycle.stages.rollback.status === "verified",
    externalClosureArchiveVerified:
      input.lifecycle.stages.closure.status === "verified",
  };
  const localBlockers = [
    ...(checks.controlPlaneCandidateBound
      ? []
      : ["The v1.12.0 control-plane candidate has no current passing local reconciliation."]),
    ...(checks.controlPlaneStateDigestBound
      ? []
      : ["The v1.12.0 control-plane candidate state digest is missing or invalid."]),
    ...(checks.releaseEvidenceIntegrityBound
      ? []
      : ["The local GA evidence bundle is missing or its integrity digest is invalid."]),
    ...(checks.releaseSecurityIntegrityVerified
      ? []
      : ["The release-security preflight is not fresh and integrity-verified."]),
    ...(checks.externalReadinessContractBound
      ? []
      : ["The external-production readiness contract is incomplete."]),
    ...(checks.desktopAcceptanceContractBound
      ? []
      : ["The desktop external-acceptance contract is incomplete."]),
    ...(checks.evidenceAuthorityContractBound
      ? []
      : ["The independent production evidence-authority contract is incomplete."]),
    ...(checks.releaseDecisionLedgerContractBound
      ? []
      : ["The external release-authority decision-ledger contract is incomplete."]),
    ...(checks.lifecycleClosureContractBound
      ? []
      : ["The external transition, rollback, and closure lifecycle contract is incomplete."]),
  ];
  const blockers = [
    ...localBlockers,
    ...(!externalGates.managedIdentityDataAndTelemetry
      ? input.externalReadiness.blockers.slice(0, 5)
      : []),
    ...(!externalGates.independentDesktopDistribution
      ? input.desktopAcceptance.blockers.slice(0, 3)
      : []),
    ...(!externalGates.productionEvidenceBundleVerified
      ? ["No complete independently signed production evidence bundle is verified."]
      : []),
    ...(!externalGates.externalReleaseDecisionApproved
      ? ["No valid independent release-authority approval is available for projection."]
      : []),
    ...(!externalGates.externalTransitionWitnessVerified
      ? ["No independently signed external transition witness is verified."]
      : []),
    ...(!externalGates.externalRollbackWitnessVerified
      ? ["No independently signed rollback witness is verified."]
      : []),
    ...(!externalGates.externalClosureArchiveVerified
      ? ["No independently signed release-closure archive is verified."]
      : []),
    "Independent multi-region failover, billing settlement, security assessment, and organization sign-off receipts are not imported by this local process.",
    "Production promotion is intentionally disabled: no local smoke, fixture, preview, or reconciliation receipt can change v2.0.0 to ready.",
  ];
  const withoutDigest = {
    localStatus: localBlockers.length === 0 ? ("pass" as const) : ("hold" as const),
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    checks,
    externalGates,
    summary: {
      controlPlaneStatus: input.controlPlane.localStatus,
      externalReadinessStatus: input.externalReadiness.status,
      desktopAcceptanceReady: input.desktopAcceptance.ready,
      releaseSecurityStatus: input.releaseSecurity.status,
      releaseBundleProductionStatus: input.releaseBundle.productionReadiness.status,
      productionEvidenceBundleStatus: input.evidenceAuthority.evidenceStatus,
      externalReleaseDecisionStatus: input.releaseDecision.decisionStatus,
      lifecycleVerifiedStages: Object.values(input.lifecycle.stages).filter(
        (stage) => stage.status === "verified",
      ).length,
      localChecksPassed: localCheckValues.length,
      localChecksTotal: Object.keys(checks).length,
    },
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState() {
  return buildEnterpriseProductionGaState({
    controlPlane: readEnterpriseControlPlaneCandidateEvidence(),
    externalReadiness: readExternalProductionReadiness(),
    desktopAcceptance: readDesktopExternalAcceptance(),
    releaseSecurity: readReleaseSecurityEvidence(),
    releaseBundle: buildGaReleaseEvidenceBundle(),
    evidenceAuthority: readProductionEvidenceAuthority(),
    releaseDecision: readReleaseAuthorityDecisionLedger(),
    lifecycle: readProductionLifecycleClosure(),
  });
}

/** Records an auditable local snapshot; it cannot create or substitute external GA receipts. */
export function recordEnterpriseProductionGaReconciliation() {
  const state = readCurrentState();
  const withoutDigest = {
    id: `enterprise-production-ga-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: EnterpriseProductionGaReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return receipt;
}

export function readEnterpriseProductionGaEvidence() {
  const receipts = readDurableReceipts<EnterpriseProductionGaReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const current = readCurrentState();
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: ENTERPRISE_PRODUCTION_GA_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
