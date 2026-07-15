import crypto from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import {
  PROVIDER_OPS_EVIDENCE_SNAPSHOT_SCHEMA_VERSION,
  type ProviderOpsEvidenceRetentionPolicy,
  type ProviderOpsEvidenceRetentionResult,
  type ProviderOpsPinnedSnapshotFreshness,
  type ProviderOpsEvidenceSnapshot,
  type ProviderOpsEvidenceSnapshotIntegritySummary,
  type ProviderOpsEvidenceSnapshotStoreSummary,
} from "./contracts";
import {
  hasFreshProviderOpsEvidence,
  readProviderOpsEvidenceSummary,
} from "./provider-ops-evidence";

const SNAPSHOT_FILE = getLocalAgentDataPath("provider-ops-evidence-snapshots.json");
const MAX_STORED_SNAPSHOTS = 200;

type ProviderOpsEvidenceSnapshotStore = {
  schemaVersion?: string;
  snapshots?: Array<Omit<ProviderOpsEvidenceSnapshot, "integrity"> & {
    integrity?: Partial<ProviderOpsEvidenceSnapshot["integrity"]>;
  }>;
};

type StoredProviderOpsEvidenceSnapshot =
  ProviderOpsEvidenceSnapshotStore["snapshots"] extends Array<infer T> | undefined
    ? T
    : never;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function snapshotDigest(
  snapshot: Omit<ProviderOpsEvidenceSnapshot, "integrity">,
) {
  const { pinned: _pinned, ...immutableSnapshot } = snapshot;
  return crypto
    .createHash("sha256")
    .update(stableStringify(immutableSnapshot))
    .digest("hex");
}

function hydrateSnapshot(
  snapshot: StoredProviderOpsEvidenceSnapshot,
): ProviderOpsEvidenceSnapshot {
  const { integrity, ...payload } = snapshot;
  const expectedDigest = snapshotDigest(payload);
  const storedDigest = typeof integrity?.digest === "string" ? integrity.digest : "";
  return {
    ...payload,
    integrity: {
      algorithm: "sha256",
      digest: storedDigest || expectedDigest,
      status: !storedDigest
        ? "missing"
        : storedDigest === expectedDigest
          ? "verified"
          : "invalid",
    },
  };
}

function ensureSnapshotDir() {
  mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
}

function readStoredSnapshots(): StoredProviderOpsEvidenceSnapshot[] {
  if (!existsSync(SNAPSHOT_FILE)) return [];
  try {
    const parsed = JSON.parse(
      readFileSync(SNAPSHOT_FILE, "utf8"),
    ) as ProviderOpsEvidenceSnapshotStore;
    return Array.isArray(parsed.snapshots) ? parsed.snapshots : [];
  } catch {
    return [];
  }
}

function readSnapshots() {
  return readStoredSnapshots().map(hydrateSnapshot);
}

function buildIntegritySummary(
  snapshots: ProviderOpsEvidenceSnapshot[],
): ProviderOpsEvidenceSnapshotIntegritySummary {
  const verifiedCount = snapshots.filter(
    (snapshot) => snapshot.integrity.status === "verified",
  ).length;
  const missingCount = snapshots.filter(
    (snapshot) => snapshot.integrity.status === "missing",
  ).length;
  const invalidCount = snapshots.filter(
    (snapshot) => snapshot.integrity.status === "invalid",
  ).length;
  return {
    status: missingCount === 0 && invalidCount === 0
      ? "verified"
      : "attention-required",
    verifiedAt: new Date().toISOString(),
    verifiedCount,
    missingCount,
    invalidCount,
  };
}

function writeSnapshots(snapshots: ProviderOpsEvidenceSnapshot[]) {
  ensureSnapshotDir();
  const storedSnapshots = snapshots.slice(0, MAX_STORED_SNAPSHOTS).map(
    (snapshot) => {
      const { integrity, ...payload } = snapshot;
      return {
        ...payload,
        ...(integrity.status === "missing"
          ? {}
          : {
              integrity: {
                algorithm: "sha256" as const,
                digest: integrity.digest,
              },
            }),
      };
    },
  );
  writeFileSync(
    SNAPSHOT_FILE,
    `${JSON.stringify(
      {
        schemaVersion: PROVIDER_OPS_EVIDENCE_SNAPSHOT_SCHEMA_VERSION,
        snapshots: storedSnapshots,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function sortSnapshots(snapshots: ProviderOpsEvidenceSnapshot[]) {
  return [...snapshots].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function readProviderOpsEvidenceSnapshots(options?: {
  limit?: number;
}): ProviderOpsEvidenceSnapshotStoreSummary {
  const snapshots = sortSnapshots(readSnapshots());
  const limit = Math.max(1, Math.min(options?.limit || 30, MAX_STORED_SNAPSHOTS));
  return {
    schemaVersion: PROVIDER_OPS_EVIDENCE_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    path: SNAPSHOT_FILE,
    totalCount: snapshots.length,
    pinnedCount: snapshots.filter((snapshot) => snapshot.pinned).length,
    qualifyingCount: snapshots.filter(
      (snapshot) => snapshot.qualifiesAsFreshEvidence,
    ).length,
    latestAt: snapshots[0]?.createdAt || null,
    latestPinnedAt:
      snapshots.find((snapshot) => snapshot.pinned)?.createdAt || null,
    integrity: buildIntegritySummary(snapshots),
    snapshots: snapshots.slice(0, limit),
  };
}

export function verifyProviderOpsEvidenceSnapshotIntegrity(options?: {
  repairMissing?: boolean;
}) {
  const snapshots = sortSnapshots(readSnapshots());
  const before = buildIntegritySummary(snapshots);
  if (options?.repairMissing) {
    writeSnapshots(
      snapshots.map((snapshot) => ({
        ...snapshot,
        integrity: {
          algorithm: "sha256",
          digest: snapshot.integrity.digest,
          status: snapshot.integrity.status === "missing"
            ? "verified"
            : snapshot.integrity.status,
        },
      })),
    );
  }
  return {
    ok: before.invalidCount === 0,
    repairedCount: options?.repairMissing ? before.missingCount : 0,
    before,
    store: readProviderOpsEvidenceSnapshots({ limit: MAX_STORED_SNAPSHOTS }),
  };
}

export function captureProviderOpsEvidenceSnapshot(input?: {
  label?: string;
  reason?: string;
  pinned?: boolean;
  windowHours?: number;
}) {
  const summary = readProviderOpsEvidenceSummary({
    windowHours: input?.windowHours || 24,
  });
  const qualifiesAsFreshEvidence = hasFreshProviderOpsEvidence(summary);
  const evidenceAt = [
    summary.releaseProbe.latestSuccessfulAt,
    ...summary.providers.map((provider) => provider.lastSuccessAt),
  ]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] || null;
  const pinned = input?.pinned === true;
  if (pinned && !qualifiesAsFreshEvidence) {
    throw new Error(
      "Provider evidence without a successful chat request or release probe cannot be pinned.",
    );
  }

  const createdAt = new Date().toISOString();
  const snapshotPayload: Omit<ProviderOpsEvidenceSnapshot, "integrity"> = {
    id: `provider-evidence-${crypto.randomUUID()}`,
    createdAt,
    label: input?.label?.trim() || `Provider Ops ${createdAt}`,
    reason:
      input?.reason?.trim() ||
      "Captured from the current Provider Ops release evidence window.",
    pinned,
    qualifiesAsFreshEvidence,
    evidenceAt,
    summary,
  };
  const snapshot: ProviderOpsEvidenceSnapshot = {
    ...snapshotPayload,
    integrity: {
      algorithm: "sha256",
      digest: snapshotDigest(snapshotPayload),
      status: "verified",
    },
  };
  writeSnapshots([snapshot, ...sortSnapshots(readSnapshots())]);
  return {
    ok: true,
    snapshot,
    store: readProviderOpsEvidenceSnapshots(),
  };
}

export function setProviderOpsEvidenceSnapshotPinned(input: {
  id: string;
  pinned: boolean;
}) {
  const snapshots = readSnapshots();
  const index = snapshots.findIndex((snapshot) => snapshot.id === input.id);
  if (index < 0) {
    throw new Error(`Unknown Provider evidence snapshot: ${input.id}`);
  }
  if (input.pinned && !snapshots[index].qualifiesAsFreshEvidence) {
    throw new Error("Only qualifying Provider evidence snapshots can be pinned.");
  }
  snapshots[index] = {
    ...snapshots[index],
    pinned: input.pinned,
  };
  writeSnapshots(sortSnapshots(snapshots));
  return {
    ok: true,
    snapshot: snapshots[index],
    store: readProviderOpsEvidenceSnapshots(),
  };
}

export function deleteProviderOpsEvidenceSnapshot(id: string) {
  const snapshots = readSnapshots();
  const target = snapshots.find((snapshot) => snapshot.id === id);
  if (!target) {
    throw new Error(`Unknown Provider evidence snapshot: ${id}`);
  }
  if (target.pinned) {
    throw new Error("Pinned Provider evidence must be unpinned before deletion.");
  }
  writeSnapshots(snapshots.filter((snapshot) => snapshot.id !== id));
  return {
    ok: true,
    deletedId: id,
    store: readProviderOpsEvidenceSnapshots(),
  };
}

export function applyProviderOpsEvidenceRetention(
  input?: Partial<ProviderOpsEvidenceRetentionPolicy>,
): ProviderOpsEvidenceRetentionResult {
  const policy: ProviderOpsEvidenceRetentionPolicy = {
    maxSnapshots: Math.max(5, Math.min(input?.maxSnapshots || 50, 200)),
    maxAgeDays: Math.max(7, Math.min(input?.maxAgeDays || 90, 730)),
    preservePinned: input?.preservePinned !== false,
  };
  const snapshots = sortSnapshots(readSnapshots());
  const cutoffMs = Date.now() - policy.maxAgeDays * 24 * 60 * 60 * 1000;
  const retained: ProviderOpsEvidenceSnapshot[] = [];
  let protectedCount = 0;
  for (const snapshot of snapshots) {
    if (policy.preservePinned && snapshot.pinned) {
      retained.push(snapshot);
      protectedCount += 1;
      continue;
    }
    const createdMs = new Date(snapshot.createdAt).getTime();
    if (!Number.isFinite(createdMs) || createdMs < cutoffMs) continue;
    const nonPinnedCount = retained.filter((entry) => !entry.pinned).length;
    if (nonPinnedCount >= policy.maxSnapshots) continue;
    retained.push(snapshot);
  }
  writeSnapshots(retained);
  return {
    appliedAt: new Date().toISOString(),
    beforeCount: snapshots.length,
    afterCount: retained.length,
    removedCount: snapshots.length - retained.length,
    protectedCount,
    policy,
  };
}

export function getProviderOpsEvidenceSnapshotPath() {
  ensureSnapshotDir();
  return SNAPSHOT_FILE;
}

export function readLatestPinnedProviderOpsEvidenceSnapshot(options?: {
  maxAgeHours?: number;
  now?: Date;
}): ProviderOpsPinnedSnapshotFreshness {
  const maxAgeHours = Math.max(1, Math.min(options?.maxAgeHours || 24, 168));
  const snapshot = sortSnapshots(readSnapshots()).find(
    (entry) => entry.pinned && entry.qualifiesAsFreshEvidence,
  ) || null;
  const evidenceAt = snapshot?.evidenceAt || snapshot?.createdAt || null;
  const evidenceMs = evidenceAt ? new Date(evidenceAt).getTime() : Number.NaN;
  const nowMs = (options?.now || new Date()).getTime();
  const ageHours = Number.isFinite(evidenceMs)
    ? Math.max(0, (nowMs - evidenceMs) / (60 * 60 * 1000))
    : null;
  return {
    maxAgeHours,
    snapshot,
    evidenceAt,
    ageHours: ageHours === null ? null : Number(ageHours.toFixed(2)),
    fresh:
      Boolean(snapshot) && ageHours !== null && ageHours <= maxAgeHours,
  };
}

export function serializeProviderOpsEvidenceSnapshotsAsMarkdown() {
  const store = readProviderOpsEvidenceSnapshots({ limit: MAX_STORED_SNAPSHOTS });
  const lines = [
    "# Provider Ops Evidence Snapshots",
    "",
    `Generated at: ${store.generatedAt}`,
    `Snapshots: ${store.totalCount}`,
    `Pinned: ${store.pinnedCount}`,
    `Qualifying: ${store.qualifyingCount}`,
    "",
  ];
  for (const snapshot of store.snapshots) {
    lines.push(`## ${snapshot.label}`);
    lines.push("");
    lines.push(`- ID: ${snapshot.id}`);
    lines.push(`- Created: ${snapshot.createdAt}`);
    lines.push(`- Pinned: ${snapshot.pinned ? "yes" : "no"}`);
    lines.push(
      `- Qualifies as fresh evidence: ${snapshot.qualifiesAsFreshEvidence ? "yes" : "no"}`,
    );
    lines.push(`- Evidence event time: ${snapshot.evidenceAt || "unknown"}`);
    lines.push(`- Integrity: ${snapshot.integrity.status} (${snapshot.integrity.digest})`);
    lines.push(`- Window: ${snapshot.summary.windowHours}h`);
    lines.push(`- Chat requests: ${snapshot.summary.totals.totalRequests}`);
    lines.push(
      `- Release probes: ${snapshot.summary.releaseProbe.successCount}/${snapshot.summary.releaseProbe.totalCount} successful`,
    );
    lines.push(`- Reason: ${snapshot.reason}`);
    if (snapshot.summary.topRisks.length) {
      lines.push(`- Risks: ${snapshot.summary.topRisks.join("; ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
