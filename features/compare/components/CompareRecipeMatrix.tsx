import { CompareRecipeGallery } from "@/features/compare/components/CompareRecipeGallery";
import type { AgentStudioRecipe } from "@/lib/agent/types";

type CompareRecipeMatrixProps = {
  locale: string;
  recipes: AgentStudioRecipe[];
  recipesPending: boolean;
  recipesExecutionPending: boolean;
  recipesError: string;
  activeRecipeId: string;
  recipeDraftLabel: string;
  recipeDraftDescription: string;
  selectedTargetCount: number;
  onRecipeDraftLabelChange: (value: string) => void;
  onRecipeDraftDescriptionChange: (value: string) => void;
  onRefreshRecipes: () => void;
  onApplyRecipe: (recipeId: string) => void;
  onRunRecipeCompare: (recipeId: string) => void;
  onRunRecipeBenchmark: (recipeId: string) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onSaveCurrentRecipe: () => void;
  onExportRecipesJson: () => void;
  onImportRecipesJson: (file: File) => void;
};

export function CompareRecipeMatrix({
  locale,
  recipes,
  recipesPending,
  recipesExecutionPending,
  recipesError,
  activeRecipeId,
  recipeDraftLabel,
  recipeDraftDescription,
  selectedTargetCount,
  onRecipeDraftLabelChange,
  onRecipeDraftDescriptionChange,
  onRefreshRecipes,
  onApplyRecipe,
  onRunRecipeCompare,
  onRunRecipeBenchmark,
  onDeleteRecipe,
  onSaveCurrentRecipe,
  onExportRecipesJson,
  onImportRecipesJson,
}: CompareRecipeMatrixProps) {
  const isEnglish = locale.startsWith("en");

  return (
    <details className="group rounded-[28px] border border-white/10 bg-white/[0.025] p-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3 transition hover:bg-white/[0.04]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">
            {isEnglish ? "Reusable compare recipes" : "可复用 Compare 配方"}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {isEnglish
              ? `${recipes.length} setups. Expand only when you need preset management.`
              : `${recipes.length} 个配置。只有管理预设时再展开。`}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200">
          {isEnglish ? "Expand" : "展开"}
        </span>
      </summary>
      <div className="mt-3">
        <CompareRecipeGallery
          locale={locale}
          recipes={recipes}
          pending={recipesPending}
          executionPending={recipesExecutionPending}
          error={recipesError}
          activeRecipeId={activeRecipeId}
          draftLabel={recipeDraftLabel}
          draftDescription={recipeDraftDescription}
          selectedTargetCount={selectedTargetCount}
          onDraftLabelChange={onRecipeDraftLabelChange}
          onDraftDescriptionChange={onRecipeDraftDescriptionChange}
          onRefresh={onRefreshRecipes}
          onApply={onApplyRecipe}
          onRunCompare={onRunRecipeCompare}
          onRunBenchmark={onRunRecipeBenchmark}
          onDelete={onDeleteRecipe}
          onSaveCurrent={onSaveCurrentRecipe}
          onExportJson={onExportRecipesJson}
          onImportJson={onImportRecipesJson}
        />
      </div>
    </details>
  );
}
