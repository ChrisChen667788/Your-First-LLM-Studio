import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import crypto from "crypto";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import type { AgentRetrievalSummary } from "@/lib/agent/types";
import type {
  RetrievalCitationDiagnostic,
  RetrievalCitationDiagnosticSeverity,
  RetrievalQueryReplayEntry,
  RetrievalQueryReplaySummary,
} from "@/features/retrieval/contracts";

const RETRIEVAL_QUERY_REPLAY_SCHEMA_VERSION = "retrieval.query-replay.v1" as const;
const REPLAY_FILE = getLocalAgentDataPath("retrieval-query-replays.json");
const MAX_REPLAY_ENTRIES = 120;

type ReplayStoreFile = {
  schemaVersion: typeof RETRIEVAL_QUERY_REPLAY_SCHEMA_VERSION;
  updatedAt: string;
  entries: RetrievalQueryReplayEntry[];
};

function ensureDirectory() {
  mkdirSync(path.dirname(REPLAY_FILE), { recursive: true });
}

function readStore(): ReplayStoreFile {
  if (!existsSync(REPLAY_FILE)) {
    return {
      schemaVersion: RETRIEVAL_QUERY_REPLAY_SCHEMA_VERSION,
      updatedAt: new Date(0).toISOString(),
      entries: [],
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(REPLAY_FILE, "utf8")) as Partial<ReplayStoreFile>;
    return {
      schemaVersion: RETRIEVAL_QUERY_REPLAY_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      entries: Array.isArray(parsed.entries) ? parsed.entries.filter(isReplayEntry) : [],
    };
  } catch {
    return {
      schemaVersion: RETRIEVAL_QUERY_REPLAY_SCHEMA_VERSION,
      updatedAt: new Date(0).toISOString(),
      entries: [],
    };
  }
}

function writeStore(entries: RetrievalQueryReplayEntry[]) {
  ensureDirectory();
  const sorted = entries
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-MAX_REPLAY_ENTRIES);
  writeFileSync(
    REPLAY_FILE,
    `${JSON.stringify(
      {
        schemaVersion: RETRIEVAL_QUERY_REPLAY_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        entries: sorted,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function isReplayEntry(value: unknown): value is RetrievalQueryReplayEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as RetrievalQueryReplayEntry;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.query === "string" &&
    typeof candidate.hitCount === "number" &&
    Array.isArray(candidate.results) &&
    Array.isArray(candidate.diagnostics)
  );
}

function diagnostic(input: {
  label: string;
  severity: RetrievalCitationDiagnosticSeverity;
  scope: RetrievalCitationDiagnostic["scope"];
  reason: string;
  detail: string;
  citationLabel?: string;
  chunkId?: string;
}): RetrievalCitationDiagnostic {
  return {
    id: crypto.randomUUID(),
    ...input,
  };
}

export function buildRetrievalCitationDiagnostics(
  retrieval: AgentRetrievalSummary,
): RetrievalCitationDiagnostic[] {
  const diagnostics: RetrievalCitationDiagnostic[] = [];

  if (!retrieval.hitCount) {
    diagnostics.push(
      diagnostic({
        label: "no-evidence",
        severity: "fail",
        scope: "query",
        reason: "no-retrieval-hits",
        detail: "The query returned no evidence, so generated answers must avoid fabricated citations.",
      }),
    );
    return diagnostics;
  }

  diagnostics.push(
    diagnostic({
      label: retrieval.lowConfidence ? "low-confidence" : "citation-required",
      severity: retrieval.lowConfidence ? "watch" : "ok",
      scope: "query",
      reason: retrieval.lowConfidence ? "weak-top-hit" : "grounded-evidence-available",
      detail: retrieval.lowConfidence
        ? "Top evidence is below the grounding threshold; answers should caveat claims or ask for narrower context."
        : "Evidence is strong enough that grounded answers should cite the returned labels inline.",
    }),
  );

  for (const result of retrieval.results) {
    const weakScore = result.score < 34 || result.confidence < 0.36;
    const missingSource = !result.source;
    const missingPreview = !result.evidencePreview && !result.evidenceSpans?.length;
    if (weakScore) {
      diagnostics.push(
        diagnostic({
          label: "weak-citation",
          severity: "watch",
          scope: "citation",
          citationLabel: result.citationLabel,
          chunkId: result.chunkId,
          reason: "low-score-or-confidence",
          detail: `${result.citationLabel} has score ${result.score.toFixed(2)} and confidence ${result.confidence.toFixed(2)}.`,
        }),
      );
    }
    if (missingSource) {
      diagnostics.push(
        diagnostic({
          label: "missing-source",
          severity: "watch",
          scope: "citation",
          citationLabel: result.citationLabel,
          chunkId: result.chunkId,
          reason: "source-metadata-missing",
          detail: `${result.citationLabel} can be cited, but its source path or URL is missing.`,
        }),
      );
    }
    if (missingPreview) {
      diagnostics.push(
        diagnostic({
          label: "missing-preview",
          severity: "watch",
          scope: "citation",
          citationLabel: result.citationLabel,
          chunkId: result.chunkId,
          reason: "evidence-preview-missing",
          detail: `${result.citationLabel} has no compact evidence preview; use expanded mode before publishing.`,
        }),
      );
    }
    if (!weakScore && !missingSource && !missingPreview) {
      diagnostics.push(
        diagnostic({
          label: "citation-ready",
          severity: "ok",
          scope: "citation",
          citationLabel: result.citationLabel,
          chunkId: result.chunkId,
          reason: "ready-for-grounded-answer",
          detail: `${result.citationLabel} has score, source, and preview metadata for inline citation.`,
        }),
      );
    }
  }

  return diagnostics;
}

function buildReplayEntry(input: {
  id?: string;
  retrieval: AgentRetrievalSummary;
}): RetrievalQueryReplayEntry {
  const retrieval = input.retrieval;
  return {
    id: input.id || `retrieval-query-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    query: retrieval.query,
    scope: retrieval.scope,
    sourcePreference: retrieval.sourcePreference,
    evidenceMode: retrieval.evidenceMode,
    hitCount: retrieval.hitCount,
    lowConfidence: retrieval.lowConfidence,
    topScore: retrieval.topScore,
    strategy: retrieval.strategy,
    candidateCount: retrieval.candidateCount,
    vectorCandidateCount: retrieval.vectorCandidateCount,
    reranked: retrieval.reranked,
    embeddingModel: retrieval.embeddingModel,
    indexGeneratedAt: retrieval.indexGeneratedAt,
    sourceBreakdown: retrieval.sourceBreakdown,
    stageNotes: retrieval.stageNotes,
    diagnostics: buildRetrievalCitationDiagnostics(retrieval),
    results: retrieval.results.map((result) => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      title: result.title,
      source: result.source,
      citationLabel: result.citationLabel,
      score: result.score,
      confidence: result.confidence,
      sectionPath: result.sectionPath,
      matchedTerms: result.matchedTerms,
      evidencePreview: result.evidencePreview,
    })),
    retrieval,
  };
}

export function appendRetrievalQueryReplay(input: {
  id?: string;
  retrieval: AgentRetrievalSummary;
}) {
  const store = readStore();
  const entry = buildReplayEntry(input);
  writeStore([...store.entries.filter((item) => item.id !== entry.id), entry]);
  return entry;
}

export function readRetrievalQueryReplaySummary(options?: {
  limit?: number;
}): RetrievalQueryReplaySummary {
  const limit = Math.max(1, Math.min(options?.limit || 30, MAX_REPLAY_ENTRIES));
  const store = readStore();
  const entries = store.entries
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
  const allDiagnostics = entries.flatMap((entry) => entry.diagnostics);
  const latestEntry = entries[0] || null;
  return {
    ok: true,
    schemaVersion: RETRIEVAL_QUERY_REPLAY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    path: REPLAY_FILE,
    entries,
    totals: {
      entryCount: store.entries.length,
      replayableCount: store.entries.filter((entry) => entry.hitCount > 0).length,
      diagnosticLabelCount: allDiagnostics.length,
      okLabelCount: allDiagnostics.filter((item) => item.severity === "ok").length,
      watchLabelCount: allDiagnostics.filter((item) => item.severity === "watch").length,
      failLabelCount: allDiagnostics.filter((item) => item.severity === "fail").length,
      latestEntryId: latestEntry?.id || null,
      latestQuery: latestEntry?.query || null,
    },
  };
}
