"use client";

import { useCallback, useEffect, useState } from "react";

type Stage = {
  status: "missing" | "invalid" | "verified";
  checks: Record<string, boolean>;
  blockers: string[];
};
type Payload = {
  productionStatus: "blocked";
  stages: { transition: Stage; rollback: Stage; closure: Stage };
  summary: { verifiedStages: number; requiredStages: 3; chainComplete: boolean };
  blockers: string[];
  error?: string;
};

export function ProductionLifecycleClosurePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/experiments/production-lifecycle-closure", {
        cache: "no-store",
      });
      const body = (await response.json()) as Payload;
      if (!response.ok) throw new Error(body.error || "Production lifecycle could not be loaded.");
      setPayload(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Production lifecycle failed.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const stages = [
    ["v2.0.3", en ? "Transition witness" : "转场见证", payload?.stages.transition],
    ["v2.0.4", en ? "Rollback witness" : "回滚见证", payload?.stages.rollback],
    ["v2.0.5", en ? "Closure archive" : "闭环归档", payload?.stages.closure],
  ] as const;
  return (
    <section className="border border-cyan-300/30 bg-slate-950/70 p-4">
      <div>
        <p className="text-xs font-semibold uppercase text-cyan-300">
          V2.0.3–V2.0.5 PRODUCTION LIFECYCLE CLOSURE
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {en
            ? "Independent transition, rollback, and archive witnesses"
            : "独立转场、回滚与归档见证"}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          {en
            ? "Each stage reads a separately signed external artifact with its own trust anchor. A complete chain remains evidence only: this studio never executes or authorizes production state changes."
            : "每一阶段均读取独立签名、独立信任锚的外部产物。即使链路完整，也只构成证据；本工作台不会执行或授权生产状态变更。"}
        </p>
      </div>
      {error ? <p className="mt-4 text-sm text-rose-100">{error}</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Stat label="VERIFIED" value={payload ? `${payload.summary.verifiedStages}/3` : "--"} />
        <Stat label="CHAIN" value={payload?.summary.chainComplete ? "complete" : "hold"} />
        <Stat label="PRODUCTION" value={payload?.productionStatus || "blocked"} />
        <Stat label="MODE" value="read-only" />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {stages.map(([version, label, stage]) => (
          <article key={version} className="border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase text-slate-500">{version}</p>
            <p className="mt-1 font-semibold text-white">{label}</p>
            <p className="mt-2 text-xs text-cyan-100">{stage?.status || "missing"}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {stage ? `${Object.values(stage.checks).filter(Boolean).length}/${Object.keys(stage.checks).length} checks` : "--"}
            </p>
            {stage?.blockers[0] ? <p className="mt-2 text-xs leading-5 text-cyan-100">HOLD · {stage.blockers[0]}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </article>
  );
}
