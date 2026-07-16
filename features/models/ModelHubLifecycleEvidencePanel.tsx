"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/layout/LocaleProvider";

type PromotionEvidence = {
  status: "pass" | "hold";
  generatedAt: string;
  evidenceDigest: string;
  checks: Record<string, boolean>;
  blockers: string[];
  hubReceipt: null | {
    repository: string;
    resolvedRevision: string;
    totals: { files: number; bytes: number; verifiedChecksums: number };
    authentication: { verified: boolean };
  };
  storageReceipt: null | {
    destinationPath?: string;
    volume?: { volumeName: string; filesystem: string; protocol: string };
  };
};

function bytesLabel(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  return `${Math.max(0, value)} B`;
}

export function ModelHubLifecycleEvidencePanel() {
  const { locale } = useLocale();
  const isEnglish = locale.startsWith("en");
  const [evidence, setEvidence] = useState<PromotionEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/models/promotion-evidence", { cache: "no-store" });
      const payload = await response.json() as PromotionEvidence & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Model Hub evidence request failed.");
      setEvidence(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Model Hub evidence request failed.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <section className="border border-emerald-300/15 bg-slate-950/55 px-5 py-5 shadow-[0_20px_70px_rgba(2,6,23,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">MODEL HUB EVIDENCE</p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {isEnglish ? "Transfer and physical storage promotion" : "下载与物理存储晋级证据"}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            {isEnglish
              ? "One gate binds authenticated immutable Hub files, per-file SHA-256, and the external-volume ownership manifest."
              : "同一门禁绑定已认证的不可变 Hub 文件、逐文件 SHA-256 与外置盘 ownership manifest。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`border px-2.5 py-1 text-xs font-semibold uppercase ${evidence?.status === "pass" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
            {loading ? "checking" : evidence?.status || "hold"}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-8 items-center justify-center border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            title={isEnglish ? "Refresh evidence" : "刷新证据"}
          >
            {isEnglish ? "Refresh" : "刷新"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      {evidence ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] uppercase text-slate-500">Repository</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-100">{evidence.hubReceipt?.repository || "--"}</p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] uppercase text-slate-500">Files / SHA-256</p>
              <p className="mt-1 text-sm font-medium text-slate-100">
                {evidence.hubReceipt ? `${evidence.hubReceipt.totals.verifiedChecksums}/${evidence.hubReceipt.totals.files}` : "--"}
              </p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] uppercase text-slate-500">Transferred</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{evidence.hubReceipt ? bytesLabel(evidence.hubReceipt.totals.bytes) : "--"}</p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] uppercase text-slate-500">Physical volume</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-100">{evidence.storageReceipt?.volume?.volumeName || "--"}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(evidence.checks).map(([label, passed]) => (
              <span key={label} className={`border px-2 py-1 text-[11px] ${passed ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>
                {passed ? "PASS" : "HOLD"} · {label}
              </span>
            ))}
          </div>
          <p className="mt-3 break-all text-[11px] text-slate-500">SHA-256 evidence · {evidence.evidenceDigest}</p>
        </>
      ) : null}
    </section>
  );
}
