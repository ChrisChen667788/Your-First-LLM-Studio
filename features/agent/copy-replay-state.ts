"use client";

import { useCallback, useState } from "react";

export type AgentReplayTargetMode = "original" | "current";

export function useAgentCopyReplayState({
  copyFailedMessage,
  setError,
}: {
  copyFailedMessage: string;
  setError: (message: string) => void;
}) {
  const [replayTargetMode, setReplayTargetMode] =
    useState<AgentReplayTargetMode>("original");
  const [copyState, setCopyState] = useState("");

  const handleCopy = useCallback(
    async (value: string, key: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopyState(key);
        window.setTimeout(() => {
          setCopyState((current) => (current === key ? "" : current));
        }, 1800);
      } catch {
        setError(copyFailedMessage);
        window.setTimeout(() => {
          setCopyState((current) => (current === key ? "" : current));
        }, 2200);
      }
    },
    [copyFailedMessage, setError],
  );

  return {
    replayTargetMode,
    setReplayTargetMode,
    copyState,
    handleCopy,
  };
}
