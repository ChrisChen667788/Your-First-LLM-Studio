"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivationIntakeControls } from "@/features/experiments/ActivationIntakeControls";
import { ActivationOperationsPanel } from "@/features/experiments/ActivationOperationsPanel";

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
    manifests: number;
    observations: number;
    quarantines: number;
    decisionRequests: number;
    decisionReceipts: number;
    coveredMilestones: number;
  };
  sourceStatus: "pass";
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  productionStatus: "blocked";
  versions: VersionState[];
  stateDigest: string;
};

export function ExternalEvidenceActivationTrainPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (record = false) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/evidence-external-activation-train", {
        method: record ? "POST" : "GET",
        headers: record ? { "content-type": "application/json" } : undefined,
        body: record ? "{}" : undefined,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load external evidence activation.");
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">V5.4.0-V5.5.4 ACTIVATION INTAKE</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">{en ? "Independent evidence activation boundary" : "独立证据激活边界"}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-400">
            {en
              ? "Activation manifests now bind relay and handoff lineage to verified stage imports, quarantine, fourteen-domain currentness, and a separate decision request. This panel never activates distribution or production."
              : "激活清单现已绑定 Relay 与 handoff 谱系、已核验阶段导入、隔离、14 域时效和独立决策请求；本面板不会激活分发或生产。"}
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
          ["MANIFESTS", payload ? String(payload.totals.manifests) : "--", "text-cyan-200"],
          ["OBSERVATIONS", payload ? String(payload.totals.observations) : "--", "text-violet-200"],
          ["COVERAGE", payload ? `${payload.totals.coveredMilestones}/14` : "--", "text-amber-200"],
          ["PRODUCTION", "BLOCKED", "text-rose-300"],
        ].map(([label, value, color]) => (
          <div key={label} className="border-r border-white/10 px-4 py-3 last:border-r-0">
            <p className="text-[9px] uppercase tracking-[0.15em] text-slate-500">{label}</p>
            <p className={`mt-1 text-sm font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <ActivationIntakeControls locale={locale} />
      <ActivationOperationsPanel locale={locale} />
      {error ? <p className="border-b border-rose-300/15 bg-rose-400/10 px-5 py-3 text-xs text-rose-200">{error}</p> : null}
      <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-3">
        {(payload?.versions || []).map((version) => (
          <article key={version.version} className="min-h-[154px] bg-[#070d1c] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{version.version} · {version.track}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-100">{version.label}</h3>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${version.localStatus === "pass" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
                {version.localStatus}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <span>{en ? "External" : "外部"} <b className="ml-1 text-amber-200">HOLD</b></span>
              <span>{en ? "Coverage" : "覆盖"} <b className="ml-1 text-cyan-200">{version.coverage}/14</b></span>
            </div>
            {version.blockers[0] ? <p className="mt-3 text-xs leading-5 text-slate-400">{version.blockers[0]}</p> : <p className="mt-3 text-xs leading-5 text-emerald-200/80">{en ? "Source contract is covered; external proof remains separately required." : "源码契约已覆盖；真实外部证明仍需独立提供。"}</p>}
          </article>
        ))}
      </div>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] leading-5 text-slate-500">
        {en
          ? "Only digest-bound metadata is retained. A manifest, accepted-looking decision receipt, or local source-gate record is not a distribution or production authorization."
          : "仅保留摘要绑定的元数据。激活清单、看似已接受的决策回执或本地源码门槛记录，都不是分发或生产授权。"}
      </div>
    </section>
  );
}
