"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/layout/LocaleProvider";

type BackendEvidence = {
  backend: "mlx" | "ollama" | "llama.cpp";
  status: "pass" | "hold";
  realProcess: boolean;
  model: string;
  discoveredModels: number;
  runtimeVersion: string | null;
  fingerprint: string | null;
  checks: Record<string, boolean>;
  metrics: {
    chatLatencyMs: number;
    streamLatencyMs: number;
    streamChunks: number;
    promptTokens: number;
    completionTokens: number;
  };
  error: { code: string; message: string } | null;
};

type AcceptanceReceipt = {
  status: "pass" | "hold";
  generatedAt: string;
  host: {
    platformKey: string;
    memoryGb: number;
    accelerator: string;
  };
  backends: BackendEvidence[];
  adapterContract: {
    implemented: number;
    conformant: number;
    planned: number;
    operationChecks: number;
    normalizedOperationChecks: number;
  };
  compatibilityMatrix: Array<{
    backend: string;
    modelFormat: string;
    compatible: boolean;
    codes: string[];
    reasons: string[];
  }>;
  totals: {
    realBackends: number;
    passingBackends: number;
    adapterContracts: number;
    compatibleProfiles: number;
    rejectedProfiles: number;
    promptTokens: number;
    completionTokens: number;
    averageLatencyMs: number;
  };
  blockers: string[];
  evidenceDigest: string;
};

type AcceptanceResponse = {
  latest: AcceptanceReceipt | null;
  latestPassing: AcceptanceReceipt | null;
  error?: string;
};

type PromotionResponse = {
  localStatus: "pass" | "evidence-needed";
  productionStatus: "hold";
  productionBlockers: string[];
  evidenceDigest: string;
};

function statusClass(status: "pass" | "hold" | "evidence-needed") {
  return status === "pass"
    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
    : "border-amber-300/30 bg-amber-300/10 text-amber-100";
}

export function RuntimeFabricEvidencePanel() {
  const { locale } = useLocale();
  const isEnglish = locale.startsWith("en");
  const [acceptance, setAcceptance] =
    useState<AcceptanceResponse | null>(null);
  const [promotion, setPromotion] = useState<PromotionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [acceptanceResponse, promotionResponse] = await Promise.all([
        fetch("/api/runtime/fabric-acceptance", { cache: "no-store" }),
        fetch("/api/runtime/fabric-promotion", { cache: "no-store" }),
      ]);
      const [acceptancePayload, promotionPayload] = (await Promise.all([
        acceptanceResponse.json(),
        promotionResponse.json(),
      ])) as [AcceptanceResponse, PromotionResponse];
      if (!acceptanceResponse.ok) {
        throw new Error(
          acceptancePayload.error || "Runtime Fabric evidence failed.",
        );
      }
      setAcceptance(acceptancePayload);
      setPromotion(promotionPayload);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Runtime Fabric evidence failed.",
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
      const response = await fetch("/api/runtime/fabric-acceptance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          models: {
            mlx: "local-qwen3-0.6b",
            ollama: "qwen3:0.6b",
            "llama.cpp": "qwen3-0.6b-llamacpp",
          },
        }),
      });
      const payload = (await response.json()) as {
        receipt?: AcceptanceReceipt;
        evidence?: AcceptanceResponse;
        error?: string;
      };
      if (!response.ok && !payload.receipt) {
        throw new Error(payload.error || "Runtime Fabric acceptance failed.");
      }
      if (payload.evidence) setAcceptance(payload.evidence);
      await load();
      if (payload.receipt?.status === "hold") {
        setError(
          isEnglish
            ? "The run completed with held backends. Review the normalized errors below."
            : "验收已完成，但仍有后端处于 HOLD，请查看标准化错误。",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Runtime Fabric acceptance failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  const receipt = acceptance?.latest || null;
  const localStatus = promotion?.localStatus || "evidence-needed";

  return (
    <section className="border border-sky-300/15 bg-slate-950/55 px-5 py-5 shadow-[0_20px_70px_rgba(2,6,23,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">
            RUNTIME FABRIC · v1.2.1
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {isEnglish
              ? "One contract across MLX, Ollama, llama.cpp, and remote runtimes"
              : "统一 MLX、Ollama、llama.cpp 与远端 runtime 合同"}
          </h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
            {isEnglish
              ? "Real local inference proves the shared health, discovery, chat, streaming, usage, and failure shape. LocalAI, vLLM, and SGLang use the same adapter port and fail before execution when endpoint or hardware requirements are missing."
              : "真实本地推理验证统一健康、发现、聊天、流式、计量和失败形状；LocalAI、vLLM、SGLang 复用同一适配端口，并在端点或硬件条件不满足时于执行前拒绝。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`border px-2.5 py-1 text-xs font-semibold uppercase ${statusClass(localStatus)}`}
          >
            LOCAL {loading ? "checking" : localStatus}
          </span>
          <span className={`border px-2.5 py-1 text-xs font-semibold uppercase ${statusClass("hold")}`}>
            PROD {promotion?.productionStatus || "hold"}
          </span>
          <button
            type="button"
            onClick={() => void runAcceptance()}
            disabled={loading || running}
            className="h-8 border border-sky-300/20 bg-sky-300/10 px-3 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/15 disabled:opacity-50"
          >
            {running
              ? isEnglish
                ? "Running fabric..."
                : "正在验证..."
              : isEnglish
                ? "Run fabric"
                : "运行 Fabric"}
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
            {[
              ["Host", `${receipt.host.platformKey} · ${receipt.host.accelerator}`],
              ["Memory", `${receipt.host.memoryGb} GB`],
              ["Real backends", `${receipt.totals.passingBackends}/${receipt.totals.realBackends}`],
              ["Adapter contracts", `${receipt.adapterContract.conformant}/${receipt.adapterContract.implemented}`],
              ["Operations", `${receipt.adapterContract.normalizedOperationChecks}/${receipt.adapterContract.operationChecks}`],
              ["Avg latency", `${receipt.totals.averageLatencyMs} ms`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border border-white/10 bg-white/[0.025] px-3 py-3"
              >
                <p className="text-[10px] uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {receipt.backends.map((backend) => (
              <div
                key={backend.backend}
                className={`border px-3 py-3 ${
                  backend.status === "pass"
                    ? "border-emerald-300/15 bg-emerald-300/[0.045]"
                    : "border-amber-300/20 bg-amber-300/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {backend.backend}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {backend.model}
                    </p>
                  </div>
                  <span
                    className={
                      backend.status === "pass"
                        ? "text-[10px] font-semibold text-emerald-300"
                        : "text-[10px] font-semibold text-amber-200"
                    }
                  >
                    {backend.status.toUpperCase()}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-slate-500">CHAT</p>
                    <p className="mt-1 text-slate-200">
                      {backend.metrics.chatLatencyMs} ms
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">STREAM</p>
                    <p className="mt-1 text-slate-200">
                      {backend.metrics.streamChunks} chunks
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">TOKENS</p>
                    <p className="mt-1 text-slate-200">
                      {backend.metrics.promptTokens +
                        backend.metrics.completionTokens}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {Object.entries(backend.checks).map(([check, passed]) => (
                    <span
                      key={check}
                      className={`border px-1.5 py-0.5 text-[9px] uppercase ${
                        passed
                          ? "border-emerald-300/15 text-emerald-200"
                          : "border-amber-300/20 text-amber-100"
                      }`}
                    >
                      {check.replace(/([a-z])([A-Z])/gu, "$1 $2")}
                    </span>
                  ))}
                </div>
                {backend.error ? (
                  <p className="mt-2 text-[10px] leading-4 text-amber-100">
                    {backend.error.code} · {backend.error.message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {receipt.compatibilityMatrix.map((profile) => (
              <div
                key={profile.backend}
                className="flex items-start justify-between gap-3 border border-white/10 bg-white/[0.02] px-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {profile.backend}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    {profile.modelFormat}
                    {profile.codes.length ? ` · ${profile.codes.join(", ")}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase ${
                    profile.compatible ? "text-emerald-300" : "text-amber-200"
                  }`}
                >
                  {profile.compatible ? "host fit" : "host blocked"}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 break-all text-[10px] text-slate-600">
            SHA-256 evidence · {receipt.evidenceDigest}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          {loading
            ? isEnglish
              ? "Reading Runtime Fabric evidence..."
              : "正在读取 Runtime Fabric 证据..."
            : isEnglish
              ? "No Runtime Fabric receipt has been captured."
              : "尚未生成 Runtime Fabric receipt。"}
        </p>
      )}
    </section>
  );
}
