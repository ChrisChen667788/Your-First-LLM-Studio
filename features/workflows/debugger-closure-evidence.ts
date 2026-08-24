import { createHash, randomUUID } from "node:crypto";

import {
  createPersistedWorkflowExecution,
  dispatchPersistedWorkflowEvent,
  readWorkflowExecutions,
  type WorkflowExecutionState,
} from "@/features/workflows/execution-reducer";
import {
  digestWorkflowGraph,
  readWorkflowGraphRegistry,
  resolveWorkflowGraph,
} from "@/features/workflows/graph-registry";
import { forkWorkflowExecutionForReplay, readWorkflowReplayEvidence } from "@/features/workflows/replay-service";
import { readWorkflowStateDiffEvidence, rehearseWorkflowStateDiff } from "@/features/workflows/state-diff";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import type { WorkflowGraph } from "@/features/workflows/graph-contract";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const WORKFLOW_DEBUGGER_CLOSURE_SCHEMA_VERSION =
  "workflows.debugger-closure.v1" as const;
const STORE_SCHEMA_VERSION = "workflows.debugger-closure-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "workflows",
  "v1.10.5-debugger-closure.json",
);

type Status = "pass" | "hold";
type ReplayBoundary = {
  id: string;
  replayExecutionId: string;
  copiedSideEffects: boolean;
} | null;
type StateDiffBoundary = {
  id: string;
  status: "pass" | "failed";
  checks: Record<string, boolean>;
} | null;

export type RedactedWorkflowValue = {
  state: "redacted" | "not-recorded";
  label: "input" | "output" | "error";
  digest: string | null;
  characterCount: number;
  classifications: string[];
  display: string;
};

export type WorkflowDebuggerClosureState = {
  localStatus: Status;
  productionStatus: "hold";
  execution: {
    id: string;
    status: WorkflowExecutionState["status"];
    graphId: string;
    graphVersion: number;
  } | null;
  graph: {
    id: string;
    version: number;
    digest: string;
    immutablePublishedVersion: boolean;
  } | null;
  node: {
    id: string;
    label: string;
    kind: string;
    sideEffect: string;
    resumePolicy: string;
  } | null;
  cards: {
    input: RedactedWorkflowValue;
    output: RedactedWorkflowValue;
    error: RedactedWorkflowValue;
  };
  trace: Array<{
    eventId: string;
    type: string;
    at: string;
    nodeId: string | null;
    output: RedactedWorkflowValue;
    error: RedactedWorkflowValue;
  }>;
  recovery: {
    canResume: boolean;
    canContinue: boolean;
    canForkReplay: boolean;
    reason: string;
  };
  replayBoundary: {
    replay: ReplayBoundary;
    stateDiff: StateDiffBoundary;
  };
  checks: {
    graphVersionBound: boolean;
    graphDigestPresent: boolean;
    immutableGraphVersion: boolean;
    nodeLocated: boolean;
    cardsRedacted: boolean;
    failedStateCaptured: boolean;
    replayOmitsProtectedSideEffects: boolean;
    stateDiffPassed: boolean;
  };
  blockers: string[];
  stateDigest: string;
};

export type WorkflowDebuggerClosureReceipt = WorkflowDebuggerClosureState & {
  id: string;
  generatedAt: string;
  evidenceDigest: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function secretClassifications(value: string) {
  const classifications: string[] = [];
  if (/\bbearer\s+[a-z0-9._~+/=-]+/iu.test(value)) classifications.push("bearer-token");
  if (/\b(api[_-]?key|token|secret|password)\s*[:=]/iu.test(value)) classifications.push("credential-field");
  if (/\bsk-[a-z0-9_-]{8,}/iu.test(value)) classifications.push("api-secret");
  return classifications;
}

/** Keeps execution payloads out of the UI receipt while retaining a stable locator. */
export function redactWorkflowDebuggerValue(
  value: string | undefined,
  label: RedactedWorkflowValue["label"],
): RedactedWorkflowValue {
  const source = value?.trim() || "";
  if (!source) {
    return {
      state: "not-recorded",
      label,
      digest: null,
      characterCount: 0,
      classifications: [],
      display: `No ${label} value was recorded.`,
    };
  }
  const classifications = secretClassifications(source);
  return {
    state: "redacted",
    label,
    digest: `sha256:${digest(source)}`,
    characterCount: source.length,
    classifications,
    display: `${label} captured and redacted (${source.length} character(s)${classifications.length ? `; ${classifications.join(", ")}` : ""}).`,
  };
}

function emptyState(reason: string): WorkflowDebuggerClosureState {
  const notRecorded = (label: RedactedWorkflowValue["label"]) => redactWorkflowDebuggerValue(undefined, label);
  const withoutDigest = {
    localStatus: "hold" as const,
    productionStatus: "hold" as const,
    execution: null,
    graph: null,
    node: null,
    cards: { input: notRecorded("input"), output: notRecorded("output"), error: notRecorded("error") },
    trace: [],
    recovery: { canResume: false, canContinue: false, canForkReplay: false, reason },
    replayBoundary: { replay: null, stateDiff: null },
    checks: {
      graphVersionBound: false,
      graphDigestPresent: false,
      immutableGraphVersion: false,
      nodeLocated: false,
      cardsRedacted: false,
      failedStateCaptured: false,
      replayOmitsProtectedSideEffects: false,
      stateDiffPassed: false,
    },
    blockers: [reason, "Distributed checkpointer, production trace retention, browser workflow acceptance, and operator recovery review remain production HOLD gates."],
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

export function buildWorkflowDebuggerClosureState(input: {
  execution?: WorkflowExecutionState | null;
  graph?: WorkflowGraph | null;
  graphDigest?: string | null;
  immutablePublishedVersion?: boolean;
  replay?: ReplayBoundary;
  stateDiff?: StateDiffBoundary;
}): WorkflowDebuggerClosureState {
  const execution = input.execution || null;
  const graph = input.graph || null;
  if (!execution || !graph) return emptyState("No persisted workflow execution and graph version are available for node-level debugging.");

  const current = graph.nodes.find((node) => node.id === execution.currentNodeId) || null;
  const cards = {
    input: redactWorkflowDebuggerValue(execution.input, "input"),
    output: redactWorkflowDebuggerValue(execution.output, "output"),
    error: redactWorkflowDebuggerValue(execution.error, "error"),
  };
  const trace = execution.events.slice(-20).reverse().map((event) => ({
    eventId: event.id,
    type: event.type,
    at: event.at,
    nodeId: event.nodeId || null,
    output: redactWorkflowDebuggerValue(event.output, "output"),
    error: redactWorkflowDebuggerValue(event.error, "error"),
  }));
  const replay = input.replay || null;
  const stateDiff = input.stateDiff || null;
  const cardDoesNotExpose = (card: RedactedWorkflowValue, source: string | undefined) => {
    const normalized = source?.trim() || "";
    return !normalized || (card.state === "redacted" && !card.display.includes(normalized));
  };
  const checks = {
    graphVersionBound: execution.graphId === graph.id && execution.graphVersion === graph.version,
    graphDigestPresent: Boolean(input.graphDigest),
    immutableGraphVersion: input.immutablePublishedVersion === true,
    nodeLocated: Boolean(current),
    cardsRedacted:
      cardDoesNotExpose(cards.input, execution.input) &&
      cardDoesNotExpose(cards.output, execution.output) &&
      cardDoesNotExpose(cards.error, execution.error),
    failedStateCaptured: execution.status === "failed" && cards.error.state === "redacted",
    replayOmitsProtectedSideEffects: Boolean(replay?.copiedSideEffects === false),
    stateDiffPassed: Boolean(stateDiff?.status === "pass" && stateDiff.checks.breakpointPausedReplay),
  };
  const canResume = execution.status === "failed" && current?.resumePolicy !== "manual-review";
  const canContinue = execution.status === "paused-breakpoint";
  const canForkReplay = !["completed", "rejected"].includes(execution.status);
  const blockers = [
    ...(checks.graphVersionBound ? [] : ["Execution graph id/version does not match the resolved graph."]),
    ...(checks.graphDigestPresent ? [] : ["Resolved graph has no immutable digest."]),
    ...(checks.immutableGraphVersion ? [] : ["Debugger receipts require a published immutable graph version."]),
    ...(checks.nodeLocated ? [] : ["Current execution node cannot be located in this graph version."]),
    ...(checks.failedStateCaptured ? [] : ["No failed execution with a redacted error card is selected."]),
    ...(checks.replayOmitsProtectedSideEffects ? [] : ["No matching replay receipt proves protected side effects were omitted."]),
    ...(checks.stateDiffPassed ? [] : ["No matching state-diff receipt proves the replay stopped at a breakpoint."]),
    "Distributed checkpointer, production trace retention, browser workflow acceptance, and operator recovery review remain production HOLD gates.",
  ];
  const withoutDigest = {
    localStatus: blockers.length === 1 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    execution: { id: execution.id, status: execution.status, graphId: execution.graphId, graphVersion: execution.graphVersion },
    graph: { id: graph.id, version: graph.version, digest: input.graphDigest || "unavailable", immutablePublishedVersion: input.immutablePublishedVersion === true },
    node: current ? { id: current.id, label: current.label, kind: current.kind, sideEffect: current.sideEffect, resumePolicy: current.resumePolicy } : null,
    cards,
    trace,
    recovery: {
      canResume,
      canContinue,
      canForkReplay,
      reason: canResume ? "Failed replay-safe/idempotent node may resume under the existing operator boundary." : canContinue ? "Breakpoint is active; continue is operator-controlled." : current?.resumePolicy === "manual-review" ? "Manual-review node requires a new approval decision." : "Create a replay fork or select a failed execution to recover.",
    },
    replayBoundary: { replay, stateDiff },
    checks,
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function matchingBoundaries(executionId: string) {
  const replay = readWorkflowReplayEvidence().receipts.find((entry) => entry.sourceExecutionId === executionId) || null;
  const stateDiff = replay
    ? readWorkflowStateDiffEvidence().receipts.find((entry) => entry.sourceExecutionId === executionId && entry.replayExecutionId === replay.replayExecutionId) || null
    : null;
  return {
    replay: replay ? { id: replay.id, replayExecutionId: replay.replayExecutionId, copiedSideEffects: replay.copiedSideEffects } : null,
    stateDiff: stateDiff ? { id: stateDiff.id, status: stateDiff.status, checks: stateDiff.checks } : null,
  };
}

function currentState(executionId?: string) {
  const executions = readWorkflowExecutions().executions;
  const execution = executionId
    ? executions.find((entry) => entry.id === executionId) || null
    : executions.find((entry) => entry.status === "failed") || executions[0] || null;
  if (!execution) return emptyState("No persisted workflow execution is available for debugger inspection.");
  const record = readWorkflowGraphRegistry().records.find(
    (entry) => entry.graph.id === execution.graphId && entry.graph.version === execution.graphVersion,
  );
  const graph = record?.graph || resolveWorkflowGraph(execution.graphId, execution.graphVersion);
  return buildWorkflowDebuggerClosureState({
    execution,
    graph,
    graphDigest: record?.graphDigest || (graph ? digestWorkflowGraph(graph) : null),
    immutablePublishedVersion: record?.state === "published",
    ...matchingBoundaries(execution.id),
  });
}

export function runWorkflowDebuggerClosureRehearsal() {
  const graph = resolveWorkflowGraph("agent-protected-tool-resume", 1);
  if (!graph) throw new Error("Protected workflow graph version is unavailable.");
  const source = createPersistedWorkflowExecution(
    "v1.10.5 debugger rehearsal: Authorization: Bearer local-demo-input-token",
    graph,
  );
  dispatchPersistedWorkflowEvent(source.id, { type: "start" });
  const failed = dispatchPersistedWorkflowEvent(source.id, {
    type: "failed",
    error: "Debugger rehearsal captured Authorization: Bearer local-demo-error-token at the input node.",
  });
  const replayResult = forkWorkflowExecutionForReplay({ sourceExecutionId: failed.id });
  const stateDiff = rehearseWorkflowStateDiff({
    sourceExecutionId: failed.id,
    replayExecutionId: replayResult.replay.id,
  });
  const state = currentState(failed.id);
  const withoutDigest = {
    id: `workflow-debugger-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: WorkflowDebuggerClosureReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return { receipt, source: failed, replay: replayResult.replay, stateDiff };
}

export function readWorkflowDebuggerClosureEvidence(executionId?: string) {
  const current = currentState(executionId);
  const receipts = readDurableReceipts<WorkflowDebuggerClosureReceipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: WORKFLOW_DEBUGGER_CLOSURE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
