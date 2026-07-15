"use client";

import { sanitizeDisplayPath } from "@/lib/agent/path-display";
import type { AgentRuntimeStatus, AgentTarget } from "@/lib/agent/types";
import {
  describeAdminRuntimeAlias,
  formatAdminRuntimeDuration,
  formatAdminRuntimeTimestamp,
} from "./runtime-formatters";

export type AdminRuntimeModelAction = "release" | "restart" | "read_log";

export type AdminRuntimeModelStatePanelProps = {
  locale: string;
  runtime?: AgentRuntimeStatus;
  targets: AgentTarget[];
  action: string;
  runtimeMessage: string;
  loadedAlias: string | null;
  gatewayLoadedOtherAlias: string | null;
  lastSwitchMs: number | null;
  lastSwitchAt: string | null;
  text: {
    idle: string;
    unknown: string;
    loadedAlias: string;
    currentLoaded: string;
    lastSwitchLoad: string;
    lastSwitchAt: string;
    switchingNow: string;
    lastEvent: string;
    ensureReason: string;
    logPath: string;
    noLog: string;
    refreshing: string;
    refresh: string;
    prewarm: string;
    release: string;
    restart: string;
    readLog: string;
  };
  onRefresh: () => void | Promise<void>;
  onPrewarm: () => void | Promise<void>;
  onAction: (action: AdminRuntimeModelAction) => void | Promise<void>;
};

export function AdminRuntimeModelStatePanel({
  locale,
  runtime,
  targets,
  action,
  runtimeMessage,
  loadedAlias,
  gatewayLoadedOtherAlias,
  lastSwitchMs,
  lastSwitchAt,
  text,
  onRefresh,
  onPrewarm,
  onAction,
}: AdminRuntimeModelStatePanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Model state</p>
        <span className="text-xs text-slate-500">{action ? text.refreshing : text.idle}</span>
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        <StateRow label={text.loadedAlias} value={loadedAlias ? describeAdminRuntimeAlias(loadedAlias, targets) : "—"}>
          {gatewayLoadedOtherAlias ? `${text.currentLoaded}: ${describeAdminRuntimeAlias(gatewayLoadedOtherAlias, targets)}` : null}
        </StateRow>
        <StateRow label={text.lastSwitchLoad} value={formatAdminRuntimeDuration(lastSwitchMs)} />
        <StateRow label={text.lastSwitchAt} value={formatAdminRuntimeTimestamp(lastSwitchAt, locale)} />
        <StateRow
          label={text.switchingNow}
          value={`${runtime?.loadingAlias ? describeAdminRuntimeAlias(runtime.loadingAlias, targets) : "—"}${runtime?.loadingAlias && typeof runtime.loadingElapsedMs === "number" ? ` · ${Math.max(1, Math.round(runtime.loadingElapsedMs / 1000))}s` : ""}`}
        />
        <StateRow label={text.lastEvent} value={runtime?.lastEvent || text.unknown} />
        <StateRow label={text.ensureReason} value={runtime?.lastEnsureReason || runtimeMessage || text.noLog} compact />
        <StateRow label={text.logPath} value={runtime?.logFile ? sanitizeDisplayPath(runtime.logFile) : text.unknown} compact />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <ActionButton disabled={Boolean(action)} onClick={onRefresh} label={action === "refresh" ? text.refreshing : text.refresh} />
        <ActionButton tone="cyan" disabled={Boolean(action)} onClick={onPrewarm} label={action === "prewarm" ? text.refreshing : text.prewarm} />
        <ActionButton tone="emerald" disabled={Boolean(action)} onClick={() => onAction("release")} label={action === "release" ? text.refreshing : text.release} />
        <ActionButton tone="amber" disabled={Boolean(action)} onClick={() => onAction("restart")} label={action === "restart" ? text.refreshing : text.restart} />
        <ActionButton disabled={Boolean(action)} onClick={() => onAction("read_log")} label={action === "read_log" ? text.refreshing : text.readLog} />
      </div>
    </div>
  );
}

function StateRow({ label, value, children, compact = false }: { label: string; value: string; children?: string | null; compact?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-1 text-white ${compact ? "break-all text-xs leading-6 text-slate-400" : "text-sm"}`}>{value}</p>
      {children ? <p className="mt-1 text-xs text-slate-500">{children}</p> : null}
    </div>
  );
}

function ActionButton({ label, disabled, onClick, tone = "neutral" }: { label: string; disabled: boolean; onClick: () => void | Promise<void>; tone?: "neutral" | "cyan" | "emerald" | "amber" }) {
  const toneClass = {
    neutral: "border-white/10 text-slate-300 hover:bg-white/5",
    cyan: "border-cyan-400/20 text-cyan-200 hover:bg-cyan-400/10",
    emerald: "border-emerald-400/20 text-emerald-200 hover:bg-emerald-400/10",
    amber: "border-amber-400/20 text-amber-200 hover:bg-amber-400/10",
  }[tone];
  return (
    <button type="button" disabled={disabled} onClick={() => void onClick()} className={`rounded-full border bg-transparent px-3 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500 ${toneClass}`}>
      {label}
    </button>
  );
}
