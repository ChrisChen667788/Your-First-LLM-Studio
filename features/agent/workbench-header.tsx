"use client";

import type { getDictionary } from "@/lib/i18n";
import type { AgentTarget, AgentWorkbenchMode } from "@/lib/agent/types";

type AgentDictionary = ReturnType<typeof getDictionary>;

export type AgentWorkbenchHeaderProps = {
  locale: string;
  dictionary: AgentDictionary;
  target: AgentTarget;
  mode: AgentWorkbenchMode;
  messageCount: number;
  turnCount: number;
  activityCount: number;
  onModeChange: (mode: AgentWorkbenchMode) => void;
  onOpenGetCode: () => void;
};

export function AgentWorkbenchHeader({
  locale,
  dictionary,
  target,
  mode,
  messageCount,
  turnCount,
  activityCount,
  onModeChange,
  onOpenGetCode,
}: AgentWorkbenchHeaderProps) {
  const isEnglish = locale.startsWith("en");
  return (
    <header className="border-b border-white/10 px-5 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-cyan-400/[0.07] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              {target.providerLabel}
            </span>
            <span className="rounded-full bg-white/[0.03] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-slate-300">
              {target.transport}
            </span>
            <span className="rounded-full bg-white/[0.03] px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] text-slate-300">
              {target.execution === "local"
                ? dictionary.common.local
                : dictionary.common.remote}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {target.label}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {dictionary.agent.subtitle}
          </p>
        </div>

        <div className="space-y-2 xl:min-w-[318px]">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onOpenGetCode}
              className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20"
            >
              {isEnglish ? "Get code" : "获取代码"}
            </button>
            <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
              {(["chat", "compare"] as AgentWorkbenchMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onModeChange(item)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    mode === item
                      ? "bg-cyan-400/15 text-cyan-100"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-4">
            <HeaderMetric label={dictionary.agent.messages} value={messageCount} />
            <HeaderMetric label={dictionary.agent.turns} value={turnCount} />
            <HeaderMetric
              label={
                mode === "compare"
                  ? isEnglish
                    ? "Lanes"
                    : "对比 Lane"
                  : dictionary.agent.tools
              }
              value={activityCount}
            />
            <HeaderMetric
              label={isEnglish ? "Target mix" : "目标形态"}
              value={
                target.execution === "local"
                  ? isEnglish
                    ? "Local-first"
                    : "本地优先"
                  : isEnglish
                    ? "Remote API"
                    : "远端 API"
              }
              compact
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | number;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.035] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1.5 font-semibold text-white ${compact ? "text-sm" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}
