"use client";

export function AdminBenchmarkRunNotePanel({
  locale,
  entryId,
  runNote,
  summary,
  copyState,
  onCopy,
}: {
  locale: string;
  entryId: string;
  runNote: string;
  summary: string;
  copyState?: { key: string; tone: "success" | "error" } | null;
  onCopy: (value: string, key: string) => void | Promise<void>;
}) {
  const isEnglish = locale.startsWith("en");
  const copyKey = `history-run-note:${entryId}`;
  return (
    <details className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-3 text-sm text-cyan-50">
      <summary className="cursor-pointer list-none">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">{isEnglish ? "Run note" : "运行备注"}</p>
          <p className="text-[11px] leading-5 text-cyan-100/75">{summary}</p>
        </div>
      </summary>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] leading-5 text-cyan-100/75">
          {isEnglish ? "Captured from Compare handoff so this benchmark run keeps its original review context." : "这段内容来自 Compare handoff，用来保留这轮 benchmark 当时的审阅上下文。"}
        </p>
        <button type="button" onClick={() => void onCopy(runNote, copyKey)} className="rounded-full border border-cyan-200/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-50 transition hover:border-cyan-200/35 hover:bg-cyan-400/20">
          {copyState?.key === copyKey
            ? copyState.tone === "success"
              ? isEnglish ? "Copied" : "已复制"
              : isEnglish ? "Copy failed" : "复制失败"
            : isEnglish ? "Copy run note" : "复制备注"}
        </button>
      </div>
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-[11px] leading-6 text-slate-200">{runNote}</pre>
    </details>
  );
}
