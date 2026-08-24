import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkflowDebuggerClosureState,
  redactWorkflowDebuggerValue,
} from "@/features/workflows/debugger-closure-evidence";
import {
  WORKFLOW_GRAPH_SCHEMA_VERSION,
  type WorkflowGraph,
} from "@/features/workflows/graph-contract";
import {
  WORKFLOW_EXECUTION_SCHEMA_VERSION,
  type WorkflowExecutionState,
} from "@/features/workflows/execution-reducer";

const graph: WorkflowGraph = {
  schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
  id: "debugger-fixture",
  version: 1,
  label: "Debugger fixture",
  nodes: [
    { id: "input", kind: "input", label: "Input", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
    { id: "output", kind: "output", label: "Output", config: {}, sideEffect: "none", resumePolicy: "replay-safe" },
  ],
  edges: [{ from: "input", to: "output" }],
};

const execution: WorkflowExecutionState = {
  schemaVersion: WORKFLOW_EXECUTION_SCHEMA_VERSION,
  id: "debugger-fixture-run",
  graphId: graph.id,
  graphVersion: graph.version,
  status: "failed",
  currentNodeId: "input",
  completedNodeIds: [],
  usedIdempotencyKeys: [],
  input: "Authorization: Bearer input-demo-secret",
  error: "Authorization: Bearer error-demo-secret failed at input",
  events: [{ id: "event-1", type: "failed", at: "2026-08-21T00:00:00.000Z", nodeId: "input", error: "Authorization: Bearer event-demo-secret" }],
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

test("debugger cards retain digest locators without exposing captured secrets", () => {
  const card = redactWorkflowDebuggerValue(execution.error, "error");
  assert.equal(card.state, "redacted");
  assert.ok(card.digest?.startsWith("sha256:"));
  assert.equal(card.display.includes("error-demo-secret"), false);
  assert.deepEqual(card.classifications, ["bearer-token"]);
});

test("node locator only passes with matching graph, replay fork, and breakpoint state diff", () => {
  const state = buildWorkflowDebuggerClosureState({
    execution,
    graph,
    graphDigest: "sha256:fixture",
    immutablePublishedVersion: true,
    replay: { id: "replay-1", replayExecutionId: "replay-run-1", copiedSideEffects: false },
    stateDiff: { id: "diff-1", status: "pass", checks: { breakpointPausedReplay: true } },
  });

  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "hold");
  assert.equal(state.node?.id, "input");
  assert.equal(state.recovery.canResume, true);
  assert.equal(state.cards.input.display.includes("input-demo-secret"), false);

  const draftVersion = buildWorkflowDebuggerClosureState({
    execution,
    graph,
    graphDigest: "sha256:fixture",
    immutablePublishedVersion: false,
    replay: { id: "replay-1", replayExecutionId: "replay-run-1", copiedSideEffects: false },
    stateDiff: { id: "diff-1", status: "pass", checks: { breakpointPausedReplay: true } },
  });
  assert.equal(draftVersion.localStatus, "hold");
  assert.ok(draftVersion.blockers.some((blocker) => blocker.includes("published immutable graph")));
});
