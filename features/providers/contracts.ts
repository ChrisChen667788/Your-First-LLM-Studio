import type { AgentProviderHealthDeskItem } from "@/lib/agent/types";

export const PROVIDER_OPS_EVIDENCE_SUMMARY_VERSION = "provider.ops-evidence-summary.v1" as const;
export const PROVIDER_OPS_EVIDENCE_SNAPSHOT_SCHEMA_VERSION =
  "provider.ops-evidence-snapshots.v1" as const;

export type ProviderReleaseProbeEvidence = {
  totalCount: number;
  successCount: number;
  failureCount: number;
  latestAt: string | null;
  latestSuccessfulAt: string | null;
  latestTargetId: string | null;
};

export type ProviderOpsEvidenceSummary = {
  schemaVersion: typeof PROVIDER_OPS_EVIDENCE_SUMMARY_VERSION;
  generatedAt: string;
  windowHours: number;
  totals: {
    providerCount: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    noTrafficCount: number;
    totalRequests: number;
    successCount: number;
    failureCount: number;
    successRatePct: number;
    timeoutCount: number;
    rateLimitCount: number;
    authFailureCount: number;
    networkFailureCount: number;
    totalTokens: number;
    estimatedCostUsd: number | null;
    actionRequiredCount: number;
    watchCount: number;
  };
  releaseProbe: ProviderReleaseProbeEvidence;
  providers: Array<{
    targetId: string;
    label: string;
    providerLabel: string;
    status: AgentProviderHealthDeskItem["status"];
    policySeverity: AgentProviderHealthDeskItem["policyRecommendation"]["severity"];
    totalRequests: number;
    successRatePct: number;
    failureCount: number;
    timeoutCount: number;
    rateLimitCount: number;
    authFailureCount: number;
    estimatedCostUsd: number | null;
    releaseProbeCount: number;
    successfulReleaseProbeCount: number;
    failedReleaseProbeCount: number;
    lastReleaseProbeAt: string | null;
    lastReleaseProbeOk: boolean | null;
    lastSuccessAt: string | null;
    recommendedTemplateId: string;
    providerKind: string;
    summary: string;
    actions: string[];
  }>;
  topRisks: string[];
  releaseNoteDraft: string[];
};

export type ProviderOpsEvidenceSnapshot = {
  id: string;
  createdAt: string;
  label: string;
  reason: string;
  pinned: boolean;
  qualifiesAsFreshEvidence: boolean;
  evidenceAt: string | null;
  summary: ProviderOpsEvidenceSummary;
  integrity: {
    algorithm: "sha256";
    digest: string;
    status: "verified" | "missing" | "invalid";
  };
};

export type ProviderOpsEvidenceSnapshotIntegritySummary = {
  status: "verified" | "attention-required";
  verifiedAt: string;
  verifiedCount: number;
  missingCount: number;
  invalidCount: number;
};

export type ProviderOpsPinnedSnapshotFreshness = {
  maxAgeHours: number;
  snapshot: ProviderOpsEvidenceSnapshot | null;
  evidenceAt: string | null;
  ageHours: number | null;
  fresh: boolean;
};

export type ProviderOpsEvidenceSnapshotStoreSummary = {
  schemaVersion: typeof PROVIDER_OPS_EVIDENCE_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  path: string;
  totalCount: number;
  pinnedCount: number;
  qualifyingCount: number;
  latestAt: string | null;
  latestPinnedAt: string | null;
  integrity: ProviderOpsEvidenceSnapshotIntegritySummary;
  snapshots: ProviderOpsEvidenceSnapshot[];
};

export type ProviderOpsEvidenceRetentionPolicy = {
  maxSnapshots: number;
  maxAgeDays: number;
  preservePinned: boolean;
};

export type ProviderOpsEvidenceRetentionResult = {
  appliedAt: string;
  beforeCount: number;
  afterCount: number;
  removedCount: number;
  protectedCount: number;
  policy: ProviderOpsEvidenceRetentionPolicy;
};
