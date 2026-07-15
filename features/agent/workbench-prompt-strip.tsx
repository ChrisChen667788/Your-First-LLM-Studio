"use client";

import type { AgentWorkbenchMode } from "@/lib/agent/types";

export function AgentWorkbenchPromptStrip({
  locale,
  mode,
  starterPrompts,
  onSelectPrompt,
}: {
  locale: string;
  mode: AgentWorkbenchMode;
  starterPrompts: string[];
  onSelectPrompt: (prompt: string) => void;
}) {
  const isEnglish = locale.startsWith("en");
  return (
    <div className="border-b border-white/10 bg-black/20 px-5 py-2.5">
      {mode === "chat" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          <PromptChip primary>{isEnglish ? "Compare keeps the current shell" : "Compare 直接嵌进当前工作台"}</PromptChip>
          <PromptChip>{isEnglish ? "Reuse target catalog" : "复用 target catalog"}</PromptChip>
          <PromptChip>{isEnglish ? "Same runtime guardrails" : "复用 runtime guardrails"}</PromptChip>
          <PromptChip>{isEnglish ? "Feature-owned run API" : "Feature-owned compare run API"}</PromptChip>
        </div>
      )}
    </div>
  );
}

function PromptChip({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 ${
      primary
        ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
        : "border-white/10 bg-white/[0.04]"
    }`}>
      {children}
    </span>
  );
}
