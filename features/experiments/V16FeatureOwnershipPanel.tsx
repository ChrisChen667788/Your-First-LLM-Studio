"use client";

import { useCallback, useEffect, useState } from "react";

type Slice = {
  id: string;
  label: string;
  status: "pass" | "hold";
  summary: string;
};

type Receipt = {
  generatedAt: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: Slice[];
  totals: { slices: 15; passed: number; held: number };
  evidenceDigest: string;
};

type Payload = {
  ok: boolean;
  localStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  latest: Receipt | null;
  totals: { slices: 15; passed: number; held: number };
  productionBlockers: string[];
  error?: string;
};

export function V16FeatureOwnershipPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (run = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/experiments/v16-feature-ownership",
        {
          method: run ? "POST" : "GET",
          cache: "no-store",
          headers: run ? { "content-type": "application/json" } : undefined,
          body: run ? "{}" : undefined,
        },
      );
      const body = (await response.json()) as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "v1.6 feature ownership acceptance failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "v1.6 feature ownership acceptance failed.",
      );
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="border border-emerald-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-300">
            V1.6 FEATURE OWNERSHIP
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Foreground ownership closure" : "前台 Feature Ownership 收口"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Fifteen checks guard Fine-tune physical ownership, canonical Benchmark and Compare APIs, thin compatibility routes, and a Compare foreground shell independent from Agent mode state."
              : "15 项检查守住 Fine-tune 物理归属、Benchmark/Compare canonical API、薄兼容路由，以及不再依赖 Agent 模式状态的 Compare 前台 shell。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 border border-white/10 bg-black/25 text-center">
            <div className="border-r border-white/10 px-4 py-2">
              <p className="text-[10px] uppercase text-slate-500">Local</p>
              <p className="mt-1 text-sm font-semibold text-emerald-100">
                {payload?.totals.passed || 0}/{payload?.totals.slices || 15}
              </p>
            </div>
            <div className="px-4 py-2">
              <p className="text-[10px] uppercase text-slate-500">Production</p>
              <p className="mt-1 text-sm font-semibold text-amber-100">HOLD</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={pending}
            className="border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/20 disabled:cursor-wait disabled:opacity-60"
          >
            {pending
              ? en
                ? "Running..."
                : "运行中..."
              : en
                ? "Run 15 checks"
                : "运行 15 项验收"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {payload?.latest?.slices.length ? (
          payload.latest.slices.map((entry) => (
            <article key={entry.id} className="border border-white/10 bg-black/25 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{entry.label}</h3>
                <span
                  className={`border px-2 py-1 text-[10px] font-semibold uppercase ${
                    entry.status === "pass"
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                      : "border-amber-300/25 bg-amber-400/10 text-amber-100"
                  }`}
                >
                  {entry.status}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">{entry.summary}</p>
            </article>
          ))
        ) : (
          <div className="h-24 animate-pulse border border-white/10 bg-white/[0.025] md:col-span-2 xl:col-span-3" />
        )}
      </div>

      {payload?.latest ? (
        <div className="mt-4 grid gap-2 border-t border-white/10 pt-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <p className="text-xs leading-5 text-amber-200">
            {payload.productionBlockers[0]}
          </p>
          <p className="text-[10px] uppercase text-slate-500">
            SHA-256 {payload.latest.evidenceDigest.slice(0, 16)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
