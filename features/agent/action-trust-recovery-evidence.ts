import { createHash, randomUUID } from "node:crypto";

import { runLangGraphProtectedToolShadow, readLangGraphShadowEvidence } from "@/features/workflows/langgraph-shadow-service";
import { readWorkflowReplayEvidence } from "@/features/workflows/replay-service";
import { readWorkflowStateDiffEvidence } from "@/features/workflows/state-diff";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const AGENT_ACTION_TRUST_RECOVERY_SCHEMA_VERSION =
  "agent.action-trust-recovery.v1" as const;
const STORE_SCHEMA_VERSION = "agent.action-trust-recovery-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("agent", "action-trust-recovery.json");

type Status = "pass" | "hold";
type Inputs = {
  shadow: ReturnType<typeof readLangGraphShadowEvidence>;
  replay: ReturnType<typeof readWorkflowReplayEvidence>;
  stateDiff: ReturnType<typeof readWorkflowStateDiffEvidence>;
};

export type AgentActionTrustRecoveryState = {
  localStatus: Status;
  productionStatus: "hold";
  checks: {
    protectedActionInterrupted: boolean;
    noDuplicateSideEffects: boolean;
    replayForkOmitsSideEffects: boolean;
    breakpointStateDiffPassed: boolean;
  };
  summary: {
    shadowPassingRuns: number;
    duplicateSideEffects: number;
    replayReceiptId: string | null;
    stateDiffReceiptId: string | null;
  };
  blockers: string[];
  stateDigest: string;
};

type Receipt = AgentActionTrustRecoveryState & {
  id: string;
  generatedAt: string;
  evidenceDigest: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildAgentActionTrustRecoveryState(input: Inputs): AgentActionTrustRecoveryState {
  const checks = {
    protectedActionInterrupted: input.shadow.summary.passingRuns > 0,
    noDuplicateSideEffects: input.shadow.summary.duplicateSideEffects === 0,
    replayForkOmitsSideEffects: Boolean(input.replay.latestPassing?.copiedSideEffects === false),
    breakpointStateDiffPassed: Boolean(input.stateDiff.latestPassing?.checks.breakpointPausedReplay),
  };
  const blockers = [
    ...(checks.protectedActionInterrupted ? [] : ["No passing protected-action interruption receipt is available."]),
    ...(checks.noDuplicateSideEffects ? [] : ["Protected-action shadow evidence contains duplicate side effects."]),
    ...(checks.replayForkOmitsSideEffects ? [] : ["No replay-fork receipt proves side effects were omitted."]),
    ...(checks.breakpointStateDiffPassed ? [] : ["No breakpoint state-diff receipt proves replay remained side-effect-free."]),
    "Multi-client streaming reconnect, real protected-tool execution, human approval usability, and billing/quota reconciliation remain external HOLD gates.",
  ];
  const withoutDigest = {
    localStatus: blockers.length === 1 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    checks,
    summary: {
      shadowPassingRuns: input.shadow.summary.passingRuns,
      duplicateSideEffects: input.shadow.summary.duplicateSideEffects,
      replayReceiptId: input.replay.latestPassing?.id || null,
      stateDiffReceiptId: input.stateDiff.latestPassing?.id || null,
    },
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState() {
  return buildAgentActionTrustRecoveryState({
    shadow: readLangGraphShadowEvidence(),
    replay: readWorkflowReplayEvidence(),
    stateDiff: readWorkflowStateDiffEvidence(),
  });
}

export async function runAgentActionTrustRecoveryAcceptance() {
  const shadowReceipt = await runLangGraphProtectedToolShadow({ approve: true });
  const state = readCurrentState();
  const withoutDigest = {
    id: `agent-action-trust-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: Receipt = { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return { shadowReceipt, receipt };
}

export function readAgentActionTrustRecoveryEvidence() {
  const receipts = readDurableReceipts<Receipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const current = readCurrentState();
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: AGENT_ACTION_TRUST_RECOVERY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
