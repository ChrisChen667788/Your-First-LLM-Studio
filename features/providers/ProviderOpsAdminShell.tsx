"use client";

import type { AgentProviderHealthDeskItem } from "@/lib/agent/types";
import type { ProviderOpsEvidenceSummary } from "./contracts";
import { ProviderHealthTargetGrid } from "./ProviderHealthTargetGrid";
import { ProviderOpsEvidencePanel } from "./ProviderOpsEvidencePanel";

type ProviderOpsAdminShellProps = {
  locale: string;
  summary?: ProviderOpsEvidenceSummary;
  entries: AgentProviderHealthDeskItem[];
  labels: {
    model: string;
    firstTokenLatency: string;
    totalLatency: string;
    noData: string;
  };
  onRefresh?: () => void | Promise<void>;
};

export function ProviderOpsAdminShell({
  locale,
  summary,
  entries,
  labels,
  onRefresh,
}: ProviderOpsAdminShellProps) {
  const en = locale.startsWith("en");
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-slate-300">
            {en ? "Provider usage / health desk" : "Provider 使用 / 健康台"}
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            {en
              ? "Track remote reliability, release evidence, cost, failure classes, and retry policy from one feature-owned surface."
              : "在一个 feature-owned 界面统一查看远端可靠性、发布证据、成本、失败分类与重试策略。"}
          </p>
        </div>
        <span className="text-[11px] text-slate-500">
          {en ? "24h aggregation" : "近 24h 聚合"} · {entries.length}
        </span>
      </div>
      {summary ? (
        <ProviderOpsEvidencePanel
          locale={locale}
          initialSummary={summary}
          targets={entries.map((entry) => ({
            targetId: entry.targetId,
            targetLabel: entry.targetLabel,
            providerLabel: entry.providerLabel,
          }))}
          onRefresh={onRefresh}
        />
      ) : null}
      <ProviderHealthTargetGrid locale={locale} entries={entries} labels={labels} />
    </section>
  );
}
