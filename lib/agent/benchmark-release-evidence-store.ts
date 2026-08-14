import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { readJsonFileDurably, updateJsonFileDurably } from "@/features/persistence/durable-json-file";

export type StoredBenchmarkReleaseEvidence = {
  id: string;
  kind: "benchmark-release-evidence";
  runId: string;
  title?: string;
  note?: string;
  pinnedAt: string;
};

const EVIDENCE_FILE = getLocalAgentDataPath("benchmark-release-evidence.json");

type EvidenceStore = {
  schemaVersion: "0.3.0";
  updatedAt: string;
  entries: StoredBenchmarkReleaseEvidence[];
};

const emptyStore = (): EvidenceStore => ({
  schemaVersion: "0.3.0",
  updatedAt: new Date(0).toISOString(),
  entries: [],
});

function isEvidenceStore(value: unknown): value is EvidenceStore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EvidenceStore>;
  return candidate.schemaVersion === "0.3.0"
    && typeof candidate.updatedAt === "string"
    && Array.isArray(candidate.entries);
}

function normalizeEntries(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<StoredBenchmarkReleaseEvidence>;
      if (candidate.kind !== "benchmark-release-evidence") return [];
      if (typeof candidate.id !== "string" || typeof candidate.runId !== "string" || typeof candidate.pinnedAt !== "string") {
        return [];
      }
      return [{
        id: candidate.id,
        kind: "benchmark-release-evidence" as const,
        runId: candidate.runId,
        title: typeof candidate.title === "string" ? candidate.title : undefined,
        note: typeof candidate.note === "string" ? candidate.note : undefined,
        pinnedAt: candidate.pinnedAt
      }];
    })
    .sort((left, right) => right.pinnedAt.localeCompare(left.pinnedAt));
}

export function readBenchmarkReleaseEvidence() {
  return normalizeEntries(readJsonFileDurably(EVIDENCE_FILE, emptyStore, isEvidenceStore).entries);
}

function updateBenchmarkReleaseEvidence(
  mutator: (entries: StoredBenchmarkReleaseEvidence[]) => StoredBenchmarkReleaseEvidence[],
) {
  return updateJsonFileDurably(EVIDENCE_FILE, emptyStore, (store) => ({
    schemaVersion: "0.3.0" as const,
    updatedAt: new Date().toISOString(),
    entries: mutator(normalizeEntries(store.entries)),
  }), isEvidenceStore);
}

export function upsertBenchmarkReleaseEvidence(input: {
  runId: string;
  title?: string;
  note?: string;
}) {
  const outcome: { value?: StoredBenchmarkReleaseEvidence } = {};
  updateBenchmarkReleaseEvidence((entries) => {
    const existing = entries.find((entry) => entry.runId === input.runId) || null;
    const nextEntry: StoredBenchmarkReleaseEvidence = existing
      ? { ...existing, title: input.title ?? existing.title, note: input.note ?? existing.note, pinnedAt: new Date().toISOString() }
      : { id: crypto.randomUUID(), kind: "benchmark-release-evidence", runId: input.runId, title: input.title, note: input.note, pinnedAt: new Date().toISOString() };
    outcome.value = nextEntry;
    return [nextEntry, ...entries.filter((entry) => entry.runId !== input.runId)].slice(0, 20);
  });
  if (!outcome.value) throw new Error("Benchmark evidence update did not complete.");
  return outcome.value;
}

export function removeBenchmarkReleaseEvidence(runId: string) {
  const outcome = { deleted: false };
  updateBenchmarkReleaseEvidence((entries) => {
    const nextEntries = entries.filter((entry) => entry.runId !== runId);
    outcome.deleted = nextEntries.length !== entries.length;
    return nextEntries;
  });
  return outcome.deleted;
}
