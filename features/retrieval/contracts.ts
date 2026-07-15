import type {
  AgentKnowledgeDocument,
  AgentRetrievalSummary,
} from "@/lib/agent/types";

export type RetrievalChunk = {
  id: string;
  documentId: string;
  title: string;
  source?: string;
  sectionPath: string[];
  order: number;
  content: string;
  charCount: number;
  tokenEstimate: number;
};

export type RetrievalSnapshot = {
  documents: AgentKnowledgeDocument[];
  chunks: RetrievalChunk[];
  stats: {
    documentCount: number;
    chunkCount: number;
    avgChunkChars: number;
    avgChunkTokens: number;
  };
  workspaceRoot?: string;
  recommendedImportPaths?: string[];
};

export type RetrievalPathInspection = {
  path: string;
  kind: "file" | "directory" | "other";
  recursive: boolean;
  totalFiles: number;
  importableCount: number;
  skippedCount: number;
  previewFiles: string[];
  supportedExtensions?: string[];
};

export type RetrievalEditor = {
  id?: string;
  title: string;
  source: string;
  tagsText: string;
  content: string;
};

export type RetrievalQueryResponse = {
  ok: true;
  retrieval: AgentRetrievalSummary;
  replay: RetrievalQueryReplayEntry;
};

export type RetrievalCitationDiagnosticSeverity = "ok" | "watch" | "fail";

export type RetrievalCitationDiagnostic = {
  id: string;
  label: string;
  severity: RetrievalCitationDiagnosticSeverity;
  scope: "query" | "citation";
  citationLabel?: string;
  chunkId?: string;
  reason: string;
  detail: string;
};

export type RetrievalQueryReplayResult = {
  chunkId: string;
  documentId: string;
  title: string;
  source?: string;
  citationLabel: string;
  score: number;
  confidence: number;
  sectionPath: string[];
  matchedTerms?: string[];
  evidencePreview?: string;
};

export type RetrievalQueryReplayEntry = {
  id: string;
  createdAt: string;
  query: string;
  scope?: AgentRetrievalSummary["scope"];
  sourcePreference?: AgentRetrievalSummary["sourcePreference"];
  evidenceMode?: AgentRetrievalSummary["evidenceMode"];
  hitCount: number;
  lowConfidence: boolean;
  topScore: number;
  strategy?: AgentRetrievalSummary["strategy"];
  candidateCount?: number;
  vectorCandidateCount?: number;
  reranked?: boolean;
  embeddingModel?: string;
  indexGeneratedAt?: string;
  sourceBreakdown?: AgentRetrievalSummary["sourceBreakdown"];
  stageNotes?: string[];
  diagnostics: RetrievalCitationDiagnostic[];
  results: RetrievalQueryReplayResult[];
  retrieval: AgentRetrievalSummary;
};

export type RetrievalQueryReplaySummary = {
  ok: true;
  schemaVersion: "retrieval.query-replay.v1";
  generatedAt: string;
  path: string;
  entries: RetrievalQueryReplayEntry[];
  totals: {
    entryCount: number;
    replayableCount: number;
    diagnosticLabelCount: number;
    okLabelCount: number;
    watchLabelCount: number;
    failLabelCount: number;
    latestEntryId: string | null;
    latestQuery: string | null;
  };
};
