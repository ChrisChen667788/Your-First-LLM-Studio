import { createHash } from "node:crypto";

export const AGENT_HARNESS_CONFORMANCE_SCHEMA_VERSION =
  "agent.harness-conformance.v1" as const;

export type AgentHarnessEvent = {
  id: string;
  type:
    | "turn-started"
    | "tool-requested"
    | "approval-required"
    | "approval-resolved"
    | "tool-completed"
    | "turn-resumed"
    | "turn-cancelled"
    | "branch-created"
    | "usage-recorded";
  idempotencyKey?: string;
  parentTurnId?: string;
  promptTokens?: number;
  completionTokens?: number;
};

export type AgentHarnessScenario = {
  id: string;
  events: AgentHarnessEvent[];
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function ordered(events: AgentHarnessEvent[], before: AgentHarnessEvent["type"], after: AgentHarnessEvent["type"]) {
  const beforeIndex = events.findIndex((event) => event.type === before);
  const afterIndex = events.findIndex((event) => event.type === after);
  return beforeIndex >= 0 && afterIndex > beforeIndex;
}

export function evaluateAgentHarnessScenario(scenario: AgentHarnessScenario) {
  const toolEffects = scenario.events.filter((event) => event.type === "tool-completed");
  const effectKeys = toolEffects.map((event) => event.idempotencyKey).filter(Boolean);
  const usage = scenario.events.filter((event) => event.type === "usage-recorded");
  const checks = {
    toolLifecycle:
      !scenario.events.some((event) => event.type === "tool-requested") ||
      ordered(scenario.events, "tool-requested", "tool-completed"),
    approvalBeforeProtectedEffect:
      !scenario.events.some((event) => event.type === "approval-required") ||
      (ordered(scenario.events, "approval-required", "approval-resolved") &&
        ordered(scenario.events, "approval-resolved", "tool-completed")),
    resumable:
      !scenario.events.some((event) => event.type === "approval-resolved") ||
      scenario.events.some((event) => event.type === "turn-resumed"),
    cancellationTerminal:
      !scenario.events.some((event) => event.type === "turn-cancelled") ||
      scenario.events.at(-1)?.type === "turn-cancelled",
    idempotentEffects:
      effectKeys.length === new Set(effectKeys).size &&
      toolEffects.every((event) => Boolean(event.idempotencyKey)),
    branchLinked:
      scenario.events
        .filter((event) => event.type === "branch-created")
        .every((event) => Boolean(event.parentTurnId)),
    usageAccounted:
      usage.length > 0 &&
      usage.every(
        (event) =>
          Number.isFinite(event.promptTokens) &&
          Number.isFinite(event.completionTokens) &&
          (event.promptTokens || 0) >= 0 &&
          (event.completionTokens || 0) >= 0,
      ),
  };
  return {
    scenarioId: scenario.id,
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}

function referenceScenarios(): AgentHarnessScenario[] {
  return [
    {
      id: "protected-tool-resume",
      events: [
        { id: "e1", type: "turn-started" },
        { id: "e2", type: "tool-requested" },
        { id: "e3", type: "approval-required" },
        { id: "e4", type: "approval-resolved" },
        { id: "e5", type: "turn-resumed" },
        { id: "e6", type: "tool-completed", idempotencyKey: "effect-1" },
        { id: "e7", type: "usage-recorded", promptTokens: 40, completionTokens: 12 },
      ],
    },
    {
      id: "cancel-before-effect",
      events: [
        { id: "e1", type: "turn-started" },
        { id: "e2", type: "usage-recorded", promptTokens: 8, completionTokens: 0 },
        { id: "e3", type: "turn-cancelled" },
      ],
    },
    {
      id: "branch-and-account",
      events: [
        { id: "e1", type: "turn-started" },
        { id: "e2", type: "branch-created", parentTurnId: "turn-parent" },
        { id: "e3", type: "usage-recorded", promptTokens: 30, completionTokens: 20 },
      ],
    },
  ];
}

export function readAgentHarnessConformance() {
  const scenarios = referenceScenarios().map(evaluateAgentHarnessScenario);
  const withoutDigest = {
    ok: true as const,
    schemaVersion: AGENT_HARNESS_CONFORMANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass" as const,
    localStatus: scenarios.every((scenario) => scenario.passed) ? "pass" as const : "hold" as const,
    productionStatus: "hold" as const,
    scenarios,
    totals: {
      scenarios: scenarios.length,
      passed: scenarios.filter((scenario) => scenario.passed).length,
    },
    disclosure:
      "The shared harness contract is deterministic local evidence. Provider-specific streaming reconnect, real protected effects, and multi-client cancellation still require live receipts.",
  };
  return { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
}
