"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AcceptanceSlice = {
  id: string;
  version: "v1.3.1" | "v1.4.0" | "v1.4.1";
  domain: "governance" | "workflow" | "evaluation";
  label: string;
  status: "pass" | "hold";
  summary: string;
};

type AcceptanceReceipt = {
  generatedAt: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: AcceptanceSlice[];
  totals: { slices: number; passed: number; held: number };
  productionBlockers: string[];
  evidenceDigest: string;
};

type AcceptancePayload = {
  ok: boolean;
  localStatus: "pass" | "evidence-needed";
  productionStatus: "hold";
  latest: AcceptanceReceipt | null;
  totals: { slices: number; passed: number; held: number };
  productionBlockers: string[];
  productionBridges?: {
    localStatus: "pass" | "hold";
    productionStatus: "hold";
    bridges: Array<{
      id: string;
      label: string;
      localStatus: "pass" | "hold" | "evidence-needed";
      productionStatus: "hold";
      summary: string;
      blockers: string[];
    }>;
  };
  error?: string;
};

const DOMAIN_ORDER = ["governance", "workflow", "evaluation"] as const;

function tone(status: AcceptanceSlice["status"]) {
  return status === "pass"
    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
    : "border-amber-300/25 bg-amber-400/10 text-amber-100";
}

export function V14AcceptancePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<AcceptancePayload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (run = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/v14-acceptance", {
        method: run ? "POST" : "GET",
        cache: "no-store",
        headers: run ? { "content-type": "application/json" } : undefined,
        body: run ? "{}" : undefined,
      });
      const body = await response.json() as AcceptancePayload & {
        evidence?: AcceptancePayload;
      };
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "v1.4 acceptance failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "v1.4 acceptance failed.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(
    () => DOMAIN_ORDER.map((domain) => ({
      domain,
      slices: payload?.latest?.slices.filter((slice) => slice.domain === domain) || [],
    })),
    [payload],
  );

  return (
    <section
      className="border border-emerald-300/20 bg-slate-950/75 p-4 backdrop-blur"
      data-evidence-ready={Boolean(payload?.latest)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-300">
            V1.4 ACCEPTANCE TRAIN
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Identity, worker, and quality gates" : "身份、Worker 与质量晋级门槛"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Fifteen local contract checks cover enterprise identity delivery, distributed worker recovery, and reproducible quality CI. External production receipts remain separate."
              : "15 项本地合同检查覆盖企业身份投递、分布式 Worker 恢复和可复现质量 CI；外部生产回执继续独立判定。"}
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
              ? en ? "Running..." : "运行中..."
              : en ? "Run 15 checks" : "运行 15 项验收"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.domain}>
            <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
              <p className="text-xs font-semibold uppercase text-slate-300">{group.domain}</p>
              <span className="text-[10px] text-slate-500">{group.slices.filter((slice) => slice.status === "pass").length}/5</span>
            </div>
            <div className="grid gap-2">
              {group.slices.length ? group.slices.map((slice) => (
                <article key={slice.id} className="border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">{slice.version}</p>
                      <h3 className="mt-1 text-sm font-semibold text-white">{slice.label}</h3>
                    </div>
                    <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${tone(slice.status)}`}>
                      {slice.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{slice.summary}</p>
                </article>
              )) : Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="h-20 animate-pulse border border-white/10 bg-white/[0.025]" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {payload?.productionBridges ? (
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase text-cyan-300">
                REAL INFRASTRUCTURE BRIDGES
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">
                {en ? "Adapter evidence, production held" : "真实 Adapter 证据，生产继续 HOLD"}
              </h3>
            </div>
            <span className="border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase text-amber-100">
              Production hold
            </span>
          </div>
          <div className="grid gap-2 xl:grid-cols-3">
            {payload.productionBridges.bridges.map((bridge) => (
              <article key={bridge.id} className="border border-white/10 bg-black/25 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white">{bridge.label}</h4>
                  <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${
                    bridge.localStatus === "pass"
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                      : "border-amber-300/25 bg-amber-400/10 text-amber-100"
                  }`}>
                    {bridge.localStatus}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{bridge.summary}</p>
                <p className="mt-2 text-[11px] leading-5 text-amber-200/80">
                  {bridge.blockers[0]}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

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
