import { Pool, type PoolClient } from "pg";

import {
  WorkflowLeasePolicyError,
  type WorkflowWorkerLease,
} from "@/features/workflows/worker-lease-policy";

export const POSTGRES_WORKFLOW_LEASE_SCHEMA_VERSION =
  "workflows.postgres-lease-adapter.v1" as const;

type LeaseRow = {
  execution_id: string;
  worker_id: string;
  fence_token: string;
  acquired_at: Date | string;
  heartbeat_at: Date | string;
  expires_at: Date | string;
  recovery_count: number;
  released_at: Date | string | null;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toLease(row: LeaseRow): WorkflowWorkerLease {
  return {
    executionId: row.execution_id,
    workerId: row.worker_id,
    fenceToken: Number(row.fence_token),
    acquiredAt: iso(row.acquired_at),
    heartbeatAt: iso(row.heartbeat_at),
    expiresAt: iso(row.expires_at),
    recoveryCount: row.recovery_count,
  };
}

async function rollbackQuietly(client: PoolClient) {
  await client.query("ROLLBACK").catch(() => undefined);
}

export class PostgresWorkflowLeaseAdapter {
  readonly schemaVersion = POSTGRES_WORKFLOW_LEASE_SCHEMA_VERSION;
  private readonly pool: Pool;

  constructor(input?: { connectionString?: string; pool?: Pool }) {
    const connectionString =
      input?.connectionString || process.env.FIRST_LLM_WORKFLOW_DATABASE_URL;
    if (!input?.pool && !connectionString) {
      throw new Error(
        "PostgreSQL workflow leases require FIRST_LLM_WORKFLOW_DATABASE_URL.",
      );
    }
    this.pool = input?.pool || new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      application_name: "first-llm-workflow-lease",
    });
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS first_llm_workflow_leases (
        execution_id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        fence_token BIGINT NOT NULL CHECK (fence_token > 0),
        acquired_at TIMESTAMPTZ NOT NULL,
        heartbeat_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        recovery_count INTEGER NOT NULL DEFAULT 0 CHECK (recovery_count >= 0),
        released_at TIMESTAMPTZ NULL,
        revision BIGINT NOT NULL DEFAULT 1
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS first_llm_workflow_leases_expiry_idx
      ON first_llm_workflow_leases (expires_at)
      WHERE released_at IS NULL
    `);
  }

  private async transaction<T>(run: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await run(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async claim(input: {
    executionId: string;
    workerId: string;
    ttlMs?: number;
  }) {
    const executionId = input.executionId.trim();
    const workerId = input.workerId.trim();
    const ttlMs = Math.max(250, Math.min(input.ttlMs || 30_000, 300_000));
    if (!executionId || !workerId) {
      throw new Error("executionId and workerId are required for a lease claim.");
    }
    return this.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [executionId],
      );
      const currentResult = await client.query<LeaseRow>(
        `SELECT * FROM first_llm_workflow_leases
         WHERE execution_id = $1
         FOR UPDATE`,
        [executionId],
      );
      const current = currentResult.rows[0] || null;
      const nowResult = await client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const now = nowResult.rows[0].now;
      const active = current && !current.released_at &&
        new Date(current.expires_at).getTime() > now.getTime();
      if (active && current.worker_id !== workerId) {
        throw new WorkflowLeasePolicyError(
          "lease_conflict",
          `Workflow execution is leased by ${current.worker_id}.`,
        );
      }
      const result = current
        ? await client.query<LeaseRow>(
            `UPDATE first_llm_workflow_leases
             SET worker_id = $2,
                 fence_token = CASE
                   WHEN released_at IS NULL AND expires_at > clock_timestamp()
                     THEN fence_token
                   ELSE fence_token + 1
                 END,
                 acquired_at = CASE
                   WHEN released_at IS NULL AND expires_at > clock_timestamp()
                     THEN acquired_at
                   ELSE clock_timestamp()
                 END,
                 heartbeat_at = clock_timestamp(),
                 expires_at = clock_timestamp() + ($3::bigint * interval '1 millisecond'),
                 recovery_count = CASE
                   WHEN released_at IS NULL AND expires_at > clock_timestamp()
                     THEN recovery_count
                   ELSE recovery_count + 1
                 END,
                 released_at = NULL,
                 revision = revision + 1
             WHERE execution_id = $1
             RETURNING *`,
            [executionId, workerId, ttlMs],
          )
        : await client.query<LeaseRow>(
            `INSERT INTO first_llm_workflow_leases (
               execution_id, worker_id, fence_token, acquired_at,
               heartbeat_at, expires_at, recovery_count, revision
             ) VALUES (
               $1, $2, 1, clock_timestamp(), clock_timestamp(),
               clock_timestamp() + ($3::bigint * interval '1 millisecond'), 0, 1
             ) RETURNING *`,
            [executionId, workerId, ttlMs],
          );
      return toLease(result.rows[0]);
    });
  }

  async heartbeat(input: {
    executionId: string;
    workerId: string;
    fenceToken: number;
    ttlMs?: number;
  }) {
    const ttlMs = Math.max(250, Math.min(input.ttlMs || 30_000, 300_000));
    const result = await this.pool.query<LeaseRow>(
      `UPDATE first_llm_workflow_leases
       SET heartbeat_at = clock_timestamp(),
           expires_at = clock_timestamp() + ($4::bigint * interval '1 millisecond'),
           revision = revision + 1
       WHERE execution_id = $1
         AND worker_id = $2
         AND fence_token = $3
         AND released_at IS NULL
         AND expires_at > clock_timestamp()
       RETURNING *`,
      [input.executionId, input.workerId, input.fenceToken, ttlMs],
    );
    if (!result.rows[0]) {
      const current = await this.read(input.executionId);
      throw new WorkflowLeasePolicyError(
        current ? "lease_fenced" : "lease_expired",
        "Workflow lease heartbeat was rejected by the durable fence.",
      );
    }
    return toLease(result.rows[0]);
  }

  async release(input: {
    executionId: string;
    workerId: string;
    fenceToken: number;
  }) {
    const result = await this.pool.query<LeaseRow>(
      `UPDATE first_llm_workflow_leases
       SET released_at = clock_timestamp(), revision = revision + 1
       WHERE execution_id = $1
         AND worker_id = $2
         AND fence_token = $3
         AND released_at IS NULL
         AND expires_at > clock_timestamp()
       RETURNING *`,
      [input.executionId, input.workerId, input.fenceToken],
    );
    if (!result.rows[0]) {
      throw new WorkflowLeasePolicyError(
        "lease_fenced",
        "A stale workflow worker cannot release the durable lease.",
      );
    }
    return { ...toLease(result.rows[0]), releasedAt: iso(result.rows[0].released_at!) };
  }

  async read(executionId: string) {
    const result = await this.pool.query<LeaseRow>(
      "SELECT * FROM first_llm_workflow_leases WHERE execution_id = $1",
      [executionId],
    );
    return result.rows[0]
      ? {
          ...toLease(result.rows[0]),
          releasedAt: result.rows[0].released_at
            ? iso(result.rows[0].released_at)
            : null,
        }
      : null;
  }

  async close() {
    await this.pool.end();
  }
}
