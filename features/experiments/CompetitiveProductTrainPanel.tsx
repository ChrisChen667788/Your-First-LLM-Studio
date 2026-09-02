"use client";

import { useCallback, useEffect, useState } from "react";

type Version = {
  version: string;
  label: string;
  sourceStatus: "pass";
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  contract: string;
  localEvidence: string;
  remainingGate: string;
};

type Payload = {
  ok: boolean;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  versions: Version[];
  totals: { sourcePassed: number; localPassed: number; localHeld: number; externalHeld: number };
  freshness: { freshSources: number; staleSources: number; reviewRequired: number; promotionEligible: boolean };
  disclosure: string;
  error?: string;
};

export function CompetitiveProductTrainPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (record = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/competitive-product-train", {
        method: record ? "POST" : "GET",
        headers: record ? { "content-type": "application/json" } : undefined,
        body: record ? "{}" : undefined,
        cache: "no-store",
      });
      const body = await response.json() as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Competitive product train request failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Competitive product train request failed.");
    } finally {
      setPending(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <section className="min-w-0 border border-cyan-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-300">V3.8.0–V3.9.4 PRODUCT TRAIN</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Competitive capability implementation and promotion truth" : "竞品能力实现与放行真相"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Fifteen source contracts are complete. Workload evidence, external acceptance and production approval remain separate gates."
              : "十五个源码契约已完成；真实 workload 证据、外部签收与生产批准仍是相互独立的门槛。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="shrink-0 border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/20 disabled:opacity-60"
        >
          {pending ? (en ? "Recording..." : "记录中...") : (en ? "Record local gate" : "记录本地门禁")}
        </button>
      </div>
      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {[
          ["SOURCE", payload ? `${payload.totals.sourcePassed}/15` : "--"],
          ["LOCAL", payload ? `${payload.totals.localPassed}/15` : "--"],
          ["FRESHNESS", payload?.freshness.promotionEligible ? "PASS" : "HOLD"],
          ["PRODUCTION", "HOLD"],
        ].map(([label, value]) => (
          <div key={label} className="border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-emerald-100">{payload?.freshness.freshSources ?? "--"} fresh sources</span>
        <span className="border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-amber-100">{payload?.freshness.staleSources ?? "--"} stale</span>
        <span className="border border-rose-300/20 bg-rose-400/10 px-2 py-1 text-rose-100">{payload?.freshness.reviewRequired ?? "--"} review required</span>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {payload?.versions.map((version) => (
          <article key={version.version} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <p className="text-sm font-semibold text-white">{version.version} · {version.label}</p>
            <p className="mt-1 text-xs text-cyan-200">SOURCE PASS · LOCAL {version.localStatus.toUpperCase()} · EXTERNAL HOLD</p>
            <p className="mt-3 break-all text-[11px] text-slate-500">{version.contract}</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{version.localEvidence}</p>
            <p className="mt-2 text-xs leading-5 text-amber-200">{version.remainingGate}</p>
          </article>
        ))}
      </div>
      <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-amber-100">
        {payload?.disclosure || (en ? "Loading product-train evidence..." : "正在加载产品列车证据...")}
      </p>
    </section>
  );
}
