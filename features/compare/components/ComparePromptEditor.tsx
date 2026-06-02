type ComparePromptMeta = {
  label: string;
  description: string;
};

export type ComparePromptEditorProps = {
  locale: string;
  copy: Record<string, string>;
  input: string;
  systemPrompt: string;
  selectedIntentMeta: ComparePromptMeta;
  selectedOutputShapeMeta: ComparePromptMeta;
  onInputChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
};

export function ComparePromptEditor({
  locale,
  copy,
  input,
  systemPrompt,
  selectedIntentMeta,
  selectedOutputShapeMeta,
  onInputChange,
  onSystemPromptChange,
}: ComparePromptEditorProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {copy.promptFrame}
          </p>
          <p className="ui-pretty mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {locale.startsWith("en")
              ? "One shared task prompt stays primary; system framing is folded into a secondary drawer."
              : "主任务提示词保持优先，系统提示词收进次级抽屉。"}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300">
          {selectedIntentMeta.label} · {selectedOutputShapeMeta.label}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
            {copy.promptInput}
          </label>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-400">
            {input.length} chars
          </span>
        </div>
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          rows={7}
          className="mt-2 min-h-[170px] w-full resize-y rounded-3xl border border-white/10 bg-black/25 px-4 py-4 font-mono text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-black/35"
        />
        <details
          className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
          open={Boolean(systemPrompt.trim())}
        >
          <summary className="cursor-pointer list-none">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                {copy.systemFrame}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-400">
                {systemPrompt.trim()
                  ? `${systemPrompt.length} chars`
                  : locale.startsWith("en")
                    ? "optional"
                    : "可选"}
              </span>
            </span>
          </summary>
          <textarea
            value={systemPrompt}
            onChange={(event) => onSystemPromptChange(event.target.value)}
            rows={5}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 font-mono text-xs leading-6 text-slate-200 outline-none transition focus:border-cyan-400/40"
          />
        </details>
      </div>
    </section>
  );
}
