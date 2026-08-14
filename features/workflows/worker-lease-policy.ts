export type WorkflowWorkerLease = {
  executionId: string;
  workerId: string;
  fenceToken: number;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
  recoveryCount: number;
};

export class WorkflowLeasePolicyError extends Error {
  constructor(
    readonly code: "lease_conflict" | "lease_fenced" | "lease_expired",
    message: string,
  ) {
    super(message);
    this.name = "WorkflowLeasePolicyError";
  }
}

export function claimWorkflowLeasePolicy(input: {
  executionId: string;
  workerId: string;
  current: WorkflowWorkerLease | null;
  previousFenceToken?: number;
  now: number;
  ttlMs: number;
}) {
  const active =
    input.current && Date.parse(input.current.expiresAt) > input.now
      ? input.current
      : null;
  if (active && active.workerId !== input.workerId) {
    throw new WorkflowLeasePolicyError(
      "lease_conflict",
      `Workflow execution is leased by ${active.workerId}.`,
    );
  }
  if (active) {
    return {
      ...active,
      heartbeatAt: new Date(input.now).toISOString(),
      expiresAt: new Date(input.now + input.ttlMs).toISOString(),
    };
  }
  const previousFenceToken = Math.max(
    input.previousFenceToken || 0,
    input.current?.fenceToken || 0,
  );
  return {
    executionId: input.executionId,
    workerId: input.workerId,
    fenceToken: previousFenceToken + 1,
    acquiredAt: new Date(input.now).toISOString(),
    heartbeatAt: new Date(input.now).toISOString(),
    expiresAt: new Date(input.now + input.ttlMs).toISOString(),
    recoveryCount: (input.current?.recoveryCount || 0) + (input.current ? 1 : 0),
  } satisfies WorkflowWorkerLease;
}

export function heartbeatWorkflowLeasePolicy(input: {
  current: WorkflowWorkerLease | null;
  workerId: string;
  fenceToken: number;
  now: number;
  ttlMs: number;
}) {
  if (
    !input.current ||
    input.current.workerId !== input.workerId ||
    input.current.fenceToken !== input.fenceToken
  ) {
    throw new WorkflowLeasePolicyError(
      "lease_fenced",
      "Workflow lease owner or fence token no longer matches.",
    );
  }
  if (Date.parse(input.current.expiresAt) <= input.now) {
    throw new WorkflowLeasePolicyError(
      "lease_expired",
      "Workflow lease expired before the heartbeat.",
    );
  }
  return {
    ...input.current,
    heartbeatAt: new Date(input.now).toISOString(),
    expiresAt: new Date(input.now + input.ttlMs).toISOString(),
  };
}

export function releaseWorkflowLeasePolicy(input: {
  current: WorkflowWorkerLease | null;
  workerId: string;
  fenceToken: number;
}) {
  if (
    !input.current ||
    input.current.workerId !== input.workerId ||
    input.current.fenceToken !== input.fenceToken
  ) {
    throw new WorkflowLeasePolicyError(
      "lease_fenced",
      "A stale workflow worker cannot release the active lease.",
    );
  }
  return null;
}

export function simulateDistributedWorkflowLeaseRecovery() {
  const ttlMs = 30_000;
  const startedAt = Date.UTC(2026, 7, 1, 12, 0, 0);
  const first = claimWorkflowLeasePolicy({
    executionId: "workflow-acceptance",
    workerId: "worker-a",
    current: null,
    now: startedAt,
    ttlMs,
  });
  let exclusiveLease = false;
  try {
    claimWorkflowLeasePolicy({
      executionId: first.executionId,
      workerId: "worker-b",
      current: first,
      previousFenceToken: first.fenceToken,
      now: startedAt + 1_000,
      ttlMs,
    });
  } catch (error) {
    exclusiveLease =
      error instanceof WorkflowLeasePolicyError &&
      error.code === "lease_conflict";
  }
  const recovered = claimWorkflowLeasePolicy({
    executionId: first.executionId,
    workerId: "worker-b",
    current: first,
    previousFenceToken: first.fenceToken,
    now: startedAt + ttlMs + 1,
    ttlMs,
  });
  let staleWorkerFenced = false;
  try {
    releaseWorkflowLeasePolicy({
      current: recovered,
      workerId: first.workerId,
      fenceToken: first.fenceToken,
    });
  } catch (error) {
    staleWorkerFenced =
      error instanceof WorkflowLeasePolicyError &&
      error.code === "lease_fenced";
  }
  const heartbeat = heartbeatWorkflowLeasePolicy({
    current: recovered,
    workerId: recovered.workerId,
    fenceToken: recovered.fenceToken,
    now: startedAt + ttlMs + 5_000,
    ttlMs,
  });
  const released = releaseWorkflowLeasePolicy({
    current: heartbeat,
    workerId: heartbeat.workerId,
    fenceToken: heartbeat.fenceToken,
  });
  return {
    first,
    recovered,
    heartbeat,
    checks: {
      exclusiveLease,
      expiredLeaseRecovered:
        recovered.workerId === "worker-b" && recovered.recoveryCount === 1,
      staleWorkerFenced,
      heartbeatExtended:
        Date.parse(heartbeat.expiresAt) > Date.parse(recovered.expiresAt),
      recoveryReceiptComplete:
        recovered.fenceToken === first.fenceToken + 1 && released === null,
    },
  };
}
