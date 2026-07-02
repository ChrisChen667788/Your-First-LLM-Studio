import type { AgentProviderHealthDeskItem } from "@/lib/agent/types";

export const PROVIDER_OPS_EVIDENCE_SUMMARY_VERSION = "provider.ops-evidence-summary.v1" as const;

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
    recommendedTemplateId: string;
    providerKind: string;
    summary: string;
    actions: string[];
  }>;
  topRisks: string[];
  releaseNoteDraft: string[];
};
