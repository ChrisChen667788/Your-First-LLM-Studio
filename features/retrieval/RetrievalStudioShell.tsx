"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/layout/LocaleProvider";
import {
  StudioIdentityBand,
  StudioSegmentedChips,
  StudioSurface,
} from "@/components/layout/StudioPageShell";
import {
  deleteRetrievalDocument,
  importRetrievalPath,
  inspectRetrievalPath,
  loadRetrievalSnapshot,
  runRetrievalProbe,
  saveRetrievalDocument,
} from "@/features/retrieval/actions";
import type {
  RetrievalEditor,
  RetrievalPathInspection,
  RetrievalSnapshot,
} from "@/features/retrieval/contracts";
import type {
  AgentKnowledgeDocument,
  AgentRetrievalEvidenceMode,
  AgentRetrievalScope,
  AgentRetrievalSourcePreference,
  AgentRetrievalSummary,
} from "@/lib/agent/types";

const EMPTY_EDITOR: RetrievalEditor = {
  title: "",
  source: "",
  tagsText: "",
  content: "",
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function RetrievalStudioShell() {
  const { locale } = useLocale();
  const en = locale.startsWith("en");
  const [snapshot, setSnapshot] = useState<RetrievalSnapshot | null>(null);
  const [editor, setEditor] = useState<RetrievalEditor>(EMPTY_EDITOR);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [importPath, setImportPath] = useState("");
  const [importTags, setImportTags] = useState("");
  const [recursive, setRecursive] = useState(true);
  const [inspection, setInspection] = useState<RetrievalPathInspection | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<AgentRetrievalScope>("all");
  const [sourcePreference, setSourcePreference] =
    useState<AgentRetrievalSourcePreference>("balanced");
  const [evidenceMode, setEvidenceMode] =
    useState<AgentRetrievalEvidenceMode>("compact");
  const [results, setResults] = useState<AgentRetrievalSummary | null>(null);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const copy = useMemo(
    () => ({
      title: en ? "Retrieval workspace" : "检索工作区",
      description: en
        ? "Import local knowledge, inspect chunks, tune retrieval scope, and review grounded evidence without entering Admin."
        : "导入本地知识、检查 chunks、调整检索范围并审阅 grounded evidence，不再依赖后台工作台。",
    }),
    [en],
  );

  const load = useCallback(async (documentId?: string) => {
    setPending("load");
    setError("");
    try {
      const next = await loadRetrievalSnapshot(documentId);
      setSnapshot(next);
      setSelectedDocumentId(documentId || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load retrieval workspace.");
    } finally {
      setPending("");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function editDocument(document: AgentKnowledgeDocument) {
    setEditor({
      id: document.id,
      title: document.title,
      source: document.source || "",
      tagsText: document.tags.join(", "),
      content: document.content,
    });
    void load(document.id);
  }

  async function saveDocument() {
    if (!editor.title.trim() || !editor.content.trim()) {
      setError(en ? "Title and content are required." : "标题与内容不能为空。");
      return;
    }
    setPending("save");
    setError("");
    try {
      const payload = await saveRetrievalDocument(editor);
      setMessage(en ? "Knowledge document saved." : "知识文档已保存。");
      editDocument(payload.document);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setPending("");
    }
  }

  async function removeDocument(document: AgentKnowledgeDocument) {
    if (!window.confirm(en ? `Delete ${document.title}?` : `确定删除 ${document.title}？`)) return;
    setPending(`delete:${document.id}`);
    setError("");
    try {
      await deleteRetrievalDocument(document.id);
      if (editor.id === document.id) setEditor(EMPTY_EDITOR);
      setMessage(en ? "Knowledge document removed." : "知识文档已删除。");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setPending("");
    }
  }

  async function inspectPath() {
    if (!importPath.trim()) return;
    setPending("inspect");
    setError("");
    try {
      const payload = await inspectRetrievalPath({
        path: importPath.trim(),
        recursive,
        tags: importTags,
      });
      setInspection({
        ...payload.inspection,
        supportedExtensions: payload.supportedExtensions,
      });
      setMessage(
        en
          ? `${payload.inspection.importableCount} importable files found.`
          : `发现 ${payload.inspection.importableCount} 个可导入文件。`,
      );
    } catch (inspectError) {
      setError(inspectError instanceof Error ? inspectError.message : "Path inspection failed.");
    } finally {
      setPending("");
    }
  }

  async function importPathNow() {
    if (!importPath.trim()) return;
    setPending("import");
    setError("");
    try {
      const payload = await importRetrievalPath({
        path: importPath.trim(),
        recursive,
        tags: importTags,
      });
      setInspection({
        ...payload.inspection,
        supportedExtensions: payload.supportedExtensions,
      });
      setMessage(
        en
          ? `${payload.importedCount} documents imported.`
          : `已导入 ${payload.importedCount} 个文档。`,
      );
      await load();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setPending("");
    }
  }

  async function runQuery() {
    if (!query.trim()) return;
    setPending("query");
    setError("");
    try {
      const payload = await runRetrievalProbe({
        query: query.trim(),
        scope,
        sourcePreference,
        evidenceMode,
      });
      setResults(payload.retrieval);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Retrieval probe failed.");
    } finally {
      setPending("");
    }
  }

  const stats = snapshot?.stats;
  const selectedChunks = snapshot?.chunks || [];

  return (
    <StudioSurface accent="cyan" className="flex flex-col gap-4">
      <StudioIdentityBand
        accent="cyan"
        className="mb-0"
        eyebrow="RETRIEVAL STUDIO"
        title={copy.title}
        description={copy.description}
        side={
          <div className="flex flex-wrap gap-2">
            <Link href="/agent" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
              {en ? "Use in Agent" : "在 Agent 中使用"}
            </Link>
            <Link href="/experiments" className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-50 hover:bg-cyan-400/20">
              {en ? "Open evidence" : "打开实验记录"}
            </Link>
          </div>
        }
      />

      <StudioSegmentedChips
        labels={[
          en ? "Local path import" : "本地路径导入",
          en ? "Chunk inspection" : "Chunk 检查",
          en ? "Grounded query probe" : "Grounded 查询验证",
        ]}
      />

      {(error || message) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-400/20 bg-rose-400/10 text-rose-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">{en ? "Knowledge index" : "知识索引"}</p>
                <p className="mt-2 text-sm text-slate-400">{snapshot?.workspaceRoot || "--"}</p>
              </div>
              <button type="button" onClick={() => void load(selectedDocumentId || undefined)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                {pending === "load" ? (en ? "Refreshing..." : "刷新中...") : en ? "Refresh" : "刷新"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label={en ? "Documents" : "文档"} value={stats?.documentCount || 0} />
              <Metric label="Chunks" value={stats?.chunkCount || 0} />
              <Metric label={en ? "Avg chars" : "平均字符"} value={stats?.avgChunkChars?.toFixed(1) || "0.0"} />
              <Metric label={en ? "Avg tokens" : "平均 Token"} value={stats?.avgChunkTokens?.toFixed(1) || "0.0"} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">{en ? "Path import" : "路径导入"}</p>
                <p className="mt-2 text-sm text-slate-400">{en ? "Probe before indexing a local file or directory." : "索引本地文件或目录前先检查可导入内容。"}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={recursive} onChange={(event) => setRecursive(event.target.checked)} />
                {en ? "Recursive" : "递归目录"}
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <input value={importPath} onChange={(event) => { setImportPath(event.target.value); setInspection(null); }} placeholder={en ? "/absolute/path/to/docs" : "本地绝对路径"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={importTags} onChange={(event) => setImportTags(event.target.value)} placeholder={en ? "tags, comma separated" : "标签，逗号分隔"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(snapshot?.recommendedImportPaths || []).map((path) => (
                <button key={path} type="button" onClick={() => { setImportPath(path); setInspection(null); }} className="max-w-full truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10" title={path}>
                  {path}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => void inspectPath()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
                {pending === "inspect" ? (en ? "Inspecting..." : "检查中...") : en ? "Inspect" : "检查路径"}
              </button>
              <button type="button" onClick={() => void importPathNow()} className="rounded-xl border border-cyan-300/20 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/25">
                {pending === "import" ? (en ? "Importing..." : "导入中...") : en ? "Import" : "导入"}
              </button>
            </div>
            {inspection && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
                <p>{inspection.kind} · {inspection.importableCount}/{inspection.totalFiles} {en ? "importable" : "可导入"}</p>
                <div className="mt-2 space-y-1 text-slate-500">
                  {inspection.previewFiles.slice(0, 5).map((file) => <p key={file} className="truncate" title={file}>{file}</p>)}
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-4 2xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">{en ? "Documents" : "文档"}</p>
                <span className="text-xs text-slate-500">{snapshot?.documents.length || 0}</span>
              </div>
              <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
                {snapshot?.documents.length ? snapshot.documents.map((document) => (
                  <div key={document.id} className={`rounded-2xl border p-3 ${editor.id === document.id ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-black/20"}`}>
                    <button type="button" onClick={() => editDocument(document)} className="w-full text-left">
                      <p className="truncate text-sm font-semibold text-white">{document.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{document.chunkCount} chunks · {document.tags.join(", ") || "--"}</p>
                    </button>
                    <button type="button" onClick={() => void removeDocument(document)} className="mt-2 text-xs text-rose-200 hover:text-rose-100">
                      {pending === `delete:${document.id}` ? (en ? "Deleting..." : "删除中...") : en ? "Delete" : "删除"}
                    </button>
                  </div>
                )) : <p className="text-sm text-slate-500">{en ? "No indexed documents." : "暂无已索引文档。"}</p>}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">{editor.id ? (en ? "Edit document" : "编辑文档") : en ? "New document" : "新建文档"}</p>
                <button type="button" onClick={() => { setEditor(EMPTY_EDITOR); setSelectedDocumentId(""); }} className="text-xs text-slate-400 hover:text-white">{en ? "Reset" : "重置"}</button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={editor.title} onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))} placeholder={en ? "Document title" : "文档标题"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" />
                <input value={editor.source} onChange={(event) => setEditor((current) => ({ ...current, source: event.target.value }))} placeholder={en ? "Source path or URL" : "来源路径或 URL"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" />
              </div>
              <input value={editor.tagsText} onChange={(event) => setEditor((current) => ({ ...current, tagsText: event.target.value }))} placeholder={en ? "Tags" : "标签"} className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" />
              <textarea value={editor.content} onChange={(event) => setEditor((current) => ({ ...current, content: event.target.value }))} rows={10} placeholder={en ? "Knowledge content" : "知识内容"} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white outline-none" />
              <button type="button" onClick={() => void saveDocument()} className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/25">
                {pending === "save" ? (en ? "Saving..." : "保存中...") : en ? "Save document" : "保存文档"}
              </button>
              {selectedChunks.length > 0 && (
                <div className="mt-4 max-h-[280px] space-y-2 overflow-auto border-t border-white/10 pt-4">
                  {selectedChunks.map((chunk) => (
                    <div key={chunk.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs font-semibold text-white">#{chunk.order} · {chunk.charCount} chars · {chunk.tokenEstimate} tok</p>
                      <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{chunk.content}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="rounded-3xl border border-white/10 bg-slate-950/75 p-4 xl:sticky xl:top-[5.25rem] xl:max-h-[calc(100vh-6.5rem)] xl:overflow-auto">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">{en ? "Grounded query probe" : "Grounded 查询验证"}</p>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={5} placeholder={en ? "Ask against indexed knowledge" : "输入针对已索引知识的问题"} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white outline-none" />
          <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <select value={scope} onChange={(event) => setScope(event.target.value as AgentRetrievalScope)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white">
              <option value="all">{en ? "All sources" : "全部来源"}</option>
              <option value="knowledge-base">{en ? "Knowledge only" : "仅知识库"}</option>
              <option value="benchmark-builtins">{en ? "Benchmark refs" : "Benchmark 参考"}</option>
            </select>
            <select value={sourcePreference} onChange={(event) => setSourcePreference(event.target.value as AgentRetrievalSourcePreference)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white">
              <option value="balanced">{en ? "Balanced" : "平衡"}</option>
              <option value="knowledge-first">{en ? "Knowledge first" : "知识优先"}</option>
              <option value="benchmark-first">{en ? "Benchmark first" : "Benchmark 优先"}</option>
            </select>
            <select value={evidenceMode} onChange={(event) => setEvidenceMode(event.target.value as AgentRetrievalEvidenceMode)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white">
              <option value="compact">{en ? "Compact" : "紧凑证据"}</option>
              <option value="expanded">{en ? "Expanded" : "展开证据"}</option>
            </select>
          </div>
          <button type="button" onClick={() => void runQuery()} className="mt-3 w-full rounded-xl border border-cyan-300/20 bg-cyan-400/15 px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/25">
            {pending === "query" ? (en ? "Running..." : "检索中...") : en ? "Run retrieval" : "执行检索"}
          </button>

          {results && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">hits {results.hitCount}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">top {results.topScore.toFixed(2)}</span>
                <span className={`rounded-full border px-2 py-1 ${results.lowConfidence ? "border-amber-300/20 bg-amber-400/10 text-amber-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}>{results.lowConfidence ? "low confidence" : "grounded"}</span>
              </div>
              {results.results.map((result) => (
                <article key={result.chunkId} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-white">{result.citationLabel} {result.title}</p>
                    <span className="text-xs text-cyan-200">{result.score.toFixed(1)}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">{result.sectionPath.join(" > ") || "--"}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-300">{result.evidencePreview || result.content}</pre>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </StudioSurface>
  );
}
