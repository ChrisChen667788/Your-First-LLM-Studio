"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AgentFineTuneDatasetQuality,
  AgentFineTuneDatasetValidation,
  AgentFineTuneSourceSurface,
  AgentFineTuneSummary,
} from "@/lib/agent/types";
import {
  postFineTuneAction,
  type FineTuneActionResponse,
} from "./actions";
import type { FineTuneMessageTone } from "./state";

type FineTuneStateSetter<T> = Dispatch<SetStateAction<T>>;

type FineTuneSubmitHandlersOptions = {
  surface: AgentFineTuneSourceSurface;
  setPending: FineTuneStateSetter<boolean>;
  setMessage: FineTuneStateSetter<string>;
  setMessageTone: FineTuneStateSetter<FineTuneMessageTone>;
  setActionPending: FineTuneStateSetter<Record<string, boolean>>;
  setSummary: FineTuneStateSetter<AgentFineTuneSummary | null>;
  setDatasetValidation: FineTuneStateSetter<AgentFineTuneDatasetValidation | null>;
  setDatasetValidationQuality: FineTuneStateSetter<AgentFineTuneDatasetQuality | null>;
  setDatasetValidationQualityWarnings: FineTuneStateSetter<string[]>;
  defaultSecondarySuccessMessage?: string;
  fallbackErrorMessage?: string;
};

export function useFineTuneSubmitHandlers({
  surface,
  setPending,
  setMessage,
  setMessageTone,
  setActionPending,
  setSummary,
  setDatasetValidation,
  setDatasetValidationQuality,
  setDatasetValidationQualityWarnings,
  defaultSecondarySuccessMessage = "Action completed.",
  fallbackErrorMessage = "Fine-tune request failed.",
}: FineTuneSubmitHandlersOptions) {
  const postAction = useCallback(
    async (
      body: Record<string, unknown>,
      successMessage: string,
    ): Promise<FineTuneActionResponse | null> => {
      setPending(true);
      setMessage("");
      try {
        const payload = await postFineTuneAction({
          ...body,
          sourceSurface: surface,
        });
        if (payload.summary) {
          setSummary(payload.summary);
        }
        if (payload.validation) {
          setDatasetValidation(payload.validation);
        }
        if (payload.dataset?.quality) {
          setDatasetValidationQuality(payload.dataset.quality);
        }
        if (payload.dataset?.qualityWarnings) {
          setDatasetValidationQualityWarnings(payload.dataset.qualityWarnings);
        }
        setMessage(successMessage);
        setMessageTone("success");
        return payload;
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : fallbackErrorMessage,
        );
        setMessageTone("error");
        return null;
      } finally {
        setPending(false);
      }
    },
    [
      fallbackErrorMessage,
      setDatasetValidation,
      setDatasetValidationQuality,
      setDatasetValidationQualityWarnings,
      setMessage,
      setMessageTone,
      setPending,
      setSummary,
      surface,
    ],
  );

  const runSecondaryAction = useCallback(
    async (
      actionKey: string,
      body: Record<string, unknown>,
      successMessage = defaultSecondarySuccessMessage,
    ) => {
      setActionPending((current) => ({ ...current, [actionKey]: true }));
      try {
        await postAction(body, successMessage);
      } finally {
        setActionPending((current) => ({ ...current, [actionKey]: false }));
      }
    },
    [defaultSecondarySuccessMessage, postAction, setActionPending],
  );

  return {
    postAction,
    runSecondaryAction,
  };
}
