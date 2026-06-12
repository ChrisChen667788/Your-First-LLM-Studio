import type {
  AgentCacheMode,
  AgentConnectionCheckResponse,
  AgentGroundedVerification,
  AgentMessage,
  AgentProviderProfile,
  AgentRetrievalSummary,
  AgentThinkingMode,
  AgentToolRun,
} from "@/lib/agent/types";

export const SESSIONS_STORAGE_KEY = "agent-workbench:sessions:v1";
export const MAX_STORED_SESSIONS = 12;

const AGENT_SESSION_EXPORT_SCHEMA_VERSION = "0.2.1";

const PROVIDER_PROFILE_OPTIONS: AgentProviderProfile[] = [
  "speed",
  "balanced",
  "tool-first",
];
const THINKING_MODE_OPTIONS: AgentThinkingMode[] = ["standard", "thinking"];

export type AgentTurn = {
  id: string;
  kind?: "chat" | "check";
  targetId: string;
  prompt: string;
  displayPrompt?: string;
  response: string;
  providerLabel: string;
  targetLabel: string;
  resolvedModel: string;
  resolvedBaseUrl: string;
  providerProfile?: AgentProviderProfile;
  thinkingMode?: AgentThinkingMode;
  thinkingFallbackToStandard?: boolean;
  localFallbackUsed?: boolean;
  localFallbackTargetId?: string;
  localFallbackTargetLabel?: string;
  localFallbackReason?: string;
  cacheHit?: boolean;
  cacheMode?: AgentCacheMode;
  plannerSteps?: string[];
  memorySummary?: string;
  retrieval?: AgentRetrievalSummary;
  verification?: AgentGroundedVerification;
  toolRuns: AgentToolRun[];
  warning?: string;
  connectionCheck?: AgentConnectionCheckResponse;
  replaySource?: {
    turnId: string;
    targetId: string;
    targetLabel: string;
    resolvedModel: string;
    response: string;
    includeHistory: boolean;
    targetMode: "original" | "current";
  };
};

export type StoredAgentSession = {
  id: string;
  title: string;
  updatedAt: string;
  pinned?: boolean;
  selectedTargetId: string;
  enableTools: boolean;
  enableRetrieval: boolean;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  input: string;
  systemPrompt: string;
  turns: AgentTurn[];
  connectionChecksByTargetId: Record<string, AgentConnectionCheckResponse>;
};

export type AgentSessionExportScope = "visible" | "pinned";

export type AgentSessionExportOptions = {
  scope: AgentSessionExportScope;
  sessionTargetFilter: string;
  sessionSearch: string;
};

export function sortSessions(sessions: StoredAgentSession[]) {
  return [...sessions].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function normalizeProviderProfile(input: unknown): AgentProviderProfile {
  return PROVIDER_PROFILE_OPTIONS.includes(input as AgentProviderProfile)
    ? (input as AgentProviderProfile)
    : "balanced";
}

function normalizeThinkingMode(input: unknown): AgentThinkingMode {
  return THINKING_MODE_OPTIONS.includes(input as AgentThinkingMode)
    ? (input as AgentThinkingMode)
    : "standard";
}

export function normalizeStoredSessions(input: unknown): StoredAgentSession[] {
  if (!Array.isArray(input)) return [];
  return sortSessions(
    input.flatMap((session) => {
      if (!session || typeof session !== "object") return [];
      const candidate = session as Partial<StoredAgentSession>;
      if (
        typeof candidate.id !== "string" ||
        typeof candidate.updatedAt !== "string"
      ) {
        return [];
      }

      return [
        {
          id: candidate.id,
          title:
            typeof candidate.title === "string"
              ? candidate.title
              : "New session",
          updatedAt: candidate.updatedAt,
          pinned: Boolean(candidate.pinned),
          selectedTargetId:
            typeof candidate.selectedTargetId === "string"
              ? candidate.selectedTargetId
              : "anthropic-claude",
          enableTools: Boolean(candidate.enableTools),
          enableRetrieval: Boolean(candidate.enableRetrieval),
          contextWindow:
            typeof candidate.contextWindow === "number"
              ? candidate.contextWindow
              : 32768,
          providerProfile: normalizeProviderProfile(candidate.providerProfile),
          thinkingMode: normalizeThinkingMode(candidate.thinkingMode),
          input: typeof candidate.input === "string" ? candidate.input : "",
          systemPrompt:
            typeof candidate.systemPrompt === "string"
              ? candidate.systemPrompt
              : "",
          turns: Array.isArray(candidate.turns)
            ? (candidate.turns as AgentTurn[])
            : [],
          connectionChecksByTargetId:
            candidate.connectionChecksByTargetId &&
            typeof candidate.connectionChecksByTargetId === "object"
              ? (candidate.connectionChecksByTargetId as Record<
                  string,
                  AgentConnectionCheckResponse
                >)
              : {},
        },
      ];
    }),
  ).slice(0, MAX_STORED_SESSIONS);
}

export function mergeStoredSessions(
  localSessions: StoredAgentSession[],
  remoteSessions: StoredAgentSession[],
) {
  const merged = new Map<string, StoredAgentSession>();
  for (const session of [...localSessions, ...remoteSessions]) {
    const existing = merged.get(session.id);
    if (!existing || session.updatedAt >= existing.updatedAt) {
      merged.set(session.id, session);
    }
  }
  return sortSessions([...merged.values()]).slice(0, MAX_STORED_SESSIONS);
}

export function filterSessionsForExport(
  sessions: StoredAgentSession[],
  options: AgentSessionExportOptions,
) {
  const normalizedSearch = options.sessionSearch.trim().toLowerCase();
  return sortSessions(
    sessions.filter((session) => {
      if (options.scope === "pinned") return Boolean(session.pinned);
      if (
        options.sessionTargetFilter !== "all" &&
        session.selectedTargetId !== options.sessionTargetFilter
      ) {
        return false;
      }
      if (!normalizedSearch) return true;
      return (
        session.title.toLowerCase().includes(normalizedSearch) ||
        session.selectedTargetId.toLowerCase().includes(normalizedSearch)
      );
    }),
  );
}

export function buildSessionExportEnvelope(
  sessions: StoredAgentSession[],
  options: AgentSessionExportOptions,
) {
  return {
    kind: "agent-session-export",
    schemaVersion: AGENT_SESSION_EXPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    filters: {
      scope: options.scope,
      sessionTargetFilter: options.sessionTargetFilter,
      sessionSearch: options.sessionSearch,
    },
    sessions,
  };
}

export function createSessionTitle(
  turns: AgentTurn[],
  fallback = "New session",
) {
  const firstPrompt =
    turns.find((turn) => turn.kind !== "check")?.displayPrompt ||
    turns.find((turn) => turn.kind !== "check")?.prompt ||
    fallback;
  const normalized = firstPrompt.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > 64 ? `${normalized.slice(0, 61)}...` : normalized;
}

export function flattenTurns(turns: AgentTurn[]): AgentMessage[] {
  return turns
    .filter((turn) => turn.kind !== "check")
    .flatMap((turn) => [
      { role: "user" as const, content: turn.prompt },
      { role: "assistant" as const, content: turn.response },
    ])
    .filter((message) => message.content.trim());
}

function formatOptionalLine(label: string, value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return `- ${label}: ${String(value)}`;
}

export function buildTurnMarkdownLines(turn: AgentTurn) {
  const lines = [
    `### ${turn.displayPrompt || turn.prompt || "Turn"}`,
    "",
    `- Target: ${turn.targetLabel} (${turn.targetId})`,
    `- Provider: ${turn.providerLabel}`,
    `- Model: ${turn.resolvedModel}`,
    formatOptionalLine("Profile", turn.providerProfile),
    formatOptionalLine("Thinking", turn.thinkingMode),
    formatOptionalLine("Cache", turn.cacheHit ? turn.cacheMode || "hit" : null),
    formatOptionalLine("Warning", turn.warning),
    "",
    "#### Prompt",
    "",
    turn.prompt || "_No prompt captured._",
    "",
    "#### Response",
    "",
    turn.response || "_No response captured._",
  ].filter((line): line is string => line !== null);

  if (turn.toolRuns.length) {
    lines.push("", "#### Tool Runs", "");
    for (const toolRun of turn.toolRuns) {
      lines.push(`- ${toolRun.name}`);
    }
  }

  if (turn.retrieval?.results.length) {
    lines.push("", "#### Retrieval", "");
    for (const hit of turn.retrieval.results.slice(0, 5)) {
      lines.push(`- ${hit.citationLabel}: ${hit.title}`);
    }
  }

  return lines;
}

export function serializeTurnsAsMarkdown(turns: AgentTurn[]) {
  return turns
    .flatMap((turn, index) => [
      index === 0 ? null : "",
      ...buildTurnMarkdownLines(turn),
    ])
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function serializeSessionsAsMarkdown(sessions: StoredAgentSession[]) {
  const lines = [
    "# Agent Sessions Export",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Session count: ${sessions.length}`,
  ];

  for (const session of sessions) {
    lines.push(
      "",
      `## ${session.title}`,
      "",
      `- Session ID: ${session.id}`,
      `- Updated: ${session.updatedAt}`,
      `- Target: ${session.selectedTargetId}`,
      `- Pinned: ${session.pinned ? "yes" : "no"}`,
      "",
    );
    const markdown = serializeTurnsAsMarkdown(session.turns);
    lines.push(markdown || "_No turns captured._");
  }

  return lines.join("\n");
}
