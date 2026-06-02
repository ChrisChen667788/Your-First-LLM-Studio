"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  DEFAULT_RECIPE_FORM,
  type FineTuneRecipeFormState,
} from "./setup-state";
import type { FineTuneTrainStage } from "./run-state";
import type { FineTuneMessageTone } from "./state";

type FineTuneStateSetter<T> = Dispatch<SetStateAction<T>>;

type FineTuneTrainingArgsSnapshotOptions = {
  recipeForm: FineTuneRecipeFormState;
  trainStage: FineTuneTrainStage;
  setRecipeForm: FineTuneStateSetter<FineTuneRecipeFormState>;
  setTrainStage: FineTuneStateSetter<FineTuneTrainStage>;
  setMessage: FineTuneStateSetter<string>;
  setMessageTone: FineTuneStateSetter<FineTuneMessageTone>;
  messages: {
    saved: string;
    missing: string;
    loaded: string;
    saveFailed?: string;
    loadFailed?: string;
  };
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = "first-llm-studio:fine-tune-training-args";

export function useFineTuneTrainingArgsSnapshot({
  recipeForm,
  trainStage,
  setRecipeForm,
  setTrainStage,
  setMessage,
  setMessageTone,
  messages,
  storageKey = DEFAULT_STORAGE_KEY,
}: FineTuneTrainingArgsSnapshotOptions) {
  const saveTrainingArgsSnapshot = useCallback(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          recipeForm,
          trainStage,
          savedAt: new Date().toISOString(),
        }),
      );
      setMessage(messages.saved);
      setMessageTone("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : messages.saveFailed || "Failed to save args.",
      );
      setMessageTone("error");
    }
  }, [
    messages.saveFailed,
    messages.saved,
    recipeForm,
    setMessage,
    setMessageTone,
    storageKey,
    trainStage,
  ]);

  const loadTrainingArgsSnapshot = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setMessage(messages.missing);
        setMessageTone("error");
        return;
      }
      const snapshot = JSON.parse(raw) as {
        recipeForm?: Partial<FineTuneRecipeFormState>;
        trainStage?: FineTuneTrainStage;
      };
      setRecipeForm({
        ...DEFAULT_RECIPE_FORM,
        ...snapshot.recipeForm,
      });
      if (snapshot.trainStage) {
        setTrainStage(snapshot.trainStage);
      }
      setMessage(messages.loaded);
      setMessageTone("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : messages.loadFailed || "Failed to load args.",
      );
      setMessageTone("error");
    }
  }, [
    messages.loadFailed,
    messages.loaded,
    messages.missing,
    setMessage,
    setMessageTone,
    setRecipeForm,
    setTrainStage,
    storageKey,
  ]);

  return {
    saveTrainingArgsSnapshot,
    loadTrainingArgsSnapshot,
  };
}
