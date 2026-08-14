import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { decideWorkspaceAccess, type WorkspaceAction, type WorkspaceMembership, type WorkspaceResource, type WorkspaceRole } from "@/features/governance/workspace-identity";

export const GOVERNANCE_POLICY_SIMULATOR_SCHEMA_VERSION = "governance.policy-simulator.v1" as const;
type Scenario = { id: string; membership?: WorkspaceMembership; workspaceId: string; resource: WorkspaceResource; action: WorkspaceAction; expectedAllowed: boolean };
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; decisions: Array<Scenario & { allowed: boolean; matchedExpectation: boolean; reason: string }>; coverage: { roles: WorkspaceRole[]; actions: WorkspaceAction[]; crossWorkspace: boolean } };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "governance-policy-simulations.json");
function readReceipts(): Receipt[] { return readDurableReceipts(STORE_FILE, GOVERNANCE_POLICY_SIMULATOR_SCHEMA_VERSION); }
function persist(receipt: Receipt) { prependDurableReceipt(STORE_FILE, GOVERNANCE_POLICY_SIMULATOR_SCHEMA_VERSION, receipt, 100); }

function defaults(): Scenario[] {
  const membership = (role: WorkspaceRole): WorkspaceMembership => ({ subjectId: `${role}-user`, workspaceId: "workspace-a", role });
  return [
    { id: "owner-admin", membership: membership("owner"), workspaceId: "workspace-a", resource: "workflow", action: "admin", expectedAllowed: true },
    { id: "builder-execute", membership: membership("builder"), workspaceId: "workspace-a", resource: "workflow", action: "execute", expectedAllowed: true },
    { id: "builder-admin-denied", membership: membership("builder"), workspaceId: "workspace-a", resource: "dataset", action: "admin", expectedAllowed: false },
    { id: "viewer-read", membership: membership("viewer"), workspaceId: "workspace-a", resource: "knowledge", action: "read", expectedAllowed: true },
    { id: "viewer-write-denied", membership: membership("viewer"), workspaceId: "workspace-a", resource: "knowledge", action: "write", expectedAllowed: false },
    { id: "cross-workspace-denied", membership: membership("owner"), workspaceId: "workspace-b", resource: "adapter", action: "read", expectedAllowed: false },
    { id: "missing-membership-denied", workspaceId: "workspace-a", resource: "model", action: "read", expectedAllowed: false },
  ];
}

export function runGovernancePolicySimulation(scenarios: Scenario[] = defaults()) {
  if (!scenarios.length) throw new Error("At least one policy scenario is required.");
  const decisions = scenarios.map((scenario) => { const decision = decideWorkspaceAccess(scenario); return { ...scenario, allowed: decision.allowed, matchedExpectation: decision.allowed === scenario.expectedAllowed, reason: decision.reason }; });
  const receipt: Receipt = { id: `policy-simulation-${randomUUID()}`, generatedAt: new Date().toISOString(), status: decisions.every((entry) => entry.matchedExpectation) ? "pass" : "failed", decisions, coverage: { roles: [...new Set(decisions.flatMap((entry) => entry.membership?.role ? [entry.membership.role] : []))], actions: [...new Set(decisions.map((entry) => entry.action))], crossWorkspace: decisions.some((entry) => entry.membership && entry.membership.workspaceId !== entry.workspaceId) } };
  persist(receipt); return receipt;
}

export function readGovernancePolicySimulationEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: GOVERNANCE_POLICY_SIMULATOR_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, path: STORE_FILE }; }
