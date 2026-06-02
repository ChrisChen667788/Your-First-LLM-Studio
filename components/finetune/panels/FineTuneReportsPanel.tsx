"use client";

import type { AgentFineTuneOperation } from "@/lib/agent/types";

type FineTuneReportsPanelProps = {
  operations: AgentFineTuneOperation[];
  text: Record<string, string>;
  formatDateTime: (value?: string) => string;
  copyValue: (value: string, message?: string) => void | Promise<void>;
};

export function FineTuneReportsPanel({
  operations,
  text,
  formatDateTime,
  copyValue,
}: FineTuneReportsPanelProps) {
  return (
    <div className="mt-4 rounded-[24px] border border-cyan-300/15 bg-cyan-400/[0.045] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">
          {text.operationHistory}
        </p>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-50">
          {operations.length}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {operations.length ? (
          operations.slice(0, 8).map((operation) => (
            <div
              key={operation.id}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs leading-6 text-slate-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">
                      {operation.title}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                      {operation.kind}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {formatDateTime(operation.updatedAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    operation.status === "completed"
                      ? "bg-emerald-400/10 text-emerald-100"
                      : "bg-rose-400/10 text-rose-100"
                  }`}
                >
                  {operation.status}
                </span>
              </div>
              <p className="mt-2 text-slate-300">{operation.summary}</p>
              {operation.metrics && Object.keys(operation.metrics).length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(operation.metrics)
                    .slice(0, 8)
                    .map(([metricKey, metricValue]) => (
                      <span
                        key={`${operation.id}:${metricKey}`}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300"
                      >
                        {metricKey}: {String(metricValue ?? "--")}
                      </span>
                    ))}
                </div>
              ) : null}
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {text.operationArtifacts}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {operation.artifacts.length ? (
                    operation.artifacts.map((artifact) => (
                      <button
                        key={`${operation.id}:${artifact.filePath}`}
                        type="button"
                        onClick={() =>
                          void copyValue(artifact.filePath, text.copied)
                        }
                        className="max-w-full truncate rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-left text-[10px] font-semibold text-cyan-50 transition hover:bg-cyan-300/15"
                        title={artifact.filePath}
                      >
                        {artifact.label}
                      </button>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-500">--</span>
                  )}
                </div>
              </div>
              {operation.errorMessage ? (
                <p className="mt-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-2.5 py-2 text-[11px] text-rose-100">
                  {operation.errorMessage}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-500">
            {text.operationHistoryEmpty}
          </p>
        )}
      </div>
    </div>
  );
}
