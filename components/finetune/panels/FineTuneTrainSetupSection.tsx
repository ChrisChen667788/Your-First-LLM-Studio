import type { FineTuneTrainSetupSectionProps } from "./FineTuneSetupSectionTypes";

export function FineTuneTrainSetupSection({
  text,
  summary,
  selectedRecipeId,
  setSelectedRecipeId,
  selectedRecipe,
  stageRecipeJob,
}: FineTuneTrainSetupSectionProps) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-sm font-semibold text-white">{text.jobTitle}</p>
      <p className="mt-2 text-xs leading-6 text-slate-500">{text.jobHint}</p>
      <div className="mt-4 space-y-3">
        <select
          value={selectedRecipeId}
          onChange={(event) => setSelectedRecipeId(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
        >
          <option value="">{text.recipes}</option>
          {(summary?.recipes || []).map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.label}
            </option>
          ))}
        </select>
        {selectedRecipe ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs leading-6 text-slate-300">
            <p className="font-semibold text-white">{selectedRecipe.label}</p>
            <p className="mt-2">
              {text.adapterName}: {selectedRecipe.adapterName}
            </p>
            <p>
              {text.benchmarkSuite}: {selectedRecipe.benchmarkSuiteId || "--"}
            </p>
            <p>
              {text.sequenceLength}: {selectedRecipe.sequenceLength}
            </p>
            <p>
              {text.fineTuneMethod}: {selectedRecipe.fineTuneMethod}
            </p>
            <p>
              {text.optimizer}: {selectedRecipe.optimizer}
            </p>
            <p>
              {text.scheduler}: {selectedRecipe.scheduler} ·{" "}
              {text.warmupRatio}: {selectedRecipe.warmupRatio}
            </p>
            <p>
              {text.targetModules}: {selectedRecipe.targetModules.join(", ")}
            </p>
            <p>
              {text.evalEverySteps}: {selectedRecipe.evalEverySteps} ·{" "}
              {text.saveEverySteps}: {selectedRecipe.saveEverySteps}
            </p>
            <p>
              {text.bestCheckpointMetric}:{" "}
              {selectedRecipe.bestCheckpointMetric}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          disabled={!selectedRecipeId}
          onClick={() => void stageRecipeJob(selectedRecipeId)}
          className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition enabled:hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {text.stageJob}
        </button>
      </div>
    </div>
  );
}
