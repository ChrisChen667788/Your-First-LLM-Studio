"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  productionStatus: "blocked";
  checks: Record<string, boolean>;
  externalGates: Record<string, boolean>;
  summary: {
    controlPlaneStatus: string;
    externalReadinessStatus: string;
    desktopAcceptanceReady: boolean;
    productionEvidenceBundleStatus: string;
    localChecksPassed: number;
    localChecksTotal: number;
  };
  blockers: string[];
  error?: string;
};

export function EnterpriseProductionGaPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (capture = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/enterprise-production-ga", {
        method: capture ? "POST" : "GET",
        headers: capture ? { "content-type": "application/json" } : undefined,
        body: capture ? "{}" : undefined,
        cache: "no-store",
      });
      const body = (await response.json()) as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Enterprise production GA evidence could not be loaded.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Enterprise production GA evidence failed.",
      );
    } finally {
      setPending(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="border border-rose-300/30 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-rose-300">
            V2.0.0 ENTERPRISE PRODUCTION GA
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en
              ? "Independent production receipt reconciliation"
              : "独立生产凭证的统一核对"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "This panel can capture a local reconciliation snapshot, but it is designed to stay BLOCKED until independently controlled identity, HA, billing, security, distribution, and organization receipts are verified."
              : "该面板可保存本地核对快照，但在独立身份、HA、计费、安全、分发与组织凭证完成验证前，状态会保持 BLOCKED。"}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void load(true)}
          className="border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-50"
        >
          {pending
            ? en
              ? "Capturing..."
              : "保存中..."
            : en
              ? "Capture local reconciliation"
              : "保存本地核对快照"}
        </button>
      </div>
      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Stat label="LOCAL" value={payload?.localStatus || "hold"} />
        <Stat label="EXTERNAL" value={payload?.externalStatus || "hold"} />
        <Stat label="PRODUCTION" value={payload?.productionStatus || "blocked"} />
        <Stat
          label="LOCAL CHECKS"
          value={payload ? `${payload.summary.localChecksPassed}/${payload.summary.localChecksTotal}` : "--"}
        />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(payload?.externalGates || {}).map(([label, value]) => (
          <Gate key={label} label={label} value={value} />
        ))}
      </div>
      {payload?.blockers.slice(0, 3).map((blocker) => (
        <p key={blocker} className="mt-3 text-xs leading-5 text-rose-200">
          BLOCKED · {blocker}
        </p>
      ))}
    </section>
  );
}

function Gate({ label, value }: { label: string; value: boolean }) {
  return (
    <div
      className={`border p-2 text-xs ${
        value
          ? "border-emerald-300/20 bg-emerald-400/5 text-emerald-100"
          : "border-rose-300/20 bg-rose-400/5 text-rose-100"
      }`}
    >
      {value ? "VERIFIED" : "EXTERNAL HOLD"}
      <p className="mt-1 break-words text-slate-300">
        {label.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}
      </p>
    </div>
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
