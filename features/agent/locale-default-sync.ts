"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  getDefaultSystemPromptForLocale,
  getLocalizedStarterPrompts,
  type AppLocale,
} from "@/lib/i18n";

export function useAgentLocaleDefaultSync(input: {
  locale: AppLocale;
  starterPrompts: string[];
  setSystemPrompt: Dispatch<SetStateAction<string>>;
  setInput: Dispatch<SetStateAction<string>>;
}) {
  const previousLocaleRef = useRef(input.locale);

  useEffect(() => {
    const previousLocale = previousLocaleRef.current;
    const previousDefaultPrompt = getDefaultSystemPromptForLocale(previousLocale);
    const nextDefaultPrompt = getDefaultSystemPromptForLocale(input.locale);
    input.setSystemPrompt((current) =>
      current === previousDefaultPrompt ? nextDefaultPrompt : current,
    );
    const previousPrompts = getLocalizedStarterPrompts(previousLocale);
    input.setInput((current) =>
      previousPrompts.includes(current) ? input.starterPrompts[0] : current,
    );
    previousLocaleRef.current = input.locale;
  }, [input.locale, input.setInput, input.setSystemPrompt, input.starterPrompts]);
}
