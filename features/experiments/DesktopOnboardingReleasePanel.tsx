"use client";

import { useCallback, useEffect, useState } from "react";

type Step = {
  id: string;
  label: string;
  status: "pass" | "watch" | "blocked";
  summary: string;
};

type Payload = {
  ok: true;
  version: string;
  status: "ga-ready" | "rc-ready" | "evidence-needed";
  localRcReady: boolean;
  gaReady: boolean;
  steps: Step[];
  totals: { pass: number; watch: number; blocked: number };
  gaBlockers: string[];
};

function tone(status: Step["status"]) {
  if (status === "pass") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (status === "watch") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  return "border-rose-300/30 bg-rose-400/10 text-rose-100";
}

export function DesktopOnboardingReleasePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (rehearse = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/desktop/onboarding-release", {
        method: rehearse ? "POST" : "GET",
        cache: "no-store",
      });
      const body = (await response.json()) as Payload & { evidence?: Payload; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "Failed to load desktop release evidence.");
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load desktop release evidence.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="border border-cyan-300/15 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">V1.1 DESKTOP RELEASE DESK</p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            {en ? "Desktop onboarding release candidate" : "桌面首次启动发布候选"}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "One evidence chain for the app bundle, first-run diagnosis, permission repair, service recovery, data migration, update rollback, and a real local-chat proof. Apple notarization stays separate."
              : "用一条证据链收口应用包、首次诊断、权限修复、服务恢复、数据迁移、更新回滚和真实本地对话；Apple notarization 保持独立门禁。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {payload ? (
            <span className={`border px-3 py-2 text-xs uppercase ${payload.localRcReady ? tone("pass") : tone("blocked")}`}>
              {payload.version} · {payload.status}
            </span>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => void load(true)}
            className="border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-400/20 disabled:opacity-50"
          >
            {pending ? (en ? "Running..." : "演练中...") : en ? "Run lifecycle rehearsal" : "运行生命周期演练"}
          </button>
        </div>
      </div>
      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {payload?.steps.map((step) => (
          <article key={step.id} className="min-h-36 border border-white/10 bg-black/25 p-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-white">{step.label}</h4>
              <span className={`border px-2 py-1 text-[10px] uppercase ${tone(step.status)}`}>{step.status}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{step.summary}</p>
          </article>
        ))}
      </div>
      {payload?.gaBlockers[0] ? (
        <p className="mt-3 border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
          GA gate: {payload.gaBlockers.join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
