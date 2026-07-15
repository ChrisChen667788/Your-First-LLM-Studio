"use client";

import type { Dispatch, SetStateAction } from "react";
import type { AgentMetricPercentiles, AgentTarget } from "@/lib/agent/types";

export type AdminProviderComparisonRow = {
  targetId: string;
  targetLabel: string;
  providerLabel: string;
  totalRequests: number;
  totalTokens: number;
  failedRequests: number;
  activeForTarget: number;
  avgLatencyMs: number;
  avgFirstTokenLatencyMs: number;
  avgTokenThroughputTps: number;
  firstTokenLatencyPercentiles: AgentMetricPercentiles;
  totalLatencyPercentiles: AgentMetricPercentiles;
  tokenThroughputPercentiles: AgentMetricPercentiles;
};

type AdminProviderComparisonPanelProps = {
  targets: AgentTarget[];
  selectedTargetIds: string[];
  setSelectedTargetIds: Dispatch<SetStateAction<string[]>>;
  rows: AdminProviderComparisonRow[];
  labels: {
    title: string;
    targets: string;
    provider: string;
    totalRequests: string;
    totalTokens: string;
    failedRequests: string;
    activeRequests: string;
    firstTokenLatency: string;
    totalLatency: string;
    tokenThroughput: string;
    tokensPerSecond: string;
    percentiles: string;
    noData: string;
  };
};

function formatCompactNumber(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function AdminProviderComparisonPanel({
  targets,
  selectedTargetIds,
  setSelectedTargetIds,
  rows,
  labels,
}: AdminProviderComparisonPanelProps) {
  return (
    <section className="order-26 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div><p className="text-sm text-slate-300">{labels.title}</p><p className="mt-2 text-xs leading-6 text-slate-500">{labels.targets}</p></div>
        <div className="flex flex-wrap gap-2">
          {targets.map((target) => {
            const active = selectedTargetIds.includes(target.id);
            return (
              <button key={target.id} type="button" onClick={() => setSelectedTargetIds((current) => current.includes(target.id) ? current.length === 1 ? current : current.filter((item) => item !== target.id) : [...current, target.id])} className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                {target.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-white/5 text-slate-400"><tr>{[labels.targets, labels.provider, labels.totalRequests, labels.totalTokens, labels.failedRequests, labels.activeRequests, labels.firstTokenLatency, labels.totalLatency, labels.tokenThroughput, labels.percentiles].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.targetId} className="border-t border-white/10">
                <td className="px-3 py-2 text-slate-100">{row.targetLabel}</td><td className="px-3 py-2 text-slate-300">{row.providerLabel}</td><td className="px-3 py-2 text-slate-300">{row.totalRequests}</td><td className="px-3 py-2 text-slate-300">{formatCompactNumber(row.totalTokens)}</td><td className="px-3 py-2 text-slate-300">{row.failedRequests}</td><td className="px-3 py-2 text-slate-300">{row.activeForTarget}</td><td className="px-3 py-2 text-slate-300">{row.avgFirstTokenLatencyMs.toFixed(1)} ms</td><td className="px-3 py-2 text-slate-300">{row.avgLatencyMs.toFixed(1)} ms</td><td className="px-3 py-2 text-slate-300">{row.avgTokenThroughputTps.toFixed(2)} {labels.tokensPerSecond}</td>
                <td className="px-3 py-2 text-xs text-slate-300"><div>FT P50/P95/P99: {row.firstTokenLatencyPercentiles.p50.toFixed(0)} / {row.firstTokenLatencyPercentiles.p95.toFixed(0)} / {row.firstTokenLatencyPercentiles.p99.toFixed(0)} ms</div><div className="mt-1">LAT P50/P95/P99: {row.totalLatencyPercentiles.p50.toFixed(0)} / {row.totalLatencyPercentiles.p95.toFixed(0)} / {row.totalLatencyPercentiles.p99.toFixed(0)} ms</div><div className="mt-1">TPS P50/P95/P99: {row.tokenThroughputPercentiles.p50.toFixed(2)} / {row.tokenThroughputPercentiles.p95.toFixed(2)} / {row.tokenThroughputPercentiles.p99.toFixed(2)}</div></td>
              </tr>
            )) : <tr><td className="px-3 py-4 text-slate-500" colSpan={10}>{labels.noData}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
