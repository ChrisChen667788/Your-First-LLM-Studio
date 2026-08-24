"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  checks: Record<string, boolean>;
  summary: { targets: number; digestVerifyingTargets: number; activeTrustRoots: number; revokedTrustRoots: number; verifiedLocalRecords: number; signedReadBackReceiptId: string | null; rehearsal: { artifact: { id: string }; checks: Record<string, boolean> } | null };
  blockers: string[];
  error?: string;
};

export function ArtifactFederationTrustPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (rehearse = false) => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/artifacts/federation-trust", { method: rehearse ? "POST" : "GET", headers: rehearse ? { "content-type": "application/json" } : undefined, body: rehearse ? "{}" : undefined, cache: "no-store" });
      const body = await response.json() as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) throw new Error(body.error || "Artifact federation evidence could not be loaded.");
      setPayload(body.evidence || body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Artifact federation evidence failed."); }
    finally { setPending(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const passed = Object.values(payload?.checks || {}).filter(Boolean).length;
  const total = Object.keys(payload?.checks || {}).length;
  return <section className="border border-indigo-300/20 bg-slate-950/75 p-4 backdrop-blur">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-indigo-300">V1.11.0 ARTIFACT FEDERATION TRUST</p><h2 className="mt-2 text-xl font-semibold text-white">{en ? "Federated artifact trust, without fictional remote promotion" : "联邦 Artifact 信任，不虚构远端晋级"}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{en ? "Immutable coordinates, publisher roots, signed read-back, provenance, atomic install, and revoked/tampered denial are one local gate. The rehearsal is local-only and never contacts a provider registry." : "不可变坐标、发布者信任根、签名回读、来源、原子安装和撤销/篡改拒绝合并为一个本地门禁。演练仅在本地执行，不会接触任何提供方注册表。"}</p></div><button type="button" disabled={pending} onClick={() => void load(true)} className="shrink-0 border border-indigo-300/30 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-50 disabled:opacity-50">{pending ? (en ? "Running..." : "演练中...") : (en ? "Run local trust rehearsal" : "运行本地信任演练")}</button></div>
    {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
    <div className="mt-4 grid gap-2 sm:grid-cols-4">{[["LOCAL", payload?.localStatus || "hold"], ["PRODUCTION", "hold"], ["TRUST ROOTS", payload ? `${payload.summary.activeTrustRoots} active / ${payload.summary.revokedTrustRoots} revoked` : "--"], ["CHECKS", payload ? `${passed}/${total}` : "--"]].map(([label, value]) => <article key={label} className="border border-white/10 bg-black/25 p-3"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></article>)}</div>
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{Object.entries(payload?.checks || {}).map(([label, value]) => <div key={label} className={`border p-2 text-xs ${value ? "border-emerald-300/20 bg-emerald-400/5 text-emerald-100" : "border-amber-300/20 bg-amber-400/5 text-amber-100"}`}><span className="uppercase">{value ? "PASS" : "HOLD"}</span><p className="mt-1 break-words text-slate-300">{label.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</p></div>)}</div>
    {payload?.summary.rehearsal ? <p className="mt-3 truncate font-mono text-[10px] text-slate-500">local rehearsal · {payload.summary.rehearsal.artifact.id}</p> : null}
    {payload?.blockers.slice(0, 2).map((blocker) => <p key={blocker} className="mt-2 text-xs leading-5 text-amber-200">HOLD · {blocker}</p>)}
  </section>;
}
