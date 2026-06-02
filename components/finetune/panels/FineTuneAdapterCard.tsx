import type { AgentFineTuneAdapterArtifact } from "@/lib/agent/types";

type FineTuneAdapterCardProps = {
  adapter: AgentFineTuneAdapterArtifact;
  text: Record<string, string>;
  actionPending: Record<string, boolean>;
  formatDateTime: (value?: string) => string;
  onAttachRuntime: (adapterId: string) => void;
  onDetachRuntime: (adapterId: string) => void;
  onSendToBenchmark: (adapterId: string) => void;
  onSendToCompare: (adapterId: string) => void;
  onRunProofLoop: (adapterId: string) => void;
  onOpenDir: (adapterId: string) => void;
  onCopyPath: (path: string) => void;
  onOpenSource: (adapterId: string) => void;
};

export function FineTuneAdapterCard({
  adapter,
  text,
  actionPending,
  formatDateTime,
  onAttachRuntime,
  onDetachRuntime,
  onSendToBenchmark,
  onSendToCompare,
  onRunProofLoop,
  onOpenDir,
  onCopyPath,
  onOpenSource,
}: FineTuneAdapterCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-xs leading-6 text-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{adapter.adapterName}</p>
          <p className="mt-1 text-slate-400">{adapter.baseTargetLabel || "--"}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
            adapter.status === "ready"
              ? "bg-emerald-400/10 text-emerald-100"
              : adapter.status === "checkpointing"
                ? "bg-cyan-400/10 text-cyan-100"
                : "bg-amber-400/10 text-amber-100"
          }`}
        >
          {adapter.status}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <p>
          {text.checkpointCount}: {adapter.checkpointCount}
        </p>
        <p>
          {text.latestCheckpoint}: {formatDateTime(adapter.latestCheckpointAt)}
        </p>
        <p>
          {text.outputDir}: {adapter.outputDir}
        </p>
        <p>
          {text.benchmarkSuite}: {adapter.benchmarkSuiteId || "--"}
        </p>
        <p>
          {text.runtimeAttached}: {adapter.attachedTargetLabel || "--"}
        </p>
        <p>
          {text.attachedAt}: {formatDateTime(adapter.attachedAt)}
        </p>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
          {text.adapterArtifacts}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {adapter.files.length ? (
            adapter.files.slice(0, 10).map((file) => (
              <span
                key={`${adapter.id}:${file}`}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-200"
              >
                {file}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-500">--</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            adapter.status !== "ready" ||
            Boolean(actionPending[`adapter-attach:${adapter.id}`])
          }
          onClick={() => onAttachRuntime(adapter.id)}
          className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition enabled:hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {actionPending[`adapter-attach:${adapter.id}`]
            ? text.loading
            : text.attachRuntime}
        </button>
        {adapter.attachedTargetId ? (
          <button
            type="button"
            disabled={Boolean(actionPending[`adapter-detach:${adapter.id}`])}
            onClick={() => onDetachRuntime(adapter.id)}
            className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100 transition enabled:hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {actionPending[`adapter-detach:${adapter.id}`]
              ? text.loading
              : text.detachRuntime}
          </button>
        ) : null}
        <button
          type="button"
          disabled={
            adapter.status !== "ready" ||
            Boolean(actionPending[`adapter-benchmark:${adapter.id}`])
          }
          onClick={() => onSendToBenchmark(adapter.id)}
          className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition enabled:hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {actionPending[`adapter-benchmark:${adapter.id}`]
            ? text.loading
            : text.sendToBenchmark}
        </button>
        <button
          type="button"
          disabled={
            adapter.status !== "ready" ||
            Boolean(actionPending[`adapter-compare:${adapter.id}`])
          }
          onClick={() => onSendToCompare(adapter.id)}
          className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-[11px] font-semibold text-violet-100 transition enabled:hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {actionPending[`adapter-compare:${adapter.id}`]
            ? text.loading
            : text.sendToCompare}
        </button>
        <button
          type="button"
          disabled={
            adapter.status !== "ready" ||
            Boolean(actionPending[`adapter-proof:${adapter.id}`])
          }
          onClick={() => onRunProofLoop(adapter.id)}
          className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-[11px] font-semibold text-sky-100 transition enabled:hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {actionPending[`adapter-proof:${adapter.id}`]
            ? text.loading
            : text.runProofLoop}
        </button>
        <button
          type="button"
          onClick={() => onOpenDir(adapter.id)}
          className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
        >
          {actionPending[`adapter-open:${adapter.id}`]
            ? text.loading
            : text.openDir}
        </button>
        <button
          type="button"
          onClick={() => onCopyPath(adapter.outputDir)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {text.copyPath}
        </button>
        {adapter.sourceUrl ? (
          <button
            type="button"
            onClick={() => onOpenSource(adapter.id)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
          >
            {actionPending[`adapter-source:${adapter.id}`]
              ? text.loading
              : text.openSource}
          </button>
        ) : null}
      </div>
    </div>
  );
}
