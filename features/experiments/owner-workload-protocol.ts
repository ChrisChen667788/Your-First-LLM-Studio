import { createHash } from "node:crypto";

import type {
  RemediationExecutionAction,
  RemediationExecutionPlan,
} from "@/features/experiments/remediation-execution-source-signals";

export const OWNER_WORKLOAD_PROTOCOL_SCHEMA_VERSION =
  "experiments.owner-workload-protocol.v1" as const;
export const OWNER_WORKLOAD_REQUEST_SCHEMA_VERSION =
  "experiments.owner-workload-request.v1" as const;
export const OWNER_WORKLOAD_RECEIPT_SCHEMA_VERSION =
  "experiments.owner-workload-receipt.v1" as const;

export type OwnerWorkloadAdmissionState = "completed" | "admitted" | "blocked";

export type OwnerWorkloadRequest = {
  schemaVersion: typeof OWNER_WORKLOAD_REQUEST_SCHEMA_VERSION;
  actionId: string;
  releaseVersion: string;
  owner: string;
  admissionState: OwnerWorkloadAdmissionState;
  validation: {
    method: "GET";
    route: string;
    expectedHttpStatus: 200;
  };
  configurationGroups: string[][];
  idempotencyKey: string;
  fencingTokenDigest: string;
  upstreamEvidenceFingerprint: string;
  reviewWithinHours: number;
  escalationAfterHours: number;
  rollbackRequired: true;
  dryRunOnly: true;
  remoteMutationAllowed: false;
  requestDigest: string;
};

export type OwnerWorkloadReceipt = {
  schemaVersion?: string;
  actionId?: string;
  requestDigest?: string;
  idempotencyKey?: string;
  startedAt?: string;
  completedAt?: string;
  outcome?: string;
  primaryEvidenceDigest?: string;
  rollbackEvidenceDigest?: string;
  operator?: {
    organizationId?: string;
    operatorId?: string;
  };
};

export type OwnerWorkloadReceiptValidation = {
  ok: boolean;
  schemaVersion: "experiments.owner-workload-receipt-validation.v1";
  status: "valid-candidate" | "invalid";
  actionId: string | null;
  checks: Record<string, boolean>;
  blockers: string[];
  externalSignaturePending: true;
  externalAssuranceRequired: true;
  productionTransitionDenied: true;
};

export type OwnerWorkloadProtocol = {
  ok: true;
  schemaVersion: typeof OWNER_WORKLOAD_PROTOCOL_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "attention";
  productionStatus: "blocked";
  summary: {
    totalRequests: number;
    completedRequests: number;
    admittedRequests: number;
    blockedRequests: number;
  };
  checks: {
    everyActionBound: boolean;
    strictRequestDigests: boolean;
    boundedReviewAndEscalation: boolean;
    rollbackAlwaysRequired: boolean;
    dryRunOnly: true;
    remoteMutationDenied: true;
    productionTransitionDenied: true;
  };
  receiptPolicy: {
    maximumAgeHours: 168;
    maximumExecutionHours: 24;
    detachedSignatureRequired: true;
    pinnedTrustAnchorRequired: true;
    immutableArchiveRequired: true;
    selfApprovalDenied: true;
  };
  waiverPolicy: {
    maximumDurationHours: 24;
    renewalAllowed: false;
    productionOverrideAllowed: false;
    forbiddenScopes: string[];
  };
  requests: OwnerWorkloadRequest[];
  protocolDigest: string;
};

type RequestDefinition = {
  actionId: string;
  releaseVersion: string;
  configurationGroups: string[][];
};

const REQUEST_DEFINITIONS: RequestDefinition[] = [
  {
    actionId: "provider-release-probe",
    releaseVersion: "v3.4.0",
    configurationGroups: [
      ["FIRST_LLM_PROVIDER_RELEASE_TARGET"],
      ["OPENAI_API_KEY", "DEEPSEEK_API_KEY", "MINIMAX_API_KEY"],
    ],
  },
  {
    actionId: "managed-retrieval-rehearsal",
    releaseVersion: "v3.4.1",
    configurationGroups: [
      ["FIRST_LLM_ENTERPRISE_RETRIEVAL_MODE"],
      ["DATABASE_URL", "FIRST_LLM_WORKSPACE_DATABASE_URL"],
      ["FIRST_LLM_EMBEDDING_BASE_URL"],
      ["FIRST_LLM_RERANKER_BASE_URL"],
    ],
  },
  {
    actionId: "authenticated-model-transfer",
    releaseVersion: "v3.4.2",
    configurationGroups: [
      ["FIRST_LLM_HUB_REPOSITORY"],
      ["HF_TOKEN", "MODELSCOPE_API_TOKEN"],
      ["FIRST_LLM_MODEL_INSTALL_ROOT"],
    ],
  },
  {
    actionId: "signed-workspace-action",
    releaseVersion: "v3.4.3",
    configurationGroups: [
      ["FIRST_LLM_ENTERPRISE_OIDC_ISSUER"],
      ["FIRST_LLM_ENTERPRISE_SCIM_BASE_URL"],
      ["FIRST_LLM_WORKSPACE_DATABASE_URL", "DATABASE_URL"],
    ],
  },
  {
    actionId: "runtime-recovery-rehearsal",
    releaseVersion: "v3.4.4",
    configurationGroups: [
      ["FIRST_LLM_RUNTIME_RECOVERY_PROFILE"],
      ["FIRST_LLM_RUNTIME_BACKEND"],
    ],
  },
  {
    actionId: "benchmark-candidate-run",
    releaseVersion: "v3.4.5",
    configurationGroups: [
      ["FIRST_LLM_BENCHMARK_CANDIDATE_TARGET"],
      ["FIRST_LLM_BENCHMARK_BASELINE_TARGET"],
    ],
  },
  {
    actionId: "telemetry-export-reconciliation",
    releaseVersion: "v3.4.6",
    configurationGroups: [
      ["OTEL_EXPORTER_OTLP_ENDPOINT", "LANGFUSE_BASE_URL"],
      ["FIRST_LLM_TELEMETRY_RETENTION_PROFILE"],
    ],
  },
];

const RECEIPT_KEYS = new Set([
  "schemaVersion",
  "actionId",
  "requestDigest",
  "idempotencyKey",
  "startedAt",
  "completedAt",
  "outcome",
  "primaryEvidenceDigest",
  "rollbackEvidenceDigest",
  "operator",
]);
const OPERATOR_KEYS = new Set(["organizationId", "operatorId"]);

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

function isDigest(value: string | undefined) {
  return Boolean(value && /^[a-f0-9]{64}$/iu.test(value));
}

function hasOnlyKeys(value: unknown, allowed: Set<string>) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).every((key) => allowed.has(key)),
  );
}

function isDurableIdentity(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(
    normalized &&
      normalized.length >= 3 &&
      !/^(local|test|fixture|demo|rehearsal|unknown)/iu.test(normalized),
  );
}

function admissionState(action: RemediationExecutionAction): OwnerWorkloadAdmissionState {
  if (action.state === "satisfied") return "completed";
  if (action.state === "ready") return "admitted";
  return "blocked";
}

function buildRequest(
  definition: RequestDefinition,
  action: RemediationExecutionAction,
): OwnerWorkloadRequest {
  const withoutDigest = {
    schemaVersion: OWNER_WORKLOAD_REQUEST_SCHEMA_VERSION,
    actionId: action.id,
    releaseVersion: definition.releaseVersion,
    owner: action.owner,
    admissionState: admissionState(action),
    validation: {
      method: "GET" as const,
      route: action.localValidationRoute,
      expectedHttpStatus: 200 as const,
    },
    configurationGroups: definition.configurationGroups,
    idempotencyKey: action.idempotencyKey,
    fencingTokenDigest: action.lease.fencingTokenDigest,
    upstreamEvidenceFingerprint: action.rollback.evidenceFingerprint,
    reviewWithinHours: action.priority === "critical" ? 4 : action.priority === "high" ? 24 : 72,
    escalationAfterHours: action.priority === "critical" ? 8 : action.priority === "high" ? 48 : 168,
    rollbackRequired: true as const,
    dryRunOnly: true as const,
    remoteMutationAllowed: false as const,
  };
  return { ...withoutDigest, requestDigest: digest(withoutDigest) };
}

export function buildOwnerWorkloadProtocol(
  executionPlan: RemediationExecutionPlan,
): OwnerWorkloadProtocol {
  const actions = new Map(executionPlan.actions.map((action) => [action.id, action]));
  const requests = REQUEST_DEFINITIONS.flatMap((definition) => {
    const action = actions.get(definition.actionId);
    return action ? [buildRequest(definition, action)] : [];
  });
  const checks = {
    everyActionBound:
      requests.length === REQUEST_DEFINITIONS.length &&
      requests.length === executionPlan.actions.length,
    strictRequestDigests: requests.every(
      (request) => /^[a-f0-9]{64}$/u.test(request.requestDigest),
    ),
    boundedReviewAndEscalation: requests.every(
      (request) =>
        request.reviewWithinHours > 0 &&
        request.escalationAfterHours >= request.reviewWithinHours,
    ),
    rollbackAlwaysRequired: requests.every((request) => request.rollbackRequired),
    dryRunOnly: true as const,
    remoteMutationDenied: true as const,
    productionTransitionDenied: true as const,
  };
  const summary = {
    totalRequests: requests.length,
    completedRequests: requests.filter((request) => request.admissionState === "completed").length,
    admittedRequests: requests.filter((request) => request.admissionState === "admitted").length,
    blockedRequests: requests.filter((request) => request.admissionState === "blocked").length,
  };
  const receiptPolicy = {
    maximumAgeHours: 168 as const,
    maximumExecutionHours: 24 as const,
    detachedSignatureRequired: true as const,
    pinnedTrustAnchorRequired: true as const,
    immutableArchiveRequired: true as const,
    selfApprovalDenied: true as const,
  };
  const waiverPolicy = {
    maximumDurationHours: 24 as const,
    renewalAllowed: false as const,
    productionOverrideAllowed: false as const,
    forbiddenScopes: [
      "production-authority",
      "signature-verification",
      "trust-anchor-pinning",
      "critical-security-findings",
      "workspace-acl",
    ],
  };
  const withoutDigest = {
    ok: true as const,
    schemaVersion: OWNER_WORKLOAD_PROTOCOL_SCHEMA_VERSION,
    generatedAt: executionPlan.generatedAt,
    localStatus:
      Object.values(checks).every(Boolean) &&
      summary.completedRequests === summary.totalRequests
        ? ("pass" as const)
        : ("attention" as const),
    productionStatus: "blocked" as const,
    summary,
    checks,
    receiptPolicy,
    waiverPolicy,
    requests,
  };
  return {
    ...withoutDigest,
    protocolDigest: digest({
      schemaVersion: withoutDigest.schemaVersion,
      localStatus: withoutDigest.localStatus,
      productionStatus: withoutDigest.productionStatus,
      summary,
      checks,
      receiptPolicy,
      waiverPolicy,
      requests,
    }),
  };
}

export function validateOwnerWorkloadReceipt(input: {
  receipt: unknown;
  protocol: OwnerWorkloadProtocol;
  now?: number;
}): OwnerWorkloadReceiptValidation {
  const now = input.now ?? Date.now();
  const receipt =
    input.receipt && typeof input.receipt === "object" && !Array.isArray(input.receipt)
      ? (input.receipt as OwnerWorkloadReceipt)
      : null;
  const request = input.protocol.requests.find(
    (candidate) => candidate.actionId === receipt?.actionId,
  );
  const startedAt = receipt?.startedAt ? Date.parse(receipt.startedAt) : Number.NaN;
  const completedAt = receipt?.completedAt ? Date.parse(receipt.completedAt) : Number.NaN;
  const checks = {
    strictTopLevelSchema: hasOnlyKeys(receipt, RECEIPT_KEYS),
    strictOperatorSchema: hasOnlyKeys(receipt?.operator, OPERATOR_KEYS),
    schemaVersionMatches:
      receipt?.schemaVersion === OWNER_WORKLOAD_RECEIPT_SCHEMA_VERSION,
    actionKnown: Boolean(request),
    requestDigestBound: Boolean(request && receipt?.requestDigest === request.requestDigest),
    idempotencyKeyBound: Boolean(
      request && receipt?.idempotencyKey === request.idempotencyKey,
    ),
    timestampsValid:
      Number.isFinite(startedAt) &&
      Number.isFinite(completedAt) &&
      startedAt <= completedAt &&
      completedAt <= now + 5 * 60 * 1000,
    receiptFresh:
      Number.isFinite(completedAt) &&
      now - completedAt <= input.protocol.receiptPolicy.maximumAgeHours * 60 * 60 * 1000,
    executionBounded:
      Number.isFinite(startedAt) &&
      Number.isFinite(completedAt) &&
      completedAt - startedAt <=
        input.protocol.receiptPolicy.maximumExecutionHours * 60 * 60 * 1000,
    outcomePassed: receipt?.outcome === "passed",
    primaryEvidenceBound: isDigest(receipt?.primaryEvidenceDigest),
    rollbackEvidenceConsistent:
      receipt?.outcome === "passed" || isDigest(receipt?.rollbackEvidenceDigest),
    durableOrganizationIdentity: isDurableIdentity(receipt?.operator?.organizationId),
    durableOperatorIdentity: isDurableIdentity(receipt?.operator?.operatorId),
    selfApprovalDenied: input.protocol.receiptPolicy.selfApprovalDenied,
    productionTransitionDenied: true,
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Receipt check failed: ${check}.`);
  const ok = blockers.length === 0;
  return {
    ok,
    schemaVersion: "experiments.owner-workload-receipt-validation.v1",
    status: ok ? "valid-candidate" : "invalid",
    actionId: request?.actionId || null,
    checks,
    blockers,
    externalSignaturePending: true,
    externalAssuranceRequired: true,
    productionTransitionDenied: true,
  };
}
