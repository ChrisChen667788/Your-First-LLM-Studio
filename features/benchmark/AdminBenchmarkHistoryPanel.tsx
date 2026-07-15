"use client";

import type { ReactNode } from "react";
import { formatBenchmarkReportMatchSource } from "./release-evidence-formatters";

export type BenchmarkHistorySourceFilter =
  | "all"
  | "recent-window"
  | "full-history";

type AdminBenchmarkHistoryPanelProps = {
  locale: string;
  title: string;
  trendTitle: string;
  count: number;
  sourceFilter: BenchmarkHistorySourceFilter;
  onSourceFilterChange: (value: BenchmarkHistorySourceFilter) => void;
  children: ReactNode;
};

export function AdminBenchmarkHistoryPanel({
  locale,
  title,
  trendTitle,
  count,
  sourceFilter,
  onSourceFilterChange,
  children,
}: AdminBenchmarkHistoryPanelProps) {
  const en = locale.startsWith("en");
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-300">{title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-slate-500">
            {en ? "History source" : "历史来源"}
          </label>
          <select value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value as BenchmarkHistorySourceFilter)} className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] text-slate-100 outline-none">
            <option value="all">{en ? "All sources" : "全部来源"}</option>
            <option value="recent-window">{formatBenchmarkReportMatchSource(locale, "recent-window")}</option>
            <option value="full-history">{formatBenchmarkReportMatchSource(locale, "full-history")}</option>
          </select>
          <span className="text-[11px] text-slate-500">{trendTitle} · {count}</span>
        </div>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
