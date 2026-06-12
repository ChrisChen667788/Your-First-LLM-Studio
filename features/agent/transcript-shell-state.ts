"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentWorkbenchMode } from "@/lib/agent/types";

const TRANSCRIPT_BOTTOM_THRESHOLD_PX = 96;

export function useAgentTranscriptShellState({
  turnCount,
  pending,
  toolDecisionBusyKey,
  workbenchMode,
  sessionId,
}: {
  turnCount: number;
  pending: boolean;
  toolDecisionBusyKey: string;
  workbenchMode: AgentWorkbenchMode;
  sessionId: string;
}) {
  const [transcriptPinnedToBottom, setTranscriptPinnedToBottom] =
    useState(true);
  const [unseenTranscriptTurns, setUnseenTranscriptTurns] = useState(0);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const lastObservedTurnCountRef = useRef(0);

  const scrollTranscriptToLatest = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const node = transcriptRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior });
    },
    [],
  );

  const handleJumpToLatestTranscript = useCallback(() => {
    setTranscriptPinnedToBottom(true);
    setUnseenTranscriptTurns(0);
    scrollTranscriptToLatest("smooth");
  }, [scrollTranscriptToLatest]);

  const updateTranscriptPinnedState = useCallback(() => {
    const node = transcriptRef.current;
    if (!node) return;
    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;
    setTranscriptPinnedToBottom(
      distanceFromBottom <= TRANSCRIPT_BOTTOM_THRESHOLD_PX,
    );
  }, []);

  const handleTranscriptScroll = useCallback(() => {
    updateTranscriptPinnedState();
  }, [updateTranscriptPinnedState]);

  useEffect(() => {
    if (workbenchMode !== "chat") return;
    if (!transcriptPinnedToBottom) return;
    setUnseenTranscriptTurns(0);
    const rafId = window.requestAnimationFrame(() => {
      scrollTranscriptToLatest("auto");
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [
    turnCount,
    pending,
    toolDecisionBusyKey,
    transcriptPinnedToBottom,
    workbenchMode,
    scrollTranscriptToLatest,
  ]);

  useEffect(() => {
    if (workbenchMode !== "chat") return;
    const rafId = window.requestAnimationFrame(() => {
      scrollTranscriptToLatest("auto");
      setTranscriptPinnedToBottom(true);
      setUnseenTranscriptTurns(0);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [sessionId, workbenchMode, scrollTranscriptToLatest]);

  useEffect(() => {
    if (workbenchMode !== "chat") {
      lastObservedTurnCountRef.current = turnCount;
      setUnseenTranscriptTurns(0);
      return;
    }
    const previousTurnCount = lastObservedTurnCountRef.current;
    if (!transcriptPinnedToBottom && turnCount > previousTurnCount) {
      setUnseenTranscriptTurns(
        (current) => current + (turnCount - previousTurnCount),
      );
    }
    if (transcriptPinnedToBottom && unseenTranscriptTurns !== 0) {
      setUnseenTranscriptTurns(0);
    }
    lastObservedTurnCountRef.current = turnCount;
  }, [
    turnCount,
    transcriptPinnedToBottom,
    unseenTranscriptTurns,
    workbenchMode,
  ]);

  return {
    transcriptRef,
    transcriptPinnedToBottom,
    setTranscriptPinnedToBottom,
    unseenTranscriptTurns,
    setUnseenTranscriptTurns,
    scrollTranscriptToLatest,
    handleJumpToLatestTranscript,
    handleTranscriptScroll,
  };
}
