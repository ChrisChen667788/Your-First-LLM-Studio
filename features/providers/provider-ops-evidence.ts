import { buildProviderHealthDesk } from "@/lib/agent/provider-health-desk";
import type { AgentProviderHealthDeskItem } from "@/lib/agent/types";
import {
  PROVIDER_OPS_EVIDENCE_SUMMARY_VERSION,
  type ProviderOpsEvidenceSummary,
} from "@/features/providers/contracts";

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function successRate(successCount: number, totalRequests: number) {
  if (!totalRequests) return 0;
  return round((successCount / totalRequests) * 100, 1);
}

function sumNullable(values: Array<number | null | undefined>) {
  const total = values.reduce<number>(
    (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0,
  );
  return total > 0 ? round(total, 4) : null;
}

function buildRiskLines(rows: AgentProviderHealthDeskItem[]) {
  return rows
    .filter((row) => row.status !== "healthy")
    .sort((left, right) => {
      const severityOrder = { unhealthy: 3, degraded: 2, "no-traffic": 1, healthy: 0 };
      return severityOrder[right.status] - severityOrder[left.status] || right.failureCount - left.failureCount;
    })
    .slice(0, 6)
    .map((row) => {
      const reasons = [
        row.authFailureCount ? `${row.authFailureCount} auth` : "",
        row.rateLimitCount ? `${row.rateLimitCount} rate-limit` : "",
        row.timeoutCount ? `${row.timeoutCount} timeout` : "",
        row.failureCount ? `${row.failureCount} failed` : "",
        row.totalRequests ? "" : "no traffic",
      ].filter(Boolean);
      return `${row.targetLabel}: ${row.status}${reasons.length ? ` (${reasons.join(", ")})` : ""}`;
    });
}

function buildReleaseNoteDraft(input: {
  totals: ProviderOpsEvidenceSummary["totals"];
  providers: ProviderOpsEvidenceSummary["providers"];
}) {
  const lines = [
    `Provider Ops evidence covers ${input.totals.providerCount} remote provider target(s), ${input.totals.totalRequests} request(s), and ${input.totals.totalTokens.toLocaleString()} token(s).`,
    `Overall success rate is ${input.totals.successRatePct}% with ${input.totals.failureCount} failure(s), ${input.totals.timeoutCount} timeout(s), ${input.totals.rateLimitCount} rate-limit event(s), and ${input.totals.authFailureCount} auth failure(s).`,
  ];
  if (input.totals.estimatedCostUsd !== null) {
    lines.push(`Estimated provider cost in the evidence window is $${input.totals.estimatedCostUsd.toFixed(4)}.`);
  }
  if (input.totals.actionRequiredCount > 0 || input.totals.watchCount > 0) {
    lines.push(`${input.totals.actionRequiredCount} provider(s) require action and ${input.totals.watchCount} provider(s) need watch before promotion.`);
  }
  for (const provider of input.providers.slice(0, 4)) {
    lines.push(`${provider.label}: ${provider.status}, ${provider.successRatePct}% success, retry template ${provider.recommendedTemplateId}.`);
  }
  return lines;
}

export function buildProviderOpsEvidenceSummary(input: {
  rows: AgentProviderHealthDeskItem[];
  windowHours?: number;
}): ProviderOpsEvidenceSummary {
  const rows = input.rows;
  const successCount = rows.reduce((sum, row) => sum + row.successCount, 0);
  const totalRequests = rows.reduce((sum, row) => sum + row.totalRequests, 0);
  const providers = rows
    .map((row) => ({
      targetId: row.targetId,
      label: row.targetLabel,
      providerLabel: row.providerLabel,
      status: row.status,
      policySeverity: row.policyRecommendation.severity,
      totalRequests: row.totalRequests,
      successRatePct: row.successRatePct,
      failureCount: row.failureCount,
      timeoutCount: row.timeoutCount,
      rateLimitCount: row.rateLimitCount,
      authFailureCount: row.authFailureCount,
      estimatedCostUsd: row.estimatedCostUsd ?? null,
      recommendedTemplateId: row.retryPolicy.recommendedTemplateId,
      providerKind: row.retryPolicy.providerKind,
      summary: row.policyRecommendation.summary,
      actions: row.policyRecommendation.actions,
    }))
    .sort((left, right) => {
      const severityOrder = { action: 3, watch: 2, ok: 1 };
      return severityOrder[right.policySeverity] - severityOrder[left.policySeverity] || right.failureCount - left.failureCount;
    });

  const totals: ProviderOpsEvidenceSummary["totals"] = {
    providerCount: rows.length,
    healthyCount: rows.filter((row) => row.status === "healthy").length,
    degradedCount: rows.filter((row) => row.status === "degraded").length,
    unhealthyCount: rows.filter((row) => row.status === "unhealthy").length,
    noTrafficCount: rows.filter((row) => row.status === "no-traffic").length,
    totalRequests,
    successCount,
    failureCount: rows.reduce((sum, row) => sum + row.failureCount, 0),
    successRatePct: successRate(successCount, totalRequests),
    timeoutCount: rows.reduce((sum, row) => sum + row.timeoutCount, 0),
    rateLimitCount: rows.reduce((sum, row) => sum + row.rateLimitCount, 0),
    authFailureCount: rows.reduce((sum, row) => sum + row.authFailureCount, 0),
    networkFailureCount: rows.reduce((sum, row) => sum + row.networkFailureCount, 0),
    totalTokens: rows.reduce((sum, row) => sum + row.totalTokens, 0),
    estimatedCostUsd: sumNullable(rows.map((row) => row.estimatedCostUsd)),
    actionRequiredCount: rows.filter((row) => row.policyRecommendation.severity === "action").length,
    watchCount: rows.filter((row) => row.policyRecommendation.severity === "watch").length,
  };

  return {
    schemaVersion: PROVIDER_OPS_EVIDENCE_SUMMARY_VERSION,
    generatedAt: new Date().toISOString(),
    windowHours: input.windowHours || 24,
    totals,
    providers,
    topRisks: buildRiskLines(rows),
    releaseNoteDraft: buildReleaseNoteDraft({ totals, providers }),
  };
}

export function readProviderOpsEvidenceSummary(options?: {
  windowHours?: number;
}) {
  const windowHours = Math.max(1, Math.min(options?.windowHours || 24, 168));
  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  return buildProviderOpsEvidenceSummary({
    rows: buildProviderHealthDesk({ sinceIso }),
    windowHours,
  });
}
