import assert from "node:assert/strict";
import test from "node:test";

import { buildRagGovernanceState, canReadGovernedRetrievalDocument } from "@/features/retrieval/rag-governance-evidence";

function fixture(enterpriseConfigured = true) {
  return {
    enterprise: { status: enterpriseConfigured ? "configured" as const : "blocked" as const, capabilities: { acl: "postgres-rls-subject-groups" } },
    replay: { totals: { entryCount: 2, replayableCount: 2, latestEntryId: "replay-2" } },
    rehearsal: { id: "rehearsal-1", generatedAt: "2026-08-21T00:00:00.000Z", corpus: { documentId: "doc-1", revisionDigest: "sha256:fixture" }, replayIds: { golden: "golden-1", deletion: "delete-1" }, checks: { corpusRevisionBound: true, goldenQueryGrounded: true, citationsDiagnosed: true, deletionPropagatedToLocalIndex: true, crossWorkspaceDenied: true, unauthorizedSubjectDenied: true, authorizedPrincipalAllowed: true } },
    now: Date.parse("2026-08-21T01:00:00.000Z"),
  };
}

test("RAG governance requires corpus lifecycle, citations, leakage probes, and enterprise dependencies", () => {
  const state = buildRagGovernanceState(fixture() as Parameters<typeof buildRagGovernanceState>[0]);
  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "hold");
  assert.equal(state.checks.deletionPropagatedToLocalIndex, true);
  assert.equal(state.checks.freshnessWithinWindow, true);
});

test("cross-workspace and unauthorized subjects fail closed, while an allowed subject can read", () => {
  const document = { workspaceId: "workspace-a", allowedSubjects: ["subject-a"], allowedGroups: ["group-a"] };
  assert.equal(canReadGovernedRetrievalDocument({ workspaceId: "workspace-b", subjectId: "subject-a", groupIds: ["group-a"] }, document), false);
  assert.equal(canReadGovernedRetrievalDocument({ workspaceId: "workspace-a", subjectId: "subject-b", groupIds: ["group-b"] }, document), false);
  assert.equal(canReadGovernedRetrievalDocument({ workspaceId: "workspace-a", subjectId: "subject-a", groupIds: [] }, document), true);
  const blocked = buildRagGovernanceState(fixture(false) as Parameters<typeof buildRagGovernanceState>[0]);
  assert.equal(blocked.localStatus, "hold");
});
