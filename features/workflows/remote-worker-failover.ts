import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const REMOTE_WORKER_FAILOVER_SCHEMA_VERSION =
  "workflows.remote-worker-failover.v1" as const;

export type RemoteWorkerFailoverReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  scope: "process-isolated-postgres";
  executionId: string;
  checks: {
    postgresDurableLease: boolean;
    independentWorkerProcesses: boolean;
    liveOwnerConflictRejected: boolean;
    expiredOwnerRecovered: boolean;
    fenceTokenAdvanced: boolean;
    recoveredWorkerHeartbeat: boolean;
    recoveredWorkerReleased: boolean;
  };
  evidence: {
    firstWorkerPid: number;
    recoveredWorkerPid: number;
    initialFenceToken: number;
    recoveredFenceToken: number;
    recoveryCount: number;
    databaseHost: string;
  };
  blockers: string[];
  productionBlockers: string[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(
  DATA_DIR,
  "workflows",
  "remote-worker-failover.json",
);

export function saveRemoteWorkerFailoverReceipt(
  input: Omit<RemoteWorkerFailoverReceipt, "id" | "generatedAt" | "status" | "localStatus" | "productionStatus" | "scope" | "blockers" | "productionBlockers">,
) {
  const blockers = Object.entries(input.checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Remote worker failover check failed: ${check}.`);
  const receipt: RemoteWorkerFailoverReceipt = {
    id: `remote-worker-failover-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "hold" : "pass",
    localStatus: blockers.length ? "hold" : "pass",
    productionStatus: "hold",
    scope: "process-isolated-postgres",
    ...input,
    blockers,
    productionBlockers: [
      "Two independently managed worker hosts must repeat this rehearsal against the production lease database.",
      "Network partition, database failover, and protected side-effect idempotency require operator-signed evidence.",
    ],
  };
  prependDurableReceipt(
    STORE_FILE,
    REMOTE_WORKER_FAILOVER_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readRemoteWorkerFailoverEvidence() {
  const receipts = readDurableReceipts<RemoteWorkerFailoverReceipt>(
    STORE_FILE,
    REMOTE_WORKER_FAILOVER_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: REMOTE_WORKER_FAILOVER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    latest: receipts[0] || null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    productionStatus: "hold" as const,
    productionBlockers: receipts[0]?.productionBlockers || [
      "Process-isolated PostgreSQL worker failover has not been rehearsed.",
    ],
    path: STORE_FILE,
  };
}
