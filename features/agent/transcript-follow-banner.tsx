"use client";

type TranscriptFollowBannerProps = {
  locale: string;
  pending: boolean;
  unseenTranscriptTurns: number;
  onJumpToLatest: () => void;
};

export function TranscriptFollowBanner({
  locale,
  pending,
  unseenTranscriptTurns,
  onJumpToLatest,
}: TranscriptFollowBannerProps) {
  const isEnglish = locale.startsWith("en");

  return (
    <div className="border-t border-cyan-400/15 bg-slate-950/80 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] px-3 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
            {isEnglish ? "Reading history" : "正在查看历史"}
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-300">
            {pending
              ? isEnglish
                ? "Live output is still streaming below. We paused auto-follow so you can keep reading."
                : "底部仍有新内容在继续生成。为了不打断阅读，自动跟随已暂停。"
              : unseenTranscriptTurns > 0
                ? isEnglish
                  ? `${unseenTranscriptTurns} new turn${unseenTranscriptTurns > 1 ? "s" : ""} arrived while you were reading earlier messages.`
                  : `你查看较早消息时，已有 ${unseenTranscriptTurns} 条新轮次到达。`
                : isEnglish
                  ? "Auto-follow is paused until you jump back to the latest turn."
                  : "自动跟随已暂停，回到最新内容后会恢复。"}
          </p>
        </div>
        <button
          type="button"
          onClick={onJumpToLatest}
          className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20"
        >
          {isEnglish
            ? `Jump to latest${unseenTranscriptTurns > 0 ? ` (${unseenTranscriptTurns})` : ""}`
            : `回到最新${unseenTranscriptTurns > 0 ? ` (${unseenTranscriptTurns})` : ""}`}
        </button>
      </div>
    </div>
  );
}
