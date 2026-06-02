import type { AgentFineTuneJob } from "@/lib/agent/types";

type FineTuneWorkerLogCardProps = {
  job: AgentFineTuneJob;
  text: Record<string, string>;
};

export function FineTuneWorkerLogCard({
  job,
  text,
}: FineTuneWorkerLogCardProps) {
  if (!job.recentLogLines?.length) return null;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
        {text.workerLog}
      </p>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950/70 p-3 text-[11px] leading-5 text-slate-300">
        {job.recentLogLines.join("\n")}
      </pre>
    </div>
  );
}
