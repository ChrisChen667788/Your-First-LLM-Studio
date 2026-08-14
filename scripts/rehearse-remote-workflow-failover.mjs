import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const cwd = process.cwd();
const containerName = `first-llm-lease-${randomUUID().slice(0, 8)}`;
const executionId = `workflow-failover-${randomUUID()}`;
const ttlMs = 1_200;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function lastJson(stdout) {
  const line = stdout.trim().split("\n").filter(Boolean).at(-1);
  if (!line) throw new Error("Worker process did not emit a JSON receipt.");
  return JSON.parse(line);
}

async function waitForPostgres(connectionString) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await run("docker", ["exec", containerName, "pg_isready", "-U", "postgres"]);
    if (result.code === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`PostgreSQL did not become ready: ${connectionString}`);
}

let connectionString = "";
try {
  const started = await run("docker", [
    "run", "--rm", "-d", "--name", containerName,
    "-e", "POSTGRES_PASSWORD=postgres",
    "-p", "127.0.0.1::5432",
    "postgres:16-alpine",
  ]);
  if (started.code !== 0) throw new Error(started.stderr || "Docker PostgreSQL failed to start.");
  const portResult = await run("docker", ["port", containerName, "5432/tcp"]);
  const port = portResult.stdout.trim().match(/:(\d+)$/u)?.[1];
  if (!port) throw new Error("Docker did not publish a PostgreSQL port.");
  connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  await waitForPostgres(connectionString);
  const env = { FIRST_LLM_WORKFLOW_DATABASE_URL: connectionString };
  const ownerResult = await run(
    "./node_modules/.bin/tsx",
    ["scripts/workflow-lease-process.ts", "crash-owner", executionId, String(ttlMs)],
    { env },
  );
  if (ownerResult.code !== 73) {
    throw new Error(ownerResult.stderr || `Crash owner exited ${ownerResult.code}.`);
  }
  const owner = lastJson(ownerResult.stdout);
  const recoveredResult = await run(
    "./node_modules/.bin/tsx",
    ["scripts/workflow-lease-process.ts", "recoverer", executionId, String(ttlMs)],
    { env },
  );
  if (recoveredResult.code !== 0) {
    throw new Error(recoveredResult.stderr || `Recoverer exited ${recoveredResult.code}.`);
  }
  const recovered = lastJson(recoveredResult.stdout);
  process.env.FIRST_LLM_WORKFLOW_DATABASE_URL = connectionString;
  const { saveRemoteWorkerFailoverReceipt } = await import(
    "../features/workflows/remote-worker-failover.ts"
  );
  const receipt = saveRemoteWorkerFailoverReceipt({
    executionId,
    checks: {
      postgresDurableLease: true,
      independentWorkerProcesses: owner.pid !== recovered.pid,
      liveOwnerConflictRejected: recovered.conflictRejected === true,
      expiredOwnerRecovered: recovered.lease.workerId === "worker-b" && recovered.lease.recoveryCount >= 1,
      fenceTokenAdvanced: recovered.lease.fenceToken > owner.lease.fenceToken,
      recoveredWorkerHeartbeat: Date.parse(recovered.heartbeat.heartbeatAt) >= Date.parse(recovered.lease.heartbeatAt),
      recoveredWorkerReleased: Boolean(recovered.released.releasedAt),
    },
    evidence: {
      firstWorkerPid: owner.pid,
      recoveredWorkerPid: recovered.pid,
      initialFenceToken: owner.lease.fenceToken,
      recoveredFenceToken: recovered.lease.fenceToken,
      recoveryCount: recovered.lease.recoveryCount,
      databaseHost: "127.0.0.1:docker-postgres-16",
    },
  });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.localStatus !== "pass") process.exitCode = 1;
} finally {
  await run("docker", ["rm", "-f", containerName]).catch(() => undefined);
}
