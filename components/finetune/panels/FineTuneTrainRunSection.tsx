import type { Dispatch, SetStateAction } from "react";
import type { AgentTarget } from "@/lib/agent/types";
import { FineTuneFieldShell as FieldShell } from "./FineTuneFieldShell";
import type {
  FineTuneDistillationFormState,
  FineTuneTrainingArgGroup,
  FineTuneTrainStage,
  TextMap,
} from "./FineTuneSetupSectionTypes";

type DistillationNumberField = keyof Pick<
  FineTuneDistillationFormState,
  "sampleCount" | "maxNewTokens" | "temperature" | "topP"
>;

type FineTuneTrainRunSectionProps = {
  text: TextMap;
  isEnglish: boolean;
  trainStage: FineTuneTrainStage;
  setTrainStage: Dispatch<SetStateAction<FineTuneTrainStage>>;
  distillationForm: FineTuneDistillationFormState;
  setDistillationForm: Dispatch<SetStateAction<FineTuneDistillationFormState>>;
  targetCatalog: AgentTarget[];
  actionPending: Record<string, boolean | undefined>;
  distillationOutputPath: string;
  trainingArgGroups: FineTuneTrainingArgGroup[];
  trainingCommandPreview: string;
  trainingYamlPreview: string;
  selectedRecipeId: string;
  copyValue: (value?: string | null, successMessage?: string) => Promise<void>;
  saveTrainingArgsSnapshot: () => void;
  loadTrainingArgsSnapshot: () => void;
  runDistillation: () => Promise<void>;
  stageSelectedRecipeJob: () => Promise<unknown> | void;
};

function getDistillationFieldHelper(
  key: DistillationNumberField,
  isEnglish: boolean,
) {
  if (key === "sampleCount") {
    return isEnglish
      ? "Small starter sets are safer before long training."
      : "长轮次训练前，先用小 starter 数据更安全。";
  }
  if (key === "maxNewTokens") {
    return isEnglish
      ? "Caps each generated supervision answer."
      : "限制每条蒸馏答案的生成长度。";
  }
  if (key === "temperature") {
    return isEnglish
      ? "Lower values make synthetic data more stable."
      : "较低温度会让合成数据更稳定。";
  }
  return isEnglish
    ? "Nucleus sampling for teacher outputs."
    : "教师输出的 nucleus sampling 参数。";
}

export function FineTuneTrainRunSection({
  text,
  isEnglish,
  trainStage,
  setTrainStage,
  distillationForm,
  setDistillationForm,
  targetCatalog,
  actionPending,
  distillationOutputPath,
  trainingArgGroups,
  trainingCommandPreview,
  trainingYamlPreview,
  selectedRecipeId,
  copyValue,
  saveTrainingArgsSnapshot,
  loadTrainingArgsSnapshot,
  runDistillation,
  stageSelectedRecipeJob,
}: FineTuneTrainRunSectionProps) {
  const isDistillation = trainStage === "distillation";
  const commandCopyMessage = isDistillation
    ? text.distillationCommandCopied
    : text.commandCopied;
  const yamlCopyMessage = isDistillation
    ? text.distillationYamlCopied
    : text.yamlCopied;

  return (
    <div className="mt-4 grid gap-3 2xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.45fr)]">
      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
        <p className="text-sm font-semibold text-white">
          {text.trainConsoleTitle}
        </p>
        <p className="mt-2 text-xs leading-6 text-cyan-50/70">
          {text.trainConsoleHint}
        </p>
        <FieldShell
          label={text.trainStage}
          helper={
            isEnglish
              ? "This stage is written into the preview and staged bundle metadata."
              : "训练阶段会写入预览和暂存 bundle 元数据。"
          }
          className="mt-4"
        >
          <select
            value={trainStage}
            onChange={(event) =>
              setTrainStage(event.target.value as FineTuneTrainStage)
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="supervised-fine-tune">{text.trainStageSft}</option>
            <option value="continued-pretrain">
              {text.trainStagePretrain}
            </option>
            <option value="preference-tuning">
              {text.trainStagePreference}
            </option>
            <option value="distillation">{text.trainStageDistillation}</option>
          </select>
        </FieldShell>

        {isDistillation ? (
          <div className="mt-4 rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-3">
            <p className="text-sm font-semibold text-amber-50">
              {text.distillationConsoleTitle}
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-100/70">
              {text.distillationConsoleHint}
            </p>
            <FieldShell
              label={text.distillationTeacher}
              helper={
                isEnglish
                  ? "Pick a stronger remote or local target that will generate supervision examples."
                  : "选择更强的远端或本地目标，用来生成监督样本。"
              }
              className="mt-3"
            >
              <select
                value={distillationForm.teacherTargetId}
                onChange={(event) =>
                  setDistillationForm((current) => ({
                    ...current,
                    teacherTargetId: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">{text.distillationTeacher}</option>
                {targetCatalog.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label} · {target.execution}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell
              label={text.distillationOutputPath}
              helper={
                isEnglish
                  ? "Generated instruction JSONL should be validated before training."
                  : "生成的 instruction JSONL 仍需先校验，再进入训练。"
              }
              className="mt-3"
            >
              <input
                value={distillationForm.outputPath}
                onChange={(event) =>
                  setDistillationForm((current) => ({
                    ...current,
                    outputPath: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
              />
            </FieldShell>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    key: "sampleCount",
                    label: text.distillationSamples,
                    min: 16,
                    step: 16,
                  },
                  {
                    key: "maxNewTokens",
                    label: text.evalMaxNewTokens,
                    min: 64,
                    step: 64,
                  },
                  {
                    key: "temperature",
                    label: text.evalTemperature,
                    min: 0,
                    step: 0.1,
                  },
                  {
                    key: "topP",
                    label: text.evalTopP,
                    min: 0,
                    step: 0.05,
                  },
                ] satisfies Array<{
                  key: DistillationNumberField;
                  label: string;
                  min: number;
                  step: number;
                }>
              ).map((field) => (
                <FieldShell
                  key={field.key}
                  label={field.label}
                  helper={getDistillationFieldHelper(field.key, isEnglish)}
                >
                  <input
                    type="number"
                    min={field.min}
                    step={field.step}
                    value={distillationForm[field.key]}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      if (!Number.isFinite(nextValue)) return;
                      setDistillationForm((current) => ({
                        ...current,
                        [field.key]: nextValue,
                      }));
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
                  />
                </FieldShell>
              ))}
            </div>
            <FieldShell
              label={text.distillationSeedPrompt}
              helper={
                isEnglish
                  ? "Describe the behavior you want the generated dataset to teach."
                  : "描述你希望蒸馏数据教会模型的目标行为。"
              }
              className="mt-3"
            >
              <textarea
                value={distillationForm.seedPrompt}
                onChange={(event) =>
                  setDistillationForm((current) => ({
                    ...current,
                    seedPrompt: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-xs leading-6 text-white outline-none"
              />
            </FieldShell>
            <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-amber-50">
              <input
                type="checkbox"
                checked={distillationForm.includeReasoningTrace}
                onChange={(event) =>
                  setDistillationForm((current) => ({
                    ...current,
                    includeReasoningTrace: event.target.checked,
                  }))
                }
              />
              {text.distillationIncludeReasoning}
            </label>
            <button
              type="button"
              disabled={
                !distillationForm.teacherTargetId ||
                Boolean(actionPending["distillation-run"])
              }
              onClick={() => void runDistillation()}
              className="mt-3 w-full rounded-2xl border border-amber-300/30 bg-amber-300/15 px-4 py-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {actionPending["distillation-run"]
                ? text.loading
                : text.distillationRun}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {text.trainingArgsMatrix}
            </p>
            <p className="ui-pretty mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              {text.trainingArgsMatrixHint}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
            {trainStage}
          </span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {trainingArgGroups.map((group) => (
            <section
              key={group.label}
              className="rounded-3xl border border-white/10 bg-white/[0.035] p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                {group.label}
              </p>
              <div className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <div
                    key={`${group.label}:${item.label}`}
                    className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {item.label}
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-white">
                          {item.value}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                        {text.trainingArgsRecommended}: {item.recommended}
                      </span>
                    </div>
                    <p className="ui-pretty mt-2 text-[11px] leading-5 text-slate-500">
                      {item.helper}
                    </p>
                    <p className="ui-pretty mt-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.055] px-2.5 py-2 text-[11px] leading-5 text-cyan-50/80">
                      {text.trainingArgsImpact}: {item.impact}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="grid gap-3 2xl:col-span-2 xl:grid-cols-[1fr_1fr_0.85fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {text.commandPreview}
            </p>
            <button
              type="button"
              onClick={() => void copyValue(trainingCommandPreview, commandCopyMessage)}
              className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              {text.copyCommand}
            </button>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-200">
            {trainingCommandPreview}
          </pre>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {text.yamlPreview}
            </p>
            <button
              type="button"
              onClick={() => void copyValue(trainingYamlPreview, yamlCopyMessage)}
              className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-[11px] font-semibold text-violet-100 transition hover:bg-violet-400/15"
            >
              {text.copyYaml}
            </button>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-200">
            {trainingYamlPreview}
          </pre>
        </div>
        <div className="rounded-3xl border border-emerald-300/15 bg-emerald-400/[0.055] p-4">
          <p className="text-sm font-semibold text-white">
            {text.trainActions}
          </p>
          <p className="ui-pretty mt-2 text-xs leading-5 text-emerald-50/70">
            {text.trainActionHint}
          </p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => void copyValue(trainingCommandPreview, commandCopyMessage)}
              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-left text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              {text.copyCommand}
            </button>
            <button
              type="button"
              onClick={saveTrainingArgsSnapshot}
              className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-left text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
            >
              {text.saveArgs}
            </button>
            <button
              type="button"
              onClick={loadTrainingArgsSnapshot}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs font-semibold text-slate-100 transition hover:bg-white/10"
            >
              {text.loadArgs}
            </button>
            <button
              type="button"
              disabled={!selectedRecipeId}
              onClick={() => void stageSelectedRecipeJob()}
              className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-left text-xs font-semibold text-amber-100 transition enabled:hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {text.stageJob}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
