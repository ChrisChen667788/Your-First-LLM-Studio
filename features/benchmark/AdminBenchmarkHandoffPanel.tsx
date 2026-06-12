"use client";

import Link from "next/link";
import type { AgentBenchmarkProgress } from "@/lib/agent/types";

type AdminBenchmarkHandoffPanelProps = {
  locale: string;
  progress: AgentBenchmarkProgress | null;
  latestRunId?: string | null;
  latestGeneratedAt?: string | null;
  historyCount: number;
  releaseEvidenceCount: number;
};

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusTone(status?: AgentBenchmarkProgress["status"]) {
  if (status === "completed") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "failed" || status === "abandoned") {
    return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  }
  if (status === "running" || status === "pending") {
    return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
  }
  return "border-white/10 bg-white/5 text-slate-300";
}

export function AdminBenchmarkHandoffPanel({
  locale,
  progress,
  latestRunId,
  latestGeneratedAt,
  historyCount,
  releaseEvidenceCount,
}: AdminBenchmarkHandoffPanelProps) {
  const isEnglish = locale.startsWith("en");
  const active = progress?.status === "running" || progress?.status === "pending";
  const completedSamples = progress?.completedSamples ?? 0;
  const totalSamples = progress?.totalSamples ?? 0;
  const progressPercent = totalSamples > 0
    ? Math.min(100, Math.round((completedSamples / totalSamples) * 100))
    : 0;

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(8,47,73,0.42),rgba(2,6,23,0.78)_52%,rgba(6,78,59,0.3))] px-4 py-4 shadow-[0_20px_70px_rgba(2,6,23,0.28)] backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              {isEnglish ? "Benchmark governance" : "Benchmark 治理镜像"}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(progress?.status)}`}>
              {progress?.status || (isEnglish ? "idle" : "空闲")}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {isEnglish ? "Runs now belong to Benchmark Studio" : "运行与配置已归属 Benchmark Studio"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isEnglish
              ? "Admin keeps operational health, release evidence, and historical regression monitoring. Configure, start, and review benchmark runs in the foreground workspace."
              : "Admin 只保留运行健康、发布证据和历史回归监控；评测配置、启动执行和结果审阅统一进入前台工作区。"}
          </p>
        </div>

        <Link
          href="/benchmarks"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200/25 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/40 hover:bg-cyan-400/25"
        >
          {isEnglish ? "Open Benchmark Studio" : "打开 Benchmark Studio"}
        </Link>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {isEnglish ? "Current run" : "当前运行"}
          </p>
          <p className="mt-2 truncate font-mono text-slate-100" title={progress?.runId || latestRunId || "--"}>
            {progress?.runId || latestRunId || "--"}
          </p>
          <p className="mt-1 text-slate-500">
            {active
              ? `${completedSamples}/${totalSamples} · ${progressPercent}%`
              : formatDateTime(progress?.updatedAt || latestGeneratedAt)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {isEnglish ? "Regression history" : "回归历史"}
          </p>
          <p className="mt-2 text-xl font-semibold text-white">{historyCount}</p>
          <p className="mt-1 text-slate-500">
            {isEnglish ? "Runs retained for monitoring" : "保留用于趋势监控的运行"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {isEnglish ? "Release evidence" : "发布证据"}
          </p>
          <p className="mt-2 text-xl font-semibold text-white">{releaseEvidenceCount}</p>
          <p className="mt-1 text-slate-500">
            {isEnglish ? "Pinned governance artifacts" : "已固定的治理证据"}
          </p>
        </div>
      </div>
    </section>
  );
}
