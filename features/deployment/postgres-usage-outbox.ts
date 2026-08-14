import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";

import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const POSTGRES_USAGE_OUTBOX_SCHEMA_VERSION =
  "deployment.postgres-usage-outbox.v1" as const;

type UsageOutboxRow = {
  id: string;
  idempotency_key: string;
  tenant_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  payload_digest: string;
  status: "pending" | "processing" | "failed" | "delivered";
  attempts: number;
  lease_token: string | null;
  lease_expires_at: Date | null;
  next_attempt_at: Date | null;
  external_receipt_id: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PostgresUsageOutboxReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  checks: {
    schemaCreated: boolean;
    idempotentEnqueue: boolean;
    exclusiveClaim: boolean;
    transientFailureRetained: boolean;
    retryClaimed: boolean;
    deliveryAcknowledged: boolean;
    tokenAccountingPreserved: boolean;
  };
  evidence: {
    eventId: string;
    attempts: number;
    totalTokens: number;
    externalReceiptId: string;
    database: "postgresql";
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
const EVIDENCE_FILE = path.join(
  DATA_DIR,
  "deployment-postgres-usage-outbox.json",
);

function normalizeRow(row: UsageOutboxRow) {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    tenantId: row.tenant_id,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    payloadDigest: row.payload_digest,
    status: row.status,
    attempts: row.attempts,
    leaseToken: row.lease_token,
    leaseExpiresAt: row.lease_expires_at?.toISOString() || null,
    nextAttemptAt: row.next_attempt_at?.toISOString() || null,
    externalReceiptId: row.external_receipt_id,
    lastError: row.last_error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PostgresUsageOutboxAdapter {
  private readonly pool: Pool;

  constructor(input?: { connectionString?: string; pool?: Pool }) {
    const connectionString =
      input?.connectionString || process.env.FIRST_LLM_USAGE_DATABASE_URL;
    if (!input?.pool && !connectionString) {
      throw new Error("PostgreSQL usage outbox requires FIRST_LLM_USAGE_DATABASE_URL.");
    }
    this.pool = input?.pool || new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      application_name: "first-llm-usage-outbox",
    });
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS first_llm_usage_outbox (
        id UUID PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL CHECK (prompt_tokens >= 0),
        completion_tokens INTEGER NOT NULL CHECK (completion_tokens >= 0),
        total_tokens INTEGER NOT NULL CHECK (total_tokens = prompt_tokens + completion_tokens),
        payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64),
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'failed', 'delivered')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        lease_token UUID NULL,
        lease_expires_at TIMESTAMPTZ NULL,
        next_attempt_at TIMESTAMPTZ NULL,
        external_receipt_id TEXT NULL,
        last_error TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS first_llm_usage_outbox_delivery_idx
      ON first_llm_usage_outbox (status, next_attempt_at, created_at)
      WHERE status IN ('pending', 'failed', 'processing')
    `);
  }

  async enqueue(input: {
    idempotencyKey: string;
    tenantId: string;
    promptTokens: number;
    completionTokens: number;
    payloadDigest: string;
  }) {
    if (!input.idempotencyKey.trim() || !input.tenantId.trim()) {
      throw new Error("idempotencyKey and tenantId are required.");
    }
    if (![input.promptTokens, input.completionTokens].every(
      (value) => Number.isInteger(value) && value >= 0,
    )) throw new Error("Usage token counts must be non-negative integers.");
    if (!/^[a-f0-9]{64}$/u.test(input.payloadDigest)) {
      throw new Error("payloadDigest must be SHA-256.");
    }
    const result = await this.pool.query<UsageOutboxRow>(
      `INSERT INTO first_llm_usage_outbox (
         id, idempotency_key, tenant_id, prompt_tokens, completion_tokens,
         total_tokens, payload_digest, status
       ) VALUES ($1, $2, $3, $4::integer, $5::integer, $4::integer + $5::integer, $6, 'pending')
       ON CONFLICT (idempotency_key) DO UPDATE
       SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING *`,
      [
        randomUUID(),
        input.idempotencyKey,
        input.tenantId,
        input.promptTokens,
        input.completionTokens,
        input.payloadDigest,
      ],
    );
    const row = result.rows[0];
    if (
      row.tenant_id !== input.tenantId ||
      row.prompt_tokens !== input.promptTokens ||
      row.completion_tokens !== input.completionTokens ||
      row.payload_digest !== input.payloadDigest
    ) {
      throw new Error("Idempotency key is already bound to a different usage payload.");
    }
    return normalizeRow(row);
  }

  async claim(input: { workerId: string; leaseMs?: number }) {
    const leaseMs = Math.max(250, Math.min(input.leaseMs || 30_000, 300_000));
    const leaseToken = randomUUID();
    const result = await this.pool.query<UsageOutboxRow>(
      `WITH candidate AS (
         SELECT id
         FROM first_llm_usage_outbox
         WHERE (
           status = 'pending'
           OR (status = 'failed' AND COALESCE(next_attempt_at, clock_timestamp()) <= clock_timestamp())
           OR (status = 'processing' AND lease_expires_at <= clock_timestamp())
         )
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE first_llm_usage_outbox AS event
       SET status = 'processing',
           attempts = attempts + 1,
           lease_token = $1,
           lease_expires_at = clock_timestamp() + ($2::bigint * interval '1 millisecond'),
           updated_at = clock_timestamp(),
           last_error = NULL
       FROM candidate
       WHERE event.id = candidate.id
       RETURNING event.*`,
      [leaseToken, leaseMs],
    );
    return result.rows[0]
      ? { ...normalizeRow(result.rows[0]), workerId: input.workerId }
      : null;
  }

  async fail(input: { eventId: string; leaseToken: string; error: string; retryMs?: number }) {
    const retryMs = Math.max(50, Math.min(input.retryMs || 1_000, 300_000));
    const result = await this.pool.query<UsageOutboxRow>(
      `UPDATE first_llm_usage_outbox
       SET status = 'failed', lease_token = NULL, lease_expires_at = NULL,
           next_attempt_at = clock_timestamp() + ($3::bigint * interval '1 millisecond'),
           last_error = $4, updated_at = clock_timestamp()
       WHERE id = $1 AND lease_token = $2 AND status = 'processing'
       RETURNING *`,
      [input.eventId, input.leaseToken, retryMs, input.error.slice(0, 500)],
    );
    if (!result.rows[0]) throw new Error("Usage outbox failure update was fenced.");
    return normalizeRow(result.rows[0]);
  }

  async acknowledge(input: {
    eventId: string;
    leaseToken: string;
    externalReceiptId: string;
  }) {
    if (!input.externalReceiptId.trim()) throw new Error("externalReceiptId is required.");
    const result = await this.pool.query<UsageOutboxRow>(
      `UPDATE first_llm_usage_outbox
       SET status = 'delivered', lease_token = NULL, lease_expires_at = NULL,
           next_attempt_at = NULL, external_receipt_id = $3,
           last_error = NULL, updated_at = clock_timestamp()
       WHERE id = $1 AND lease_token = $2 AND status = 'processing'
       RETURNING *`,
      [input.eventId, input.leaseToken, input.externalReceiptId],
    );
    if (!result.rows[0]) throw new Error("Usage outbox acknowledgement was fenced.");
    return normalizeRow(result.rows[0]);
  }

  async readSummary() {
    const result = await this.pool.query<{
      total: string;
      pending: string;
      processing: string;
      failed: string;
      delivered: string;
      total_tokens: string;
    }>(`SELECT
      count(*) AS total,
      count(*) FILTER (WHERE status = 'pending') AS pending,
      count(*) FILTER (WHERE status = 'processing') AS processing,
      count(*) FILTER (WHERE status = 'failed') AS failed,
      count(*) FILTER (WHERE status = 'delivered') AS delivered,
      COALESCE(sum(total_tokens), 0) AS total_tokens
      FROM first_llm_usage_outbox`);
    return Object.fromEntries(
      Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]),
    );
  }

  async close() {
    await this.pool.end();
  }
}

export function savePostgresUsageOutboxReceipt(
  input: Omit<PostgresUsageOutboxReceipt, "id" | "generatedAt" | "status" | "localStatus" | "productionStatus" | "blockers" | "productionBlockers">,
) {
  const blockers = Object.entries(input.checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `PostgreSQL usage outbox check failed: ${check}.`);
  const receipt: PostgresUsageOutboxReceipt = {
    id: `postgres-usage-outbox-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "hold" : "pass",
    localStatus: blockers.length ? "hold" : "pass",
    productionStatus: "hold",
    ...input,
    blockers,
    productionBlockers: [
      "Managed PostgreSQL failover and billing receiver acknowledgements require production workload identity.",
      "Cross-region duplicate-delivery and billing reconciliation need organization-signed receipts.",
    ],
  };
  prependDurableReceipt(
    EVIDENCE_FILE,
    POSTGRES_USAGE_OUTBOX_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readPostgresUsageOutboxEvidence() {
  const receipts = readDurableReceipts<PostgresUsageOutboxReceipt>(
    EVIDENCE_FILE,
    POSTGRES_USAGE_OUTBOX_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: POSTGRES_USAGE_OUTBOX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latest: receipts[0] || null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    productionStatus: "hold" as const,
    productionBlockers: receipts[0]?.productionBlockers || [
      "PostgreSQL usage outbox has not been rehearsed locally.",
    ],
    path: EVIDENCE_FILE,
  };
}
