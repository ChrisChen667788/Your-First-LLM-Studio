"use client";

import type { AgentReproduceLanguage } from "@/lib/agent/reproduce-request";

type AgentGetCodePanelProps = {
  locale: string;
  open: boolean;
  mode: "chat" | "compare";
  language: AgentReproduceLanguage;
  summary: Record<string, unknown> | null;
  snippets: Record<AgentReproduceLanguage, string>;
  copyState: string;
  onClose: () => void;
  onLanguageChange: (value: AgentReproduceLanguage) => void;
  onCopy: (text: string, key: string) => void;
};

const LANGUAGE_LABELS: Record<AgentReproduceLanguage, string> = {
  curl: "curl",
  python: "Python",
  typescript: "TypeScript",
  "openai-sdk": "OpenAI SDK"
};

export function AgentGetCodePanel({
  locale,
  open,
  mode,
  language,
  summary,
  snippets,
  copyState,
  onClose,
  onLanguageChange,
  onCopy
}: AgentGetCodePanelProps) {
  const isEn = locale.startsWith("en");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 px-4 pb-4 pt-20 backdrop-blur md:items-center md:px-8">
      <div className="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-[0_40px_120px_rgba(2,6,23,0.75)]">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">
                {isEn ? "Get code / reproduce request" : "获取代码 / 复现请求"}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                {mode === "compare"
                  ? isEn
                    ? "Reproduce this compare run outside the UI"
                    : "在 UI 外复现这次 compare"
                  : isEn
                    ? "Reproduce this chat request outside the UI"
                    : "在 UI 外复现这次 chat 请求"}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {isEn
                  ? "Copy a working request with the same target mix, prompt, and locked controls we are using right now."
                  : "直接复制一份可运行请求，带上当前这次实验正在使用的目标、提示词和锁定控制项。"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            >
              {isEn ? "Close" : "关闭"}
            </button>
          </div>
          {summary ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(summary).map(([key, value]) => (
                <span key={key} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-300">
                  {key}: {Array.isArray(value) ? value.join(", ") : String(value)}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-white/10 bg-black/25 p-1">
              {(Object.keys(LANGUAGE_LABELS) as AgentReproduceLanguage[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onLanguageChange(item)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    language === item ? "bg-cyan-400/15 text-cyan-100" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {LANGUAGE_LABELS[item]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onCopy(snippets[language], `get-code:${mode}:${language}`)}
              className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
            >
              {copyState === `get-code:${mode}:${language}`
                ? isEn
                  ? "Copied"
                  : "已复制"
                : isEn
                  ? "Copy snippet"
                  : "复制代码"}
            </button>
          </div>
          <pre className="max-h-[56vh] overflow-auto rounded-[24px] border border-white/10 bg-black/30 p-4 text-[13px] leading-6 text-slate-100"><code>{snippets[language]}</code></pre>
        </div>
      </div>
    </div>
  );
}
