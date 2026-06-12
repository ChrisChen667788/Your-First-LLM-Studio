"use client";

import { AgentProviderSelfCheckPanel } from "@/features/agent/agent-provider-self-check-panel";
import type { AgentTurn } from "@/features/agent/session-model";
import { getDictionary } from "@/lib/i18n";
import type {
  AgentConnectionCheckResponse,
  AgentRuntimeStatus,
  AgentTarget,
} from "@/lib/agent/types";

type AgentSecondaryAnalysisPanelProps = {
  locale: string;
  dictionary: ReturnType<typeof getDictionary>;
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  selectedTarget: AgentTarget;
  selectedTargetId: string;
  runtimeStatus: AgentRuntimeStatus | null;
  lastTurn?: AgentTurn;
  supportsConnectionCheck: boolean;
  connectionCheckPending: boolean;
  connectionCheckError: string;
  connectionCheck: AgentConnectionCheckResponse | null;
  pending: boolean;
  fallbackLaunchHint: string;
  onConnectionCheck: () => void;
};

export function AgentSecondaryAnalysisPanel({
  locale,
  dictionary,
  systemPrompt,
  setSystemPrompt,
  selectedTarget,
  selectedTargetId,
  runtimeStatus,
  lastTurn,
  supportsConnectionCheck,
  connectionCheckPending,
  connectionCheckError,
  connectionCheck,
  pending,
  fallbackLaunchHint,
  onConnectionCheck,
}: AgentSecondaryAnalysisPanelProps) {
  const isEnglish = locale.startsWith("en");

  return (
    <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.28),rgba(2,6,23,0.16))] px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {isEnglish ? "Secondary analysis cards" : "次级分析卡片"}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {isEnglish
              ? "Use the transcript and composer as the primary surface. The cards below keep prompt framing, launch hints, and provider checks nearby without stretching the workspace into a long single strip."
              : "把对话记录和输入区作为主内容面，下面这组卡片专门承接提示词框架、启动提示和 provider 自检，避免工作区继续被拉成长条单列。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
            {isEnglish ? "Primary: transcript + compose" : "主内容：记录 + 输入"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
            {isEnglish ? "Secondary: analysis cards" : "次级：分析卡片"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] 2xl:grid-cols-[minmax(0,1.32fr)_minmax(420px,0.78fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {dictionary.agent.promptFrame}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-300">
                  {isEnglish
                    ? "Prompt framing stays beside the main workspace so you can refine agent behavior without burying the transcript."
                    : "系统提示词直接放在主工作区旁边，边看输出边收口行为，不再把核心记录挤到侧栏里。"}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                {isEnglish ? "Live prompt frame" : "实时提示框架"}
              </span>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              rows={12}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 font-mono text-xs leading-6 text-slate-200 outline-none transition focus:border-cyan-400/40"
            />
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {dictionary.agent.launchHints}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-300">
                  {isEnglish
                    ? "Keep deployment and fallback hints in a card grid instead of a long sidebar, so high-density sessions remain easier to scan."
                    : "把部署与 fallback 提示放进卡片网格，而不是继续堆在长侧栏里，高信息密度时更容易扫读。"}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                {selectedTarget.execution === "local"
                  ? dictionary.common.local
                  : dictionary.common.remote}
              </span>
            </div>
            <div className="mt-3 grid gap-3 2xl:grid-cols-2">
              {(selectedTarget.launchHints || [fallbackLaunchHint]).map((hint) => (
                <pre
                  key={hint}
                  className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 font-mono text-xs leading-6 text-slate-200"
                >
                  {hint}
                </pre>
              ))}
            </div>
          </div>
        </div>

        <AgentProviderSelfCheckPanel
          dictionary={dictionary}
          selectedTarget={selectedTarget}
          selectedTargetId={selectedTargetId}
          runtimeStatus={runtimeStatus}
          lastTurn={lastTurn}
          supportsConnectionCheck={supportsConnectionCheck}
          connectionCheckPending={connectionCheckPending}
          connectionCheckError={connectionCheckError}
          connectionCheck={connectionCheck}
          pending={pending}
          onConnectionCheck={onConnectionCheck}
          description={dictionary.agent.selfCheckDescription}
        />
      </div>
    </div>
  );
}
