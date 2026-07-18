"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/layout/LocaleProvider";

type AcceptanceSlice = {
  id: string;
  title: string;
  status: "pass" | "hold";
  evidence: string;
};
type AcceptanceReceipt = {
  status: "pass" | "hold";
  generatedAt: string;
  model: string;
  runtime: {
    version: string | null;
    realProcess: boolean;
    realModel: boolean;
  };
  slices: AcceptanceSlice[];
  totals: {
    slices: number;
    passed: number;
    held: number;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    averageLatencyMs: number;
  };
  blockers: string[];
  evidenceDigest: string;
};
type AcceptanceEvidence = {
  schemaVersion: string;
  latest: AcceptanceReceipt | null;
  latestPassing: AcceptanceReceipt | null;
  capabilities: string[];
  error?: string;
};

function metric(
  label: string,
  value: string | number,
  accent = false,
) {
  return (
    <div className="border border-white/10 bg-white/[0.025] px-3 py-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold ${
          accent ? "text-emerald-200" : "text-slate-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function LocalServerAcceptancePanel() {
  const { locale } = useLocale();
  const isEnglish = locale.startsWith("en");
  const [evidence, setEvidence] = useState<AcceptanceEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/models/local-server-acceptance", {
        cache: "no-store",
      });
      const payload = (await response.json()) as AcceptanceEvidence;
      if (!response.ok) {
        throw new Error(payload.error || "Local Server evidence request failed.");
      }
      setEvidence(payload);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Local Server evidence request failed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAcceptance() {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/models/local-server-acceptance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "qwen3:0.6b" }),
      });
      const payload = (await response.json()) as {
        receipt?: AcceptanceReceipt;
        evidence?: AcceptanceEvidence;
        error?: string;
      };
      if (!response.ok && !payload.receipt) {
        throw new Error(payload.error || "Local Server acceptance failed.");
      }
      if (payload.evidence) setEvidence(payload.evidence);
      if (payload.receipt?.status === "hold") {
        setError(
          isEnglish
            ? "The run completed with held slices. Review the evidence below."
            : "验收已完成，但仍有 HOLD 切片，请查看下方证据。",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Local Server acceptance failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  const receipt = evidence?.latest || null;
  const status = receipt?.status || "hold";

  return (
    <section className="border border-cyan-300/15 bg-slate-950/55 px-5 py-5 shadow-[0_20px_70px_rgba(2,6,23,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            LOCAL SERVER ACCEPTANCE
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {isEnglish
              ? "Real Ollama lifecycle and OpenAI API evidence"
              : "真实 Ollama 生命周期与 OpenAI API 证据"}
          </h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
            {isEnglish
              ? "Fifteen slices exercise the live runtime, model residency, streaming, concurrency, accounting, policy, eviction, and recovery without claiming separate-device LAN or long-duration daemon proof."
              : "十五个切片直接验证真实 runtime、模型驻留、流式、并发、计量、策略、驱逐与恢复；跨设备 LAN 和长时 daemon 证据仍保持独立门禁。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`border px-2.5 py-1 text-xs font-semibold uppercase ${
              status === "pass"
                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                : "border-amber-300/30 bg-amber-300/10 text-amber-100"
            }`}
          >
            {loading ? "checking" : receipt ? status : "evidence needed"}
          </span>
          <button
            type="button"
            onClick={() => void runAcceptance()}
            disabled={loading || running}
            className="h-8 border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-50"
          >
            {running
              ? isEnglish
                ? "Running 15 slices..."
                : "正在运行 15 项..."
              : isEnglish
                ? "Run acceptance"
                : "运行验收"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || running}
            className="h-8 border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
          >
            {isEnglish ? "Refresh" : "刷新"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {receipt ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            {metric("Runtime", `Ollama ${receipt.runtime.version || "--"}`, true)}
            {metric("Model", receipt.model)}
            {metric(
              "Slices",
              `${receipt.totals.passed}/${receipt.totals.slices}`,
              receipt.status === "pass",
            )}
            {metric("Requests", receipt.totals.requests)}
            {metric(
              "Tokens",
              receipt.totals.promptTokens + receipt.totals.completionTokens,
            )}
            {metric("Avg latency", `${receipt.totals.averageLatencyMs} ms`)}
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {receipt.slices.map((slice, index) => (
              <div
                key={slice.id}
                className={`border px-3 py-3 ${
                  slice.status === "pass"
                    ? "border-emerald-300/15 bg-emerald-300/[0.045]"
                    : "border-amber-300/20 bg-amber-300/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-100">
                    {String(index + 1).padStart(2, "0")} · {slice.title}
                  </p>
                  <span
                    className={
                      slice.status === "pass"
                        ? "text-[10px] font-semibold text-emerald-300"
                        : "text-[10px] font-semibold text-amber-200"
                    }
                  >
                    {slice.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                  {slice.evidence}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 break-all text-[11px] text-slate-500">
            SHA-256 evidence · {receipt.evidenceDigest}
          </p>
        </>
      ) : (
        <p className="mt-4 border border-white/10 bg-white/[0.025] px-3 py-3 text-sm text-slate-400">
          {isEnglish
            ? "No real Local Server acceptance receipt has been retained yet."
            : "尚未留存真实 Local Server 验收 receipt。"}
        </p>
      )}
    </section>
  );
}
