import { FineTuneFieldShell as FieldShell } from "./FineTuneFieldShell";
import type { FineTuneRecipeSetupSectionProps } from "./FineTuneSetupSectionTypes";

export function FineTuneRecipeSetupSection({
  text,
  summary,
  recipeForm,
  setRecipeForm,
  recipeHelp,
  recipeScheduleFields,
  recipeAdapterFields,
  recipeEvidenceFields,
  updateRecipeNumber,
  saveRecipe,
}: FineTuneRecipeSetupSectionProps) {
  return (
    <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-sm font-semibold text-white">{text.recipeTitle}</p>
      <p className="mt-2 text-xs leading-6 text-slate-500">{text.recipeHint}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-2">
        <FieldShell label={text.recipeLabel} helper={recipeHelp.label}>
          <input
            value={recipeForm.label}
            onChange={(event) =>
              setRecipeForm((current) => ({
                ...current,
                label: event.target.value,
              }))
            }
            placeholder={text.recipeLabel}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          />
        </FieldShell>
        <FieldShell label={text.datasets} helper={recipeHelp.datasetId}>
          <select
            value={recipeForm.datasetId}
            onChange={(event) =>
              setRecipeForm((current) => ({
                ...current,
                datasetId: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">{text.datasets}</option>
            {(summary?.datasets || []).map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.label}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell label={text.baseTarget} helper={recipeHelp.baseTargetId}>
          <select
            value={recipeForm.baseTargetId}
            onChange={(event) =>
              setRecipeForm((current) => ({
                ...current,
                baseTargetId: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">{text.baseTarget}</option>
            {(summary?.localTargets || []).map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell label={text.adapterName} helper={recipeHelp.adapterName}>
          <input
            value={recipeForm.adapterName}
            onChange={(event) =>
              setRecipeForm((current) => ({
                ...current,
                adapterName: event.target.value,
              }))
            }
            placeholder={text.adapterName}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          />
        </FieldShell>
        <FieldShell
          label={text.fineTuneMethod}
          helper={recipeHelp.fineTuneMethod}
        >
          <select
            value={recipeForm.fineTuneMethod}
            onChange={(event) =>
              setRecipeForm((current) => ({
                ...current,
                fineTuneMethod: event.target.value as "lora" | "dora",
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="lora">{text.fineTuneMethod} · LoRA</option>
            <option value="dora">{text.fineTuneMethod} · DoRA</option>
          </select>
        </FieldShell>
        <FieldShell label={text.optimizer} helper={recipeHelp.optimizer}>
          <select
            value={recipeForm.optimizer}
            onChange={(event) =>
              setRecipeForm((current) => ({
                ...current,
                optimizer: event.target.value as
                  | "adam"
                  | "adamw"
                  | "sgd"
                  | "adafactor",
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="adamw">{text.optimizer} · AdamW</option>
            <option value="adam">{text.optimizer} · Adam</option>
            <option value="sgd">{text.optimizer} · SGD</option>
            <option value="adafactor">{text.optimizer} · Adafactor</option>
          </select>
        </FieldShell>
        {[
          {
            label: text.recipeGroupSchedule,
            fields: recipeScheduleFields,
          },
          {
            label: text.recipeGroupAdapter,
            fields: recipeAdapterFields,
          },
          {
            label: text.recipeGroupEvidence,
            fields: recipeEvidenceFields,
          },
        ].map((group) => (
          <div
            key={group.label}
            className="rounded-3xl border border-white/10 bg-slate-950/45 p-3 sm:col-span-2"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
              {group.label}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.fields.map((field) => (
                <FieldShell
                  key={field.key}
                  label={field.label}
                  helper={field.helper}
                >
                  <input
                    type="number"
                    step={field.step}
                    value={recipeForm[field.key]}
                    onChange={(event) =>
                      updateRecipeNumber(field.key, event.target.value)
                    }
                    placeholder={field.label}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
                  />
                </FieldShell>
              ))}
            </div>
          </div>
        ))}
        <FieldShell
          label={text.benchmarkSuite}
          helper={recipeHelp.benchmarkSuiteId}
        >
          <input
            value={recipeForm.benchmarkSuiteId}
            onChange={(event) =>
              setRecipeForm((current) => ({
                ...current,
                benchmarkSuiteId: event.target.value,
              }))
            }
            placeholder={text.benchmarkSuite}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          />
        </FieldShell>
        <FieldShell
          label={text.notes}
          helper={recipeHelp.notes}
          className="sm:col-span-2"
        >
          <textarea
            value={recipeForm.notes}
            onChange={(event) =>
              setRecipeForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder={text.notes}
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          />
        </FieldShell>
        <label className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300 sm:col-span-2">
          <span className="flex items-center gap-2 font-semibold text-slate-100">
            <input
              type="checkbox"
              checked={recipeForm.gradientCheckpointing}
              onChange={(event) =>
                setRecipeForm((current) => ({
                  ...current,
                  gradientCheckpointing: event.target.checked,
                }))
              }
            />
            {text.gradientCheckpointing}
          </span>
          <span className="mt-1 block text-[11px] leading-5 text-slate-500">
            {recipeHelp.gradientCheckpointing}
          </span>
        </label>
        <button
          type="button"
          onClick={() => void saveRecipe()}
          className="rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/15 sm:col-span-2"
        >
          {text.recipeSave}
        </button>
      </div>
    </div>
  );
}
