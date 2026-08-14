"use client";

import { useCallback, useState } from "react";
import {
  fetchRuntimeGuardrailPolicy,
  updateRuntimeGuardrailPolicy,
  type RuntimeGuardrailStrategy,
} from "@/features/admin/runtime-operations";

const FALLBACK_RUNTIME_GUARDRAIL: RuntimeGuardrailStrategy = {
  cautionPeakRatio: 0.68,
  blockedPeakRatio: 0.82,
  cautionFreeMb: 6144,
  blockedFreeMb: 2048,
};

export function useAdminRuntimeGuardrailController(input: {
  refreshRuntimeStatuses: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
}) {
  const { refreshRuntimeStatuses, refreshDashboard } = input;
  const [draft, setDraft] = useState<RuntimeGuardrailStrategy>(
    FALLBACK_RUNTIME_GUARDRAIL,
  );
  const [defaults, setDefaults] = useState<RuntimeGuardrailStrategy>(
    FALLBACK_RUNTIME_GUARDRAIL,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [policyFile, setPolicyFile] = useState("");

  const applyPayload = useCallback(
    (payload: {
      strategy: RuntimeGuardrailStrategy;
      defaults?: RuntimeGuardrailStrategy;
      policyFile?: string;
      message?: string;
    }) => {
      setDraft(payload.strategy);
      setDefaults(payload.defaults || payload.strategy);
      setPolicyFile(payload.policyFile || "");
      if (payload.message) setMessage(payload.message);
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      applyPayload(await fetchRuntimeGuardrailPolicy());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load runtime guardrail policy.",
      );
    }
  }, [applyPayload]);

  const persist = useCallback(
    async (action: "save" | "reset") => {
      setPending(true);
      setMessage("");
      try {
        const payload = await updateRuntimeGuardrailPolicy(
          action,
          action === "save" ? draft : undefined,
        );
        applyPayload({
          ...payload,
          message:
            payload.message ||
            `Runtime guardrail policy ${action === "save" ? "saved" : "reset"}.`,
        });
        await Promise.all([
          refreshRuntimeStatuses(),
          refreshDashboard(),
        ]);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : `Failed to ${action} runtime guardrail policy.`,
        );
      } finally {
        setPending(false);
      }
    },
    [applyPayload, draft, refreshDashboard, refreshRuntimeStatuses],
  );

  return {
    draft,
    setDraft,
    defaults,
    pending,
    message,
    policyFile,
    load,
    save: useCallback(() => persist("save"), [persist]),
    reset: useCallback(() => persist("reset"), [persist]),
  };
}
