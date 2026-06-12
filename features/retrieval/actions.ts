import type {
  AgentKnowledgeDocument,
  AgentRetrievalEvidenceMode,
  AgentRetrievalScope,
  AgentRetrievalSourcePreference,
} from "@/lib/agent/types";
import type {
  RetrievalEditor,
  RetrievalPathInspection,
  RetrievalQueryResponse,
  RetrievalSnapshot,
} from "@/features/retrieval/contracts";

const RETRIEVAL_API = "/api/retrieval";

async function readPayload<T>(response: Response, fallback: string) {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload;
}

export async function loadRetrievalSnapshot(documentId?: string) {
  const query = documentId ? `?documentId=${encodeURIComponent(documentId)}` : "";
  const response = await fetch(`${RETRIEVAL_API}${query}`, { cache: "no-store" });
  return readPayload<RetrievalSnapshot>(response, "Failed to load retrieval workspace.");
}

export async function saveRetrievalDocument(editor: RetrievalEditor) {
  const response = await fetch(RETRIEVAL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: editor.id,
      title: editor.title,
      source: editor.source,
      tags: editor.tagsText,
      content: editor.content,
    }),
  });
  return readPayload<{ ok: true; document: AgentKnowledgeDocument }>(
    response,
    "Failed to save knowledge document.",
  );
}

export async function inspectRetrievalPath(input: {
  path: string;
  recursive: boolean;
  tags: string;
}) {
  const response = await fetch(RETRIEVAL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, importMode: "path-probe" }),
  });
  return readPayload<{
    ok: true;
    inspection: RetrievalPathInspection;
    supportedExtensions: string[];
  }>(response, "Failed to inspect retrieval path.");
}

export async function importRetrievalPath(input: {
  path: string;
  recursive: boolean;
  tags: string;
}) {
  const response = await fetch(RETRIEVAL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, importMode: "path" }),
  });
  return readPayload<{
    ok: true;
    importedCount: number;
    importedDocuments: AgentKnowledgeDocument[];
    inspection: RetrievalPathInspection;
    supportedExtensions: string[];
  }>(response, "Failed to import retrieval path.");
}

export async function deleteRetrievalDocument(id: string) {
  const response = await fetch(`${RETRIEVAL_API}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return readPayload<{ ok: true; id: string }>(
    response,
    "Failed to delete knowledge document.",
  );
}

export async function runRetrievalProbe(input: {
  query: string;
  scope: AgentRetrievalScope;
  sourcePreference: AgentRetrievalSourcePreference;
  evidenceMode: AgentRetrievalEvidenceMode;
}) {
  const response = await fetch(`${RETRIEVAL_API}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, topK: 6 }),
  });
  return readPayload<RetrievalQueryResponse>(response, "Retrieval probe failed.");
}
