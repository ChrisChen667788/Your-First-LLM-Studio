import { createHash, randomUUID } from "crypto";
import os from "os";
import path from "path";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

export const USAGE_SETTLEMENT_SCHEMA_VERSION =
  "deployment.usage-settlement.v1" as const;

type Event = {
  id: string;
  idempotencyKey: string;
  tenantId: string;
  totalTokens: number;
  status: "pending" | "failed" | "delivered";
  attempts: number;
  payloadDigest: string;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string;
  externalReceiptId?: string;
  error?: string;
};

type Receipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "failed";
  eventId: string;
  checks: Record<string, boolean>;
  transitions: Event["status"][];
};

type Store = {
  schemaVersion: typeof USAGE_SETTLEMENT_SCHEMA_VERSION;
  events: Event[];
  receipts: Receipt[];
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
const STORE_FILE = path.join(DATA_DIR, "deployment-usage-settlement.json");

function emptyStore(): Store {
  return {
    schemaVersion: USAGE_SETTLEMENT_SCHEMA_VERSION,
    events: [],
    receipts: [],
  };
}

function isStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Store>;
  return (
    candidate.schemaVersion === USAGE_SETTLEMENT_SCHEMA_VERSION &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.receipts)
  );
}

function readStore() {
  return readJsonFileDurably(STORE_FILE, emptyStore, isStore);
}

function updateStore(mutate: (store: Store) => Store) {
  return updateJsonFileDurably(STORE_FILE, emptyStore, mutate, isStore);
}

export function enqueueUsageSettlement(input: {
  idempotencyKey: string;
  tenantId: string;
  totalTokens: number;
}) {
  if (!input.idempotencyKey.trim() || !input.tenantId.trim()) {
    throw new Error("idempotencyKey and tenantId are required.");
  }
  if (!Number.isFinite(input.totalTokens) || input.totalTokens < 0) {
    throw new Error("totalTokens must be a non-negative number.");
  }
  let saved: Event | null = null;
  updateStore((store) => {
    const existing = store.events.find(
      (entry) => entry.idempotencyKey === input.idempotencyKey,
    );
    if (existing) {
      saved = existing;
      return store;
    }
    const now = new Date().toISOString();
    saved = {
      id: `usage-settlement-${randomUUID()}`,
      ...input,
      totalTokens: Math.round(input.totalTokens),
      status: "pending",
      attempts: 0,
      payloadDigest: createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex"),
      createdAt: now,
      updatedAt: now,
    };
    return { ...store, events: [saved, ...store.events] };
  });
  return saved!;
}

export function deliverUsageSettlement(input: {
  eventId: string;
  outcome: "success" | "transient-failure";
  externalReceiptId?: string;
}) {
  let saved: Event | null = null;
  updateStore((store) => {
    const current = store.events.find((entry) => entry.id === input.eventId);
    if (!current) throw new Error("Usage settlement event was not found.");
    if (current.status === "delivered") {
      saved = current;
      return store;
    }
    const now = new Date();
    const attempts = current.attempts + 1;
    saved =
      input.outcome === "success"
        ? {
            ...current,
            status: "delivered",
            attempts,
            externalReceiptId:
              input.externalReceiptId || `billing-${randomUUID()}`,
            updatedAt: now.toISOString(),
            error: undefined,
            nextAttemptAt: undefined,
          }
        : {
            ...current,
            status: "failed",
            attempts,
            error: "Transient billing receiver failure.",
            nextAttemptAt: new Date(
              now.getTime() + Math.min(60_000, 1_000 * 2 ** attempts),
            ).toISOString(),
            updatedAt: now.toISOString(),
          };
    return {
      ...store,
      events: store.events.map((entry) =>
        entry.id === current.id ? saved! : entry,
      ),
    };
  });
  return saved!;
}

export function rehearseUsageSettlement() {
  const key = `rehearsal-settlement-${Date.now()}-${randomUUID()}`;
  const pending = enqueueUsageSettlement({
    idempotencyKey: key,
    tenantId: "local-lab",
    totalTokens: 611,
  });
  const failed = deliverUsageSettlement({
    eventId: pending.id,
    outcome: "transient-failure",
  });
  const delivered = deliverUsageSettlement({
    eventId: pending.id,
    outcome: "success",
    externalReceiptId: `local-billing-${randomUUID()}`,
  });
  const duplicate = enqueueUsageSettlement({
    idempotencyKey: key,
    tenantId: "local-lab",
    totalTokens: 611,
  });
  const checks = {
    startsPending: pending.status === "pending",
    failureRetainedForRetry:
      failed.status === "failed" && Boolean(failed.nextAttemptAt),
    retryDelivered:
      delivered.status === "delivered" && delivered.attempts === 2,
    externalReceiptRecorded: Boolean(delivered.externalReceiptId),
    duplicateSuppressed: duplicate.id === pending.id,
  };
  const receipt: Receipt = {
    id: `usage-settlement-receipt-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: Object.values(checks).every(Boolean) ? "pass" : "failed",
    eventId: pending.id,
    checks,
    transitions: [pending.status, failed.status, delivered.status],
  };
  updateStore((store) => ({
    ...store,
    receipts: [receipt, ...store.receipts].slice(0, 100),
  }));
  return receipt;
}

export function readUsageSettlementEvidence() {
  const store = readStore();
  return {
    ...store,
    ok: true as const,
    generatedAt: new Date().toISOString(),
    latestPassing:
      store.receipts.find((entry) => entry.status === "pass") || null,
    totals: {
      events: store.events.length,
      pending: store.events.filter((entry) => entry.status === "pending").length,
      failed: store.events.filter((entry) => entry.status === "failed").length,
      delivered: store.events.filter((entry) => entry.status === "delivered").length,
    },
    path: STORE_FILE,
  };
}
