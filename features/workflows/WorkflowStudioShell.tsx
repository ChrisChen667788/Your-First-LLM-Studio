"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/layout/LocaleProvider";
import { StudioIdentityBand, StudioSegmentedChips, StudioSurface } from "@/components/layout/StudioPageShell";
import { addWorkflowEdge, addWorkflowNode, moveWorkflowNode, removeWorkflowEdge, removeWorkflowNode, updateWorkflowNode, WORKFLOW_NODE_PALETTE } from "@/features/workflows/editor-state";
import { diffWorkflowGraphs } from "@/features/workflows/graph-diff";
import { validateWorkflowGraph, type WorkflowEdge, type WorkflowGraph, type WorkflowNode, type WorkflowNodeKind } from "@/features/workflows/graph-contract";
import { WorkflowGraphCanvas } from "@/features/workflows/WorkflowGraphCanvas";

type Execution = { id: string; graphId: string; graphVersion: number; status: string; currentNodeId: string; completedNodeIds: string[]; usedIdempotencyKeys: string[]; input: string; events: Array<{ type: string; at: string; nodeId?: string }> };
type GraphRecord = { graph: WorkflowGraph; graphDigest: string; state: "draft" | "published" | "retired"; revision: number; deploymentSlug?: string; updatedAt: string };
type Payload = {
  ok: true;
  executionStore: { executions: Execution[] };
  breakpointStore: { breakpoints: Array<{ graphId: string; graphVersion: number; nodeId: string; enabled: boolean }> };
  graphRegistry: { records: GraphRecord[]; totals: { drafts: number; published: number; deployments: number } };
};
type Promotion = { localStatus: "pass" | "evidence-needed"; productionStatus: "blocked" | "pass"; summary: string; localBlockers: string[]; productionBlockers: string[]; latestAcceptance?: { id: string; generatedAt: string; reportDigest: string; checks: Record<string, boolean> } | null };

function statusTone(status: string) {
  if (status === "completed" || status === "pass") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (status === "failed" || status === "rejected" || status === "blocked") return "border-rose-300/30 bg-rose-400/10 text-rose-100";
  if (status.includes("paused") || status.includes("waiting") || status.includes("evidence")) return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  return "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";
}

function recordKey(record: GraphRecord) {
  return `${record.graph.id}@${record.graph.version}`;
}

export function WorkflowStudioShell() {
  const { locale } = useLocale();
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [activeKey, setActiveKey] = useState("");
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [input, setInput] = useState("Review the repository and prepare a protected patch.");
  const [edgeTarget, setEdgeTarget] = useState("");
  const [edgeCondition, setEdgeCondition] = useState("");
  const [configText, setConfigText] = useState("{}");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (preferredKey?: string) => {
    const [workflowResponse, promotionResponse] = await Promise.all([fetch("/api/workflows", { cache: "no-store" }), fetch("/api/workflows/promotion", { cache: "no-store" })]);
    const workflow = await workflowResponse.json() as Payload & { error?: string };
    const nextPromotion = await promotionResponse.json() as Promotion & { error?: string };
    if (!workflowResponse.ok || !workflow.ok) throw new Error(workflow.error || "Workflow registry could not be loaded.");
    if (!promotionResponse.ok) throw new Error(nextPromotion.error || "Workflow promotion evidence could not be loaded.");
    setPayload(workflow);
    setPromotion(nextPromotion);
    const requested = preferredKey || activeKey;
    const selectedRecord = workflow.graphRegistry.records.find((record) => recordKey(record) === requested)
      || workflow.graphRegistry.records.find((record) => record.state === "draft")
      || workflow.graphRegistry.records.find((record) => record.state === "published")
      || workflow.graphRegistry.records[0];
    if (selectedRecord) {
      setActiveKey(recordKey(selectedRecord));
      setGraph(selectedRecord.graph);
      setSelectedNodeId((current) => selectedRecord.graph.nodes.some((node) => node.id === current) ? current : selectedRecord.graph.nodes[0]?.id || "");
    }
  }, [activeKey]);

  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Load failed.")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRecord = useMemo(() => payload?.graphRegistry.records.find((record) => recordKey(record) === activeKey) || null, [activeKey, payload]);
  const editable = activeRecord?.state === "draft";
  const execution = useMemo(() => payload?.executionStore.executions.find((entry) => entry.graphId === graph?.id && entry.graphVersion === graph.version), [graph, payload]);
  const selected = graph?.nodes.find((node) => node.id === selectedNodeId) || graph?.nodes[0];
  const breakpoints = useMemo(() => new Set(payload?.breakpointStore.breakpoints.filter((entry) => entry.enabled && entry.graphId === graph?.id && entry.graphVersion === graph.version).map((entry) => entry.nodeId)), [graph, payload]);
  const validation = useMemo(() => graph ? validateWorkflowGraph(graph) : { valid: false, errors: ["No graph selected."], warnings: [] }, [graph]);
  const dirty = Boolean(graph && activeRecord && JSON.stringify(graph) !== JSON.stringify(activeRecord.graph));
  const previousVersion = useMemo(() => payload?.graphRegistry.records.filter((record) => record.graph.id === graph?.id && record.graph.version < (graph?.version || 0)).sort((left, right) => right.graph.version - left.graph.version)[0]?.graph, [graph, payload]);
  const versionDiff = useMemo(() => graph && previousVersion ? diffWorkflowGraphs(previousVersion, graph) : null, [graph, previousVersion]);

  useEffect(() => { setConfigText(JSON.stringify(selected?.config || {}, null, 2)); }, [selected?.id, selected?.config]);

  const request = useCallback(async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { ok?: boolean; error?: string; record?: GraphRecord; execution?: Execution; replay?: Execution };
    if (!response.ok || result.ok === false) throw new Error(result.error || "Workflow action failed.");
    return result;
  }, []);

  const perform = useCallback(async (action: () => Promise<string | void>) => {
    setPending(true); setError("");
    try { const preferred = await action(); await load(typeof preferred === "string" ? preferred : undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Workflow action failed."); }
    finally { setPending(false); }
  }, [load]);

  const patchNode = (patch: Partial<WorkflowNode>) => {
    if (!graph || !selected || !editable) return;
    setGraph(updateWorkflowNode(graph, selected.id, patch));
  };

  const patchRuntimeProfile = (patch: Partial<NonNullable<WorkflowGraph["runtimeProfile"]>>) => {
    if (!graph || !editable) return;
    const current = graph.runtimeProfile || { id: "workflow-default", label: "Workflow default", target: "local-first", model: "active", temperature: 0.2, maxTokens: 2048, contextWindow: 32768, toolMode: "auto" as const };
    setGraph({ ...graph, runtimeProfile: { ...current, ...patch } });
  };

  const createRun = async () => {
    if (!graph) throw new Error("Select a workflow graph first.");
    return request("/api/workflows", { action: "create", input, graphId: graph.id, graphVersion: graph.version });
  };

  const stepRun = () => perform(async () => {
    if (!graph) return;
    let current = execution;
    if (!current || ["completed", "failed", "rejected"].includes(current.status)) current = (await createRun()).execution;
    if (!current) return;
    const currentNode = graph.nodes.find((node) => node.id === current?.currentNodeId);
    const event = current.status === "idle"
      ? { type: "start" }
      : current.status === "paused-breakpoint"
        ? { type: "continue" }
        : current.status === "waiting-approval"
          ? { type: "approval-granted", condition: "approved" }
          : { type: "node-succeeded", nodeId: current.currentNodeId, condition: currentNode?.kind === "model" ? String(currentNode.config.defaultCondition || "protected_tool_requested") : currentNode?.kind === "guard" ? String(currentNode.config.defaultCondition || "") || undefined : undefined, idempotencyKey: currentNode?.sideEffect === "write" || currentNode?.sideEffect === "external" ? `${current.id}:${current.currentNodeId}` : undefined, output: "Workflow completed." };
    await request("/api/workflows", { action: "dispatch", executionId: current.id, event });
  });

  const runToBoundary = () => perform(async () => {
    let current = execution;
    if (!current || ["completed", "failed", "rejected"].includes(current.status)) current = (await createRun()).execution;
    if (!current) return;
    await request("/api/workflows/worker", { executionId: current.id, workerId: "workflow-studio-ui", maxSteps: 24 });
  });

  const cloneVersion = () => perform(async () => {
    if (!activeRecord) return;
    const result = await request("/api/workflows", { action: "clone-version", graphId: activeRecord.graph.id, graphVersion: activeRecord.graph.version });
    return result.record ? recordKey(result.record) : undefined;
  });

  const saveDraft = () => perform(async () => {
    if (!graph || !activeRecord) return;
    const result = await request("/api/workflows", { action: "save-draft", graph, expectedRevision: activeRecord.revision });
    return result.record ? recordKey(result.record) : undefined;
  });

  const publishDraft = () => perform(async () => {
    if (!graph || !activeRecord || !validation.valid) return;
    const result = await request("/api/workflows", { action: "publish", graphId: graph.id, graphVersion: graph.version, expectedRevision: activeRecord.revision, deploymentSlug: `${graph.id}-v${graph.version}` });
    return result.record ? recordKey(result.record) : undefined;
  });

  const runAcceptance = () => perform(async () => { await request("/api/workflows/acceptance", {}); });

  const endpoint = activeRecord?.deploymentSlug ? `/api/workflows/deploy/${activeRecord.deploymentSlug}/v1/chat/completions` : "";

  return (
    <StudioSurface accent="cyan">
      <div id="workflow-graph-studio" data-evidence-ready={payload && promotion ? "true" : "false"} className="flex flex-col gap-4 pt-14 lg:pt-16">
      <StudioIdentityBand
        accent="cyan"
        className="mb-0"
        eyebrow="WORKFLOW GRAPH STUDIO"
        title={en ? "Visual workflows with durable recovery" : "可视化工作流与持久恢复"}
        description={en ? "Compose typed Agent, RAG, evaluation, guard, approval, and tool nodes; publish immutable graph versions and inspect replay-safe execution." : "组合 Agent、RAG、评测、策略、审批和工具节点，发布不可变图版本，并检查可恢复执行。"}
        side={<StudioSegmentedChips wide={false} labels={[en ? "Visual editor" : "可视编辑", en ? "Versioned recipe" : "版本配方", en ? "Durable replay" : "持久回放"]} />}
      />
      {error ? <p className="border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <select value={activeKey} onChange={(event) => { const record = payload?.graphRegistry.records.find((entry) => recordKey(entry) === event.target.value); setActiveKey(event.target.value); if (record) { setGraph(record.graph); setSelectedNodeId(record.graph.nodes[0]?.id || ""); } }} className="max-w-[320px] border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            {payload?.graphRegistry.records.map((record) => <option key={recordKey(record)} value={recordKey(record)}>{record.graph.label} · v{record.graph.version} · {record.state}</option>)}
          </select>
          <span className={`border px-2.5 py-1.5 text-[10px] font-semibold uppercase ${validation.valid ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-rose-300/30 bg-rose-400/10 text-rose-100"}`}>{validation.valid ? "schema valid" : `${validation.errors.length} errors`}</span>
          {dirty ? <span className="border border-amber-300/30 bg-amber-400/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase text-amber-100">unsaved</span> : null}
          {activeRecord ? <span className="font-mono text-[10px] text-slate-500">rev {activeRecord.revision} · {activeRecord.graphDigest.slice(0, 22)}...</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {editable ? <button type="button" disabled={pending || !dirty || !validation.valid} onClick={() => void saveDraft()} className="border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40">{en ? "Save draft" : "保存草稿"}</button> : <button type="button" disabled={pending || !activeRecord} onClick={() => void cloneVersion()} className="border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40">{en ? "Create next version" : "创建下一版本"}</button>}
          {editable ? <button type="button" disabled={pending || dirty || !validation.valid} onClick={() => void publishDraft()} className="border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-40">{en ? "Publish immutable" : "发布不可变版本"}</button> : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[188px_minmax(0,1fr)_324px]">
        <aside className="border border-white/10 bg-slate-950/70 p-3 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase text-cyan-300">NODE PALETTE</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {WORKFLOW_NODE_PALETTE.map((item) => <button key={item.kind} type="button" disabled={!editable || pending || (item.kind === "input" && graph?.nodes.some((node) => node.kind === "input"))} onClick={() => { if (!graph) return; const next = addWorkflowNode(graph, item.kind); setGraph(next.graph); setSelectedNodeId(next.node.id); }} className="border border-white/10 bg-black/20 p-2.5 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/5 disabled:cursor-not-allowed disabled:opacity-35"><span className="text-xs font-semibold text-white">{item.label}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{item.description}</span></button>)}
          </div>
          <div className="mt-4 border-t border-white/10 pt-3 text-[10px] uppercase text-slate-500">{editable ? (en ? "Draft · revision controlled" : "草稿 · 修订受控") : (en ? "Published · immutable" : "已发布 · 不可变")}</div>
        </aside>

        <main className="min-w-0 border border-white/10 bg-slate-950/70 p-3 backdrop-blur">
          {graph ? <WorkflowGraphCanvas graph={graph} selectedNodeId={selected?.id || ""} currentNodeId={execution?.currentNodeId} completedNodeIds={execution?.completedNodeIds || []} breakpointNodeIds={breakpoints} editable={editable} onSelectNode={setSelectedNodeId} onMoveNode={(nodeId, position) => setGraph((current) => current ? moveWorkflowNode(current, nodeId, position) : current)} onRemoveEdge={(edge) => setGraph((current) => current ? removeWorkflowEdge(current, edge) : current)} /> : <div className="grid min-h-[430px] place-items-center text-sm text-slate-500">Loading graph...</div>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>{graph?.nodes.length || 0} nodes · {graph?.edges.length || 0} transitions · {graph?.artifactInputs?.length || 0} immutable inputs</span>
            {versionDiff ? <span>vs v{versionDiff.from.version}: +{versionDiff.nodes.added.length} / -{versionDiff.nodes.removed.length} / {versionDiff.nodes.changed.length} changed</span> : <span>base version</span>}
          </div>
        </main>

        <aside className="border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase text-cyan-300">NODE INSPECTOR</p>
          {selected ? <div className="mt-3 space-y-3">
            <label className="block text-[10px] uppercase text-slate-500">Label<input value={selected.label} disabled={!editable} onChange={(event) => patchNode({ label: event.target.value })} className="mt-1 w-full border border-white/10 bg-black/25 px-3 py-2 text-sm normal-case text-white disabled:opacity-60" /></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-[10px] uppercase text-slate-500">Kind<select value={selected.kind} disabled={!editable} onChange={(event) => { const item = WORKFLOW_NODE_PALETTE.find((entry) => entry.kind === event.target.value); patchNode({ kind: event.target.value as WorkflowNodeKind, sideEffect: item?.sideEffect || selected.sideEffect, resumePolicy: item?.resumePolicy || selected.resumePolicy }); }} className="mt-1 w-full border border-white/10 bg-slate-950 px-2 py-2 text-xs normal-case text-slate-200">{WORKFLOW_NODE_PALETTE.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select></label><label className="text-[10px] uppercase text-slate-500">Side effect<select value={selected.sideEffect} disabled={!editable} onChange={(event) => patchNode({ sideEffect: event.target.value as WorkflowNode["sideEffect"] })} className="mt-1 w-full border border-white/10 bg-slate-950 px-2 py-2 text-xs normal-case text-slate-200"><option value="none">none</option><option value="read">read</option><option value="write">write</option><option value="external">external</option></select></label></div>
            <label className="block text-[10px] uppercase text-slate-500">Resume policy<select value={selected.resumePolicy} disabled={!editable} onChange={(event) => patchNode({ resumePolicy: event.target.value as WorkflowNode["resumePolicy"] })} className="mt-1 w-full border border-white/10 bg-slate-950 px-2 py-2 text-xs normal-case text-slate-200"><option value="replay-safe">replay-safe</option><option value="idempotency-key">idempotency-key</option><option value="manual-review">manual-review</option></select></label>
            <label className="block text-[10px] uppercase text-slate-500">Config JSON<textarea value={configText} disabled={!editable} onChange={(event) => setConfigText(event.target.value)} onBlur={() => { try { const config = JSON.parse(configText) as WorkflowNode["config"]; patchNode({ config }); setError(""); } catch { setError("Node config must be valid JSON."); } }} className="mt-1 min-h-24 w-full resize-y border border-white/10 bg-black/25 px-3 py-2 font-mono text-[11px] normal-case text-slate-200 disabled:opacity-60" /></label>
            <button type="button" disabled={pending} onClick={() => void perform(async () => { if (!graph) return; await request("/api/workflows", { action: "breakpoint", graphId: graph.id, graphVersion: graph.version, nodeId: selected.id, enabled: !breakpoints.has(selected.id) }); })} className={`w-full border px-3 py-2 text-xs font-semibold ${breakpoints.has(selected.id) ? "border-amber-300/35 bg-amber-400/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-200"}`}>{breakpoints.has(selected.id) ? (en ? "Remove breakpoint" : "移除断点") : (en ? "Add breakpoint" : "添加断点")}</button>
            {editable ? <><div className="border-t border-white/10 pt-3"><p className="text-[10px] uppercase text-slate-500">Transition</p><div className="mt-2 grid grid-cols-[1fr_1fr] gap-2"><select value={edgeTarget} onChange={(event) => setEdgeTarget(event.target.value)} className="border border-white/10 bg-slate-950 px-2 py-2 text-xs text-slate-200"><option value="">Target node</option>{graph?.nodes.filter((node) => node.id !== selected.id).map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}</select><input value={edgeCondition} onChange={(event) => setEdgeCondition(event.target.value)} placeholder="condition" className="min-w-0 border border-white/10 bg-black/25 px-2 py-2 text-xs text-slate-200" /></div><button type="button" disabled={!edgeTarget} onClick={() => { if (!graph || !edgeTarget) return; try { setGraph(addWorkflowEdge(graph, { from: selected.id, to: edgeTarget, condition: edgeCondition })); setEdgeTarget(""); setEdgeCondition(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Transition failed."); } }} className="mt-2 w-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40">{en ? "Add transition" : "添加连线"}</button></div><button type="button" onClick={() => { if (!graph) return; const next = removeWorkflowNode(graph, selected.id); setGraph(next); setSelectedNodeId(next.nodes[0]?.id || ""); }} className="w-full border border-rose-300/25 bg-rose-400/5 px-3 py-2 text-xs text-rose-100">{en ? "Delete node" : "删除节点"}</button></> : null}
          </div> : <p className="mt-4 text-sm text-slate-500">Select a node.</p>}
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[10px] font-semibold uppercase text-cyan-300">RUNTIME PROFILE</p>
            {graph?.runtimeProfile ? <div className="mt-3 grid grid-cols-2 gap-2"><label className="col-span-2 text-[10px] uppercase text-slate-500">Model<input value={graph.runtimeProfile.model} disabled={!editable} onChange={(event) => patchRuntimeProfile({ model: event.target.value })} className="mt-1 w-full border border-white/10 bg-black/25 px-2 py-2 text-xs normal-case text-slate-200 disabled:opacity-60" /></label><label className="text-[10px] uppercase text-slate-500">Temperature<input type="number" min="0" max="2" step="0.1" value={graph.runtimeProfile.temperature} disabled={!editable} onChange={(event) => patchRuntimeProfile({ temperature: Number(event.target.value) })} className="mt-1 w-full border border-white/10 bg-black/25 px-2 py-2 text-xs normal-case text-slate-200 disabled:opacity-60" /></label><label className="text-[10px] uppercase text-slate-500">Context<input type="number" min="1024" step="1024" value={graph.runtimeProfile.contextWindow} disabled={!editable} onChange={(event) => patchRuntimeProfile({ contextWindow: Number(event.target.value) })} className="mt-1 w-full border border-white/10 bg-black/25 px-2 py-2 text-xs normal-case text-slate-200 disabled:opacity-60" /></label><label className="col-span-2 text-[10px] uppercase text-slate-500">Tool mode<select value={graph.runtimeProfile.toolMode} disabled={!editable} onChange={(event) => patchRuntimeProfile({ toolMode: event.target.value as NonNullable<WorkflowGraph["runtimeProfile"]>["toolMode"] })} className="mt-1 w-full border border-white/10 bg-slate-950 px-2 py-2 text-xs normal-case text-slate-200"><option value="off">off</option><option value="auto">auto</option><option value="required">required</option></select></label></div> : editable ? <button type="button" onClick={() => patchRuntimeProfile({})} className="mt-3 w-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">{en ? "Pin default profile" : "绑定默认 profile"}</button> : <p className="mt-2 text-xs text-amber-200">No profile pinned.</p>}
            <p className="mt-4 text-[10px] uppercase text-slate-500">Immutable inputs</p>
            <div className="mt-2 space-y-1">{graph?.artifactInputs?.map((artifact) => <p key={`${artifact.kind}-${artifact.id}`} className="truncate font-mono text-[10px] text-slate-400" title={artifact.digest}>{artifact.kind} · {artifact.id} · {artifact.digest}</p>) || <p className="text-[10px] text-amber-200">No artifact digest pinned.</p>}</div>
          </div>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <section className="border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase text-cyan-300">EXECUTION LANE</p><p className="mt-1 text-sm text-slate-400">{execution ? `${execution.id} · ${execution.currentNodeId}` : (en ? "No run for this graph version" : "当前图版本尚无运行")}</p></div><span className={`border px-3 py-1.5 text-xs font-semibold ${statusTone(execution?.status || "idle")}`}>{execution?.status || "idle"}</span></div>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} className="mt-4 min-h-20 w-full resize-y border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300" />
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={pending || !graph} onClick={() => void stepRun()} className="bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{execution?.status === "waiting-approval" ? (en ? "Approve" : "批准") : execution?.status === "paused-breakpoint" ? (en ? "Continue" : "继续") : (en ? "Step" : "单步")}</button><button type="button" disabled={pending || !graph} onClick={() => void runToBoundary()} className="border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">{en ? "Run to boundary" : "运行到边界"}</button>{execution ? <button type="button" disabled={pending} onClick={() => void perform(async () => { await request("/api/workflows/replay", { sourceExecutionId: execution.id }); })} className="border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">{en ? "Fork replay" : "派生回放"}</button> : null}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{execution?.events.slice(-6).reverse().map((event, index) => <div key={`${event.at}-${index}`} className="border border-white/10 bg-black/20 px-3 py-2 text-xs"><span className="text-slate-200">{event.type}</span><span className="mt-1 block text-[10px] text-slate-600">{event.nodeId || "state"} · {new Date(event.at).toLocaleTimeString()}</span></div>) || <p className="text-xs text-slate-600">No execution events.</p>}</div>
        </section>

        <section className="border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase text-cyan-300">PROMOTION EVIDENCE</p><p className="mt-1 text-sm text-slate-300">v1.3.1 · {promotion?.summary || "Loading evidence..."}</p></div><div className="flex gap-2"><span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${statusTone(promotion?.localStatus || "evidence-needed")}`}>local {promotion?.localStatus || "pending"}</span><span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${statusTone(promotion?.productionStatus || "blocked")}`}>prod {promotion?.productionStatus || "blocked"}</span></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] uppercase text-slate-500">Runtime profile</p><p className="mt-1 text-xs text-slate-200">{graph?.runtimeProfile ? `${graph.runtimeProfile.label} · ${graph.runtimeProfile.model} · ${graph.runtimeProfile.contextWindow / 1024}K` : "Not pinned"}</p></div><div><p className="text-[10px] uppercase text-slate-500">Latest receipt</p><p className="mt-1 truncate font-mono text-xs text-slate-200">{promotion?.latestAcceptance?.reportDigest || "No retained receipt"}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => void runAcceptance()} className="border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-40">{en ? "Run local acceptance" : "运行本地验收"}</button>{endpoint ? <button type="button" onClick={() => void navigator.clipboard.writeText(`curl ${window.location.origin}${endpoint} -H 'Content-Type: application/json' -d '{"model":"workflow:${activeRecord?.deploymentSlug}","messages":[{"role":"user","content":"Run this workflow"}]}'`)} className="border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200">{en ? "Copy API example" : "复制 API 示例"}</button> : null}</div>
          {endpoint ? <p className="mt-3 break-all border-t border-white/10 pt-3 font-mono text-[10px] text-cyan-200">POST {endpoint}</p> : <p className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-500">{en ? "Publish this version to generate an OpenAI-compatible endpoint." : "发布当前版本后生成 OpenAI-compatible endpoint。"}</p>}
          {validation.errors.length || validation.warnings.length ? <div className="mt-3 space-y-1 border-t border-white/10 pt-3">{validation.errors.slice(0, 3).map((message) => <p key={message} className="text-[10px] text-rose-200">ERROR · {message}</p>)}{validation.warnings.slice(0, 3).map((message) => <p key={message} className="text-[10px] text-amber-200">WARN · {message}</p>)}</div> : null}
        </section>
      </div>
      </div>
    </StudioSurface>
  );
}
