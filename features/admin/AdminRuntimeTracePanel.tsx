import type { AgentRuntimeStatus } from "@/lib/agent/types";

export function AdminRuntimeTracePanel({
  runtime,
  message,
  emptyLabel,
}: {
  runtime?: AgentRuntimeStatus;
  message: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Runtime trace</p>
      <p className="mt-3 text-sm leading-6 text-slate-200">{message || emptyLabel}</p>
      {runtime?.phaseDetail ? (
        <p className="mt-2 text-xs leading-6 text-slate-400">{runtime.phaseDetail}</p>
      ) : null}
      {runtime?.loadingAlias || runtime?.loadingError ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-slate-300">
          {runtime.loadingAlias ? (
            <p>
              Loading: {runtime.loadingAlias}
              {typeof runtime.loadingElapsedMs === "number"
                ? ` · ${Math.max(1, Math.round(runtime.loadingElapsedMs / 1000))}s`
                : ""}
            </p>
          ) : null}
          {runtime.loadingError ? (
            <p className="mt-2 break-all text-rose-200">Loading error: {runtime.loadingError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
