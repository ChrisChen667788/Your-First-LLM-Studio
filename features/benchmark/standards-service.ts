import { benchmarkStandardsCatalog } from "@/features/benchmark/standards-catalog";
import {
  BENCHMARK_STANDARDS_SCHEMA_VERSION,
  type BenchmarkStandardCatalogEntry,
  type BenchmarkStandardUpstreamState,
  type BenchmarkStandardsReadModel,
} from "@/features/benchmark/standards-contracts";
import {
  readBenchmarkStandardsState,
  updateBenchmarkStandardsState,
} from "@/features/benchmark/standards-store";

const DEFAULT_AUTO_REFRESH_HOURS = 6;
const UPSTREAM_TIMEOUT_MS = 8000;

function autoRefreshHours() {
  const parsed = Number(process.env.BENCHMARK_STANDARDS_REFRESH_HOURS);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(Math.trunc(parsed), 168))
    : DEFAULT_AUTO_REFRESH_HOURS;
}

function isStale(lastRefreshAt: string | undefined) {
  if (!lastRefreshAt) return true;
  const refreshedAt = Date.parse(lastRefreshAt);
  if (!Number.isFinite(refreshedAt)) return true;
  return Date.now() - refreshedAt >= autoRefreshHours() * 60 * 60 * 1000;
}

function shortRevision(value: string | undefined) {
  if (!value) return undefined;
  return value.length > 20 ? value.slice(0, 20) : value;
}

async function fetchHuggingFaceHeadFallback(
  standard: BenchmarkStandardCatalogEntry,
  checkedAt: string,
) {
  const response = await fetch(`${standard.sourceUrl}/resolve/main/README.md`, {
    method: "HEAD",
    cache: "no-store",
    redirect: "manual",
    headers: {
      "User-Agent": "First-LLM-Studio-Benchmark-Registry/1.0",
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`Hugging Face HEAD fallback returned HTTP ${response.status}`);
  }
  const revision = response.headers.get("x-repo-commit") || undefined;
  if (!revision) {
    throw new Error("Hugging Face HEAD fallback did not include x-repo-commit.");
  }
  return {
    standardId: standard.id,
    status: "available" as const,
    checkedAt,
    revision: shortRevision(revision),
    lastModifiedAt: response.headers.get("last-modified") || undefined,
    etag: response.headers.get("etag") || undefined,
  };
}

async function fetchGitHubAtomFallback(
  standard: BenchmarkStandardCatalogEntry,
  checkedAt: string,
) {
  const repository = standard.updateUrl.match(
    /api\.github\.com\/repos\/([^/?]+\/[^/?]+)\/commits/i,
  )?.[1];
  if (!repository) {
    throw new Error("GitHub Atom fallback could not resolve the repository.");
  }
  const response = await fetch(`https://github.com/${repository}/commits.atom`, {
    cache: "no-store",
    headers: {
      Accept: "application/atom+xml",
      "User-Agent": "First-LLM-Studio-Benchmark-Registry/1.0",
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GitHub Atom fallback returned HTTP ${response.status}`);
  }
  const atom = await response.text();
  const firstEntry = atom.match(/<entry>[\s\S]*?<\/entry>/i)?.[0] || atom;
  const revision = firstEntry.match(/Grit::Commit\/([a-f0-9]{40})/i)?.[1];
  const lastModifiedAt = firstEntry.match(/<updated>([^<]+)<\/updated>/i)?.[1];
  if (!revision) {
    throw new Error("GitHub Atom fallback did not include a commit revision.");
  }
  return {
    standardId: standard.id,
    status: "available" as const,
    checkedAt,
    revision: shortRevision(revision),
    lastModifiedAt,
    etag: response.headers.get("etag") || undefined,
  };
}

async function fetchUpstreamState(
  standard: BenchmarkStandardCatalogEntry,
  previous: BenchmarkStandardUpstreamState | undefined,
): Promise<BenchmarkStandardUpstreamState> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(standard.updateUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "First-LLM-Studio-Benchmark-Registry/1.0",
        ...(previous?.etag ? { "If-None-Match": previous.etag } : {}),
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (response.status === 304 && previous) {
      return { ...previous, status: "available", checkedAt, error: undefined };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    let revision: string | undefined;
    let lastModifiedAt: string | undefined;
    if (standard.sourceKind === "huggingface") {
      const item = payload as {
        sha?: unknown;
        lastModified?: unknown;
        lastModifiedAt?: unknown;
      };
      revision = typeof item.sha === "string" ? item.sha : undefined;
      lastModifiedAt =
        typeof item.lastModified === "string"
          ? item.lastModified
          : typeof item.lastModifiedAt === "string"
            ? item.lastModifiedAt
            : undefined;
    } else {
      const item = Array.isArray(payload) ? payload[0] : undefined;
      if (item && typeof item === "object") {
        const commit = item as {
          sha?: unknown;
          commit?: {
            committer?: { date?: unknown };
            author?: { date?: unknown };
          };
        };
        revision = typeof commit.sha === "string" ? commit.sha : undefined;
        const date = commit.commit?.committer?.date || commit.commit?.author?.date;
        lastModifiedAt = typeof date === "string" ? date : undefined;
      }
    }
    if (!revision) {
      throw new Error("Upstream response did not include a revision.");
    }
    return {
      standardId: standard.id,
      status: "available",
      checkedAt,
      revision: shortRevision(revision),
      lastModifiedAt,
      etag: response.headers.get("etag") || undefined,
    };
  } catch (error) {
    if (standard.sourceKind === "huggingface") {
      try {
        return await fetchHuggingFaceHeadFallback(standard, checkedAt);
      } catch {
        // Keep the primary API error because it is usually more actionable.
      }
    }
    if (standard.sourceKind === "github") {
      try {
        return await fetchGitHubAtomFallback(standard, checkedAt);
      } catch {
        // Preserve the API failure below and retain any previous revision.
      }
    }
    const message = error instanceof Error ? error.message : "Upstream check failed.";
    if (previous?.revision) {
      return {
        ...previous,
        status: "stale",
        checkedAt,
        error: message,
      };
    }
    return {
      standardId: standard.id,
      status: "error",
      checkedAt,
      revision: previous?.revision,
      lastModifiedAt: previous?.lastModifiedAt,
      etag: previous?.etag,
      error: message,
    };
  }
}

export async function refreshBenchmarkStandards(standardIds?: string[]) {
  const allowed = new Set(benchmarkStandardsCatalog.map((entry) => entry.id));
  const selectedIds = standardIds?.length
    ? [...new Set(standardIds)].filter((id) => allowed.has(id))
    : benchmarkStandardsCatalog.map((entry) => entry.id);
  const previous = readBenchmarkStandardsState();
  const selected = benchmarkStandardsCatalog.filter((entry) =>
    selectedIds.includes(entry.id),
  );
  const updates = await Promise.all(
    selected.map((entry) => fetchUpstreamState(entry, previous.sources[entry.id])),
  );
  const refreshedAt = new Date().toISOString();
  updateBenchmarkStandardsState((current) => ({
    ...current,
    updatedAt: refreshedAt,
    lastRefreshAt: refreshedAt,
    sources: {
      ...current.sources,
      ...Object.fromEntries(updates.map((entry) => [entry.standardId, entry])),
    },
  }));
  return buildBenchmarkStandardsReadModel();
}

export function buildBenchmarkStandardsReadModel(): BenchmarkStandardsReadModel {
  const state = readBenchmarkStandardsState();
  const standards = benchmarkStandardsCatalog.map((entry) => ({
    ...entry,
    upstream: state.sources[entry.id] || {
      standardId: entry.id,
      status: "unchecked" as const,
    },
  }));
  return {
    ok: true,
    schemaVersion: BENCHMARK_STANDARDS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    autoRefreshHours: autoRefreshHours(),
    stale: isStale(state.lastRefreshAt),
    lastRefreshAt: state.lastRefreshAt,
    totals: {
      standards: standards.length,
      available: standards.filter((entry) => entry.upstream.status === "available")
        .length,
      stale: standards.filter((entry) => entry.upstream.status === "stale").length,
      errors: standards.filter((entry) => entry.upstream.status === "error").length,
      multimodal: standards.filter((entry) => entry.modalities.length > 1).length,
      runnable: standards.filter((entry) => entry.adapterStatus !== "registry-only")
        .length,
    },
    standards,
    disclosure:
      "Built-in starter datasets are lightweight compatibility checks, not official full benchmark snapshots. Comparable published scores require the pinned upstream revision and official evaluator protocol.",
  };
}

export async function readBenchmarkStandards(options?: { autoRefresh?: boolean }) {
  const model = buildBenchmarkStandardsReadModel();
  if (options?.autoRefresh && model.stale) {
    return refreshBenchmarkStandards();
  }
  return model;
}
