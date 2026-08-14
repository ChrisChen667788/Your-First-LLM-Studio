import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

const cwd = process.cwd();
const containerName = `first-llm-usage-${randomUUID().slice(0, 8)}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${command} ${args.join(" ")} timed out after ${options.timeoutMs || 15_000} ms.`));
    }, options.timeoutMs || 15_000);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

async function waitForPostgres() {
  let consecutiveReady = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = await run(
      "docker",
      ["exec", containerName, "pg_isready", "-U", "postgres"],
      { timeoutMs: 3_000 },
    ).catch(() => ({ code: 1 }));
    consecutiveReady = ready.code === 0 ? consecutiveReady + 1 : 0;
    if (consecutiveReady >= 3) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("PostgreSQL usage outbox did not become ready.");
}

try {
  const started = await run("docker", [
    "run", "--rm", "-d", "--name", containerName,
    "-e", "POSTGRES_PASSWORD=postgres",
    "-p", "127.0.0.1::5432",
    "postgres:16-alpine",
  ], { timeoutMs: 30_000 });
  if (started.code !== 0) throw new Error(started.stderr || "Docker PostgreSQL failed to start.");
  const portResult = await run(
    "docker",
    ["port", containerName, "5432/tcp"],
    { timeoutMs: 5_000 },
  );
  const port = portResult.stdout.trim().match(/:(\d+)$/u)?.[1];
  if (!port) throw new Error("Docker did not publish a PostgreSQL port.");
  await waitForPostgres();
  const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  const {
    PostgresUsageOutboxAdapter,
    savePostgresUsageOutboxReceipt,
  } = await import("../features/deployment/postgres-usage-outbox.ts");
  const adapter = new PostgresUsageOutboxAdapter({ connectionString });
  await adapter.ensureSchema();
  const idempotencyKey = `usage-${randomUUID()}`;
  const payloadDigest = createHash("sha256").update(idempotencyKey).digest("hex");
  const first = await adapter.enqueue({
    idempotencyKey,
    tenantId: "local-v15-acceptance",
    promptTokens: 233,
    completionTokens: 144,
    payloadDigest,
  });
  const duplicate = await adapter.enqueue({
    idempotencyKey,
    tenantId: "local-v15-acceptance",
    promptTokens: 233,
    completionTokens: 144,
    payloadDigest,
  });
  const claimed = await adapter.claim({ workerId: "billing-worker-a", leaseMs: 1_000 });
  const competing = await adapter.claim({ workerId: "billing-worker-b", leaseMs: 1_000 });
  if (!claimed?.leaseToken) throw new Error("Usage event was not claimed.");
  const failed = await adapter.fail({
    eventId: claimed.id,
    leaseToken: claimed.leaseToken,
    error: "local transient receiver failure",
    retryMs: 100,
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const retried = await adapter.claim({ workerId: "billing-worker-b", leaseMs: 1_000 });
  if (!retried?.leaseToken) throw new Error("Failed usage event was not reclaimed.");
  const externalReceiptId = `local-billing-${randomUUID()}`;
  const delivered = await adapter.acknowledge({
    eventId: retried.id,
    leaseToken: retried.leaseToken,
    externalReceiptId,
  });
  const summary = await adapter.readSummary();
  await adapter.close();
  const receipt = savePostgresUsageOutboxReceipt({
    checks: {
      schemaCreated: true,
      idempotentEnqueue: duplicate.id === first.id,
      exclusiveClaim: claimed.id === first.id && competing === null,
      transientFailureRetained: failed.status === "failed" && Boolean(failed.nextAttemptAt),
      retryClaimed: retried.id === first.id && retried.attempts === 2,
      deliveryAcknowledged: delivered.status === "delivered" && summary.delivered === 1,
      tokenAccountingPreserved: delivered.totalTokens === 377 && summary.total_tokens === 377,
    },
    evidence: {
      eventId: first.id,
      attempts: delivered.attempts,
      totalTokens: delivered.totalTokens,
      externalReceiptId,
      database: "postgresql",
    },
  });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.localStatus !== "pass") process.exitCode = 1;
} finally {
  await run("docker", ["rm", "-f", containerName], { timeoutMs: 5_000 }).catch(() => undefined);
}
