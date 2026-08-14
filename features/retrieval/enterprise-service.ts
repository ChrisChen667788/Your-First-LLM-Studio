import { Pool, type PoolClient } from "pg";
import { withTelemetrySpan } from "@/features/telemetry/trace-adapter";

export const ENTERPRISE_RETRIEVAL_SCHEMA_VERSION =
  "retrieval.enterprise-pgvector.v1" as const;

export type EnterpriseRetrievalPrincipal = {
  workspaceId: string;
  subjectId: string;
  groupIds: string[];
};

type EnterpriseDocumentInput = {
  id: string;
  title: string;
  content: string;
  source?: string;
  allowedSubjects?: string[];
  allowedGroups?: string[];
  metadata?: Record<string, unknown>;
};

let pool: Pool | null = null;
let poolConnectionString = "";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveEnterpriseRetrievalConfig() {
  const databaseUrl = process.env.ENTERPRISE_RAG_DATABASE_URL?.trim() || "";
  const embeddingBaseUrl =
    process.env.ENTERPRISE_RAG_EMBEDDING_BASE_URL?.trim() || "";
  const embeddingModel =
    process.env.ENTERPRISE_RAG_EMBEDDING_MODEL?.trim() || "";
  const rerankerUrl = process.env.ENTERPRISE_RAG_RERANKER_URL?.trim() || "";
  const rerankerModel =
    process.env.ENTERPRISE_RAG_RERANKER_MODEL?.trim() || "";
  const blockers = [
    ...(!databaseUrl ? ["ENTERPRISE_RAG_DATABASE_URL is not configured."] : []),
    ...(!embeddingBaseUrl
      ? ["ENTERPRISE_RAG_EMBEDDING_BASE_URL is not configured."]
      : []),
    ...(!embeddingModel
      ? ["ENTERPRISE_RAG_EMBEDDING_MODEL is not configured."]
      : []),
    ...(!rerankerUrl
      ? ["ENTERPRISE_RAG_RERANKER_URL is not configured."]
      : []),
    ...(!rerankerModel
      ? ["ENTERPRISE_RAG_RERANKER_MODEL is not configured."]
      : []),
  ];
  return {
    databaseUrl,
    embeddingBaseUrl,
    embeddingApiKey:
      process.env.ENTERPRISE_RAG_EMBEDDING_API_KEY?.trim() || "",
    embeddingModel,
    embeddingDimensions: positiveInteger(
      process.env.ENTERPRISE_RAG_EMBEDDING_DIMENSIONS,
      1024,
    ),
    rerankerUrl,
    rerankerApiKey:
      process.env.ENTERPRISE_RAG_RERANKER_API_KEY?.trim() || "",
    rerankerModel,
    blockers,
    ready: blockers.length === 0,
  };
}

function requireConfig() {
  const config = resolveEnterpriseRetrievalConfig();
  if (!config.ready) {
    throw Object.assign(
      new Error(`Enterprise Retrieval is not ready: ${config.blockers.join(" ")}`),
      { status: 503 },
    );
  }
  return config;
}

function requirePrincipal(principal: Partial<EnterpriseRetrievalPrincipal>) {
  const workspaceId = principal.workspaceId?.trim();
  const subjectId = principal.subjectId?.trim();
  if (!workspaceId || !subjectId) {
    throw Object.assign(
      new Error("Enterprise Retrieval requires workspace and subject identity."),
      { status: 401 },
    );
  }
  return {
    workspaceId,
    subjectId,
    groupIds: Array.from(
      new Set((principal.groupIds || []).map((value) => value.trim()).filter(Boolean)),
    ),
  };
}

function getPool(connectionString: string) {
  if (!pool || poolConnectionString !== connectionString) {
    void pool?.end();
    pool = new Pool({
      connectionString,
      max: positiveInteger(process.env.ENTERPRISE_RAG_DATABASE_POOL_SIZE, 6),
      application_name: "first-llm-enterprise-rag",
    });
    poolConnectionString = connectionString;
  }
  return pool;
}

async function withWorkspaceClient<T>(
  principalInput: Partial<EnterpriseRetrievalPrincipal>,
  runner: (client: PoolClient, principal: EnterpriseRetrievalPrincipal) => Promise<T>,
) {
  const config = requireConfig();
  const principal = requirePrincipal(principalInput);
  const client = await getPool(config.databaseUrl).connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('first_llm.workspace_id', $1, true)", [
      principal.workspaceId,
    ]);
    await client.query("SELECT set_config('first_llm.subject_id', $1, true)", [
      principal.subjectId,
    ]);
    await client.query("SELECT set_config('first_llm.group_ids', $1, true)", [
      principal.groupIds.join(","),
    ]);
    const result = await runner(client, principal);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function embeddingsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");
  return normalized.endsWith("/embeddings")
    ? normalized
    : `${normalized}/embeddings`;
}

async function embedTexts(texts: string[]) {
  const config = requireConfig();
  const response = await fetch(embeddingsUrl(config.embeddingBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.embeddingApiKey
        ? { Authorization: `Bearer ${config.embeddingApiKey}` }
        : {}),
    },
    body: JSON.stringify({ model: config.embeddingModel, input: texts }),
  });
  if (!response.ok) {
    throw new Error(
      `Embedding provider failed (${response.status}): ${await response.text()}`,
    );
  }
  const payload = (await response.json()) as {
    data?: Array<{ index?: number; embedding?: unknown }>;
  };
  const vectors = (payload.data || [])
    .sort((left, right) => (left.index || 0) - (right.index || 0))
    .map((entry) =>
      Array.isArray(entry.embedding)
        ? entry.embedding.map((value) => Number(value))
        : [],
    );
  if (
    vectors.length !== texts.length ||
    vectors.some(
      (vector) =>
        vector.length !== config.embeddingDimensions ||
        vector.some((value) => !Number.isFinite(value)),
    )
  ) {
    throw new Error(
      `Embedding provider did not return ${texts.length} vectors with ${config.embeddingDimensions} dimensions.`,
    );
  }
  return vectors;
}

function vectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export function chunkEnterpriseDocument(content: string) {
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > 1_200) {
      chunks.push(current);
      current = current.slice(-160);
    }
    current = [current, paragraph].filter(Boolean).join("\n\n");
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function migrateEnterpriseRetrieval() {
  const config = requireConfig();
  const client = await getPool(config.databaseUrl).connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query("CREATE SCHEMA IF NOT EXISTS first_llm_rag");
    await client.query(`
      CREATE TABLE IF NOT EXISTS first_llm_rag.chunks (
        id text PRIMARY KEY,
        workspace_id text NOT NULL,
        document_id text NOT NULL,
        title text NOT NULL,
        source text,
        content text NOT NULL,
        embedding vector(${config.embeddingDimensions}) NOT NULL,
        allowed_subjects text[] NOT NULL DEFAULT '{}',
        allowed_groups text[] NOT NULL DEFAULT '{}',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS first_llm_rag_chunks_workspace_idx ON first_llm_rag.chunks(workspace_id, document_id)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS first_llm_rag_chunks_embedding_hnsw_idx ON first_llm_rag.chunks USING hnsw (embedding vector_cosine_ops)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS first_llm_rag_chunks_lexical_gin_idx ON first_llm_rag.chunks USING gin (to_tsvector('simple', content))",
    );
    await client.query(
      "ALTER TABLE first_llm_rag.chunks ENABLE ROW LEVEL SECURITY",
    );
    await client.query(
      "ALTER TABLE first_llm_rag.chunks FORCE ROW LEVEL SECURITY",
    );
    await client.query("DROP POLICY IF EXISTS first_llm_rag_acl ON first_llm_rag.chunks");
    await client.query(`
      CREATE POLICY first_llm_rag_acl ON first_llm_rag.chunks
      USING (
        workspace_id = current_setting('first_llm.workspace_id', true)
        AND (
          cardinality(allowed_subjects) = 0
          OR current_setting('first_llm.subject_id', true) = ANY(allowed_subjects)
          OR allowed_groups && string_to_array(current_setting('first_llm.group_ids', true), ',')
        )
      )
      WITH CHECK (
        workspace_id = current_setting('first_llm.workspace_id', true)
      )
    `);
    return {
      ok: true as const,
      schemaVersion: ENTERPRISE_RETRIEVAL_SCHEMA_VERSION,
      vectorDimensions: config.embeddingDimensions,
      rls: true,
    };
  } finally {
    client.release();
  }
}

export async function indexEnterpriseDocument(input: {
  principal: Partial<EnterpriseRetrievalPrincipal>;
  document: EnterpriseDocumentInput;
}) {
  const chunks = chunkEnterpriseDocument(input.document.content);
  if (!input.document.id.trim() || !input.document.title.trim() || !chunks.length) {
    throw Object.assign(new Error("Document id, title, and content are required."), {
      status: 400,
    });
  }
  return withTelemetrySpan(
    "retrieval.enterprise.index",
    {
      "retrieval.workspace.id": input.principal.workspaceId || "missing",
      "retrieval.document.id": input.document.id,
      "retrieval.chunk.count": chunks.length,
    },
    async () => {
      const vectors = await embedTexts(chunks);
      return withWorkspaceClient(input.principal, async (client, principal) => {
        await client.query(
          "DELETE FROM first_llm_rag.chunks WHERE workspace_id = $1 AND document_id = $2",
          [principal.workspaceId, input.document.id],
        );
        for (let index = 0; index < chunks.length; index += 1) {
          await client.query(
            `INSERT INTO first_llm_rag.chunks (
              id, workspace_id, document_id, title, source, content, embedding,
              allowed_subjects, allowed_groups, metadata
            ) VALUES ($1,$2,$3,$4,$5,$6,$7::vector,$8,$9,$10::jsonb)`,
            [
              `${input.document.id}:chunk:${index + 1}`,
              principal.workspaceId,
              input.document.id,
              input.document.title,
              input.document.source || null,
              chunks[index],
              vectorLiteral(vectors[index]),
              input.document.allowedSubjects || [],
              input.document.allowedGroups || [],
              JSON.stringify(input.document.metadata || {}),
            ],
          );
        }
        return {
          ok: true as const,
          documentId: input.document.id,
          workspaceId: principal.workspaceId,
          chunks: chunks.length,
        };
      });
    },
  );
}

async function rerank(query: string, documents: string[]) {
  const config = requireConfig();
  const response = await fetch(config.rerankerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.rerankerApiKey
        ? { Authorization: `Bearer ${config.rerankerApiKey}` }
        : {}),
    },
    body: JSON.stringify({
      model: config.rerankerModel,
      query,
      documents,
      top_n: documents.length,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Cross-encoder reranker failed (${response.status}): ${await response.text()}`,
    );
  }
  const payload = (await response.json()) as {
    results?: Array<{ index?: number; relevance_score?: number; score?: number }>;
    scores?: number[];
  };
  if (Array.isArray(payload.results)) {
    return payload.results.map((entry) => ({
      index: Number(entry.index),
      score: Number(entry.relevance_score ?? entry.score ?? 0),
    }));
  }
  if (Array.isArray(payload.scores)) {
    return payload.scores.map((score, index) => ({ index, score }));
  }
  throw new Error("Cross-encoder reranker returned an unsupported response shape.");
}

export async function searchEnterpriseRetrieval(input: {
  principal: Partial<EnterpriseRetrievalPrincipal>;
  query: string;
  topK?: number;
}) {
  const query = input.query.trim();
  if (!query) throw Object.assign(new Error("query is required."), { status: 400 });
  const topK = Math.max(1, Math.min(input.topK || 6, 20));
  return withTelemetrySpan(
    "retrieval.enterprise.query",
    {
      "retrieval.workspace.id": input.principal.workspaceId || "missing",
      "retrieval.top_k": topK,
      "retrieval.acl.enabled": true,
    },
    async () => {
      const [queryVector] = await embedTexts([query]);
      const candidates = await withWorkspaceClient(
        input.principal,
        async (client) => {
          const result = await client.query<{
            id: string;
            documentId: string;
            title: string;
            source: string | null;
            content: string;
            vectorScore: number;
            lexicalScore: number;
          }>(
            `SELECT id, document_id AS "documentId", title, source, content,
                    1 - (embedding <=> $1::vector) AS "vectorScore",
                    ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $2)) AS "lexicalScore"
             FROM first_llm_rag.chunks
             WHERE workspace_id = current_setting('first_llm.workspace_id', true)
             ORDER BY ((1 - (embedding <=> $1::vector)) * 0.75 +
                       ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $2)) * 0.25) DESC
             LIMIT $3`,
            [vectorLiteral(queryVector), query, Math.max(topK * 4, 20)],
          );
          return result.rows;
        },
      );
      if (!candidates.length) {
        return { ok: true as const, query, results: [], citations: [] };
      }
      const scores = await rerank(
        query,
        candidates.map((candidate) => candidate.content),
      );
      const ranked = scores
        .filter(
          (entry) =>
            Number.isInteger(entry.index) && candidates[entry.index] && Number.isFinite(entry.score),
        )
        .sort((left, right) => right.score - left.score)
        .slice(0, topK)
        .map((entry, index) => {
          const candidate = candidates[entry.index];
          return {
            ...candidate,
            citation: `ER${index + 1}`,
            rerankScore: entry.score,
          };
        });
      return {
        ok: true as const,
        schemaVersion: ENTERPRISE_RETRIEVAL_SCHEMA_VERSION,
        query,
        strategy: "pgvector-hybrid-cross-encoder" as const,
        aclEnforced: true,
        results: ranked,
        citations: ranked.map((result) => ({
          label: result.citation,
          documentId: result.documentId,
          title: result.title,
          source: result.source,
        })),
      };
    },
  );
}

export function readEnterpriseRetrievalReadModel() {
  const config = resolveEnterpriseRetrievalConfig();
  return {
    ok: true as const,
    schemaVersion: ENTERPRISE_RETRIEVAL_SCHEMA_VERSION,
    status: config.ready ? ("configured" as const) : ("blocked" as const),
    capabilities: {
      vectorStore: "pgvector",
      embeddings: config.embeddingModel || null,
      hybridSearch: true,
      reranker: config.rerankerModel || null,
      citations: true,
      acl: "postgres-rls-subject-groups",
    },
    checks: {
      databaseConfigured: Boolean(config.databaseUrl),
      embeddingConfigured: Boolean(
        config.embeddingBaseUrl && config.embeddingModel,
      ),
      rerankerConfigured: Boolean(config.rerankerUrl && config.rerankerModel),
    },
    blockers: config.blockers,
  };
}
