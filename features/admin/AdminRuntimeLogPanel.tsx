"use client";

import type { AgentRuntimeLogSummary } from "@/lib/agent/types";

export type AdminRuntimeLogPanelProps = {
  locale: string;
  action: string;
  query: string;
  limit: number;
  summary?: AgentRuntimeLogSummary;
  excerpt: string;
  text: {
    title: string;
    refreshing: string;
    readLog: string;
    noLog: string;
  };
  onQueryChange: (value: string) => void;
  onLimitChange: (value: number) => void;
  onSearch: () => void | Promise<void>;
};

export function AdminRuntimeLogPanel({
  locale,
  action,
  query,
  limit,
  summary,
  excerpt,
  text,
  onQueryChange,
  onLimitChange,
  onSearch,
}: AdminRuntimeLogPanelProps) {
  const isEnglish = locale.startsWith("en");
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-slate-300">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{text.title}</p>
      <div className="mt-3 flex flex-col gap-2 xl:flex-row">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={isEnglish ? "Filter log keywords" : "筛选日志关键词"}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <select
          value={limit}
          onChange={(event) => onLimitChange(Number(event.target.value))}
          className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none"
        >
          {[80, 120, 200].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={Boolean(action)}
          onClick={() => void onSearch()}
          className="rounded-full border border-white/10 bg-transparent px-3 py-2 text-[11px] text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          {action === "read_log" ? text.refreshing : text.readLog}
        </button>
      </div>
      {summary ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <LogChip>{isEnglish ? "Matched" : "匹配"} {summary.matchedLines}/{summary.totalLines}</LogChip>
          <LogChip>{isEnglish ? "Errors" : "错误"} {summary.errorLines}</LogChip>
          <LogChip>{isEnglish ? "Warnings" : "警告"} {summary.warningLines}</LogChip>
          <LogChip>{isEnglish ? "Restarts" : "重启"} {summary.restartMentions}</LogChip>
          <LogChip>{isEnglish ? "Loading" : "加载"} {summary.loadingMentions}</LogChip>
        </div>
      ) : null}
      {excerpt ? (
        <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{excerpt}</pre>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{text.noLog}</p>
      )}
    </div>
  );
}

function LogChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
      {children}
    </span>
  );
}
