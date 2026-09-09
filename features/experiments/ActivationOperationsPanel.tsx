"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  configured: boolean; configurationCode?: string; revision?: number; ledgerRevision?: number;
  trustSnapshotDigest: string | null; policyDigest: string | null; rotationCount: number;
  staleManifests: string[]; conflicts: Array<{ conflictDigest: string }>;
  quarantineCases: Array<{ status: string; code: string }>;
  decisionAdmissions: Array<{ decision: string; consumed: boolean }>;
  manifests: Array<{ id: string; eligibleForReview: boolean; conflictCount: number; openCaseCount: number }>;
  distributionStatus: "hold"; productionStatus: "blocked"; stateDigest: string | null;
};
const button = "rounded-md border border-white/20 px-3 py-2 text-xs text-slate-100 hover:bg-white/10 disabled:opacity-40";

export function ActivationOperationsPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch("/api/experiments/activation-operations", { cache: "no-store" }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Operations unavailable."); setPayload(data); }, []);
  useEffect(() => { void load().catch((err: Error) => setError(err.message)); }, [load]);
  async function exportBundle() { setBusy(true); setError(""); try { const response = await fetch("/api/experiments/activation-operations?export=true"); if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Export rejected."); } const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "activation-operations-export.json"; link.click(); URL.revokeObjectURL(url); } catch (err) { setError(err instanceof Error ? err.message : "Export failed."); } finally { setBusy(false); } }
  const activeCases = payload?.quarantineCases.filter((item) => item.status !== "resolved").length || 0;
  return <section id="activation-operations" className="min-w-0 scroll-mt-40 border-b border-white/10 px-5 py-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-slate-100">{en ? "Activation operations" : "激活运营控制"}</h3><span className={payload?.configured ? "text-emerald-200" : "text-amber-200"}>{payload ? payload.configured ? (en ? "Policy verified" : "策略已核验") : (en ? `Setup required: ${payload.configurationCode}` : `待配置：${payload.configurationCode}`) : (en ? "Loading" : "读取中")}</span></div>
    <div className="my-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
      {[[en ? "Ops revision" : "运营修订", payload?.revision], [en ? "Trust snapshot" : "信任快照", payload?.trustSnapshotDigest ? `${payload.trustSnapshotDigest.slice(0, 10)}...` : "--"], [en ? "Open cases" : "待处置", activeCases], [en ? "Consumed decisions" : "已消费决策", payload?.decisionAdmissions.filter((item) => item.consumed).length || 0]].map(([label, value]) => <div key={label}><p className="text-slate-400">{label}</p><p className="mt-1 break-all text-base font-semibold text-slate-100">{value ?? "--"}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center gap-2"><button type="button" className={button} disabled={busy || !payload?.configured} onClick={() => void exportBundle()}>{en ? "Export audit" : "导出审计"}</button><button type="button" className={button} disabled={busy} onClick={() => { setBusy(true); void load().catch((err: Error) => setError(err.message)).finally(() => setBusy(false)); }}>{en ? "Refresh" : "刷新"}</button><span className="text-xs text-slate-400">{en ? `${payload?.conflicts.length || 0} conflict(s) · ${payload?.staleManifests.length || 0} stale manifest(s)` : `${payload?.conflicts.length || 0} 个冲突 · ${payload?.staleManifests.length || 0} 个过期清单`}</span></div>
    <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]"><span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-amber-100">{en ? "Distribution HOLD" : "分发 HOLD"}</span><span className="rounded-full border border-rose-300/25 bg-rose-300/10 px-2 py-1 text-rose-200">{en ? "Production BLOCKED" : "生产 BLOCKED"}</span></div>
    {error ? <p role="alert" className="mt-3 break-words text-xs text-rose-200">{error}</p> : null}
  </section>;
}
