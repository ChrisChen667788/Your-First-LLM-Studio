"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FineTuneMessageTone } from "./state";

type FineTuneStateSetter<T> = Dispatch<SetStateAction<T>>;

type FineTuneClipboardActionsOptions = {
  copiedMessage: string;
  copyFailedMessage?: string;
  setMessage: FineTuneStateSetter<string>;
  setMessageTone: FineTuneStateSetter<FineTuneMessageTone>;
};

export function useFineTuneClipboardActions({
  copiedMessage,
  copyFailedMessage = "Copy failed.",
  setMessage,
  setMessageTone,
}: FineTuneClipboardActionsOptions) {
  const copyValue = useCallback(
    async (value?: string | null, successMessage = copiedMessage) => {
      if (!value) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          setMessage(successMessage);
          setMessageTone("success");
        }
      } catch {
        setMessageTone("error");
        setMessage(copyFailedMessage);
      }
    },
    [copiedMessage, copyFailedMessage, setMessage, setMessageTone],
  );

  return { copyValue };
}
