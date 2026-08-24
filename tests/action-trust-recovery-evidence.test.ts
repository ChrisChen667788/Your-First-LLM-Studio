import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentActionTrustRecoveryState } from "@/features/agent/action-trust-recovery-evidence";

test("action trust requires interruption, duplicate suppression, replay, and state diff", () => {
  const passing = buildAgentActionTrustRecoveryState({
    shadow: { summary: { passingRuns: 1, duplicateSideEffects: 0 } },
    replay: { latestPassing: { id: "replay-1", copiedSideEffects: false } },
    stateDiff: { latestPassing: { id: "diff-1", checks: { breakpointPausedReplay: true } } },
  } as Parameters<typeof buildAgentActionTrustRecoveryState>[0]);
  const held = buildAgentActionTrustRecoveryState({
    shadow: { summary: { passingRuns: 0, duplicateSideEffects: 1 } },
    replay: { latestPassing: null },
    stateDiff: { latestPassing: null },
  } as Parameters<typeof buildAgentActionTrustRecoveryState>[0]);

  assert.equal(passing.localStatus, "pass");
  assert.equal(passing.productionStatus, "hold");
  assert.equal(passing.checks.replayForkOmitsSideEffects, true);
  assert.equal(held.localStatus, "hold");
  assert.equal(held.checks.noDuplicateSideEffects, false);
  assert.ok(held.blockers.some((blocker) => blocker.includes("duplicate side effects")));
});
