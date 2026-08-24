"use client";

import { useCallback, useEffect, useState } from "react";

type Version = {
  version: string;
  label: string;
  evidenceStatus: "missing" | "invalid" | "verified";
  sourceContracts: string[];
  blockers: string[];
  externalBlocker: string;
};

type Payload = {
  ok: boolean;
  productionStatus: "blocked";
  summary: { verifiedVersions: number; requiredVersions: number; chainComplete: boolean };
  versions: Version[];
  blockers: string[];
  error?: string;
};

export function PostGaOperationsTrainPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/experiments/post-ga-operations-train", {
        cache: "no-store",
      });
      const body = (await response.json()) as Payload;
      if (!response.ok) throw new Error(body.error || "Post-GA operations evidence could not be loaded.");
      setPayload(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Post-GA operations evidence failed.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="min-w-0 border border-cyan-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-300">V2.1.0–V2.1.9 POST-GA OPERATIONS</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Ten externally attested operational controls" : "十项由外部证明的生产后运营控制"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Continuity, SLO, change, data, access, supply chain, quality, capacity, recovery, and independent review follow the v2.0 closure archive. This page verifies supplied signatures only; it cannot operate or authorize production."
              : "连续性、SLO、变更、数据、访问、供应链、质量、容量、灾备与独立复核均从 v2.0 闭环归档继续。此页面仅验证外部签名，不能操作或授权生产。"}
          </p>
        </div>
        <div className="border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-right">
          <p className="text-[10px] uppercase text-amber-200">PRODUCTION</p>
          <p className="mt-1 text-sm font-semibold text-amber-50">{payload?.productionStatus || "blocked"}</p>
        </div>
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          ["SOURCE", "10/10"],
          ["EXTERNAL VERIFIED", payload ? `${payload.summary.verifiedVersions}/${payload.summary.requiredVersions}` : "--"],
          ["CHAIN", payload ? (payload.summary.chainComplete ? "complete" : "incomplete") : "--"],
        ].map(([label, value]) => (
          <article key={label} className="border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {payload?.versions.map((version) => (
          <article key={version.version} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <p className="text-sm font-semibold text-white">{version.version} · {version.label}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-cyan-200">SOURCE PASS · EVIDENCE {version.evidenceStatus.toUpperCase()}</p>
            <p className="mt-3 text-xs leading-5 text-slate-300">{version.sourceContracts.join(" · ")}</p>
            {version.blockers.slice(0, 1).map((blocker) => (
              <p key={blocker} className="mt-3 text-xs leading-5 text-amber-100">{blocker}</p>
            ))}
            <p className="mt-2 text-xs leading-5 text-slate-400">{version.externalBlocker}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
