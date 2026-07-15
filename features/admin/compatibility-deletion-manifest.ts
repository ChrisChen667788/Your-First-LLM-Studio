import { existsSync } from "fs";
import path from "path";
import { readAdminCompatibilitySunsetEvidence } from "./compatibility-sunset";

export type AdminCompatibilityDeletionManifestRoute = {
  legacyPath: string;
  canonicalPath: string;
  methods: string[];
  wrapperFile: string;
  canonicalFile: string;
  wrapperExists: boolean;
  canonicalExists: boolean;
  smokeCovered: boolean;
  runtimeClear: boolean;
  historicalClear: boolean;
  preSunsetReady: boolean;
  sunsetElapsed: boolean;
  decision: "keep" | "delete-ready" | "already-removed";
  blockers: string[];
};

export type AdminCompatibilityDeletionManifest = {
  schemaVersion: "admin.compatibility-deletion-manifest.v1";
  generatedAt: string;
  sunsetAt: string;
  status: "scheduled" | "blocked" | "ready";
  preSunsetStatus: "blocked" | "ready";
  totals: {
    routeCount: number;
    wrapperFileCount: number;
    canonicalReplacementCount: number;
    preSunsetReadyCount: number;
    deleteReadyCount: number;
    alreadyRemovedCount: number;
    blockedCount: number;
  };
  routes: AdminCompatibilityDeletionManifestRoute[];
  preSunsetBlockers: string[];
  blockers: string[];
};

function routeFileFor(apiPath: string) {
  return path.join(process.cwd(), "app", ...apiPath.split("/").filter(Boolean), "route.ts");
}

function relativeToWorkspace(filePath: string) {
  return path.relative(process.cwd(), filePath) || filePath;
}

export function readAdminCompatibilityDeletionManifest(): AdminCompatibilityDeletionManifest {
  const sunset = readAdminCompatibilitySunsetEvidence();
  const sunsetElapsed = sunset.daysUntilSunset <= 0;
  const routes = sunset.routes.map<AdminCompatibilityDeletionManifestRoute>((route) => {
    const wrapperFilePath = routeFileFor(route.legacyPath);
    const canonicalFilePath = routeFileFor(route.canonicalPath);
    const wrapperExists = existsSync(wrapperFilePath);
    const canonicalExists = existsSync(canonicalFilePath);
    const runtimeClear = route.runtimeHitCount === 0;
    const historicalClear = route.legacyUnclassifiedHitCount === 0;
    const smokeCovered = route.smokeMethods.length === 0 || route.headerSmokeCovered;
    const preSunsetBlockers = [
      ...(canonicalExists ? [] : [`Canonical replacement is missing: ${route.canonicalPath}.`]),
      ...(smokeCovered ? [] : ["Required compatibility header smoke is incomplete."]),
      ...(runtimeClear ? [] : [`${route.runtimeHitCount} runtime hit(s) remain.`]),
      ...(historicalClear
        ? []
        : [`${route.legacyUnclassifiedHitCount} historical unclassified hit(s) remain.`]),
    ];
    const blockers = [
      ...preSunsetBlockers,
      ...(sunsetElapsed ? [] : [`Sunset has not elapsed (${sunset.sunsetAt}).`]),
    ];
    const decision = !wrapperExists
      ? "already-removed"
      : blockers.length === 0
        ? "delete-ready"
        : "keep";
    return {
      legacyPath: route.legacyPath,
      canonicalPath: route.canonicalPath,
      methods: route.methods,
      wrapperFile: relativeToWorkspace(wrapperFilePath),
      canonicalFile: relativeToWorkspace(canonicalFilePath),
      wrapperExists,
      canonicalExists,
      smokeCovered,
      runtimeClear,
      historicalClear,
      preSunsetReady: preSunsetBlockers.length === 0,
      sunsetElapsed,
      decision,
      blockers,
    };
  });
  const blockers = Array.from(
    new Set(routes.flatMap((route) => route.blockers)),
  );
  const preSunsetBlockers = Array.from(
    new Set(
      routes.flatMap((route) =>
        route.blockers.filter((blocker) => !blocker.startsWith("Sunset has not elapsed")),
      ),
    ),
  );
  const status = blockers.length === 0
    ? "ready"
    : sunsetElapsed
      ? "blocked"
      : "scheduled";
  return {
    schemaVersion: "admin.compatibility-deletion-manifest.v1",
    generatedAt: new Date().toISOString(),
    sunsetAt: sunset.sunsetAt,
    status,
    preSunsetStatus: preSunsetBlockers.length === 0 ? "ready" : "blocked",
    totals: {
      routeCount: routes.length,
      wrapperFileCount: routes.filter((route) => route.wrapperExists).length,
      canonicalReplacementCount: routes.filter((route) => route.canonicalExists).length,
      preSunsetReadyCount: routes.filter((route) => route.preSunsetReady).length,
      deleteReadyCount: routes.filter((route) => route.decision === "delete-ready").length,
      alreadyRemovedCount: routes.filter((route) => route.decision === "already-removed").length,
      blockedCount: routes.filter((route) => route.blockers.length > 0).length,
    },
    routes,
    preSunsetBlockers,
    blockers,
  };
}

export function serializeAdminCompatibilityDeletionRehearsalAsMarkdown() {
  const manifest = readAdminCompatibilityDeletionManifest();
  return [
    "# Admin Compatibility Pre-Sunset Deletion Rehearsal",
    "",
    `Generated: ${manifest.generatedAt}`,
    `Sunset: ${manifest.sunsetAt}`,
    `Pre-sunset status: ${manifest.preSunsetStatus}`,
    `Ready routes: ${manifest.totals.preSunsetReadyCount}/${manifest.totals.wrapperFileCount}`,
    `Formal deletion status: ${manifest.status}`,
    "",
    "## Routes",
    "",
    ...manifest.routes.flatMap((route) => [
      `### ${route.methods.join(", ")} ${route.legacyPath}`,
      "",
      `- Canonical: ${route.canonicalPath}`,
      `- Wrapper: ${route.wrapperFile}`,
      `- Canonical file: ${route.canonicalFile}`,
      `- Pre-sunset ready: ${route.preSunsetReady ? "yes" : "no"}`,
      `- Smoke covered: ${route.smokeCovered ? "yes" : "no"}`,
      `- Runtime clear: ${route.runtimeClear ? "yes" : "no"}`,
      `- Historical clear: ${route.historicalClear ? "yes" : "no"}`,
      `- Sunset elapsed: ${route.sunsetElapsed ? "yes" : "no"}`,
      `- Decision: ${route.decision}`,
      ...(route.blockers.length
        ? route.blockers.map((blocker) => `- Blocker: ${blocker}`)
        : ["- Blockers: none"]),
      "",
    ]),
  ].join("\n");
}
