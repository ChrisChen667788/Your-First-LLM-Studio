"use client";

import { useCallback, useEffect, useState } from "react";

type VersionState = {
  version: string;
  label: string;
  owner: string;
  track: string;
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  productionStatus: "blocked";
  currentSignal: { summary: string };
  candidateReceipts: number;
  localGate: string;
};

type Payload = {
  totals: {
    versions: number;
    sourcePassed: number;
    localPassed: number;
    localHeld: number;
    candidateReceipts: number;
  };
  sourceStatus: "pass";
  localStatus: "pass" | "hold";
  productionStatus: "blocked";
  versions: VersionState[];
  stateDigest: string;
};

export function EvidenceOperationsTrainPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (record = false) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/evidence-operations-train", {
        method: record ? "POST" : "GET",
        headers: record ? { "content-type": "application/json" } : undefined,
        body: record ? "{}" : undefined,
        cache: "no-store",
      });
      const data = await response.json();
      const next = (data.evidence || data) as Payload;
      if (!response.ok && response.status !== 422) throw new Error(data.error || "Unable to load evidence operations.");
      setPayload(next);
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">V4.0.0-V4.1.4 EVIDENCE OPERATIONS</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">
            {en ? "Observed evidence intake and promotion" : "真实运行证据接收与晋级"}
          </h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-400">
            {en
              ? "Strict candidate receipts can close local evidence only. External assurance and production authority remain independent."
              : "严格候选回执只能闭环本地证据；外部签收与生产授权仍是独立门槛。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={busy}
          className="rounded-[6px] border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-50"
        >
          {busy ? (en ? "Checking..." : "核验中...") : (en ? "Record source gate" : "记录源码门槛")}
        </button>
      </div>

      <div className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-5">
        {[
          ["SOURCE", payload ? `${payload.totals.sourcePassed}/${payload.totals.versions}` : "--", "text-emerald-300"],
          ["LOCAL", payload ? `${payload.totals.localPassed}/${payload.totals.versions}` : "--", "text-amber-200"],
          ["CANDIDATES", payload ? String(payload.totals.candidateReceipts) : "--", "text-cyan-200"],
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
          <article key={version.version} className="min-h-[164px] bg-[#070d1c] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.14em] text-cyan-300">{version.version} · {version.track}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-100">{version.label}</h3>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase ${version.localStatus === "pass" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>
                {version.localStatus}
              </span>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">{version.currentSignal.summary}</p>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">{version.localGate}</p>
            <div className="mt-3 flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-slate-600">
              <span>{version.owner}</span>
              <span>{version.candidateReceipts} receipt</span>
            </div>
          </article>
        ))}
      </div>

      {payload ? <p className="border-t border-white/10 px-5 py-3 font-mono text-[10px] text-slate-600">SHA-256 {payload.stateDigest}</p> : null}
    </section>
  );
}
