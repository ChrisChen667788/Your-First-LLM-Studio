"use client";

import { useCallback, useEffect, useState } from "react";

type Evidence = {
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  execution: { id: string; status: string; graphId: string; graphVersion: number } | null;
  graph: { digest: string; immutablePublishedVersion: boolean } | null;
  node: { id: string; label: string; kind: string; sideEffect: string; resumePolicy: string } | null;
  cards: Record<"input" | "output" | "error", { state: string; digest: string | null; display: string }>;
  trace: Array<{ eventId: string; type: string; at: string; nodeId: string | null; output: { display: string }; error: { display: string } }>;
  recovery: { canResume: boolean; canContinue: boolean; canForkReplay: boolean; reason: string };
  replayBoundary: { replay: { id: string; replayExecutionId: string; copiedSideEffects: boolean } | null; stateDiff: { id: string; status: string; checks: Record<string, boolean> } | null };
  checks: Record<string, boolean>;
  blockers: string[];
};

function tone(status: string) {
  return status === "pass"
    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
    : "border-amber-300/30 bg-amber-400/10 text-amber-100";
}

export function WorkflowDebuggerClosurePanel({
  executionId,
  onChanged,
}: {
  executionId?: string;
  onChanged?: () => void;
}) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const search = executionId ? `?executionId=${encodeURIComponent(executionId)}` : "";
    const response = await fetch(`/api/workflows/debugger-closure${search}`, { cache: "no-store" });
    const payload = await response.json() as Evidence & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Workflow debugger evidence could not be loaded.");
    setEvidence(payload);
  }, [executionId]);

  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Debugger evidence failed.")); }, [load]);

  const perform = useCallback(async (path: string, body?: Record<string, unknown>) => {
    setPending(true); setError("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const payload = await response.json() as { ok?: boolean; error?: string; evidence?: Evidence };
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Debugger action failed.");
      if (payload.evidence && "localStatus" in payload.evidence) setEvidence(payload.evidence);
      await load();
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Debugger action failed.");
    } finally {
      setPending(false);
    }
  }, [load, onChanged]);

  return <section className="mt-4 border border-violet-300/20 bg-violet-400/[0.035] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase text-violet-200">WORKFLOW DEBUGGER · v1.10.5</p><p className="mt-1 text-xs text-slate-400">日志/错误定位到节点、不可变图版本与回放边界；执行内容仅显示脱敏卡片。</p></div>
      <div className="flex items-center gap-2"><span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${tone(evidence?.localStatus || "hold")}`}>local {evidence?.localStatus || "hold"}</span><span className="border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase text-amber-100">prod hold</span></div>
    </div>

    {evidence?.execution && evidence.node ? <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-white/10 bg-black/20 p-2"><p className="text-[10px] uppercase text-slate-500">Node locator</p><p className="mt-1 text-xs text-slate-100">{evidence.node.label} · {evidence.node.id}</p><p className="mt-1 text-[10px] text-slate-500">{evidence.node.kind} · {evidence.node.sideEffect} · {evidence.node.resumePolicy}</p></div>
        <div className="border border-white/10 bg-black/20 p-2"><p className="text-[10px] uppercase text-slate-500">Immutable graph</p><p className="mt-1 truncate font-mono text-[10px] text-slate-200" title={evidence.graph?.digest}>{evidence.graph?.digest || "unavailable"}</p><p className="mt-1 text-[10px] text-slate-500">{evidence.graph?.immutablePublishedVersion ? "published version" : "draft/local version"}</p></div>
        <div className="border border-white/10 bg-black/20 p-2"><p className="text-[10px] uppercase text-slate-500">Replay boundary</p><p className="mt-1 text-xs text-slate-100">{evidence.replayBoundary.replay ? "side effects omitted" : "no matching fork"}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{evidence.replayBoundary.stateDiff?.id || "state diff pending"}</p></div>
        <div className="border border-white/10 bg-black/20 p-2"><p className="text-[10px] uppercase text-slate-500">Controlled recovery</p><p className="mt-1 text-xs text-slate-200">{evidence.recovery.reason}</p></div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">{(["input", "output", "error"] as const).map((kind) => <div key={kind} className={`border p-2 ${kind === "error" ? "border-rose-300/20 bg-rose-400/5" : "border-white/10 bg-black/20"}`}><p className="text-[10px] uppercase text-slate-500">{kind} · {evidence.cards[kind].state}</p><p className="mt-1 text-[11px] text-slate-200">{evidence.cards[kind].display}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-500">{evidence.cards[kind].digest || "no digest"}</p></div>)}</div>

      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={pending || !evidence.recovery.canResume} onClick={() => void perform("/api/workflows", { action: "dispatch", executionId: evidence.execution?.id, event: { type: "resume" } })} className="border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40">受控恢复</button><button type="button" disabled={pending || !evidence.recovery.canContinue} onClick={() => void perform("/api/workflows", { action: "dispatch", executionId: evidence.execution?.id, event: { type: "continue" } })} className="border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">继续断点</button><button type="button" disabled={pending || !evidence.recovery.canForkReplay} onClick={() => void perform("/api/workflows/replay", { sourceExecutionId: evidence.execution?.id })} className="border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">派生回放</button></div>
      <div className="mt-3 grid gap-1 border-t border-white/10 pt-3">{evidence.trace.slice(0, 5).map((event) => <div key={event.eventId} className="flex flex-wrap justify-between gap-2 text-[10px]"><span className="text-slate-300">{event.type} · {event.nodeId || "state"}</span><span className="text-slate-600">{new Date(event.at).toLocaleTimeString()}</span></div>)}</div>
    </> : <p className="mt-3 text-xs text-amber-100">尚无可定位执行。可先生成本地调试演练回执，演练内容会被完全脱敏。</p>}

    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3"><button type="button" disabled={pending} onClick={() => void perform("/api/workflows/debugger-closure")} className="border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-100 disabled:opacity-40">生成本地调试演练</button>{error ? <p className="self-center text-xs text-rose-200">{error}</p> : null}</div>
    {evidence?.blockers.slice(0, 2).map((blocker) => <p key={blocker} className="mt-2 text-[10px] text-slate-500">HOLD · {blocker}</p>)}
  </section>;
}
