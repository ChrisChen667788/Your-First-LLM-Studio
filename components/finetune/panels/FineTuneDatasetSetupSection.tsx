import { FineTuneFieldShell as FieldShell } from "./FineTuneFieldShell";
import type { AgentFineTuneDatasetFormat } from "@/lib/agent/types";
import type {
  DatasetSourceMode,
  FineTuneDatasetSetupSectionProps,
} from "./FineTuneSetupSectionTypes";

export function FineTuneDatasetSetupSection({
  text,
  isEnglish,
  datasetSourceMode,
  setDatasetSourceMode,
  communityImportForm,
  setCommunityImportForm,
  actionPending,
  importCommunityDatasetSource,
  communityDatasetPresets: COMMUNITY_DATASET_PRESETS,
  getPresetLabel,
  getPresetDescription,
  getPresetBestFor,
  getPresetDifficulty,
  getPresetRecommendedSteps,
  getPresetModelFit,
  getPresetLicenseRisk,
  applyCommunityDatasetPreset,
  quickStartCommunityDatasetPreset,
  datasetForm,
  setDatasetForm,
  validateDataset,
  saveDataset,
  canSaveDataset,
  datasetValidation,
  datasetValidationQuality,
  datasetValidationQualityWarnings,
  formatSampleCount,
  formatQualityScore,
  getLicenseRiskLabel,
}: FineTuneDatasetSetupSectionProps) {
  return (
    <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-sm font-semibold text-white">{text.datasetTitle}</p>
      <p className="mt-2 text-xs leading-6 text-slate-500">
        {text.datasetHint}
      </p>
      <div className="mt-4 space-y-3">
        <div className="flex rounded-full border border-white/10 bg-slate-950/60 p-1">
          {(["local", "community"] as DatasetSourceMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDatasetSourceMode(mode)}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                datasetSourceMode === mode
                  ? "bg-cyan-400/15 text-cyan-100"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {mode === "local"
                ? text.datasetSourceLocal
                : text.datasetSourceCommunity}
            </button>
          ))}
        </div>

        {datasetSourceMode === "community" ? (
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.055] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-50">
                  {text.communityDatasetTitle}
                </p>
                <p className="mt-1 max-w-xl text-xs leading-5 text-cyan-100/70">
                  {text.communityDatasetHint}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {text.communityImportTitle}
                  </p>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
                    {text.communityImportHint}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      text.communityImportGuardDirect,
                      text.communityImportGuardSchema,
                      text.communityImportGuardLimit,
                      text.communityImportGuardLicense,
                    ].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-50/80"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={
                    !communityImportForm.label.trim() ||
                    !communityImportForm.sourceUrl.trim() ||
                    Boolean(actionPending["dataset-community-import"])
                  }
                  onClick={() => void importCommunityDatasetSource()}
                  className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition enabled:hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {actionPending["dataset-community-import"]
                    ? text.loading
                    : text.communityImportAction}
                </button>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <input
                  value={communityImportForm.label}
                  onChange={(event) =>
                    setCommunityImportForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  placeholder={text.communityImportLabel}
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/40"
                />
                <input
                  value={communityImportForm.sourceLabel}
                  onChange={(event) =>
                    setCommunityImportForm((current) => ({
                      ...current,
                      sourceLabel: event.target.value,
                    }))
                  }
                  placeholder={text.communityImportSourceLabel}
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/40"
                />
                <input
                  value={communityImportForm.sourceUrl}
                  onChange={(event) =>
                    setCommunityImportForm((current) => ({
                      ...current,
                      sourceUrl: event.target.value,
                    }))
                  }
                  placeholder={text.communityImportUrl}
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/40 lg:col-span-2"
                />
                <select
                  value={communityImportForm.format}
                  onChange={(event) =>
                    setCommunityImportForm((current) => ({
                      ...current,
                      format: event.target.value as AgentFineTuneDatasetFormat,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/40"
                >
                  <option value="instruction-jsonl">
                    {text.communityImportFormat}: instruction-jsonl
                  </option>
                  <option value="chat-jsonl">
                    {text.communityImportFormat}: chat-jsonl
                  </option>
                </select>
                <input
                  type="number"
                  min={32}
                  max={5000}
                  value={communityImportForm.sampleLimit}
                  onChange={(event) =>
                    setCommunityImportForm((current) => ({
                      ...current,
                      sampleLimit: Number(event.target.value) || 384,
                    }))
                  }
                  placeholder={text.communityImportSampleLimit}
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/40"
                />
                <input
                  value={communityImportForm.license}
                  onChange={(event) =>
                    setCommunityImportForm((current) => ({
                      ...current,
                      license: event.target.value,
                    }))
                  }
                  placeholder={text.communityImportLicense}
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/40 lg:col-span-2"
                />
              </div>
            </div>
            <div className="mt-3 grid max-h-[640px] gap-3 overflow-auto pr-1">
              {COMMUNITY_DATASET_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {getPresetLabel(preset)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {getPresetDescription(preset)}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      {preset.source}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-[11px] leading-5 text-slate-400">
                    <p>
                      {text.bestFor}:{" "}
                      <span className="text-slate-300">
                        {getPresetBestFor(preset)}
                      </span>
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        {text.difficulty}:{" "}
                        <span className="text-slate-200">
                          {getPresetDifficulty(preset)}
                        </span>
                      </span>
                      <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        {text.starterRows}:{" "}
                        <span className="text-slate-200">
                          {preset.bootstrapRows} local /{" "}
                          {preset.sampleCount.toLocaleString()} upstream
                        </span>
                      </span>
                      <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        {text.recommendedPlan}:{" "}
                        <span className="text-slate-200">
                          {preset.recommendedEpochs} epochs ·{" "}
                          {preset.recommendedSamples.toLocaleString()} rows
                        </span>
                      </span>
                      <span className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-3 py-2">
                        {text.modelFit}:{" "}
                        <span className="text-cyan-100">
                          {getPresetModelFit(preset)}
                        </span>
                      </span>
                      <span className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2">
                        {text.risk}:{" "}
                        <span className="text-amber-100">
                          {getPresetLicenseRisk(preset)}
                        </span>
                      </span>
                      <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        {text.license}:{" "}
                        <span className="text-slate-200">{preset.license}</span>
                      </span>
                    </div>
                    <p>
                      {getPresetRecommendedSteps(preset)} · {preset.format} ·{" "}
                      {preset.localPath}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyCommunityDatasetPreset(preset)}
                      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      {text.loadPreset}
                    </button>
                    <button
                      type="button"
                      disabled={
                        actionPending[`dataset-preset-quickstart:${preset.id}`]
                      }
                      onClick={() =>
                        void quickStartCommunityDatasetPreset(preset)
                      }
                      className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition enabled:hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {text.quickStartPreset}
                    </button>
                    <a
                      href={preset.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
                    >
                      {text.sourcePage}
                    </a>
                    {preset.docsUrl ? (
                      <a
                        href={preset.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
                      >
                        {text.docsPage}
                      </a>
                    ) : null}
                    {preset.paperUrl ? (
                      <a
                        href={preset.paperUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
                      >
                        {text.paperPage}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <FieldShell
          label={text.datasetLabel}
          helper={
            isEnglish
              ? "Name shown in recipe selection and job history."
              : "显示在配方选择和作业历史里的数据集名称。"
          }
        >
          <input
            value={datasetForm.label}
            onChange={(event) =>
              setDatasetForm((current) => ({
                ...current,
                label: event.target.value,
              }))
            }
            placeholder={text.datasetLabel}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          />
        </FieldShell>
        <FieldShell
          label={text.datasetPath}
          helper={
            isEnglish
              ? "Local JSONL path. Community presets fill this with a bundled starter file."
              : "本地 JSONL 路径；社区预设会自动填入内置 starter 文件。"
          }
        >
          <input
            value={datasetForm.sourcePath}
            onChange={(event) =>
              setDatasetForm((current) => ({
                ...current,
                sourcePath: event.target.value,
              }))
            }
            placeholder={text.datasetPath}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          />
        </FieldShell>
        <FieldShell
          label={text.datasetFormat}
          helper={
            isEnglish
              ? "Use chat-jsonl for messages arrays; instruction-jsonl for instruction/output rows."
              : "messages 数组用 chat-jsonl；instruction/output 行用 instruction-jsonl。"
          }
        >
          <select
            value={datasetForm.format}
            onChange={(event) =>
              setDatasetForm((current) => ({
                ...current,
                format: event.target.value as AgentFineTuneDatasetFormat,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="chat-jsonl">chat-jsonl</option>
            <option value="instruction-jsonl">instruction-jsonl</option>
          </select>
        </FieldShell>
        <FieldShell
          label={text.upstreamQuery}
          helper={
            isEnglish
              ? "Query used for scheduled community dataset discovery."
              : "用于定期检查开源社区是否有新微调数据集。"
          }
        >
          <input
            value={datasetForm.upstreamQuery}
            onChange={(event) =>
              setDatasetForm((current) => ({
                ...current,
                upstreamQuery: event.target.value,
              }))
            }
            placeholder={text.upstreamQuery}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          />
        </FieldShell>
        <FieldShell
          label={text.refreshCadence}
          helper={
            isEnglish
              ? "How often the admin watcher should refresh upstream candidates."
              : "后台监听器多久刷新一次上游候选数据集。"
          }
        >
          <input
            value={datasetForm.refreshCadenceHours}
            onChange={(event) =>
              setDatasetForm((current) => ({
                ...current,
                refreshCadenceHours:
                  Number(event.target.value) || current.refreshCadenceHours,
              }))
            }
            placeholder={text.refreshCadence}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          />
        </FieldShell>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void validateDataset()}
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
          >
            {text.datasetValidate}
          </button>
          <button
            type="button"
            disabled={!canSaveDataset}
            onClick={() => void saveDataset()}
            className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition enabled:hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {text.datasetSave}
          </button>
        </div>
      </div>

      {datasetValidation || datasetValidationQuality ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span
              className={`rounded-full px-2.5 py-1 ${
                datasetValidation
                  ? datasetValidation.ok
                    ? "bg-emerald-400/15 text-emerald-100"
                    : "bg-rose-400/15 text-rose-100"
                  : "bg-cyan-400/15 text-cyan-100"
              }`}
            >
              {datasetValidation
                ? datasetValidation.ok
                  ? "OK"
                  : "FAILED"
                : isEnglish
                  ? "QUALITY PREFLIGHT"
                  : "质量预检"}
            </span>
            <span>{datasetValidation?.format || datasetForm.format}</span>
            <span>
              {formatSampleCount(
                datasetValidation?.sampleCount ||
                  datasetValidationQuality?.sampledRows ||
                  datasetValidationQuality?.convertedRows ||
                  datasetValidationQuality?.downloadedRows,
              )}{" "}
              samples
            </span>
            {!datasetValidation ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-amber-100">
                {isEnglish ? "Validate before saving" : "保存前请先校验"}
              </span>
            ) : null}
          </div>
          {datasetValidationQuality ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/80">
                  {text.qualityScore}
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {formatQualityScore(datasetValidationQuality.score)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  {text.licenseRisk}
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {getLicenseRiskLabel(datasetValidationQuality.licenseRisk)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  {text.convertedRows}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {formatSampleCount(
                    datasetValidationQuality.convertedRows ||
                      datasetValidation?.sampleCount,
                  )}{" "}
                  /{" "}
                  {formatSampleCount(
                    datasetValidationQuality.downloadedRows ||
                      datasetValidation?.sampleCount,
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  {text.recommendedSteps}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {datasetValidationQuality.recommendedSteps
                    ? `${datasetValidationQuality.recommendedSteps.min}-${datasetValidationQuality.recommendedSteps.max}`
                    : "--"}
                </p>
              </div>
              {datasetValidationQuality.schemaConversion ? (
                <p className="sm:col-span-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-400">
                  {datasetValidationQuality.schemaConversion}
                </p>
              ) : null}
              {datasetValidationQualityWarnings.length ? (
                <div className="sm:col-span-2 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">
                    {text.warnings}
                  </p>
                  <ul className="mt-1 space-y-1 text-xs leading-5 text-amber-100">
                    {datasetValidationQualityWarnings.map((warning) => (
                      <li key={warning}>- {warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {datasetValidationQuality.piiRiskRows ||
              datasetValidationQuality.duplicateRows ? (
                <p className="sm:col-span-2 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2 text-xs leading-5 text-amber-100">
                  {isEnglish
                    ? `PII risk rows: ${datasetValidationQuality.piiRiskRows || 0}; duplicate rows: ${datasetValidationQuality.duplicateRows || 0}.`
                    : `疑似隐私行：${datasetValidationQuality.piiRiskRows || 0}；重复行：${datasetValidationQuality.duplicateRows || 0}。`}
                </p>
              ) : null}
            </div>
          ) : null}
          {datasetValidation?.preview.length ? (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {text.preview}
              </p>
              <div className="mt-2 space-y-2">
                {datasetValidation.preview.map((item) => (
                  <div
                    key={`preview:${item.index}`}
                    className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      #{item.index}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-slate-200">
                      {item.inputPreview}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-cyan-100">
                      {item.outputPreview}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {datasetValidation?.warnings.length ? (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">
                {text.warnings}
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-6 text-amber-100">
                {datasetValidation.warnings.map((warning) => (
                  <li key={warning}>- {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {datasetValidation?.errors.length ? (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200">
                {text.errors}
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-6 text-rose-100">
                {datasetValidation.errors.map((error) => (
                  <li key={error}>- {error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
