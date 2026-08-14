import { PostgresWorkflowLeaseAdapter } from "../features/workflows/postgres-lease-adapter";
import { WorkflowLeasePolicyError } from "../features/workflows/worker-lease-policy";

async function main() {
  const role = process.argv[2];
  const executionId = process.argv[3];
  const ttlMs = Number(process.argv[4] || 1_200);
  if (!role || !executionId) {
    throw new Error("Usage: workflow-lease-process.ts <crash-owner|recoverer> <execution-id> [ttl-ms]");
  }
  const adapter = new PostgresWorkflowLeaseAdapter();
  await adapter.ensureSchema();
  if (role === "crash-owner") {
    const lease = await adapter.claim({ executionId, workerId: "worker-a", ttlMs });
    process.stdout.write(`${JSON.stringify({ role, pid: process.pid, lease })}\n`);
    await adapter.close();
    process.exit(73);
  }
  if (role === "recoverer") {
    let conflictRejected = false;
    try {
      await adapter.claim({ executionId, workerId: "worker-b", ttlMs });
    } catch (error) {
      conflictRejected =
        error instanceof WorkflowLeasePolicyError && error.code === "lease_conflict";
      if (!conflictRejected) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, ttlMs + 250));
    const lease = await adapter.claim({ executionId, workerId: "worker-b", ttlMs });
    const heartbeat = await adapter.heartbeat({
      executionId,
      workerId: lease.workerId,
      fenceToken: lease.fenceToken,
      ttlMs,
    });
    const released = await adapter.release({
      executionId,
      workerId: lease.workerId,
      fenceToken: lease.fenceToken,
    });
    process.stdout.write(`${JSON.stringify({
      role,
      pid: process.pid,
      conflictRejected,
      lease,
      heartbeat,
      released,
    })}\n`);
    await adapter.close();
    return;
  }
  await adapter.close();
  throw new Error(`Unsupported worker role: ${role}`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
