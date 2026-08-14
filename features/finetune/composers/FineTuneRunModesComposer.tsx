"use client";

import type { ComponentProps } from "react";
import type {
  FineTuneLabTab,
  FineTuneWorkspaceTab,
} from "@/features/finetune/state";
import {
  FineTuneChatAdapterRunSection,
  FineTuneEvaluateRunSection,
  FineTuneExportRunSection,
  FineTuneTrainRunSection,
} from "@/components/finetune/panels";

type FineTuneLabTabItem = {
  key: FineTuneLabTab;
  label: string;
};

type FineTuneRunModesComposerProps = {
  text: Record<string, string>;
  activeWorkspaceTab: FineTuneWorkspaceTab;
  activeFineTuneLabTab: FineTuneLabTab;
  fineTuneLabTabs: FineTuneLabTabItem[];
  estimatedTrainingSteps: number | null;
  effectiveTrainingBatch: number;
  estimatedTrainingSamples: number | null;
  formatSampleCount: (value?: number | null) => string;
  onFineTuneLabTabChange: (tab: FineTuneLabTab) => void;
  trainRunProps: ComponentProps<typeof FineTuneTrainRunSection>;
  evaluateRunProps: ComponentProps<typeof FineTuneEvaluateRunSection>;
  chatRunProps: ComponentProps<typeof FineTuneChatAdapterRunSection>;
  exportRunProps: ComponentProps<typeof FineTuneExportRunSection>;
};

export function FineTuneRunModesComposer({
  text,
  activeWorkspaceTab,
  activeFineTuneLabTab,
  fineTuneLabTabs,
  estimatedTrainingSteps,
  effectiveTrainingBatch,
  estimatedTrainingSamples,
  formatSampleCount,
  onFineTuneLabTabChange,
  trainRunProps,
  evaluateRunProps,
  chatRunProps,
  exportRunProps,
}: FineTuneRunModesComposerProps) {
  return (
    <div
      className={`mt-5 rounded-[26px] border border-white/10 bg-white/[0.035] p-4 ${
        activeWorkspaceTab === "setup" ? "" : "hidden"
      }`}
    >
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
            {text.fineTuneLabTabs}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fineTuneLabTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onFineTuneLabTabChange(tab.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeFineTuneLabTab === tab.key
                    ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-50"
                    : "border-white/10 bg-slate-950/60 text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                {tab.label}
                {tab.key === "train" || tab.key === "evaluate" ? null : (
                  <span className="ml-2 rounded-full bg-black/25 px-2 py-0.5 text-[10px] text-slate-400">
                    {text.fineTuneTabPlanned}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {text.estimatedSteps}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatSampleCount(estimatedTrainingSteps)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {text.effectiveBatch}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {effectiveTrainingBatch}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {text.trainSamples}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatSampleCount(estimatedTrainingSamples)}
            </p>
          </div>
        </div>
      </div>

      {activeFineTuneLabTab === "train" ? (
        <FineTuneTrainRunSection {...trainRunProps} />
      ) : activeFineTuneLabTab === "evaluate" ? (
        <FineTuneEvaluateRunSection {...evaluateRunProps} />
      ) : activeFineTuneLabTab === "chat" ? (
        <FineTuneChatAdapterRunSection {...chatRunProps} />
      ) : (
        <FineTuneExportRunSection {...exportRunProps} />
      )}
    </div>
  );
}
