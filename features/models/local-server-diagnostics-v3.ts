import { createHash } from "node:crypto";

import { readIdleUnloadDaemonEvidence } from "@/features/models/idle-unload-daemon";
import { readLocalServerAcceptanceEvidence } from "@/features/models/local-server-acceptance";
import { readServerAccessControlEvidence } from "@/features/models/server-access-control";
import { readServerInstanceRegistry } from "@/features/models/server-instance-registry";
import { readServerLogRetentionEvidence } from "@/features/models/server-log-retention";
import { readServerRequestLedger } from "@/features/models/server-request-ledger";

export const LOCAL_SERVER_DIAGNOSTICS_V3_SCHEMA_VERSION =
  "models.local-server-diagnostics-v3.v1" as const;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function readLocalServerDiagnosticsV3() {
  const registry = readServerInstanceRegistry();
  const ledger = readServerRequestLedger();
  const acceptance = readLocalServerAcceptanceEvidence();
  const idleUnload = readIdleUnloadDaemonEvidence();
  const access = readServerAccessControlEvidence();
  const retention = readServerLogRetentionEvidence();
  const instances = registry.instances.map((instance) => {
    const requestRows = ledger.entries.filter((entry) => entry.serverId === instance.id);
    const successful = requestRows.filter((entry) => entry.status === "success");
    return {
      id: instance.id,
      backend: instance.backend,
      state: instance.state,
      activeModelId: instance.activeModelId || null,
      maxConcurrentRequests: instance.maxConcurrentRequests,
      idleTtlMinutes: instance.idleTtlMinutes,
      autoEvict: instance.autoEvict,
      requests: requestRows.length,
      successRatePct: requestRows.length
        ? Number(((successful.length / requestRows.length) * 100).toFixed(2))
        : null,
      averageLatencyMs: requestRows.length
        ? Math.round(requestRows.reduce((sum, entry) => sum + entry.latencyMs, 0) / requestRows.length)
        : null,
      cancelled: requestRows.filter((entry) => entry.status === "cancelled").length,
      tokenAccounting: requestRows.reduce(
        (sum, entry) => sum + entry.promptTokens + entry.completionTokens,
        0,
      ),
    };
  });
  const checks = {
    instanceRegistry: instances.length > 0,
    boundedConcurrency: instances.every((instance) => instance.maxConcurrentRequests > 0),
    requestLedger: ledger.entries.length > 0,
    apiConformance: Boolean(acceptance.latestPassing),
    idleUnload: Boolean(idleUnload.latestPassing),
    accessControl: Boolean(access.latestPassing),
    retention: Boolean(retention.latestPassing),
  };
  const withoutDigest = {
    ok: true as const,
    schemaVersion: LOCAL_SERVER_DIAGNOSTICS_V3_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass" as const,
    localStatus: Object.values(checks).every(Boolean) ? "pass" as const : "hold" as const,
    productionStatus: "hold" as const,
    checks,
    instances,
    totals: ledger.totals,
    disclosure:
      "Declared concurrency, idle TTL, auth and retention are inspectable. Throughput, batching, cancellation propagation, and API parity require real request receipts before promotion.",
  };
  return { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
}
