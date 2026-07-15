import {
  ADMIN_COMPATIBILITY_ROUTES,
  ADMIN_COMPATIBILITY_SUNSET_ISO,
} from "@/features/admin/compatibility-route";
import {
  getLegacyUnclassifiedHitCount,
  getRouteSmokeHitCount,
  getTaggedRuntimeHitCount,
  readAdminCompatibilityHistoricalArchiveSummary,
  readAdminCompatibilityUsageSummary,
  type AdminCompatibilityHistoricalArchiveSummary,
} from "@/features/admin/compatibility-usage";

export type AdminCompatibilitySunsetRouteEvidence = {
  legacyPath: string;
  canonicalPath: string;
  methods: string[];
  smokeMethods: string[];
  observedMethods: string[];
  smokeCoveredMethods: string[];
  runtimeHitCount: number;
  smokeHitCount: number;
  legacyUnclassifiedHitCount: number;
  totalHitCount: number;
  latestSeenAt: string | null;
  headerSmokeCovered: boolean;
};

export type AdminCompatibilitySunsetEvidence = {
  schemaVersion: "admin.compatibility-sunset.v1";
  generatedAt: string;
  sunsetAt: string;
  daysUntilSunset: number;
  deletionReadiness: "scheduled" | "blocked" | "ready";
  totals: {
    expectedRouteCount: number;
    expectedMethodCount: number;
    requiredSmokeRouteCount: number;
    coveredSmokeRouteCount: number;
    coveredMethodCount: number;
    runtimeHitCount: number;
    smokeHitCount: number;
    legacyUnclassifiedHitCount: number;
    totalHitCount: number;
  };
  historicalArchives: AdminCompatibilityHistoricalArchiveSummary;
  routes: AdminCompatibilitySunsetRouteEvidence[];
  blockers: string[];
  nextActions: string[];
};

function maxIso(values: string[]) {
  return values.sort((left, right) => right.localeCompare(left))[0] || null;
}

function daysUntil(value: string) {
  const deltaMs = new Date(value).getTime() - Date.now();
  return Math.ceil(deltaMs / (24 * 60 * 60 * 1000));
}

export function readAdminCompatibilitySunsetEvidence(): AdminCompatibilitySunsetEvidence {
  const usage = readAdminCompatibilityUsageSummary();
  const historicalArchives = readAdminCompatibilityHistoricalArchiveSummary();
  const routes = ADMIN_COMPATIBILITY_ROUTES.map((route) => {
    const matches = usage.routes.filter(
      (entry) =>
        entry.legacyPath === route.legacyPath &&
        entry.canonicalPath === route.canonicalPath,
    );
    const observedMethods = Array.from(
      new Set(matches.map((entry) => entry.method)),
    ).sort();
    const smokeCoveredMethods = Array.from(
      new Set(
        matches
          .filter((entry) => (entry.smokeHitCount ?? 0) > 0)
          .map((entry) => entry.method),
      ),
    ).sort();
    const runtimeHitCount = matches.reduce(
      (sum, entry) => sum + getTaggedRuntimeHitCount(entry),
      0,
    );
    const smokeHitCount = matches.reduce(
      (sum, entry) => sum + getRouteSmokeHitCount(entry),
      0,
    );
    const legacyUnclassifiedHitCount = matches.reduce(
      (sum, entry) => sum + getLegacyUnclassifiedHitCount(entry),
      0,
    );
    const totalHitCount = matches.reduce(
      (sum, entry) => sum + entry.hitCount,
      0,
    );
    const headerSmokeCovered = route.smokeMethods.every((method) =>
      smokeCoveredMethods.includes(method),
    );
    return {
      legacyPath: route.legacyPath,
      canonicalPath: route.canonicalPath,
      methods: [...route.methods],
      smokeMethods: [...route.smokeMethods],
      observedMethods,
      smokeCoveredMethods,
      runtimeHitCount,
      smokeHitCount,
      legacyUnclassifiedHitCount,
      totalHitCount,
      latestSeenAt: maxIso(
        matches
          .map((entry) => entry.lastSeenAt)
          .filter((value): value is string => typeof value === "string"),
      ),
      headerSmokeCovered,
    };
  });
  const daysRemaining = daysUntil(ADMIN_COMPATIBILITY_SUNSET_ISO);
  const runtimeHitCount = routes.reduce(
    (sum, route) => sum + route.runtimeHitCount,
    0,
  );
  const smokeHitCount = routes.reduce(
    (sum, route) => sum + route.smokeHitCount,
    0,
  );
  const legacyUnclassifiedHitCount = routes.reduce(
    (sum, route) => sum + route.legacyUnclassifiedHitCount,
    0,
  );
  const requiredSmokeRoutes = routes.filter(
    (route) => route.smokeMethods.length > 0,
  );
  const coveredSmokeRouteCount = requiredSmokeRoutes.filter(
    (route) => route.headerSmokeCovered,
  ).length;
  const coveredMethodCount = routes.reduce(
    (sum, route) => sum + route.observedMethods.length,
    0,
  );
  const blockers = [
    ...(coveredSmokeRouteCount === requiredSmokeRoutes.length
      ? []
      : [
          `Admin compatibility header smoke covers ${coveredSmokeRouteCount}/${requiredSmokeRoutes.length} required legacy routes.`,
        ]),
    ...(runtimeHitCount === 0
      ? []
      : [
          `${runtimeHitCount} runtime compatibility hit(s) must age out or be migrated before wrapper deletion.`,
        ]),
    ...(legacyUnclassifiedHitCount === 0
      ? []
      : [
          `${legacyUnclassifiedHitCount} historical compatibility hit(s) predate source tagging; archive or clear them after verifying no runtime callers remain.`,
        ]),
    ...(daysRemaining <= 0
      ? []
      : [
          `Compatibility sunset date has not passed yet (${ADMIN_COMPATIBILITY_SUNSET_ISO}).`,
        ]),
  ];
  const deletionReadiness =
    blockers.length === 0
      ? "ready"
      : daysRemaining > 0
        ? "scheduled"
        : "blocked";

  return {
    schemaVersion: "admin.compatibility-sunset.v1",
    generatedAt: new Date().toISOString(),
    sunsetAt: ADMIN_COMPATIBILITY_SUNSET_ISO,
    daysUntilSunset: daysRemaining,
    deletionReadiness,
    totals: {
      expectedRouteCount: routes.length,
      expectedMethodCount: routes.reduce(
        (sum, route) => sum + route.methods.length,
        0,
      ),
      requiredSmokeRouteCount: requiredSmokeRoutes.length,
      coveredSmokeRouteCount,
      coveredMethodCount,
      runtimeHitCount,
      smokeHitCount,
      legacyUnclassifiedHitCount,
      totalHitCount:
        runtimeHitCount + smokeHitCount + legacyUnclassifiedHitCount,
    },
    historicalArchives,
    routes,
    blockers,
    nextActions: blockers.length
      ? [
          "Keep route smoke coverage current for every required legacy GET wrapper.",
          "Migrate any runtime consumers still calling deprecated Admin APIs.",
          "Delete compatibility wrappers only after the sunset date and a zero-runtime-hit evidence window.",
        ]
      : [
          "Compatibility wrappers are ready for deletion; archive the final zero-hit evidence before removal.",
        ],
  };
}
