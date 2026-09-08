"use client";

import { useCallback, useEffect, useState } from "react";

type VersionState = {
  version: string;
  label: string;
  track: string;
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  coverage: number;
  blockers: string[];
};

type Payload = {
  totals: {
    versions: number;
    sourcePassed: number;
    localPassed: number;
    registeredProfiles: number;
    campaigns: number;
    acceptedForBinding: number;
    quarantinedReceipts: number;
    coveredMilestones: number;
  };
  sourceStatus: "pass";
  localStatus: "pass" | "hold";
  productionStatus: "blocked";
  versions: VersionState[];
  stateDigest: string;
};

export function EvidenceAuthorityCampaignTrainPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (record = false) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/evidence-authority-campaign-train", {
        method: record ? "POST" : "GET",
        headers: record ? { "content-type": "application/json" } : undefined,
        body: record ? "{}" : undefined,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load authority campaign evidence.");
      setPayload((data.evidence || data) as Payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  return (
    <section className="overflow-hidden rounded-[8px] border border-emerald-300/15 bg-[#050b18]/90 shadow-[0_18px_70px_rgba(0,0,0,0.32)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">V4.8.0-V4.9.4 AUTHORITY CAMPAIGN</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">{en ? "Authority campaign readiness" : "权威证据活动就绪度"}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-400">
            {en
              ? "Profiles, opaque credential references, assignments, nonce-bound challenges, receipt quarantine, freshness, and escrow coverage are executable. Authority control and release decisions remain independent."
              : "Profile、非明文凭据引用、观察者分配、nonce 绑定挑战、回执隔离、时效续期与 escrow 覆盖均可执行；权威控制和发布决策仍保持独立。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={busy}
          className="rounded-[6px] border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-300/15 disabled:opacity-50"
        >
          {busy ? (en ? "Checking..." : "核验中...") : (en ? "Record source gate" : "记录源码门槛")}
        </button>
      </div>

      <div className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-6">
        {[
          ["SOURCE", payload ? `${payload.totals.sourcePassed}/${payload.totals.versions}` : "--", "text-emerald-300"],
          ["LOCAL", payload ? `${payload.totals.localPassed}/${payload.totals.versions}` : "--", "text-amber-200"],
          ["PROFILES", payload ? String(payload.totals.registeredProfiles) : "--", "text-cyan-200"],
          ["CAMPAIGNS", payload ? String(payload.totals.campaigns) : "--", "text-violet-200"],
          ["COVERAGE", payload ? `${payload.totals.coveredMilestones}/14` : "--", "text-amber-200"],
          ["PRODUCTION", "BLOCKED", "text-rose-300"],
        ].map(([label, value, color]) => (
          <div key={label} className="border-r border-white/10 px-4 py-3 last:border-r-0">
            <p className="text-[9px] uppercase tracking-[0.15em] text-slate-500">{label}</p>
            <p className={`mt-1 text-sm font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {error ? <p className="border-b border-rose-300/15 bg-rose-400/10 px-5 py-3 text-xs text-rose-200">{error}</p> : null}
      <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-3">
        {(payload?.versions || []).map((version) => (
          <article key={version.version} className="min-h-[152px] bg-[#070d1c] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.14em] text-emerald-300">{version.version} · {version.track}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-100">{version.label}</h3>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase ${version.localStatus === "pass" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>{version.localStatus}</span>
            </div>
            <div className="mt-4 flex gap-3 text-[9px] uppercase tracking-[0.12em] text-slate-500"><span>{version.coverage}/14 {en ? "covered" : "已覆盖"}</span><span>{version.externalStatus}</span></div>
            {version.blockers[0] ? <p className="mt-3 text-[10px] leading-4 text-amber-100/60">{version.blockers[0]}</p> : null}
          </article>
        ))}
      </div>
      {payload ? <p className="border-t border-white/10 px-5 py-3 font-mono text-[10px] text-slate-600">SHA-256 {payload.stateDigest}</p> : null}
    </section>
  );
}
