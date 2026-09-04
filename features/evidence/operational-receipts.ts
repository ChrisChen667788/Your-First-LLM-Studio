import { createHash, randomUUID } from "node:crypto";

import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION =
  "evidence.operational-candidate.v1" as const;
const STORE_SCHEMA_VERSION = "evidence.operational-candidate-store.v1" as const;
const STORE_PATH = getLocalAgentDataPath(
  "experiments",
  "v4.0.0-v4.1.4-operational-evidence-candidates.json",
);
const RECEIPT_KEYS = new Set([
  "schemaVersion",
  "milestone",
  "subjectId",
  "environment",
  "workloadDigest",
  "artifactDigests",
  "startedAt",
  "completedAt",
  "outcome",
  "metrics",
  "operator",
  "predecessorDigest",
]);
const OPERATOR_KEYS = new Set(["organizationId", "operatorId"]);

export type EvidenceOperationStatus = "pass" | "hold";

export type EvidenceOperationMilestoneSpec = {
  version: string;
  label: string;
  owner: string;
  track: "provider" | "agent" | "evaluation" | "models" | "runtime" | "rag" | "finetune" | "governance" | "release";
  contract: string;
  requiredMetrics: string[];
  currentSignal: {
    status: EvidenceOperationStatus;
    summary: string;
    evidenceDigest: string;
  };
  localGate: string;
  externalGate: string;
};

export type OperationalEvidenceReceipt = {
  schemaVersion?: string;
  milestone?: string;
  subjectId?: string;
  environment?: "local" | "managed" | "independent";
  workloadDigest?: string;
  artifactDigests?: string[];
  startedAt?: string;
  completedAt?: string;
  outcome?: "pass" | "failed";
  metrics?: Record<string, number>;
  operator?: {
    organizationId?: string;
    operatorId?: string;
  };
  predecessorDigest?: string;
};

export type OperationalEvidenceValidation = {
  ok: boolean;
  schemaVersion: "evidence.operational-candidate-validation.v1";
  milestone: string | null;
  checks: Record<string, boolean>;
  blockers: string[];
  externalSignaturePending: true;
  productionTransitionDenied: true;
};

export type StoredOperationalEvidenceCandidate = {
  id: string;
  receivedAt: string;
  receipt: Required<Omit<OperationalEvidenceReceipt, "predecessorDigest">> & {
    predecessorDigest?: string;
  };
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

export function operationalEvidenceDigest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function isDigest(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function onlyKeys(value: unknown, keys: Set<string>) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).every((key) => keys.has(key)),
  );
}

function durableIdentity(value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return (
    /^[a-z0-9][a-z0-9._:@/-]{2,127}$/iu.test(normalized) &&
    !/^(?:demo|fixture|local|test|unknown)(?:[-_.:]|$)/iu.test(normalized)
  );
}

export function validateOperationalEvidenceReceipt(input: {
  receipt: unknown;
  spec: EvidenceOperationMilestoneSpec;
  now?: Date;
}): OperationalEvidenceValidation {
  const now = input.now || new Date();
  const receipt = (
    input.receipt && typeof input.receipt === "object" && !Array.isArray(input.receipt)
      ? input.receipt
      : {}
  ) as OperationalEvidenceReceipt;
  const startedAt = Date.parse(receipt.startedAt || "");
  const completedAt = Date.parse(receipt.completedAt || "");
  const metrics = receipt.metrics && typeof receipt.metrics === "object" && !Array.isArray(receipt.metrics)
    ? receipt.metrics
    : {};
  const metricValuesValid = Object.values(metrics).every(
    (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
  const checks = {
    strictTopLevelSchema: onlyKeys(input.receipt, RECEIPT_KEYS),
    schemaVersion: receipt.schemaVersion === OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION,
    milestone: receipt.milestone === input.spec.version,
    subjectId: typeof receipt.subjectId === "string" && receipt.subjectId.trim().length >= 3,
    environment: ["local", "managed", "independent"].includes(receipt.environment || ""),
    workloadDigest: isDigest(receipt.workloadDigest),
    artifactDigests:
      Array.isArray(receipt.artifactDigests) &&
      receipt.artifactDigests.length > 0 &&
      receipt.artifactDigests.every(isDigest),
    timestamps: Number.isFinite(startedAt) && Number.isFinite(completedAt),
    orderedWindow:
      Number.isFinite(startedAt) &&
      Number.isFinite(completedAt) &&
      completedAt >= startedAt &&
      completedAt - startedAt <= 24 * 60 * 60 * 1000,
    fresh:
      Number.isFinite(completedAt) &&
      completedAt <= now.getTime() + 5 * 60 * 1000 &&
      now.getTime() - completedAt <= 7 * 24 * 60 * 60 * 1000,
    passingOutcome: receipt.outcome === "pass",
    metricsObject: Boolean(receipt.metrics && typeof receipt.metrics === "object" && !Array.isArray(receipt.metrics)),
    metricValues: metricValuesValid,
    requiredMetrics: input.spec.requiredMetrics.every((metric) => Object.hasOwn(metrics, metric)),
    strictOperator: onlyKeys(receipt.operator, OPERATOR_KEYS),
    durableOperator:
      durableIdentity(receipt.operator?.organizationId) &&
      durableIdentity(receipt.operator?.operatorId),
    predecessorDigest:
      receipt.predecessorDigest === undefined || isDigest(receipt.predecessorDigest),
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Receipt check failed: ${check}.`);
  return {
    ok: blockers.length === 0,
    schemaVersion: "evidence.operational-candidate-validation.v1",
    milestone: typeof receipt.milestone === "string" ? receipt.milestone : null,
    checks,
    blockers,
    externalSignaturePending: true,
    productionTransitionDenied: true,
  };
}

export function readOperationalEvidenceCandidates() {
  return readDurableReceipts<StoredOperationalEvidenceCandidate>(
    STORE_PATH,
    STORE_SCHEMA_VERSION,
  );
}

export function recordOperationalEvidenceCandidate(input: {
  receipt: unknown;
  spec: EvidenceOperationMilestoneSpec;
  now?: Date;
}) {
  const validation = validateOperationalEvidenceReceipt(input);
  if (!validation.ok) {
    throw new Error(validation.blockers.join(" "));
  }
  const normalized = input.receipt as StoredOperationalEvidenceCandidate["receipt"];
  const withoutDigest = {
    id: `operational-evidence-${randomUUID()}`,
    receivedAt: (input.now || new Date()).toISOString(),
    receipt: normalized,
  };
  const candidate: StoredOperationalEvidenceCandidate = {
    ...withoutDigest,
    evidenceDigest: operationalEvidenceDigest(withoutDigest),
  };
  prependDurableReceipt(STORE_PATH, STORE_SCHEMA_VERSION, candidate, 200);
  return { candidate, validation };
}

export function operationalEvidenceCandidatePath() {
  return STORE_PATH;
}
