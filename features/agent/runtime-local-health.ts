import {
  ensureLocalGatewayAvailableDetailed,
  getLocalGatewaySupervisorInfo,
  probeLocalGateway,
} from "@/lib/agent/local-gateway";

type LocalGatewaySupervisorInfo = ReturnType<typeof getLocalGatewaySupervisorInfo>;

async function readLocalHealth(healthUrl: string, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(healthUrl, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveLocalRuntimeHealth(input: {
  resolvedBaseUrl: string;
  healthUrl: string;
  supervisor: LocalGatewaySupervisorInfo;
}) {
  let ensureReason: string | undefined;
  let data = await readLocalHealth(input.healthUrl);

  if (!data) {
    const gatewayReachable = await probeLocalGateway(input.resolvedBaseUrl, 1200);
    if (
      !gatewayReachable &&
      !input.supervisor.supervisorAlive &&
      !input.supervisor.gatewayAlive
    ) {
      const ensureResult = await ensureLocalGatewayAvailableDetailed(
        input.resolvedBaseUrl,
        { waitMs: 6000 },
      );
      ensureReason = ensureResult.reason;
      if (ensureResult.ok) {
        data = await readLocalHealth(input.healthUrl, 2000);
      } else {
        throw new Error(ensureResult.reason);
      }
    } else {
      return { state: "recovering" as const };
    }
  }

  if (!data) {
    throw new Error(ensureReason || "Local runtime health endpoint is unavailable.");
  }
  return { state: "ready" as const, data };
}
