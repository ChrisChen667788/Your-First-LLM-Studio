"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = { localStatus: "pass" | "hold"; productionStatus: "hold"; checks: Record<string, boolean>; summary: { enterpriseStatus: string; replayEntries: number; replayableEntries: number; rehearsal: { corpus: { documentId: string }; replayIds: { golden: string; deletion: string } } | null }; blockers: string[]; error?: string };

export function RagGovernancePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (rehearse = false) => { setPending(true); setError(""); try { const response = await fetch("/api/retrieval/governance", { method: rehearse ? "POST" : "GET", headers: rehearse ? { "content-type": "application/json" } : undefined, body: rehearse ? "{}" : undefined, cache: "no-store" }); const body = await response.json() as Payload & { evidence?: Payload }; if (!response.ok && response.status !== 422) throw new Error(body.error || "RAG governance evidence could not be loaded."); setPayload(body.evidence || body); } catch (caught) { setError(caught instanceof Error ? caught.message : "RAG governance evidence failed."); } finally { setPending(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const passed = Object.values(payload?.checks || {}).filter(Boolean).length;
  const total = Object.keys(payload?.checks || {}).length;
  return <section className="border border-cyan-300/20 bg-slate-950/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-cyan-300">V1.11.2 CONTINUOUS RAG GOVERNANCE</p><h2 className="mt-2 text-xl font-semibold text-white">{en ? "Corpus revision, deletion, citations, and leakage boundaries" : "语料修订、删除、引用与泄漏边界"}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{en ? "The local rehearsal proves revision/query/delete behavior and policy probes. It does not claim deployed pgvector, identity, or connector deletion propagation." : "本地演练验证修订、查询、删除和策略探针；不会把未部署的 pgvector、身份或连接器删除传播说成已验证。"}</p></div><button type="button" disabled={pending} onClick={() => void load(true)} className="border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50">{pending ? (en ? "Running..." : "演练中...") : (en ? "Run local governance rehearsal" : "运行本地治理演练")}</button></div>
    {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
    <div className="mt-4 grid gap-2 sm:grid-cols-4"><article className="border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">LOCAL</p><p className="mt-1 text-sm font-semibold text-white">{payload?.localStatus || "hold"}</p></article><article className="border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">ENTERPRISE</p><p className="mt-1 text-sm font-semibold text-white">{payload?.summary.enterpriseStatus || "blocked"}</p></article><article className="border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">REPLAYS</p><p className="mt-1 text-sm font-semibold text-white">{payload ? `${payload.summary.replayableEntries}/${payload.summary.replayEntries}` : "--"}</p></article><article className="border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">CHECKS</p><p className="mt-1 text-sm font-semibold text-white">{payload ? `${passed}/${total}` : "--"}</p></article></div>
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{Object.entries(payload?.checks || {}).map(([label, value]) => <div key={label} className={`border p-2 text-xs ${value ? "border-emerald-300/20 bg-emerald-400/5 text-emerald-100" : "border-amber-300/20 bg-amber-400/5 text-amber-100"}`}><span>{value ? "PASS" : "HOLD"}</span><p className="mt-1 break-words text-slate-300">{label.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</p></div>)}</div>
    {payload?.blockers.slice(0, 2).map((blocker) => <p key={blocker} className="mt-3 text-xs leading-5 text-amber-200">HOLD · {blocker}</p>)}
  </section>;
}
