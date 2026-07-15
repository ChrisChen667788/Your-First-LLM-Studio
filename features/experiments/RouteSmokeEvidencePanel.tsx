"use client";

import { useCallback, useEffect, useState } from "react";

type RouteSmokeEvidence = {
  generatedAt: string;
  reportPath: string;
  updatedAt: string | null;
  ok: boolean;
  totals: {
    checkCount: number;
    passCount: number;
    failureCount: number;
    uiRouteCount: number;
    uiRoutePassCount: number;
    apiContractCount: number;
    apiContractPassCount: number;
    compatibilityHeaderCount: number;
    compatibilityHeaderPassCount: number;
  };
  history: {
    reportCount: number;
    passCount: number;
    failCount: number;
    consecutivePassCount: number;
    latestFailureAt: string | null;
    verifiedCount: number;
    invalidCount: number;
    missingIntegrityCount: number;
    reports: Array<{
      file: string;
      generatedAt: string | null;
      status: "pass" | "fail";
      checkCount: number;
      failureCount: number;
      integrityStatus: "verified" | "invalid" | "missing";
      digest: string | null;
    }>;
  };
  integrity: {
    status: "verified" | "invalid" | "missing";
    digest: string | null;
  };
  failures: Array<{
    kind: string;
    label: string;
    detail: string;
  }>;
  blockers: string[];
};

export function RouteSmokeEvidencePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [evidence, setEvidence] = useState<RouteSmokeEvidence | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/experiments/route-smoke-evidence", {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      evidence?: RouteSmokeEvidence;
      error?: string;
    };
    if (!response.ok || !payload.evidence) {
      throw new Error(payload.error || "Failed to load route smoke evidence.");
    }
    setEvidence(payload.evidence);
  }, []);

  useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load route smoke evidence.");
    });
  }, [load]);

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">ROUTE SMOKE TREND</p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {en ? "Cross-surface regression history" : "跨界面回归历史"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {en ? "UI routes, canonical API contracts, and compatibility headers stay visible as one release signal." : "UI 路由、canonical API contract 与兼容 header 统一形成发布信号。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">
            {en ? "Refresh" : "刷新"}
          </button>
          <a href="/api/experiments/route-smoke-evidence/export?format=json" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">JSON</a>
          <a href="/api/experiments/route-smoke-evidence/export?format=md" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">Markdown</a>
        </div>
      </div>

      {evidence ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [en ? "Current" : "当前", evidence.ok ? "PASS" : "FAIL"],
              [en ? "Checks" : "检查项", `${evidence.totals.passCount}/${evidence.totals.checkCount}`],
              [en ? "History" : "历史", `${evidence.history.passCount}/${evidence.history.reportCount}`],
              [en ? "Pass streak" : "连续通过", String(evidence.history.consecutivePassCount)],
              [en ? "Integrity" : "完整性", evidence.integrity.status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className={`mt-1 text-base font-semibold ${value === "FAIL" ? "text-rose-200" : "text-white"}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-16 items-end gap-1 rounded-2xl border border-white/10 bg-black/20 px-3 py-2" aria-label={en ? "Route smoke history" : "路由回归历史"}>
            {[...evidence.history.reports].reverse().map((report) => {
              const passPct = report.checkCount > 0
                ? Math.max(10, Math.round(((report.checkCount - report.failureCount) / report.checkCount) * 100))
                : 10;
              return (
                <div key={report.file} title={`${report.generatedAt || "unknown"} · ${report.status} · ${report.checkCount} checks`} className="flex min-w-0 flex-1 items-end">
                  <div className={`w-full rounded-sm ${report.status === "pass" ? "bg-emerald-300/70" : "bg-rose-300/70"}`} style={{ height: `${passPct}%` }} />
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3 text-[11px] text-slate-400">
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">UI {evidence.totals.uiRoutePassCount}/{evidence.totals.uiRouteCount}</p>
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">API {evidence.totals.apiContractPassCount}/{evidence.totals.apiContractCount}</p>
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Compatibility {evidence.totals.compatibilityHeaderPassCount}/{evidence.totals.compatibilityHeaderCount}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span>{evidence.history.verifiedCount}/{evidence.history.reportCount} history verified</span>
            <span>{evidence.history.invalidCount} invalid</span>
            <span>{evidence.history.missingIntegrityCount} legacy missing</span>
          </div>
          {evidence.failures.length ? (
            <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3">
              <p className="text-xs font-semibold text-rose-100">{en ? "Current failures" : "当前失败项"}</p>
              <div className="mt-2 grid gap-2">
                {evidence.failures.map((failure) => (
                  <div key={`${failure.kind}:${failure.label}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-rose-100">
                    <p className="font-semibold">{failure.kind} · {failure.label}</p>
                    <p className="mt-1 font-mono text-rose-200/70">{failure.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {evidence.blockers.length ? <p className="mt-3 text-xs text-amber-200">{evidence.blockers[0]}</p> : null}
        </>
      ) : null}
      {error ? <p className="mt-3 text-xs text-rose-200">{error}</p> : null}
    </section>
  );
}
