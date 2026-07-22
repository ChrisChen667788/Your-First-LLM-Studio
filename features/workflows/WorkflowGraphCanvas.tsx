"use client";

import { useMemo, useRef } from "react";
import type { WorkflowEdge, WorkflowGraph, WorkflowNodePosition } from "@/features/workflows/graph-contract";

type Props = {
  graph: WorkflowGraph;
  selectedNodeId: string;
  currentNodeId?: string;
  completedNodeIds: string[];
  breakpointNodeIds: Set<string>;
  editable: boolean;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, position: WorkflowNodePosition) => void;
  onRemoveEdge: (edge: WorkflowEdge) => void;
};

const NODE_WIDTH = 168;
const NODE_HEIGHT = 96;

function positionFor(index: number, position?: WorkflowNodePosition) {
  return position || { x: 36 + (index % 5) * 204, y: 54 + Math.floor(index / 5) * 142 };
}

function kindTone(kind: string) {
  if (kind === "tool" || kind === "approval") return "border-amber-300/35 bg-amber-400/10 text-amber-100";
  if (kind === "guard" || kind === "evaluator") return "border-violet-300/35 bg-violet-400/10 text-violet-100";
  if (kind === "retrieval") return "border-emerald-300/35 bg-emerald-400/10 text-emerald-100";
  if (kind === "input" || kind === "output") return "border-slate-300/25 bg-slate-300/10 text-slate-100";
  return "border-cyan-300/35 bg-cyan-400/10 text-cyan-100";
}

export function WorkflowGraphCanvas({ graph, selectedNodeId, currentNodeId, completedNodeIds, breakpointNodeIds, editable, onSelectNode, onMoveNode, onRemoveEdge }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const positions = useMemo(() => new Map(graph.nodes.map((node, index) => [node.id, positionFor(index, node.position)])), [graph.nodes]);
  const width = Math.max(1160, ...[...positions.values()].map((position) => position.x + NODE_WIDTH + 52));
  const height = Math.max(430, ...[...positions.values()].map((position) => position.y + NODE_HEIGHT + 72));

  return (
    <div ref={viewportRef} className="relative overflow-auto border border-white/10 bg-[#020713]" style={{ minHeight: 430 }} data-workflow-canvas>
      <div className="relative" style={{ width, height }}>
        <div className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: "linear-gradient(rgba(148,163,184,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.12) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
          <defs>
            <marker id="workflow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(103 232 249)" />
            </marker>
          </defs>
          {graph.edges.map((edge, index) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_WIDTH;
            const y1 = from.y + NODE_HEIGHT / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_HEIGHT / 2;
            const bend = Math.max(44, Math.abs(x2 - x1) / 2);
            const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
            const showCondition = edge.condition && Math.abs(x2 - x1) > 120;
            return <g key={`${edge.from}-${edge.to}-${edge.condition || index}`}><path d={path} fill="none" stroke="rgba(103,232,249,.62)" strokeWidth="1.5" markerEnd="url(#workflow-arrow)" />{showCondition ? <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" fill="rgb(148 163 184)" fontSize="10">{edge.condition}</text> : null}</g>;
          })}
        </svg>
        {graph.nodes.map((node, index) => {
          const position = positions.get(node.id) as WorkflowNodePosition;
          const selected = selectedNodeId === node.id;
          const current = currentNodeId === node.id;
          const completed = completedNodeIds.includes(node.id);
          const breakpoint = breakpointNodeIds.has(node.id);
          return (
            <button
              key={node.id}
              type="button"
              draggable={editable}
              onDragEnd={(event) => {
                if (!editable || !viewportRef.current) return;
                const rect = viewportRef.current.getBoundingClientRect();
                onMoveNode(node.id, { x: event.clientX - rect.left + viewportRef.current.scrollLeft - NODE_WIDTH / 2, y: event.clientY - rect.top + viewportRef.current.scrollTop - 22 });
              }}
              onClick={() => onSelectNode(node.id)}
              className={`absolute flex h-24 w-[168px] flex-col justify-between border p-3 text-left shadow-xl transition ${selected ? "ring-2 ring-cyan-300/80" : "hover:border-white/40"} ${current ? "border-cyan-200 bg-cyan-300/15" : "border-white/15 bg-slate-950/95"}`}
              style={{ left: position.x, top: position.y }}
            >
              <span className="flex items-center justify-between gap-2"><span className={`border px-2 py-0.5 text-[9px] font-semibold uppercase ${kindTone(node.kind)}`}>{node.kind}</span><span className={`h-2.5 w-2.5 rounded-full ${breakpoint ? "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.85)]" : completed ? "bg-emerald-300" : current ? "bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,.85)]" : "bg-slate-700"}`} aria-label={breakpoint ? "breakpoint" : completed ? "completed" : current ? "current" : "idle"} /></span>
              <span className="line-clamp-2 text-sm font-semibold text-white">{node.label}</span>
              <span className="truncate text-[10px] text-slate-500">{node.id} · {node.resumePolicy}</span>
            </button>
          );
        })}
        {editable && graph.edges.length ? <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-24px)] flex-wrap gap-1.5">{graph.edges.map((edge) => <button key={`${edge.from}-${edge.to}-${edge.condition || "default"}`} type="button" onClick={() => onRemoveEdge(edge)} className="pointer-events-auto border border-white/10 bg-slate-950/90 px-2 py-1 text-[10px] text-slate-400 hover:border-rose-300/40 hover:text-rose-100" title="Remove transition">{edge.from} → {edge.to}{edge.condition ? ` · ${edge.condition}` : ""}</button>)}</div> : null}
      </div>
    </div>
  );
}
