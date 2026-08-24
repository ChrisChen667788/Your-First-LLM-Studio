"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  decisionStatus: "missing" | "invalid" | "approved" | "rejected";
  authorizationStatus: "not-authorized";
  productionStatus: "blocked";
  checks: Record<string, boolean>;
  summary: {
    decisionId: string | null;
    declaredDecision: string | null;
    issuerOrganizationId: string | null;
  };
  blockers: string[];
  error?: string;
};

export function ReleaseAuthorityDecisionLedgerPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/experiments/release-authority-decision", {
        cache: "no-store",
      });
      const body = (await response.json()) as Payload;
      if (!response.ok) {
        throw new Error(body.error || "Release-authority decision could not be loaded.");
      }
      setPayload(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Release-authority decision failed.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const passed = Object.values(payload?.checks || {}).filter(Boolean).length;
  const total = Object.keys(payload?.checks || {}).length;
  return (
    <section className="border border-fuchsia-300/30 bg-slate-950/70 p-4">
      <div>
        <p className="text-xs font-semibold uppercase text-fuchsia-300">
          V2.0.2 RELEASE AUTHORITY DECISION LEDGER
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {en
            ? "Read an independent decision without executing it locally"
            : "读取独立发布决定，但不在本地执行"}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          {en
            ? "A decision must be separately signed, trust-pinned, fresh, rollback-bound, and tied to the verified evidence digest. This screen is a decision projection, not a production switch."
            : "决定必须使用独立签名与信任锚、保持时效、绑定回滚计划，并关联已验证的凭证摘要；本页面只投影决定，不是生产开关。"}
        </p>
      </div>
      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Stat label="DECISION" value={payload?.decisionStatus || "missing"} />
        <Stat label="AUTHORIZATION" value={payload?.authorizationStatus || "not-authorized"} />
        <Stat label="PRODUCTION" value={payload?.productionStatus || "blocked"} />
        <Stat label="CHECKS" value={payload ? `${passed}/${total}` : "--"} />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(payload?.checks || {}).map(([label, value]) => (
          <div
            key={label}
            className={`border p-2 text-xs ${
              value
                ? "border-emerald-300/20 bg-emerald-400/5 text-emerald-100"
                : "border-fuchsia-300/20 bg-fuchsia-400/5 text-fuchsia-100"
            }`}
          >
            {value ? "VERIFIED" : "HOLD"}
            <p className="mt-1 break-words text-slate-300">
              {label.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}
            </p>
          </div>
        ))}
      </div>
      {payload?.blockers.slice(0, 3).map((blocker) => (
        <p key={blocker} className="mt-3 text-xs leading-5 text-fuchsia-100">
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
