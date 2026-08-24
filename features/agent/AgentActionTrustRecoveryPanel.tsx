"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/layout/LocaleProvider";

type Evidence = {
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  checks: Record<string, boolean>;
  summary: { shadowPassingRuns: number; duplicateSideEffects: number; replayReceiptId: string | null; stateDiffReceiptId: string | null };
  blockers: string[];
  error?: string;
};

export function AgentActionTrustRecoveryPanel() {
  const { locale } = useLocale();
  const en = locale.startsWith("en");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (run = false) => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/agent/action-trust-recovery", { method: run ? "POST" : "GET", headers: run ? { "content-type": "application/json" } : undefined, body: run ? "{}" : undefined, cache: "no-store" });
      const payload = (await response.json()) as Evidence & { evidence?: Evidence; error?: string };
      if (!response.ok && response.status !== 422) throw new Error(payload.error || "Action trust evidence request failed.");
      setEvidence(payload.evidence || payload);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Action trust evidence request failed."); }
    finally { setPending(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section className="border-b border-white/10 bg-violet-400/[0.035] px-5 py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">V1.10.4 ACTION TRUST</p><p className="mt-1 text-xs text-slate-300">{en ? "Protected-action interruption, side-effect-free replay, and breakpoint recovery are read together." : "受保护动作中断、无副作用回放和断点恢复统一读取。"}</p></div><div className="flex gap-2"><span className={`border px-2.5 py-1 text-[11px] uppercase ${evidence?.localStatus === "pass" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>LOCAL {evidence?.localStatus || "hold"}</span><span className="border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] uppercase text-amber-100">PROD HOLD</span><button type="button" disabled={pending} onClick={() => void load(true)} className="border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-[11px] text-violet-100 disabled:opacity-50">{pending ? (en ? "Checking..." : "验证中...") : (en ? "Run shadow" : "运行 Shadow")}</button></div></div>{error ? <p className="mt-3 text-xs text-rose-100">{error}</p> : null}{evidence ? <><div className="mt-3 flex flex-wrap gap-2">{Object.entries(evidence.checks).map(([label, passed]) => <span key={label} className={`border px-2 py-1 text-[10px] ${passed ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>{passed ? "PASS" : "HOLD"} · {label}</span>)}</div><p className="mt-2 text-[11px] text-slate-500">shadow {evidence.summary.shadowPassingRuns} · duplicate side effects {evidence.summary.duplicateSideEffects} · replay {evidence.summary.replayReceiptId ? "linked" : "absent"} · state diff {evidence.summary.stateDiffReceiptId ? "linked" : "absent"}</p><p className="mt-2 text-[11px] text-amber-100">{evidence.blockers[0]}</p></> : null}</section>;
}
