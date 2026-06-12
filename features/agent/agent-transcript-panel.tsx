"use client";

import type { ComponentProps, RefObject } from "react";
import type { getDictionary } from "@/lib/i18n";
import type { AgentTurn } from "./session-model";
import { AgentTranscriptTurnCard } from "./agent-transcript-turn-card";
import { TranscriptFollowBanner } from "./transcript-follow-banner";

type AgentDictionary = ReturnType<typeof getDictionary>;
type AgentTranscriptTurnCardSharedProps = Omit<
  ComponentProps<typeof AgentTranscriptTurnCard>,
  "turn" | "turnIndex" | "locale" | "dictionary" | "pending"
>;

type AgentTranscriptPanelProps = AgentTranscriptTurnCardSharedProps & {
  locale: string;
  dictionary: AgentDictionary;
  turns: AgentTurn[];
  transcriptRef: RefObject<HTMLDivElement>;
  transcriptPinnedToBottom: boolean;
  unseenTranscriptTurns: number;
  pending: boolean;
  pendingTargetLabel: string;
  onTranscriptScroll: () => void;
  onJumpToLatestTranscript: () => void;
};

export function AgentTranscriptPanel({
  locale,
  dictionary,
  turns,
  transcriptRef,
  transcriptPinnedToBottom,
  unseenTranscriptTurns,
  pending,
  pendingTargetLabel,
  onTranscriptScroll,
  onJumpToLatestTranscript,
  ...turnCardProps
}: AgentTranscriptPanelProps) {
  return (
    <>
      <div
        ref={transcriptRef}
        onScroll={onTranscriptScroll}
        className="h-[58vh] min-h-[420px] max-h-[76vh] overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(2,6,23,0.12))] px-5 py-5 font-mono text-[13px] leading-7 sm:h-[62vh]"
      >
        {turns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-7 text-slate-400">
            <p className="text-cyan-300">$ boot</p>
            <p className="mt-2">{dictionary.agent.transcriptReady}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {turns.map((turn, turnIndex) => (
              <AgentTranscriptTurnCard
                key={turn.id}
                locale={locale}
                dictionary={dictionary}
                turn={turn}
                turnIndex={turnIndex}
                pending={pending}
                {...turnCardProps}
              />
            ))}

            {pending ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-400">
                <p className="text-cyan-300">$ agent.run</p>
                <p className="mt-2">
                  {dictionary.agent.processingWith} {pendingTargetLabel}...
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!transcriptPinnedToBottom ? (
        <TranscriptFollowBanner
          locale={locale}
          pending={pending}
          unseenTranscriptTurns={unseenTranscriptTurns}
          onJumpToLatest={onJumpToLatestTranscript}
        />
      ) : null}
    </>
  );
}
