import { existsSync } from "fs";
import {
  readJsonFileDurably,
  replaceJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export type RuntimeResourceGuardrailStrategy = {
  cautionPeakRatio: number;
  blockedPeakRatio: number;
  cautionFreeMb: number;
  blockedFreeMb: number;
};

const RUNTIME_GUARDRAIL_POLICY_FILE = getLocalAgentDataPath("runtime-guardrail-policy.json");

export const DEFAULT_RUNTIME_RESOURCE_GUARDRAIL_STRATEGY: RuntimeResourceGuardrailStrategy = {
  cautionPeakRatio: 0.68,
  blockedPeakRatio: 0.82,
  cautionFreeMb: 6144,
  blockedFreeMb: 2048
};

function sanitizePositiveNumber(value: unknown, fallback: number) {
  const normalized = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallback;
  }
  return normalized;
}

export function normalizeRuntimeResourceGuardrailStrategy(
  value?: Partial<RuntimeResourceGuardrailStrategy> | null,
  fallback: RuntimeResourceGuardrailStrategy = DEFAULT_RUNTIME_RESOURCE_GUARDRAIL_STRATEGY
): RuntimeResourceGuardrailStrategy {
  const cautionPeakRatio = sanitizePositiveNumber(value?.cautionPeakRatio, fallback.cautionPeakRatio);
  const blockedPeakRatio = sanitizePositiveNumber(value?.blockedPeakRatio, fallback.blockedPeakRatio);
  const cautionFreeMb = sanitizePositiveNumber(value?.cautionFreeMb, fallback.cautionFreeMb);
  const blockedFreeMb = sanitizePositiveNumber(value?.blockedFreeMb, fallback.blockedFreeMb);

  return {
    cautionPeakRatio: Math.min(cautionPeakRatio, blockedPeakRatio),
    blockedPeakRatio: Math.max(blockedPeakRatio, cautionPeakRatio),
    cautionFreeMb: Math.max(cautionFreeMb, blockedFreeMb),
    blockedFreeMb: Math.min(blockedFreeMb, cautionFreeMb)
  };
}

export function readPersistedRuntimeResourceGuardrailStrategy() {
  if (!existsSync(RUNTIME_GUARDRAIL_POLICY_FILE)) {
    return null;
  }
  const parsed = readJsonFileDurably(
    RUNTIME_GUARDRAIL_POLICY_FILE,
    () => DEFAULT_RUNTIME_RESOURCE_GUARDRAIL_STRATEGY,
  );
  return normalizeRuntimeResourceGuardrailStrategy(parsed);
}

export function saveRuntimeResourceGuardrailStrategy(value: Partial<RuntimeResourceGuardrailStrategy>) {
  const normalized = normalizeRuntimeResourceGuardrailStrategy(value);
  replaceJsonFileDurably(
    RUNTIME_GUARDRAIL_POLICY_FILE,
    normalized,
  );
  return normalized;
}

export function resetRuntimeResourceGuardrailStrategy() {
  replaceJsonFileDurably(
    RUNTIME_GUARDRAIL_POLICY_FILE,
    DEFAULT_RUNTIME_RESOURCE_GUARDRAIL_STRATEGY,
  );
  return DEFAULT_RUNTIME_RESOURCE_GUARDRAIL_STRATEGY;
}

export function getRuntimeResourceGuardrailPolicyFile() {
  return RUNTIME_GUARDRAIL_POLICY_FILE;
}
