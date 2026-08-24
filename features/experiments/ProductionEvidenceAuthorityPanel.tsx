"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  evidenceStatus: "missing" | "invalid" | "verified";
  authorizationStatus: "not-authorized";
  productionStatus: "blocked";
  checks: Record<string, boolean>;
  summary: {
    receiptTypes: string[];
    requiredReceiptTypes: readonly string[];
    independentAttestorOrganizations: number;
  };
  blockers: string[];
  error?: string;
};

export function ProductionEvidenceAuthorityPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/experiments/production-evidence-authority", {
        cache: "no-store",
      });
      const body = (await response.json()) as Payload;
      if (!response.ok) {
        throw new Error(body.error || "Production evidence authority could not be loaded.");
      }
      setPayload(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Production evidence authority failed.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const passed = Object.values(payload?.checks || {}).filter(Boolean).length;
  const total = Object.keys(payload?.checks || {}).length;
  return (
    <section className="border border-violet-300/30 bg-slate-950/70 p-4">
      <div>
        <p className="text-xs font-semibold uppercase text-violet-300">
          V2.0.1 PRODUCTION EVIDENCE AUTHORITY
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {en
            ? "Verify independently signed evidence; never self-authorize GA"
            : "校验独立签名凭证，但绝不自行授权 GA"}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          {en
            ? "The verifier reads a release-authority bundle from configured paths, checks its detached signature and pinned trust anchor, and leaves final production authorization outside this application."
            : "验证器只从受控路径读取发布权威提供的凭证包，校验分离签名与固定信任锚；最终生产授权始终在应用之外。"}
        </p>
      </div>
      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Stat label="EVIDENCE" value={payload?.evidenceStatus || "missing"} />
        <Stat label="AUTHORIZATION" value={payload?.authorizationStatus || "not-authorized"} />
        <Stat label="PRODUCTION" value={payload?.productionStatus || "blocked"} />
        <Stat label="CHECKS" value={payload ? `${passed}/${total}` : "--"} />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {(payload?.summary.requiredReceiptTypes || []).map((type) => {
          const verified = payload?.summary.receiptTypes.includes(type) || false;
          return (
            <div
              key={type}
              className={`border p-2 text-xs ${
                verified
                  ? "border-emerald-300/20 bg-emerald-400/5 text-emerald-100"
                  : "border-violet-300/20 bg-violet-400/5 text-violet-100"
              }`}
            >
              {verified ? "BUNDLE CLAIM" : "REQUIRED"}
              <p className="mt-1 break-words text-slate-300">{type}</p>
            </div>
          );
        })}
      </div>
      {payload?.blockers.slice(0, 3).map((blocker) => (
        <p key={blocker} className="mt-3 text-xs leading-5 text-violet-100">
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
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </article>
  );
}
