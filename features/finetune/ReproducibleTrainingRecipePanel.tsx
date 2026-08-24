"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  checks: Record<string, boolean>;
  summary: {
    implementedBackends: number;
    samplePlanMode: string;
    qualityExportStatus: string;
  };
  blockers: string[];
  error?: string;
};

export function ReproducibleTrainingRecipePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (rehearse = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/finetune/reproducible-recipes", {
        method: rehearse ? "POST" : "GET",
        headers: rehearse ? { "content-type": "application/json" } : undefined,
        body: rehearse ? "{}" : undefined,
        cache: "no-store",
      });
      const body = (await response.json()) as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Training recipe evidence could not be loaded.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Training recipe evidence failed.",
      );
    } finally {
      setPending(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const passed = Object.values(payload?.checks || {}).filter(Boolean).length;
  const total = Object.keys(payload?.checks || {}).length;
  return (
    <section className="mt-4 border border-cyan-300/20 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-300">
            V1.11.3 REPRODUCIBLE TRAINING RECIPES
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en
              ? "Pinned recipe, fail-closed preflight, and package evidence"
              : "输入锁定配方、失败关闭预检与产物证据"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "The rehearsal validates a canonical recipe contract only. It never starts a worker or claims remote publication/read-back."
              : "演练仅验证规范化配方契约；不会启动训练 Worker，也不会把远端发布或读回宣称为已验证。"}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void load(true)}
          className="border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          {pending
            ? en
              ? "Running..."
              : "演练中..."
            : en
              ? "Run recipe rehearsal"
              : "运行配方演练"}
        </button>
      </div>
      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Stat label="LOCAL" value={payload?.localStatus || "hold"} />
        <Stat label="WORKER PLAN" value={payload?.summary.samplePlanMode || "--"} />
        <Stat label="BACKENDS" value={String(payload?.summary.implementedBackends ?? "--")} />
        <Stat label="CHECKS" value={payload ? `${passed}/${total}` : "--"} />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(payload?.checks || {}).map(([label, value]) => (
          <div
            key={label}
            className={`border p-2 text-xs ${
              value
                ? "border-emerald-300/20 bg-emerald-400/5 text-emerald-100"
                : "border-amber-300/20 bg-amber-400/5 text-amber-100"
            }`}
          >
            {value ? "PASS" : "HOLD"}
            <p className="mt-1 break-words text-slate-300">
              {label.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}
            </p>
          </div>
        ))}
      </div>
      {payload?.blockers.slice(0, 2).map((blocker) => (
        <p key={blocker} className="mt-3 text-xs leading-5 text-amber-200">
          HOLD · {blocker}
        </p>
      ))}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </article>
  );
}
