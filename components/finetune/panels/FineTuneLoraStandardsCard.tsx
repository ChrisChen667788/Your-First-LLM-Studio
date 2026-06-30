import { buildFineTuneLoraStandardsViewModel } from "@/features/finetune/lora-standards";

type FineTuneLoraStandardsCardProps = {
  modelId: string;
};

export function FineTuneLoraStandardsCard({ modelId }: FineTuneLoraStandardsCardProps) {
  const viewModel = buildFineTuneLoraStandardsViewModel(modelId);

  return (
    <section className="rounded-[24px] border border-cyan-300/15 bg-cyan-400/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
            LoRA standards
          </p>
          <h3 className="mt-2 text-base font-semibold text-white">
            Target modules, scheduler, packing, and best checkpoint
          </h3>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            {viewModel.targetModulePreset.label}: {viewModel.targetModulePreset.rationale}
          </p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
          eval_loss best
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Target modules</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {viewModel.defaults.targetModules.join(", ")}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Scheduler</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {viewModel.defaults.scheduler.label} · warmup {(viewModel.defaults.scheduler.warmupRatio * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Checkpoint policy</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            Save/eval every {viewModel.defaults.saveEverySteps} steps, then load best checkpoint.
          </p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 text-xs leading-5 text-slate-300 md:grid-cols-2">
        {viewModel.checklist.map((item) => (
          <li key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
