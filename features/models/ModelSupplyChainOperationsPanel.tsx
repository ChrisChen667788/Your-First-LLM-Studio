"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  checks: Record<string, boolean>;
  summary: { hubRepository: string | null; hubResolvedRevision: string | null; hubFiles: number; verifiedHubChecksums: number; rehearsal: { receipts: Record<string, string> } | null };
  blockers: string[];
  error?: string;
};

export function ModelSupplyChainOperationsPanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (rehearse = false) => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/models/supply-chain-operations", { method: rehearse ? "POST" : "GET", headers: rehearse ? { "content-type": "application/json" } : undefined, body: rehearse ? "{}" : undefined, cache: "no-store" });
      const body = await response.json() as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) throw new Error(body.error || "Model supply-chain evidence could not be loaded.");
      setPayload(body.evidence || body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Model supply-chain evidence failed."); }
    finally { setPending(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const passed = Object.values(payload?.checks || {}).filter(Boolean).length;
  const total = Object.keys(payload?.checks || {}).length;
  return <section className="border border-sky-300/20 bg-slate-950/55 px-5 py-5 shadow-[0_20px_70px_rgba(2,6,23,0.24)]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">V1.11.1 MODEL SUPPLY CHAIN</p><h2 className="mt-2 text-lg font-semibold text-white">模型供应链运行门禁</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Hub 不可变版本与校验和必须由真实已认证回执提供；本地演练只验证清单、调度、去重、迁移、兼容性、隔离清理与激活回滚，不会伪造 Hub 下载。</p></div><button type="button" disabled={pending} onClick={() => void load(true)} className="border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 disabled:opacity-50">{pending ? "演练中..." : "运行本地运维演练"}</button></div>
    {error ? <p className="mt-4 border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
    <div className="mt-4 grid gap-2 sm:grid-cols-4"><div className="border border-white/10 bg-white/[0.03] px-3 py-3"><p className="text-[10px] uppercase text-slate-500">LOCAL</p><p className="mt-1 text-sm font-semibold text-white">{payload?.localStatus || "hold"}</p></div><div className="border border-white/10 bg-white/[0.03] px-3 py-3"><p className="text-[10px] uppercase text-slate-500">HUB RECEIPT</p><p className="mt-1 truncate text-sm font-semibold text-white">{payload?.summary.hubRepository || "missing"}</p></div><div className="border border-white/10 bg-white/[0.03] px-3 py-3"><p className="text-[10px] uppercase text-slate-500">FILES / SHA-256</p><p className="mt-1 text-sm font-semibold text-white">{payload ? `${payload.summary.verifiedHubChecksums}/${payload.summary.hubFiles}` : "--"}</p></div><div className="border border-white/10 bg-white/[0.03] px-3 py-3"><p className="text-[10px] uppercase text-slate-500">CHECKS</p><p className="mt-1 text-sm font-semibold text-white">{payload ? `${passed}/${total}` : "--"}</p></div></div>
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{Object.entries(payload?.checks || {}).map(([label, value]) => <div key={label} className={`border p-2 text-xs ${value ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-100" : "border-amber-300/20 bg-amber-300/5 text-amber-100"}`}><span>{value ? "PASS" : "HOLD"}</span><p className="mt-1 break-words text-slate-300">{label.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</p></div>)}</div>
    {payload?.blockers.slice(0, 2).map((blocker) => <p key={blocker} className="mt-3 text-xs leading-5 text-amber-200">HOLD · {blocker}</p>)}
  </section>;
}
