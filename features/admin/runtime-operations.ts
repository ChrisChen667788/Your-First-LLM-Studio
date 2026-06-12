import type {
  AgentRuntimeActionResponse,
  AgentRuntimePrewarmAllResponse,
  AgentRuntimePrewarmResponse,
  AgentRuntimeStatus,
} from "@/lib/agent/types";

export type RuntimeGuardrailStrategy = {
  cautionPeakRatio: number;
  blockedPeakRatio: number;
  cautionFreeMb: number;
  blockedFreeMb: number;
};

export type RuntimeGuardrailPolicyResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  strategy?: RuntimeGuardrailStrategy;
  defaults?: RuntimeGuardrailStrategy;
  policyFile?: string;
};

export type RuntimeGuardrailPolicyResult = RuntimeGuardrailPolicyResponse & {
  strategy: RuntimeGuardrailStrategy;
};

async function readJson<T>(response: Response, fallback: string) {
  const payload = (await response.json()) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) throw new Error(payload.error || payload.message || fallback);
  return payload;
}

export async function fetchAdminRuntimeStatus(targetId: string) {
  const response = await fetch(
    `/api/agent/runtime?targetId=${encodeURIComponent(targetId)}`,
    { cache: "no-store" },
  );
  return readJson<AgentRuntimeStatus>(response, "Failed to load runtime status.");
}

export async function prewarmAdminRuntime(targetId: string) {
  const response = await fetch("/api/agent/runtime/prewarm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId }),
  });
  return readJson<AgentRuntimePrewarmResponse>(response, "Prewarm failed.");
}

export async function executeAdminRuntimeAction(input: {
  targetId: string;
  action: "release" | "restart" | "read_log";
  query?: string;
  limit?: number;
}) {
  const response = await fetch("/api/agent/runtime/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson<AgentRuntimeActionResponse>(response, "Runtime action failed.");
}

export async function prewarmAllAdminRuntimes() {
  const response = await fetch("/api/agent/runtime/prewarm-all", {
    method: "POST",
  });
  return readJson<AgentRuntimePrewarmAllResponse>(response, "Prewarm-all failed.");
}

export async function fetchRuntimeGuardrailPolicy(): Promise<RuntimeGuardrailPolicyResult> {
  const response = await fetch("/api/admin/runtime-guardrail", {
    cache: "no-store",
  });
  const payload = await readJson<RuntimeGuardrailPolicyResponse>(
    response,
    "Failed to load runtime guardrail policy.",
  );
  if (!payload.strategy) throw new Error("Runtime guardrail strategy is missing.");
  return { ...payload, strategy: payload.strategy };
}

export async function updateRuntimeGuardrailPolicy(
  action: "save" | "reset",
  strategy?: RuntimeGuardrailStrategy,
): Promise<RuntimeGuardrailPolicyResult> {
  const response = await fetch("/api/admin/runtime-guardrail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, strategy }),
  });
  const payload = await readJson<RuntimeGuardrailPolicyResponse>(
    response,
    `Failed to ${action} runtime guardrail policy.`,
  );
  if (!payload.strategy) throw new Error("Runtime guardrail strategy is missing.");
  return { ...payload, strategy: payload.strategy };
}
