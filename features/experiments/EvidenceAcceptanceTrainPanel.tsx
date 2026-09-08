"use client";

import { useCallback, useEffect, useState } from "react";

type VersionState = {
  version: string;
  label: string;
  track: string;
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  verifiedCoverage: number;
  blockers: string[];
};

type Payload = {
  totals: {
    versions: number;
    sourcePassed: number;
    localPassed: number;
    verifiedPackages: number;
    verifiedMilestones: number;
  };
  sourceStatus: "pass";
  localStatus: "pass" | "hold";
  productionStatus: "blocked";
  versions: VersionState[];
  stateDigest: string;
};

export function EvidenceAcceptanceTrainPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (record = false) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/evidence-acceptance-train", {
        method: record ? "POST" : "GET",
        headers: record ? { "content-type": "application/json" } : undefined,
        body: record ? "{}" : undefined,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load evidence acceptance.");
      setPayload((data.evidence || data) as Payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  return (
    <section className="overflow-hidden rounded-[8px] border border-cyan-300/15 bg-[#050b18]/90 shadow-[0_18px_70px_rgba(0,0,0,0.32)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">V4.6.0-V4.7.4 ACCEPTANCE LIFECYCLE</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">{en ? "Independent acceptance lifecycle" : "独立验收生命周期控制"}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-400">
            {en
              ? "The intake, verification, revocation, portable import, and handoff boundaries are executable, while external authority, archive, distribution, and production decisions remain separate and fail-closed."
              : "接收、核验、撤销、可携导入与交接边界均可执行；外部权威、归档、分发与生产决策仍严格独立并保持 fail-closed。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={busy}
          className="rounded-[6px] border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-300/15 disabled:opacity-50"
        >
          {busy ? (en ? "Checking..." : "核验中...") : (en ? "Record source gate" : "记录源码门槛")}
        </button>
      </div>

      <div className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-6">
        {[
          ["SOURCE", payload ? `${payload.totals.sourcePassed}/${payload.totals.versions}` : "--", "text-emerald-300"],
          ["LOCAL", payload ? `${payload.totals.localPassed}/${payload.totals.versions}` : "--", "text-amber-200"],
          ["PACKAGES", payload ? String(payload.totals.verifiedPackages) : "--", "text-cyan-200"],
          ["COVERAGE", payload ? `${payload.totals.verifiedMilestones}/14` : "--", "text-violet-200"],
          ["EXTERNAL", "HOLD", "text-amber-200"],
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
                <p className="text-[9px] uppercase tracking-[0.14em] text-cyan-300">{version.version} · {version.track}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-100">{version.label}</h3>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase ${version.localStatus === "pass" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>{version.localStatus}</span>
            </div>
            <div className="mt-4 flex gap-3 text-[9px] uppercase tracking-[0.12em] text-slate-500"><span>{version.verifiedCoverage}/14 {en ? "verified" : "已核验"}</span><span>{version.externalStatus}</span></div>
            {version.blockers[0] ? <p className="mt-3 text-[10px] leading-4 text-amber-100/60">{version.blockers[0]}</p> : null}
          </article>
        ))}
      </div>
      {payload ? <p className="border-t border-white/10 px-5 py-3 font-mono text-[10px] text-slate-600">SHA-256 {payload.stateDigest}</p> : null}
    </section>
  );
}
