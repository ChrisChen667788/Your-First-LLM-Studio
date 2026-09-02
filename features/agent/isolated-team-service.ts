import { createHash } from "node:crypto";
import path from "node:path";

export const ISOLATED_AGENT_TEAM_SCHEMA_VERSION =
  "agent.isolated-team-plan.v1" as const;

export type TeamAgentPlan = {
  id: string;
  role: string;
  workspacePath: string;
  branchName: string;
  tokenBudget: number;
  timeBudgetSeconds: number;
  claimedFiles: string[];
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildIsolatedAgentTeamPlan(input: {
  teamId: string;
  repositoryRoot: string;
  agents: TeamAgentPlan[];
}) {
  const normalizedRoot = path.resolve(input.repositoryRoot);
  const workspacePaths = input.agents.map((agent) => path.resolve(agent.workspacePath));
  const branchNames = input.agents.map((agent) => agent.branchName.trim());
  const fileOwners = new Map<string, string[]>();
  for (const agent of input.agents) {
    for (const file of agent.claimedFiles) {
      const normalized = path.resolve(normalizedRoot, file);
      fileOwners.set(normalized, [...(fileOwners.get(normalized) || []), agent.id]);
    }
  }
  const conflicts = [...fileOwners.entries()]
    .filter(([, owners]) => new Set(owners).size > 1)
    .map(([file, owners]) => ({ file, agents: [...new Set(owners)] }));
  const checks = {
    atLeastTwoAgents: input.agents.length >= 2,
    uniqueAgentIds: new Set(input.agents.map((agent) => agent.id)).size === input.agents.length,
    isolatedWorkspaces: new Set(workspacePaths).size === workspacePaths.length && workspacePaths.every((entry) => entry !== normalizedRoot),
    isolatedBranches: branchNames.every(Boolean) && new Set(branchNames).size === branchNames.length,
    boundedBudgets: input.agents.every(
      (agent) => agent.tokenBudget > 0 && agent.timeBudgetSeconds > 0,
    ),
    claimsReviewable: input.agents.every((agent) => agent.claimedFiles.length > 0),
  };
  const mergePolicy = conflicts.length
    ? "review-required" as const
    : "independent-merge-eligible" as const;
  const withoutDigest = {
    schemaVersion: ISOLATED_AGENT_TEAM_SCHEMA_VERSION,
    teamId: input.teamId,
    agents: input.agents,
    checks,
    conflicts,
    mergePolicy,
    dispatchAllowed: Object.values(checks).every(Boolean),
    automaticMergeAllowed: Object.values(checks).every(Boolean) && conflicts.length === 0,
  };
  return { ...withoutDigest, planDigest: digest(withoutDigest) };
}

export function readIsolatedAgentTeamEvidence() {
  const plan = buildIsolatedAgentTeamPlan({
    teamId: "reference-team",
    repositoryRoot: "/workspace/repository",
    agents: [
      {
        id: "agent-source",
        role: "source-review",
        workspacePath: "/workspace/worktrees/source",
        branchName: "codex/source-review",
        tokenBudget: 12_000,
        timeBudgetSeconds: 900,
        claimedFiles: ["features/competitive/source-registry.ts"],
      },
      {
        id: "agent-evidence",
        role: "evidence-review",
        workspacePath: "/workspace/worktrees/evidence",
        branchName: "codex/evidence-review",
        tokenBudget: 12_000,
        timeBudgetSeconds: 900,
        claimedFiles: ["features/experiments/competitive-product-train.ts"],
      },
    ],
  });
  return {
    ok: true as const,
    ...plan,
    sourceStatus: "pass" as const,
    localStatus: plan.automaticMergeAllowed ? "pass" as const : "hold" as const,
    productionStatus: "hold" as const,
    disclosure:
      "The isolation, budget, ownership, and conflict contracts are implemented. Separate-worker dispatch, failure recovery, and repository merge receipts remain deployment evidence.",
  };
}
