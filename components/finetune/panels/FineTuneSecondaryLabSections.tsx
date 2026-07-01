"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  AgentFineTuneAdapterArtifact,
  AgentFineTuneSummary,
} from "@/lib/agent/types";
import type {
  FineTuneChatFormState,
  FineTuneEvalMetric,
  FineTuneEvaluateFormState,
  FineTuneExportFormState,
} from "@/features/finetune/run-state";
import { FineTuneFieldShell as FieldShell } from "./FineTuneFieldShell";

type FineTuneText = Record<string, string>;
type FineTunePendingMap = Record<string, boolean>;
type FineTuneCopyAction = (
  value: string,
  message?: string,
) => void | Promise<void>;

type FineTuneEvaluateCheckpointOption = {
  path: string;
  label: string;
};

type FineTuneEvaluateRunSectionProps = {
  text: FineTuneText;
  isEnglish: boolean;
  summary?: AgentFineTuneSummary | null;
  evaluateForm: FineTuneEvaluateFormState;
  setEvaluateForm: Dispatch<SetStateAction<FineTuneEvaluateFormState>>;
  evaluateCheckpointOptions: FineTuneEvaluateCheckpointOption[];
  toggleEvaluateMetric: (metric: FineTuneEvalMetric) => void;
  evaluationReadiness: string;
  selectedEvaluateAdapter?: AgentFineTuneAdapterArtifact | null;
  actionPending: FineTunePendingMap;
  runEvaluation: () => Promise<void> | void;
  evaluateCommandPreview: string;
  evaluateYamlPreview: string;
  copyValue: FineTuneCopyAction;
};

type FineTuneChatAdapterRunSectionProps = {
  text: FineTuneText;
  isEnglish: boolean;
  summary?: AgentFineTuneSummary | null;
  chatForm: FineTuneChatFormState;
  setChatForm: Dispatch<SetStateAction<FineTuneChatFormState>>;
  chatReadiness: string;
  actionPending: FineTunePendingMap;
  runChatAdapter: () => Promise<void> | void;
  chatAdapterCommandPreview: string;
  copyValue: FineTuneCopyAction;
};

type FineTuneExportRunSectionProps = {
  text: FineTuneText;
  isEnglish: boolean;
  summary?: AgentFineTuneSummary | null;
  exportForm: FineTuneExportFormState;
  setExportForm: Dispatch<SetStateAction<FineTuneExportFormState>>;
  exportReadiness: string;
  actionPending: FineTunePendingMap;
  runExportAdapter: () => Promise<void> | void;
  exportAdapterCommandPreview: string;
  copyValue: FineTuneCopyAction;
};

export function FineTuneEvaluateRunSection(
  props: FineTuneEvaluateRunSectionProps,
) {
  const {
    text,
    isEnglish,
    summary,
    evaluateForm,
    setEvaluateForm,
    evaluateCheckpointOptions,
    toggleEvaluateMetric,
    evaluationReadiness,
    selectedEvaluateAdapter,
    actionPending,
    runEvaluation,
    evaluateCommandPreview,
    evaluateYamlPreview,
    copyValue,
  } = props;
  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr_0.9fr_1.15fr]">
      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
        <p className="text-sm font-semibold text-white">
          {text.evaluateConsoleTitle}
        </p>
        <p className="mt-2 text-xs leading-6 text-cyan-50/70">
          {text.evaluateConsoleHint}
        </p>
        <FieldShell
          label={text.evalDataset}
          helper={
            isEnglish
              ? "Use a validation or held-out dataset; saved datasets are available immediately."
              : "建议选择验证集或留出集；已保存数据集会直接出现在这里。"
          }
          className="mt-4"
        >
          <select
            value={evaluateForm.datasetId}
            onChange={(event) =>
              setEvaluateForm((current) => ({
                ...current,
                datasetId: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">{text.evalDataset}</option>
            {(summary?.datasets || []).map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.label}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell
          label={text.evalCheckpoint}
          helper={text.evalCheckpointHelper}
          className="mt-4"
        >
          <select
            value={evaluateForm.checkpointPath}
            onChange={(event) =>
              setEvaluateForm((current) => ({
                ...current,
                checkpointPath: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">{text.evalCheckpoint}</option>
            {evaluateCheckpointOptions.map((option) => (
              <option key={option.path} value={option.path}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={evaluateForm.checkpointPath}
            onChange={(event) =>
              setEvaluateForm((current) => ({
                ...current,
                checkpointPath: event.target.value,
              }))
            }
            placeholder={text.evalCheckpoint}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-white outline-none focus:border-cyan-400/40"
          />
        </FieldShell>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <p className="text-sm font-semibold text-white">
          {text.evalGeneration}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              key: "maxSamples",
              label: text.evalMaxSamples,
              min: 1,
              step: 1,
            },
            {
              key: "maxNewTokens",
              label: text.evalMaxNewTokens,
              min: 16,
              step: 16,
            },
            {
              key: "temperature",
              label: text.evalTemperature,
              min: 0,
              step: 0.1,
            },
            { key: "topP", label: text.evalTopP, min: 0, step: 0.05 },
          ].map((field) => (
            <FieldShell
              key={field.key}
              label={field.label}
              helper={
                field.key === "maxSamples"
                  ? isEnglish
                    ? "Caps evaluation rows so local smoke runs stay short."
                    : "限制评估样本数，避免本地冒烟跑太久。"
                  : field.key === "maxNewTokens"
                    ? isEnglish
                      ? "Caps generated answer length for each sample."
                      : "限制每条样本的最大生成长度。"
                    : field.key === "temperature"
                      ? isEnglish
                        ? "Lower values reduce sampling noise during evaluation."
                        : "较低温度可减少评估时的采样噪声。"
                      : isEnglish
                        ? "Controls nucleus sampling; keep stable for repeatable evals."
                        : "控制 nucleus sampling；评估时建议保持稳定。"
              }
            >
              <input
                type="number"
                min={field.min}
                step={field.step}
                value={
                  evaluateForm[
                    field.key as keyof Pick<
                      FineTuneEvaluateFormState,
                      "maxSamples" | "maxNewTokens" | "temperature" | "topP"
                    >
                  ]
                }
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (!Number.isFinite(nextValue)) return;
                  setEvaluateForm((current) => ({
                    ...current,
                    [field.key]: nextValue,
                  }));
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
              />
            </FieldShell>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {text.evalMetrics}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                "loss",
                "rouge-l",
                "bleu",
                "exact-match",
                "latency",
              ] as FineTuneEvalMetric[]
            ).map((metric) => (
              <button
                key={metric}
                type="button"
                onClick={() => toggleEvaluateMetric(metric)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                  evaluateForm.metrics.includes(metric)
                    ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-50"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
                }`}
              >
                {metric}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-200">
            <input
              type="checkbox"
              checked={evaluateForm.savePredictions}
              onChange={(event) =>
                setEvaluateForm((current) => ({
                  ...current,
                  savePredictions: event.target.checked,
                }))
              }
            />
            {text.evalSavePredictions}
          </label>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {text.evalReadiness}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {evaluationReadiness}
          </p>
          <p className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
            {text.evalApiPlanned}
          </p>
          <button
            type="button"
            disabled={
              !evaluateForm.datasetId ||
              !evaluateForm.checkpointPath.trim() ||
              !selectedEvaluateAdapter?.id ||
              Boolean(actionPending["evaluation-run"])
            }
            onClick={() => void runEvaluation()}
            className="mt-3 w-full rounded-2xl border border-cyan-300/35 bg-cyan-400/15 px-4 py-3 text-sm font-semibold text-cyan-50 transition enabled:hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {actionPending["evaluation-run"] ? text.loading : text.evalRun}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {text.commandPreview}
          </p>
          <button
            type="button"
            onClick={() =>
              void copyValue(evaluateCommandPreview, text.evalCommandCopied)
            }
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
          >
            {text.copyCommand}
          </button>
        </div>
        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-200">
          {evaluateCommandPreview}
        </pre>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {text.yamlPreview}
          </p>
          <button
            type="button"
            onClick={() =>
              void copyValue(evaluateYamlPreview, text.evalYamlCopied)
            }
            className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-[11px] font-semibold text-violet-100 transition hover:bg-violet-400/15"
          >
            {text.copyYaml}
          </button>
        </div>
        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-200">
          {evaluateYamlPreview}
        </pre>
      </div>
    </div>
  );
}

export function FineTuneChatAdapterRunSection(
  props: FineTuneChatAdapterRunSectionProps,
) {
  const {
    text,
    isEnglish,
    summary,
    chatForm,
    setChatForm,
    chatReadiness,
    actionPending,
    runChatAdapter,
    chatAdapterCommandPreview,
    copyValue,
  } = props;
  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr_1.15fr_1fr]">
      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
        <p className="text-sm font-semibold text-white">
          {text.chatConsoleTitle}
        </p>
        <p className="mt-2 text-xs leading-6 text-cyan-50/70">
          {text.chatConsoleHint}
        </p>
        <FieldShell
          label={text.chatAdapter}
          helper={
            isEnglish
              ? "Ready adapters can be attached to the local runtime for a controlled single-turn test."
              : "可用 adapter 后续可挂载到本地运行时，进行受控单轮测试。"
          }
          className="mt-4"
        >
          <select
            value={chatForm.adapterId}
            onChange={(event) =>
              setChatForm((current) => ({
                ...current,
                adapterId: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">{text.chatAdapter}</option>
            {(summary?.adapters || []).map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.adapterName} · {adapter.status}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell
          label={text.chatRole}
          helper={
            isEnglish
              ? "Role is useful when reproducing dataset-style prompts."
              : "角色用于复现数据集里的对话格式。"
          }
          className="mt-4"
        >
          <select
            value={chatForm.role}
            onChange={(event) =>
              setChatForm((current) => ({
                ...current,
                role: event.target.value as FineTuneChatFormState["role"],
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="user">user</option>
            <option value="assistant">assistant</option>
            <option value="system">system</option>
          </select>
        </FieldShell>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <FieldShell
          label={text.chatSystemPrompt}
          helper={
            isEnglish
              ? "Keep this short so the adapter behavior stays visible."
              : "保持简短，避免系统提示词盖过 adapter 本身行为。"
          }
        >
          <textarea
            value={chatForm.systemPrompt}
            onChange={(event) =>
              setChatForm((current) => ({
                ...current,
                systemPrompt: event.target.value,
              }))
            }
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-6 text-white outline-none focus:border-cyan-400/40"
          />
        </FieldShell>
        <FieldShell
          label={text.chatPrompt}
          helper={
            isEnglish
              ? "Use a short prompt that should expose whether the adapter learned the intended behavior."
              : "建议用能暴露 adapter 行为变化的短提示词。"
          }
          className="mt-3"
        >
          <textarea
            value={chatForm.prompt}
            onChange={(event) =>
              setChatForm((current) => ({
                ...current,
                prompt: event.target.value,
              }))
            }
            rows={5}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-6 text-white outline-none focus:border-cyan-400/40"
          />
        </FieldShell>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              key: "maxNewTokens",
              label: text.evalMaxNewTokens,
              min: 16,
              step: 16,
            },
            {
              key: "temperature",
              label: text.evalTemperature,
              min: 0,
              step: 0.1,
            },
            { key: "topP", label: text.evalTopP, min: 0, step: 0.05 },
          ].map((field) => (
            <FieldShell
              key={field.key}
              label={field.label}
              helper={
                field.key === "maxNewTokens"
                  ? isEnglish
                    ? "Caps answer length in the sandbox."
                    : "限制沙盒回答长度。"
                  : field.key === "temperature"
                    ? isEnglish
                      ? "Higher values make behavior differences easier to spot."
                      : "温度越高，行为差异越容易显现。"
                    : isEnglish
                      ? "Nucleus sampling value for the sandbox call."
                      : "沙盒调用的 nucleus sampling 参数。"
              }
            >
              <input
                type="number"
                min={field.min}
                step={field.step}
                value={
                  chatForm[
                    field.key as keyof Pick<
                      FineTuneChatFormState,
                      "maxNewTokens" | "temperature" | "topP"
                    >
                  ]
                }
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (!Number.isFinite(nextValue)) return;
                  setChatForm((current) => ({
                    ...current,
                    [field.key]: nextValue,
                  }));
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
              />
            </FieldShell>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          {[
            {
              key: "skipSpecialTokens",
              label: text.chatSkipSpecialTokens,
              checked: chatForm.skipSpecialTokens,
            },
            {
              key: "renderHtmlTags",
              label: text.chatRenderHtmlTags,
              checked: chatForm.renderHtmlTags,
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-slate-200"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) =>
                  setChatForm((current) => ({
                    ...current,
                    [item.key]: event.target.checked,
                  }))
                }
              />
              {item.label}
            </label>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {text.chatReadiness}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {chatReadiness}
          </p>
          <p className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
            {text.chatApiPlanned}
          </p>
          <button
            type="button"
            disabled={
              !chatForm.adapterId ||
              !chatForm.prompt.trim() ||
              Boolean(actionPending["chat-adapter-run"])
            }
            onClick={() => void runChatAdapter()}
            className="mt-3 w-full rounded-2xl border border-cyan-300/35 bg-cyan-400/15 px-4 py-3 text-sm font-semibold text-cyan-50 transition enabled:hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {actionPending["chat-adapter-run"] ? text.loading : text.chatRun}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {text.commandPreview}
          </p>
          <button
            type="button"
            onClick={() =>
              void copyValue(
                chatAdapterCommandPreview,
                text.adapterCommandCopied,
              )
            }
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
          >
            {text.copyCommand}
          </button>
        </div>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-200">
          {chatAdapterCommandPreview}
        </pre>
      </div>
    </div>
  );
}

export function FineTuneExportRunSection(props: FineTuneExportRunSectionProps) {
  const {
    text,
    isEnglish,
    summary,
    exportForm,
    setExportForm,
    exportReadiness,
    actionPending,
    runExportAdapter,
    exportAdapterCommandPreview,
    copyValue,
  } = props;
  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr_0.9fr_1.15fr]">
      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
        <p className="text-sm font-semibold text-white">
          {text.exportConsoleTitle}
        </p>
        <p className="mt-2 text-xs leading-6 text-cyan-50/70">
          {text.exportConsoleHint}
        </p>
        <FieldShell
          label={text.exportAdapter}
          helper={
            isEnglish
              ? "Pick the adapter artifact to package for deployment."
              : "选择要打包部署的 adapter 产物。"
          }
          className="mt-4"
        >
          <select
            value={exportForm.adapterId}
            onChange={(event) =>
              setExportForm((current) => ({
                ...current,
                adapterId: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">{text.exportAdapter}</option>
            {(summary?.adapters || []).map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.adapterName} · {adapter.status}
              </option>
            ))}
          </select>
        </FieldShell>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldShell
            label={text.exportFormat}
            helper={
              isEnglish
                ? "Adapter bundle is safest; merged/gguf are deployment-oriented follow-ups."
                : "Adapter bundle 最安全；merged / gguf 偏部署导出。"
            }
          >
            <select
              value={exportForm.exportFormat}
              onChange={(event) =>
                setExportForm((current) => ({
                  ...current,
                  exportFormat: event.target
                    .value as FineTuneExportFormState["exportFormat"],
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            >
              <option value="adapter-bundle">adapter-bundle</option>
              <option value="merged-mlx">merged-mlx</option>
              <option value="gguf">gguf</option>
            </select>
          </FieldShell>
          <FieldShell
            label={text.exportQuantization}
            helper={
              isEnglish
                ? "Keep none for lossless adapter bundles; q8/q4 for smaller deployables."
                : "无损 adapter bundle 选 none；q8/q4 用于更小部署产物。"
            }
          >
            <select
              value={exportForm.quantization}
              onChange={(event) =>
                setExportForm((current) => ({
                  ...current,
                  quantization: event.target
                    .value as FineTuneExportFormState["quantization"],
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            >
              <option value="none">none</option>
              <option value="q8">q8</option>
              <option value="q4">q4</option>
            </select>
          </FieldShell>
          <FieldShell
            label={text.exportShardSize}
            helper={
              isEnglish
                ? "Large merged exports can be split for upload and sync."
                : "较大的合并导出可按分片大小拆分，便于上传同步。"
            }
          >
            <input
              type="number"
              min={1}
              step={1}
              value={exportForm.maxShardSizeGb}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (!Number.isFinite(nextValue)) return;
                setExportForm((current) => ({
                  ...current,
                  maxShardSizeGb: nextValue,
                }));
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            />
          </FieldShell>
          <FieldShell
            label={text.exportHubId}
            helper={
              isEnglish
                ? "Optional repository id if this export will be published later."
                : "如果后续要发布到 Hub，可先填可选仓库 ID。"
            }
          >
            <input
              value={exportForm.hubId}
              onChange={(event) =>
                setExportForm((current) => ({
                  ...current,
                  hubId: event.target.value,
                }))
              }
              placeholder="username/model-name"
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            />
          </FieldShell>
        </div>
        <FieldShell
          label={text.exportOutputDir}
          helper={
            isEnglish
              ? "Defaults to an export folder next to the adapter output."
              : "默认导出到 adapter 产物旁边的 export 文件夹。"
          }
          className="mt-3"
        >
          <input
            value={exportForm.outputDir}
            onChange={(event) =>
              setExportForm((current) => ({
                ...current,
                outputDir: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
          />
        </FieldShell>
        <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-slate-200">
          <input
            type="checkbox"
            checked={exportForm.includeDatasetCard}
            onChange={(event) =>
              setExportForm((current) => ({
                ...current,
                includeDatasetCard: event.target.checked,
              }))
            }
          />
          {text.exportIncludeDatasetCard}
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FieldShell
            label={text.exportPublishTarget || "Publish target"}
            helper={
              isEnglish
                ? "Select where the package is intended to land; local keeps it as a private bundle."
                : "选择导出包的目标平台；local 表示仅作为本地私有 bundle。"
            }
          >
            <select
              value={exportForm.publishTarget}
              onChange={(event) =>
                setExportForm((current) => ({
                  ...current,
                  publishTarget: event.target
                    .value as FineTuneExportFormState["publishTarget"],
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            >
              <option value="local">local</option>
              <option value="huggingface">huggingface</option>
              <option value="modelscope">modelscope</option>
            </select>
          </FieldShell>
          <FieldShell
            label={text.exportSecretScanStatus || "Secret scan"}
            helper={
              isEnglish
                ? "Do not publish until secret scan status is passed."
                : "secret scan 通过前不要公开发布。"
            }
          >
            <select
              value={exportForm.secretScanStatus}
              onChange={(event) =>
                setExportForm((current) => ({
                  ...current,
                  secretScanStatus: event.target
                    .value as FineTuneExportFormState["secretScanStatus"],
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            >
              <option value="not-run">not-run</option>
              <option value="passed">passed</option>
              <option value="needs-review">needs-review</option>
            </select>
          </FieldShell>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-slate-200">
            <input
              type="checkbox"
              checked={exportForm.licenseReviewed}
              onChange={(event) =>
                setExportForm((current) => ({
                  ...current,
                  licenseReviewed: event.target.checked,
                }))
              }
            />
            {text.exportLicenseReviewed || "License reviewed"}
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-slate-200">
            <input
              type="checkbox"
              checked={exportForm.datasetAttributionReviewed}
              onChange={(event) =>
                setExportForm((current) => ({
                  ...current,
                  datasetAttributionReviewed: event.target.checked,
                }))
              }
            />
            {text.exportDatasetAttribution || "Dataset attribution reviewed"}
          </label>
        </div>
        <FieldShell
          label={text.exportSamplePrompts || "Sample prompts"}
          helper={
            isEnglish
              ? "One prompt per line; these go into the model card and release checklist."
              : "每行一个提示词，会写入模型卡和发布检查清单。"
          }
          className="mt-3"
        >
          <textarea
            value={exportForm.samplePrompts}
            rows={3}
            onChange={(event) =>
              setExportForm((current) => ({
                ...current,
                samplePrompts: event.target.value,
              }))
            }
            className="w-full resize-y rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
          />
        </FieldShell>
        <FieldShell
          label={text.exportKnownLimitations || "Known limitations"}
          helper={
            isEnglish
              ? "Make validation scope explicit before publishing."
              : "公开发布前明确验证范围和已知限制。"
          }
          className="mt-3"
        >
          <textarea
            value={exportForm.knownLimitations}
            rows={3}
            onChange={(event) =>
              setExportForm((current) => ({
                ...current,
                knownLimitations: event.target.value,
              }))
            }
            className="w-full resize-y rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
          />
        </FieldShell>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {text.exportReadiness}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {exportReadiness}
          </p>
          <p className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
            {text.exportApiPlanned}
          </p>
          <button
            type="button"
            disabled={
              !exportForm.adapterId ||
              Boolean(actionPending["export-adapter-run"])
            }
            onClick={() => void runExportAdapter()}
            className="mt-3 w-full rounded-2xl border border-cyan-300/35 bg-cyan-400/15 px-4 py-3 text-sm font-semibold text-cyan-50 transition enabled:hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {actionPending["export-adapter-run"]
              ? text.loading
              : text.exportRun}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {text.commandPreview}
          </p>
          <button
            type="button"
            onClick={() =>
              void copyValue(
                exportAdapterCommandPreview,
                text.adapterCommandCopied,
              )
            }
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
          >
            {text.copyCommand}
          </button>
        </div>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-200">
          {exportAdapterCommandPreview}
        </pre>
      </div>
    </div>
  );
}
