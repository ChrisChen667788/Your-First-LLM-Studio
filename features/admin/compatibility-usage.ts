import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const USAGE_FILE = getLocalAgentDataPath("admin-compatibility-usage.json");

export type AdminCompatibilityUsageRoute = {
  key: string;
  legacyPath: string;
  canonicalPath: string;
  method: string;
  hitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUserAgent?: string;
};

export type AdminCompatibilityUsageSummary = {
  generatedAt: string;
  totalHits: number;
  routeCount: number;
  routes: AdminCompatibilityUsageRoute[];
};

function ensureUsageDir() {
  mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
}

function readUsageRoutes() {
  if (!existsSync(USAGE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(USAGE_FILE, "utf8")) as {
      routes?: AdminCompatibilityUsageRoute[];
    };
    return Array.isArray(parsed.routes) ? parsed.routes : [];
  } catch {
    return [];
  }
}

function normalizeLegacyRequest(request: unknown) {
  if (!(request instanceof Request)) {
    return {
      method: "GET",
      legacyPath: "unknown",
      userAgent: undefined,
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
    const routes = readUsageRoutes();
    const index = routes.findIndex((route) => route.key === key);
    if (index >= 0) {
      routes[index] = {
        ...routes[index],
        hitCount: routes[index].hitCount + 1,
        lastSeenAt: now,
        lastUserAgent: normalized.userAgent || routes[index].lastUserAgent,
      };
    } else {
      routes.push({
        key,
        legacyPath: normalized.legacyPath,
        canonicalPath,
        method: normalized.method,
        hitCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        lastUserAgent: normalized.userAgent,
      });
    }

    ensureUsageDir();
    writeFileSync(
      USAGE_FILE,
      `${JSON.stringify({ routes }, null, 2)}\n`,
      "utf8",
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
    routeCount: routes.length,
    routes: routes.slice(0, 20),
  };
}

export function clearAdminCompatibilityUsageSummary() {
  const before = readAdminCompatibilityUsageSummary();
  try {
    if (existsSync(USAGE_FILE)) {
      unlinkSync(USAGE_FILE);
    }
  } catch {
    writeFileSync(USAGE_FILE, `${JSON.stringify({ routes: [] }, null, 2)}\n`, "utf8");
  }
  return {
    ok: true,
    clearedAt: new Date().toISOString(),
    before,
    after: readAdminCompatibilityUsageSummary(),
  };
}
