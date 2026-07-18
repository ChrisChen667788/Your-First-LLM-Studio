import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import {
  readRuntimeAdapterSpecs,
  resolveRuntimeFabricOperation,
  type RuntimeBackend,
  type RuntimeFabricOperation,
} from "@/features/runtime/runtime-fabric-contract";

export type { RuntimeBackend } from "@/features/runtime/runtime-fabric-contract";

export const RUNTIME_OPERATION_PORT_SCHEMA_VERSION =
  "runtime.operation-port.v2" as const;

type Receipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "failed";
  contracts: Array<{
    backend: RuntimeBackend;
    state: "implemented";
    supportedActions: RuntimeFabricOperation[];
  }>;
  checks: Array<{
    backend: RuntimeBackend;
    action: RuntimeFabricOperation;
    normalized: boolean;
    supported: boolean;
    errorCode?: string;
  }>;
  blockers: string[];
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
const STORE_FILE = path.join(DATA_DIR, "runtime-operation-port.json");
const ACTIONS: RuntimeFabricOperation[] = [
  "health",
  "discover",
  "chat",
  "stream",
  "prewarm",
  "unload",
  "cancel",
];

function contracts() {
  return readRuntimeAdapterSpecs().map((spec) => ({
    backend: spec.backend,
    state: "implemented" as const,
    supportedActions: spec.supportedOperations,
  }));
}

function readReceipts(): Receipt[] {
  if (!existsSync(STORE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as {
      receipts?: Receipt[];
    };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function persist(receipt: Receipt) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    STORE_FILE,
    `${JSON.stringify(
      {
        schemaVersion: RUNTIME_OPERATION_PORT_SCHEMA_VERSION,
        receipts: [receipt, ...readReceipts()].slice(0, 100),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function resolveRuntimeOperation(
  backend: RuntimeBackend,
  action: RuntimeFabricOperation,
) {
  const result = resolveRuntimeFabricOperation(backend, action);
  if (!result.ok) {
    return {
      ok: false as const,
      backend,
      action,
      error: result.error,
    };
  }
  return {
    ok: true as const,
    backend,
    action,
    capability: {
      implementation: result.implementation,
      cancellable: action === "chat" || action === "stream",
      idempotent: result.idempotent,
    },
  };
}

export function runRuntimeOperationContractSuite() {
  const checks = contracts().flatMap((contract) =>
    ACTIONS.map((action) => {
      const result = resolveRuntimeOperation(contract.backend, action);
      return {
        backend: contract.backend,
        action,
        normalized: result.ok || Boolean(result.error.code),
        supported: result.ok,
        errorCode: result.ok ? undefined : result.error.code,
      };
    }),
  );
  const blockers = checks
    .filter((entry) => !entry.normalized)
    .map(
      (entry) =>
        `${entry.backend}/${entry.action} lacks a normalized result.`,
    );
  const receipt: Receipt = {
    id: `runtime-port-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "failed" : "pass",
    contracts: contracts(),
    checks,
    blockers,
  };
  persist(receipt);
  return receipt;
}

export function readRuntimeOperationPortEvidence() {
  const receipts = readReceipts();
  return {
    ok: true as const,
    schemaVersion: RUNTIME_OPERATION_PORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    contracts: contracts(),
    receipts,
    latestPassing:
      receipts.find((entry) => entry.status === "pass") || null,
    path: STORE_FILE,
  };
}
