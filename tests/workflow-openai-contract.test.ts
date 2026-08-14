import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpenAIWorkflowCompletion,
  buildOpenAIWorkflowStream,
  normalizeWorkflowInvocation,
  WorkflowCompletionBoundaryError,
} from "@/features/workflows/deployment-application";
import { WORKFLOW_EXECUTION_SCHEMA_VERSION, type WorkflowExecutionState } from "@/features/workflows/execution-reducer";

function completedExecution(): WorkflowExecutionState {
  return {
    schemaVersion: WORKFLOW_EXECUTION_SCHEMA_VERSION,
    id: "workflow-run-contract-test",
    graphId: "retrieval-grounded-answer",
    graphVersion: 1,
    status: "completed",
    currentNodeId: "answer",
    completedNodeIds: ["question", "retrieve", "generate", "verify", "answer"],
    usedIdempotencyKeys: [],
    events: [],
    input: "What is the policy?",
    output: "The policy is grounded in the supplied evidence.",
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:01.000Z",
  };
}

test("workflow completion follows the OpenAI chat completion shape", () => {
  const completion = buildOpenAIWorkflowCompletion("retrieval-grounded-answer", completedExecution());
  assert.equal(completion.object, "chat.completion");
  assert.equal(completion.choices[0]?.message.role, "assistant");
  assert.equal(completion.choices[0]?.finish_reason, "stop");
  assert.ok(completion.usage.prompt_tokens > 0);
  assert.ok(completion.usage.completion_tokens > 0);
  assert.equal(completion.usage.total_tokens, completion.usage.prompt_tokens + completion.usage.completion_tokens);
});

test("workflow streaming emits standard chunks, optional usage, and DONE", () => {
  const stream = buildOpenAIWorkflowStream("retrieval-grounded-answer", completedExecution(), true);
  assert.match(stream, /"object":"chat\.completion\.chunk"/u);
  assert.match(stream, /"finish_reason":"stop"/u);
  assert.match(stream, /"usage":\{/u);
  assert.match(stream, /data: \[DONE\]\n\n$/u);
});

test("incomplete workflows fail with a durable resume boundary", () => {
  const waiting = { ...completedExecution(), status: "waiting-approval" as const };
  assert.throws(
    () => buildOpenAIWorkflowCompletion("protected-tool-resume", waiting),
    WorkflowCompletionBoundaryError,
  );
});

test("invocation normalization accepts user messages and streaming", () => {
  assert.deepEqual(
    normalizeWorkflowInvocation({
      model: "workflow:retrieval-grounded-answer",
      messages: [{ role: "user", content: "  answer this  " }],
      stream: true,
      stream_options: { include_usage: true },
    }),
    {
      input: "answer this",
      requestedModel: "workflow:retrieval-grounded-answer",
      openAICompatible: true,
      stream: true,
      includeStreamUsage: true,
    },
  );
});
