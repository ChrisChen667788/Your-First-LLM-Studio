import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  readEnterpriseIdentityAcceptanceEvidence,
  runEnterpriseIdentityAcceptance,
  type EnterpriseIdentityAcceptanceReceipt,
} from "@/features/governance/enterprise-identity-acceptance";
import {
  readQualityCiGateEvidence,
  runQualityCiGateRehearsal,
  type QualityCiGateReceipt,
} from "@/features/evaluation/quality-ci-gate";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import {
  readDistributedWorkerAcceptanceEvidence,
  runDistributedWorkerAcceptance,
  type DistributedWorkerAcceptanceReceipt,
} from "@/features/workflows/distributed-worker-acceptance";
import { readProductionBridgeReadiness } from "@/features/experiments/production-bridge-readiness";

export const V14_ACCEPTANCE_BATCH_SCHEMA_VERSION =
  "experiments.v14-acceptance-batch.v1" as const;

export type V14AcceptanceSlice = {
  id: string;
  version: "v1.3.1" | "v1.4.0" | "v1.4.1";
  domain: "governance" | "workflow" | "evaluation";
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type V14AcceptanceBatchReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: V14AcceptanceSlice[];
  totals: { slices: number; passed: number; held: number };
  childReceipts: {
    governance: string;
    workflow: string;
    evaluation: string;
  };
  domainProductionBlockers: {
    governance: string[];
    workflow: string[];
    evaluation: string[];
  };
  productionBlockers: string[];
  evidenceDigest: string;
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(DATA_DIR, "v1.4-local-acceptance-batch.json");

const SLICE_DEFINITIONS = [
  ["governance.oidc-issuer-pin", "v1.4.0", "governance", "OIDC issuer pin", "oidcIssuerPinned"],
  ["governance.jwks-rotation", "v1.4.0", "governance", "JWKS overlap rotation", "jwksRotationSafe"],
  ["governance.signed-delivery", "v1.4.0", "governance", "Signed identity delivery", "signedDeliveryAccepted"],
  ["governance.replay-denial", "v1.4.0", "governance", "Identity replay denial", "replayDeliveryDenied"],
  ["governance.deprovision-audit", "v1.4.0", "governance", "Deprovision and audit", "deprovisionAndAuditEnforced"],
  ["workflow.exclusive-lease", "v1.3.1", "workflow", "Exclusive execution lease", "exclusiveLease"],
  ["workflow.expired-recovery", "v1.3.1", "workflow", "Expired lease recovery", "expiredLeaseRecovered"],
  ["workflow.stale-fencing", "v1.3.1", "workflow", "Stale worker fencing", "staleWorkerFenced"],
  ["workflow.heartbeat", "v1.3.1", "workflow", "Lease heartbeat extension", "heartbeatExtended"],
  ["workflow.recovery-receipt", "v1.3.1", "workflow", "Recovery receipt completeness", "recoveryReceiptComplete"],
  ["evaluation.frozen-manifest", "v1.4.1", "evaluation", "Frozen artifact manifest", "frozenManifestPinned"],
  ["evaluation.multi-seed", "v1.4.1", "evaluation", "Multi-seed coverage", "multiSeedCoverage"],
  ["evaluation.paired-confidence", "v1.4.1", "evaluation", "Paired confidence gate", "pairedConfidencePass"],
  ["evaluation.judge-calibration", "v1.4.1", "evaluation", "Judge calibration", "judgeCalibrated"],
  ["evaluation.reproducible-decision", "v1.4.1", "evaluation", "Reproducible CI decision", "ciDecisionReproducible"],
] as const;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildSlices(
  governance: EnterpriseIdentityAcceptanceReceipt,
  workflow: DistributedWorkerAcceptanceReceipt,
  evaluation: QualityCiGateReceipt,
) {
  const checks = {
    ...governance.checks,
    ...workflow.checks,
    ...evaluation.checks,
  } as Record<string, boolean>;
  return SLICE_DEFINITIONS.map(([id, version, domain, label, check]) => ({
    id,
    version,
    domain,
    label,
    status: checks[check] ? "pass" as const : "hold" as const,
    summary: checks[check]
      ? `${label} passed the local contract rehearsal.`
      : `${label} requires additional local evidence.`,
  }));
}

export function runV14AcceptanceBatch() {
  const governance = runEnterpriseIdentityAcceptance();
  const workflow = runDistributedWorkerAcceptance();
  const evaluation = runQualityCiGateRehearsal();
  const slices = buildSlices(governance, workflow, evaluation);
  const productionBlockers = unique([
    ...governance.productionBlockers,
    ...workflow.productionBlockers,
    ...evaluation.productionBlockers,
  ]);
  const domainProductionBlockers = {
    governance: governance.productionBlockers,
    workflow: workflow.productionBlockers,
    evaluation: evaluation.productionBlockers,
  };
  const digestInput = {
    slices: slices.map(({ id, status }) => ({ id, status })),
    childReceipts: [governance.id, workflow.id, evaluation.id],
  };
  const receipt: V14AcceptanceBatchReceipt = {
    id: `v14-acceptance-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: slices.every((slice) => slice.status === "pass") ? "pass" : "hold",
    localStatus: slices.every((slice) => slice.status === "pass") ? "pass" : "hold",
    productionStatus: "hold",
    slices,
    totals: {
      slices: slices.length,
      passed: slices.filter((slice) => slice.status === "pass").length,
      held: slices.filter((slice) => slice.status === "hold").length,
    },
    childReceipts: {
      governance: governance.id,
      workflow: workflow.id,
      evaluation: evaluation.id,
    },
    domainProductionBlockers,
    productionBlockers,
    evidenceDigest: createHash("sha256")
      .update(JSON.stringify(digestInput))
      .digest("hex"),
  };
  prependDurableReceipt(
    STORE_FILE,
    V14_ACCEPTANCE_BATCH_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readV14AcceptanceBatchEvidence() {
  const receipts = readDurableReceipts<V14AcceptanceBatchReceipt>(
    STORE_FILE,
    V14_ACCEPTANCE_BATCH_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  const latestPassing =
    receipts.find((receipt) => receipt.localStatus === "pass") || null;
  const fallbackDomainBlockers = {
    governance: readEnterpriseIdentityAcceptanceEvidence().productionBlockers,
    workflow: readDistributedWorkerAcceptanceEvidence().productionBlockers,
    evaluation: readQualityCiGateEvidence().productionBlockers,
  };
  return {
    ok: true as const,
    schemaVersion: V14_ACCEPTANCE_BATCH_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus: latestPassing ? "pass" as const : "evidence-needed" as const,
    productionStatus: "hold" as const,
    latest,
    latestPassing,
    receipts,
    totals: latest?.totals || { slices: 15, passed: 0, held: 15 },
    domainProductionBlockers:
      latest?.domainProductionBlockers || fallbackDomainBlockers,
    productionBlockers: latest?.productionBlockers || unique([
      ...fallbackDomainBlockers.governance,
      ...fallbackDomainBlockers.workflow,
      ...fallbackDomainBlockers.evaluation,
    ]),
    productionBridges: readProductionBridgeReadiness(),
    path: STORE_FILE,
  };
}
