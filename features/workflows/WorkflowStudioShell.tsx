"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/layout/LocaleProvider";
import { StudioIdentityBand, StudioSegmentedChips, StudioSurface } from "@/components/layout/StudioPageShell";

type Node = { id: string; kind: string; label: string; sideEffect: string; resumePolicy: string; config: Record<string, unknown> };
type Execution = { id: string; status: string; currentNodeId: string; completedNodeIds: string[]; input: string; events: Array<{ type: string; at: string }> };
type Payload = {
  ok: true;
  graphs: Array<{ graph: { id: string; version: number; label: string; nodes: Node[]; edges: Array<{ from: string; to: string; condition?: string }> } }>;
  executionStore: { executions: Execution[] };
  breakpointStore: { breakpoints: Array<{ graphId: string; graphVersion: number; nodeId: string; enabled: boolean }> };
  graphRegistry: { records: Array<{ graph: { id: string; version: number; label: string; nodes: Node[]; edges: Array<{ from: string; to: string; condition?: string }> }; state: "draft" | "published" | "retired"; deploymentSlug?: string }>; totals: { drafts: number; published: number; deployments: number } };
};

function statusTone(status: string) {
  if (status === "completed") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (status === "failed" || status === "rejected") return "border-rose-300/30 bg-rose-400/10 text-rose-100";
  if (status.includes("paused") || status.includes("waiting")) return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  return "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";
}

export function WorkflowStudioShell() {
  const { locale } = useLocale();
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState("prompt");
  const [input, setInput] = useState("Review the repository and prepare a protected patch.");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/workflows", { cache: "no-store" });
    const next = await response.json() as Payload & { error?: string };
    if (!response.ok || !next.ok) throw new Error(next.error || "Workflow registry could not be loaded.");
    setPayload(next);
  }, []);
  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Load failed.")); }, [load]);
  const graph = payload?.graphs[0]?.graph;
  const execution = payload?.executionStore.executions[0];
  const selected = graph?.nodes.find((node) => node.id === selectedNodeId) || graph?.nodes[0];
  const latestDraft = payload?.graphRegistry.records.find((record) => record.state === "draft");
  const breakpoints = useMemo(() => new Set(payload?.breakpointStore.breakpoints.filter((entry) => entry.enabled).map((entry) => entry.nodeId)), [payload]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/workflows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const next = await response.json() as { error?: string };
      if (!response.ok) throw new Error(next.error || "Workflow action failed.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workflow action failed.");
    } finally { setPending(false); }
  }, [load]);

  const runAction = () => {
    if (!execution || ["completed", "failed", "rejected"].includes(execution.status)) return post({ action: "create", input });
    const event = execution.status === "idle"
      ? { type: "start" }
      : execution.status === "paused-breakpoint"
        ? { type: "continue" }
        : execution.status === "waiting-approval"
          ? { type: "approval-granted", condition: "approved" }
          : { type: "node-succeeded", nodeId: execution.currentNodeId, condition: execution.currentNodeId === "model" ? "protected_tool_requested" : undefined, idempotencyKey: execution.currentNodeId === "tool" ? `${execution.id}:tool` : undefined, output: "Workflow completed." };
    return post({ action: "dispatch", executionId: execution.id, event });
  };

  const saveNextVersion = () => {
    if (!graph) return;
    const nextVersion = Math.max(graph.version, ...(payload?.graphRegistry.records.filter((record) => record.graph.id === graph.id).map((record) => record.graph.version) || [graph.version])) + 1;
    return post({ action: "save-draft", graph: { ...graph, version: nextVersion, label: `${graph.label} v${nextVersion}` } });
  };

  return (
    <StudioSurface accent="cyan" className="flex flex-col gap-4">
      <StudioIdentityBand
        accent="cyan"
        className="mb-0"
        eyebrow="WORKFLOW STUDIO"
        title={en ? "Graph execution and breakpoints" : "工作流编排与断点"}
        description={en ? "Edit the protected-tool graph, pause before a node, inspect persisted state, and continue with idempotency-aware execution." : "编辑 protected-tool 图，在节点前暂停，检查持久执行态，并按幂等策略继续运行。"}
        side={<StudioSegmentedChips wide={false} labels={[en ? "Versioned graph" : "版本化图", en ? "Breakpoints" : "持久断点", en ? "Resume policy" : "恢复策略"]} />}
      />
      {error ? <p className="border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div><p className="text-xs font-semibold uppercase text-cyan-300">{graph?.label || "Graph"}</p><p className="mt-1 text-sm text-slate-400">{graph ? `${graph.id} · v${graph.version}` : "loading"} · {payload?.graphRegistry.totals.published || 0} published</p></div>
            <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={pending || !graph} onClick={() => void saveNextVersion()} className="border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">{en ? "Save next draft" : "保存下一版本草稿"}</button>{latestDraft ? <button type="button" disabled={pending} onClick={() => void post({ action: "publish", graphId: latestDraft.graph.id, graphVersion: latestDraft.graph.version, deploymentSlug: `${latestDraft.graph.id}-v${latestDraft.graph.version}` })} className="border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100">{en ? `Publish v${latestDraft.graph.version}` : `发布 v${latestDraft.graph.version}`}</button> : null}<span className={`border px-3 py-1.5 text-xs font-semibold ${statusTone(execution?.status || "idle")}`}>{execution?.status || "idle"}</span></div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {graph?.nodes.map((node, index) => {
              const current = execution?.currentNodeId === node.id;
              const complete = execution?.completedNodeIds.includes(node.id);
              return <button key={node.id} type="button" onClick={() => setSelectedNodeId(node.id)} className={`min-h-32 border p-3 text-left transition ${current ? "border-cyan-300 bg-cyan-400/10" : selected?.id === node.id ? "border-white/30 bg-white/10" : "border-white/10 bg-black/25 hover:bg-white/5"}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase text-slate-500">{index + 1} · {node.kind}</span><span className={breakpoints.has(node.id) ? "text-amber-300" : complete ? "text-emerald-300" : "text-slate-600"}>{breakpoints.has(node.id) ? "●" : complete ? "✓" : "○"}</span></div>
                <p className="mt-4 text-sm font-semibold text-white">{node.label}</p><p className="mt-2 text-xs text-slate-500">{node.resumePolicy}</p>
              </button>;
            })}
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <label className="text-xs uppercase text-slate-500">{en ? "Run input" : "运行输入"}</label>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} className="mt-2 min-h-24 w-full resize-y border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300" />
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => void runAction()} className="bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{execution?.status === "paused-breakpoint" ? (en ? "Continue" : "继续") : execution?.status === "waiting-approval" ? (en ? "Approve" : "批准") : execution && !["completed", "failed", "rejected"].includes(execution.status) ? (en ? "Step" : "单步") : (en ? "New run" : "新建运行")}</button><button type="button" disabled={pending} onClick={() => void post({ action: "create", input })} className="border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">{en ? "Reset run" : "重置运行"}</button></div>
          </div>
        </section>
        <aside className="border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
          <p className="text-xs font-semibold uppercase text-cyan-300">NODE INSPECTOR</p>
          <h2 className="mt-2 text-lg font-semibold text-white">{selected?.label || "Select node"}</h2>
          {selected ? <><dl className="mt-4 grid gap-3 text-sm"><div className="border-b border-white/10 pb-3"><dt className="text-xs text-slate-500">Side effect</dt><dd className="mt-1 text-slate-200">{selected.sideEffect}</dd></div><div className="border-b border-white/10 pb-3"><dt className="text-xs text-slate-500">Resume policy</dt><dd className="mt-1 text-slate-200">{selected.resumePolicy}</dd></div><div><dt className="text-xs text-slate-500">Config</dt><dd className="mt-1 break-all font-mono text-xs text-slate-300">{JSON.stringify(selected.config)}</dd></div></dl><button type="button" disabled={pending} onClick={() => void post({ action: "breakpoint", graphId: graph?.id, graphVersion: graph?.version, nodeId: selected.id, enabled: !breakpoints.has(selected.id) })} className={`mt-5 w-full border px-3 py-2 text-sm font-semibold ${breakpoints.has(selected.id) ? "border-amber-300/40 bg-amber-400/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-200"}`}>{breakpoints.has(selected.id) ? (en ? "Remove breakpoint" : "移除断点") : (en ? "Add breakpoint" : "添加断点")}</button></> : null}
          <div className="mt-6 border-t border-white/10 pt-4"><p className="text-xs uppercase text-slate-500">{en ? "Recent events" : "最近事件"}</p><div className="mt-3 space-y-2">{execution?.events.slice(-6).reverse().map((event, index) => <div key={`${event.at}-${index}`} className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-300">{event.type}</span><time className="text-slate-600">{new Date(event.at).toLocaleTimeString()}</time></div>) || <p className="text-xs text-slate-600">No events.</p>}</div></div>
        </aside>
      </div>
    </StudioSurface>
  );
}
