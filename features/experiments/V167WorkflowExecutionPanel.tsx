"use client";

import { useCallback, useEffect, useState } from "react";

type Evidence = {
  ok: boolean;
  localStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  latest: null | {
    totals: { slices: 15; passed: number; held: number };
    evidenceDigest: string;
    disclosure: string;
    error?: string;
  };
  capabilities: {
    executors: string[];
    protectedSideEffects: {
      automaticKinds: string[];
      blockedKinds: string[];
    };
  };
  error?: string;
};

export function V167WorkflowExecutionPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (accept = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/experiments/v167-workflow-execution-closure",
        {
          method: accept ? "POST" : "GET",
          headers: accept ? { "content-type": "application/json" } : undefined,
          body: accept ? "{}" : undefined,
          cache: "no-store",
        },
      );
      const body = (await response.json()) as Evidence & { evidence?: Evidence };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Workflow execution acceptance failed.");
      }
      setEvidence(body.evidence || body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Workflow execution acceptance failed.",
      );
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="min-w-0 border border-cyan-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-cyan-300">
            V1.6.7 WORKFLOW EXECUTION GATE
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Typed node execution closure" : "类型化节点执行闭环"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Real retrieval, read-only tools, restricted guards, citation evaluators, Provider context, and protected side-effect boundaries share one executor registry."
              : "真实检索、只读工具、受限 Guard、引用 evaluator、Provider 上下文和受保护副作用统一进入一个 executor registry。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="shrink-0 border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/20 disabled:opacity-60"
        >
          {pending ? (en ? "Running..." : "运行中...") : en ? "Run 15-slice gate" : "运行 15 项验收"}
        </button>
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["LOCAL", evidence?.latest ? `${evidence.latest.totals.passed}/15` : "NOT RUN"],
          ["EXECUTORS", String(evidence?.capabilities.executors.length || 0)],
          ["AUTO EFFECTS", evidence?.capabilities.protectedSideEffects.automaticKinds.join(" / ") || "--"],
          ["PRODUCTION", evidence?.productionStatus || "hold"],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold uppercase text-white">{value}</p>
          </article>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        {evidence?.latest?.error || evidence?.latest?.disclosure || (en ? "Run the gate to create local evidence." : "运行门槛后生成本地证据。")}
      </p>
    </section>
  );
}
