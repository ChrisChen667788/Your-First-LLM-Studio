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
};
