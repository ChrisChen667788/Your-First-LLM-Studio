import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { simulateDistributedWorkflowLeaseRecovery } from "@/features/workflows/worker-lease-policy";

export const DISTRIBUTED_WORKER_ACCEPTANCE_SCHEMA_VERSION =
  "workflows.distributed-worker-acceptance.v1" as const;

export type DistributedWorkerAcceptanceReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  scope: "single-process-simulation";
  checks: {
    exclusiveLease: boolean;
    expiredLeaseRecovered: boolean;
    staleWorkerFenced: boolean;
    heartbeatExtended: boolean;
    recoveryReceiptComplete: boolean;
  };
  blockers: string[];
  productionBlockers: string[];
  evidence: {
    initialFenceToken: number;
    recoveredFenceToken: number;
    recoveryCount: number;
    recoveredWorkerId: string;
  };
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
  "distributed-worker-acceptance.json",
);

export function runDistributedWorkerAcceptance() {
  const simulation = simulateDistributedWorkflowLeaseRecovery();
  const blockers = Object.entries(simulation.checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Distributed worker check failed: ${check}.`);
  const receipt: DistributedWorkerAcceptanceReceipt = {
    id: `distributed-worker-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "hold" : "pass",
    scope: "single-process-simulation",
    checks: simulation.checks,
    blockers,
    productionBlockers: [
      "Two independently managed worker nodes must demonstrate lease recovery and fencing.",
      "Process termination during a protected side effect must prove duplicate suppression.",
      "Remote queue or database lease storage must demonstrate partition and clock-skew behavior.",
    ],
    evidence: {
      initialFenceToken: simulation.first.fenceToken,
      recoveredFenceToken: simulation.recovered.fenceToken,
      recoveryCount: simulation.recovered.recoveryCount,
      recoveredWorkerId: simulation.recovered.workerId,
    },
  };
  prependDurableReceipt(
    STORE_FILE,
    DISTRIBUTED_WORKER_ACCEPTANCE_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readDistributedWorkerAcceptanceEvidence() {
  const receipts = readDurableReceipts<DistributedWorkerAcceptanceReceipt>(
    STORE_FILE,
    DISTRIBUTED_WORKER_ACCEPTANCE_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: DISTRIBUTED_WORKER_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latestPassing: receipts.find((receipt) => receipt.status === "pass") || null,
    productionBlockers:
      receipts[0]?.productionBlockers || [
        "Distributed worker acceptance has not been rehearsed locally.",
      ],
    path: STORE_FILE,
  };
}
