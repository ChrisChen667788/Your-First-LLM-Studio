import crypto from "crypto";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import {
  migrateJsonFileDurably,
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

const USAGE_FILE = getLocalAgentDataPath("admin-compatibility-usage.json");
const ARCHIVE_FILE = getLocalAgentDataPath(
  "admin-compatibility-usage-archives.json",
);
const ADMIN_COMPATIBILITY_USAGE_SOURCE_TAG_VERSION = 2;
const ADMIN_COMPATIBILITY_ARCHIVE_SCHEMA_VERSION = 1;

export type AdminCompatibilityUsageRoute = {
  key: string;
  legacyPath: string;
  canonicalPath: string;
  method: string;
  hitCount: number;
  evidenceVersion?: number;
  runtimeHitCount?: number;
  smokeHitCount?: number;
  legacyUnclassifiedHitCount?: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUserAgent?: string;
  lastEvidenceSource?: "runtime" | "route-smoke";
};

export type AdminCompatibilityUsageSummary = {
  generatedAt: string;
  totalHits: number;
  runtimeHits: number;
  smokeHits: number;
  legacyUnclassifiedHits: number;
  routeCount: number;
  routes: AdminCompatibilityUsageRoute[];
};

export type AdminCompatibilityHistoricalArchiveRoute = {
  legacyPath: string;
  canonicalPath: string;
  method: string;
  hitCount: number;
  runtimeHitCount: number;
  smokeHitCount: number;
  legacyUnclassifiedHitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUserAgent?: string;
};

export type AdminCompatibilityHistoricalArchiveEntry = {
  id: string;
  archivedAt: string;
  reason: string;
  cleared: boolean;
  runtimeHitsAtArchive: number;
  smokeHitsAtArchive: number;
  legacyUnclassifiedHitsArchived: number;
  routeCount: number;
  routes: AdminCompatibilityHistoricalArchiveRoute[];
};

export type AdminCompatibilityHistoricalArchiveSummary = {
  archiveSchemaVersion: number;
  archivePath: string;
  archiveCount: number;
  archivedLegacyUnclassifiedHits: number;
  latestArchiveAt: string | null;
  archives: AdminCompatibilityHistoricalArchiveEntry[];
};

type AdminCompatibilityHistoricalArchiveStore = {
  schemaVersion: number;
  archives: AdminCompatibilityHistoricalArchiveEntry[];
};

type AdminCompatibilityUsageStore = {
  routes: AdminCompatibilityUsageRoute[];
};

export function getTaggedRuntimeHitCount(route: AdminCompatibilityUsageRoute) {
  return route.evidenceVersion === ADMIN_COMPATIBILITY_USAGE_SOURCE_TAG_VERSION
    ? route.runtimeHitCount ?? 0
    : 0;
}

export function getRouteSmokeHitCount(route: AdminCompatibilityUsageRoute) {
  return route.smokeHitCount ?? 0;
}

export function getLegacyUnclassifiedHitCount(
  route: AdminCompatibilityUsageRoute,
) {
  if (route.evidenceVersion === ADMIN_COMPATIBILITY_USAGE_SOURCE_TAG_VERSION) {
    return route.legacyUnclassifiedHitCount ?? 0;
  }
  return Math.max(0, route.hitCount - getRouteSmokeHitCount(route));
}

function emptyUsageStore(): AdminCompatibilityUsageStore {
  return { routes: [] };
}

function isUsageStore(value: unknown): value is AdminCompatibilityUsageStore {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as AdminCompatibilityUsageStore).routes);
}

function emptyArchiveStore(): AdminCompatibilityHistoricalArchiveStore {
  return {
    schemaVersion: ADMIN_COMPATIBILITY_ARCHIVE_SCHEMA_VERSION,
    archives: [],
  };
}

function isArchiveStore(value: unknown): value is AdminCompatibilityHistoricalArchiveStore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdminCompatibilityHistoricalArchiveStore>;
  return candidate.schemaVersion === ADMIN_COMPATIBILITY_ARCHIVE_SCHEMA_VERSION && Array.isArray(candidate.archives);
}

function migrateLegacyArchiveStore(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AdminCompatibilityHistoricalArchiveStore>;
  if (candidate.schemaVersion !== undefined || !Array.isArray(candidate.archives)) {
    return null;
  }
  return {
    schemaVersion: ADMIN_COMPATIBILITY_ARCHIVE_SCHEMA_VERSION,
    archives: candidate.archives,
  };
}

function readUsageRoutes() {
  return readJsonFileDurably(USAGE_FILE, emptyUsageStore, isUsageStore).routes;
}

function readArchiveEntries() {
  migrateJsonFileDurably(
    ARCHIVE_FILE,
    emptyArchiveStore,
    migrateLegacyArchiveStore,
    isArchiveStore,
  );
  return readJsonFileDurably(ARCHIVE_FILE, emptyArchiveStore, isArchiveStore).archives;
}

function prependArchive(entry: AdminCompatibilityHistoricalArchiveEntry) {
  updateJsonFileDurably(
    ARCHIVE_FILE,
    emptyArchiveStore,
    (store) => ({ ...store, archives: [entry, ...store.archives] }),
    isArchiveStore,
  );
}

function normalizeLegacyRequest(request: unknown) {
  if (!(request instanceof Request)) {
    return {
      method: "GET",
      legacyPath: "unknown",
      userAgent: undefined,
      evidenceSource: "runtime" as const,
    };
  }

  let legacyPath = request.url;
  try {
    legacyPath = new URL(request.url).pathname;
  } catch {
    // keep original url
  }

  return {
    method: request.method || "GET",
    legacyPath,
    userAgent: request.headers.get("user-agent") || undefined,
    evidenceSource:
      request.headers.get("x-first-llm-evidence-source") === "route-smoke"
        ? ("route-smoke" as const)
        : ("runtime" as const),
  };
}

export function recordAdminCompatibilityUsage(
  request: unknown,
  canonicalPath: string,
) {
  try {
    const now = new Date().toISOString();
    const normalized = normalizeLegacyRequest(request);
    const key = `${normalized.method} ${normalized.legacyPath} -> ${canonicalPath}`;
    updateJsonFileDurably(
      USAGE_FILE,
      emptyUsageStore,
      (store) => {
        const routes = [...store.routes];
        const index = routes.findIndex((route) => route.key === key);
        if (index >= 0) {
          const existing = routes[index];
          const currentRuntimeHitCount = getTaggedRuntimeHitCount(existing);
          const currentSmokeHitCount = existing.smokeHitCount ?? 0;
          const currentLegacyUnclassifiedHitCount = getLegacyUnclassifiedHitCount(existing);
          routes[index] = {
            ...existing,
            evidenceVersion: ADMIN_COMPATIBILITY_USAGE_SOURCE_TAG_VERSION,
            hitCount: existing.hitCount + 1,
            runtimeHitCount: normalized.evidenceSource === "runtime" ? currentRuntimeHitCount + 1 : currentRuntimeHitCount,
            smokeHitCount: normalized.evidenceSource === "route-smoke" ? currentSmokeHitCount + 1 : currentSmokeHitCount,
            legacyUnclassifiedHitCount: currentLegacyUnclassifiedHitCount,
            lastSeenAt: now,
            lastUserAgent: normalized.userAgent || existing.lastUserAgent,
            lastEvidenceSource: normalized.evidenceSource,
          };
        } else {
          routes.push({
            key,
            legacyPath: normalized.legacyPath,
            canonicalPath,
            method: normalized.method,
            hitCount: 1,
            evidenceVersion: ADMIN_COMPATIBILITY_USAGE_SOURCE_TAG_VERSION,
            runtimeHitCount: normalized.evidenceSource === "runtime" ? 1 : 0,
            smokeHitCount: normalized.evidenceSource === "route-smoke" ? 1 : 0,
            legacyUnclassifiedHitCount: 0,
            firstSeenAt: now,
            lastSeenAt: now,
            lastUserAgent: normalized.userAgent,
            lastEvidenceSource: normalized.evidenceSource,
          });
        }
        return { routes };
      },
      isUsageStore,
    );
  } catch {
    // Compatibility headers should never fail because usage evidence failed.
  }
}

export function readAdminCompatibilityUsageSummary(): AdminCompatibilityUsageSummary {
  const routes = readUsageRoutes().sort((left, right) => {
    const hitDelta = right.hitCount - left.hitCount;
    if (hitDelta !== 0) return hitDelta;
    return right.lastSeenAt.localeCompare(left.lastSeenAt);
  });
  return {
    generatedAt: new Date().toISOString(),
    totalHits: routes.reduce((sum, route) => sum + route.hitCount, 0),
    runtimeHits: routes.reduce(
      (sum, route) => sum + getTaggedRuntimeHitCount(route),
      0,
    ),
    smokeHits: routes.reduce(
      (sum, route) => sum + getRouteSmokeHitCount(route),
      0,
    ),
    legacyUnclassifiedHits: routes.reduce(
      (sum, route) => sum + getLegacyUnclassifiedHitCount(route),
      0,
    ),
    routeCount: routes.length,
    routes: routes.slice(0, 20),
  };
}

export function readAdminCompatibilityHistoricalArchiveSummary(): AdminCompatibilityHistoricalArchiveSummary {
  const archives = readArchiveEntries().sort((left, right) =>
    right.archivedAt.localeCompare(left.archivedAt),
  );
  return {
    archiveSchemaVersion: ADMIN_COMPATIBILITY_ARCHIVE_SCHEMA_VERSION,
    archivePath: ARCHIVE_FILE,
    archiveCount: archives.length,
    archivedLegacyUnclassifiedHits: archives.reduce(
      (sum, archive) => sum + archive.legacyUnclassifiedHitsArchived,
      0,
    ),
    latestArchiveAt: archives[0]?.archivedAt || null,
    archives: archives.slice(0, 10),
  };
}

export function archiveHistoricalAdminCompatibilityUsage(input?: {
  reason?: string;
  clear?: boolean;
}) {
  const before = readAdminCompatibilityUsageSummary();
  if (before.runtimeHits > 0) {
    throw new Error(
      `Cannot archive historical compatibility hits while ${before.runtimeHits} source-tagged runtime hit(s) remain.`,
    );
  }

  const routes = readUsageRoutes();
  const legacyRoutes: AdminCompatibilityHistoricalArchiveRoute[] = [];
  routes.forEach((route) => {
    const legacyUnclassifiedHitCount = getLegacyUnclassifiedHitCount(route);
    if (legacyUnclassifiedHitCount <= 0) return;
    legacyRoutes.push({
      legacyPath: route.legacyPath,
      canonicalPath: route.canonicalPath,
      method: route.method,
      hitCount: route.hitCount,
      runtimeHitCount: getTaggedRuntimeHitCount(route),
      smokeHitCount: getRouteSmokeHitCount(route),
      legacyUnclassifiedHitCount,
      firstSeenAt: route.firstSeenAt,
      lastSeenAt: route.lastSeenAt,
      lastUserAgent: route.lastUserAgent,
    });
  });
  const legacyUnclassifiedHitsArchived = legacyRoutes.reduce(
    (sum, route) => sum + route.legacyUnclassifiedHitCount,
    0,
  );
  const shouldClear = input?.clear !== false;
  const archivedAt = new Date().toISOString();
  const archive: AdminCompatibilityHistoricalArchiveEntry | null =
    legacyUnclassifiedHitsArchived > 0
      ? {
          id: `admin-compat-archive-${crypto.randomUUID()}`,
          archivedAt,
          reason:
            input?.reason ||
            "Archived historical compatibility hits recorded before evidence source tagging.",
          cleared: shouldClear,
          runtimeHitsAtArchive: before.runtimeHits,
          smokeHitsAtArchive: before.smokeHits,
          legacyUnclassifiedHitsArchived,
          routeCount: legacyRoutes.length,
          routes: legacyRoutes,
        }
      : null;

  if (archive) {
    prependArchive(archive);
  }

  if (archive && shouldClear) {
    updateJsonFileDurably(
      USAGE_FILE,
      emptyUsageStore,
      (store) => ({
        routes: store.routes
          .map((route) => {
            const runtimeHitCount = getTaggedRuntimeHitCount(route);
            const smokeHitCount = getRouteSmokeHitCount(route);
            const hitCount = runtimeHitCount + smokeHitCount;
            return {
              ...route,
              evidenceVersion: ADMIN_COMPATIBILITY_USAGE_SOURCE_TAG_VERSION,
              hitCount,
              runtimeHitCount,
              smokeHitCount,
              legacyUnclassifiedHitCount: 0,
            } satisfies AdminCompatibilityUsageRoute;
          })
          .filter((route) => route.hitCount > 0),
      }),
      isUsageStore,
    );
  }

  return {
    ok: true,
    archived: Boolean(archive),
    cleared: Boolean(archive && shouldClear),
    archive,
    before,
    after: readAdminCompatibilityUsageSummary(),
    archiveSummary: readAdminCompatibilityHistoricalArchiveSummary(),
  };
}

export function clearAdminCompatibilityUsageSummary() {
  const before = readAdminCompatibilityUsageSummary();
  updateJsonFileDurably(
    USAGE_FILE,
    emptyUsageStore,
    () => emptyUsageStore(),
    isUsageStore,
  );
  return {
    ok: true,
    clearedAt: new Date().toISOString(),
    before,
    after: readAdminCompatibilityUsageSummary(),
  };
}
