import type { AgentFineTuneJob } from "@/lib/agent/types";

type FineTuneJobPathsCardProps = {
  job: AgentFineTuneJob;
  text: Record<string, string>;
};

export function FineTuneJobPathsCard({ job, text }: FineTuneJobPathsCardProps) {
  return (
    <div className="mt-3 grid gap-2 text-[11px] text-slate-400">
      <p>
        {text.bundlePath}: {job.bundlePath}
      </p>
      <p>
        {text.outputDir}: {job.outputDir}
      </p>
      <p>
        {text.configFile}: {job.configFile || "--"}
      </p>
    </div>
  );
}
