import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { readJsonFileDurably, updateJsonFileDurably } from "@/features/persistence/durable-json-file";

export const EXTENSION_QUARANTINE_REVIEW_SCHEMA_VERSION = "extensions.quarantine-review.v1" as const;
type ReviewCase = { id: string; extensionId: string; version: string; packageDigest: string; state: "quarantined" | "released" | "rejected"; checks: { signature: boolean; sandbox: boolean; dependencies: boolean }; operatorId?: string; reason?: string; reviewedAt?: string };
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; checks: Record<string, boolean>; releasedCaseId: string; rejectedCaseId: string };
type Store = { schemaVersion: typeof EXTENSION_QUARANTINE_REVIEW_SCHEMA_VERSION; cases: ReviewCase[]; receipts: Receipt[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "extension-quarantine-review.json");
const emptyStore = (): Store => ({ schemaVersion: EXTENSION_QUARANTINE_REVIEW_SCHEMA_VERSION, cases: [], receipts: [] });
const isStore = (value: unknown): value is Store => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Store>;
  return candidate.schemaVersion === EXTENSION_QUARANTINE_REVIEW_SCHEMA_VERSION && Array.isArray(candidate.cases) && Array.isArray(candidate.receipts);
};
const readStore = () => readJsonFileDurably(STORE_FILE, emptyStore, isStore);
const updateStore = (mutator: (store: Store) => Store) => updateJsonFileDurably(STORE_FILE, emptyStore, mutator, isStore);

export function createQuarantineCase(input: Omit<ReviewCase, "id" | "state">) {
  if (!input.extensionId.trim() || !input.version.trim()) throw new Error("extensionId and version are required.");
  if (!/^[a-f0-9]{64}$/u.test(input.packageDigest)) throw new Error("packageDigest must be a SHA-256 hex digest.");
  if (!input.checks || Object.values(input.checks).some((value) => typeof value !== "boolean")) throw new Error("signature, sandbox, and dependency checks are required.");
  const item: ReviewCase = { ...input, id: `quarantine-${randomUUID()}`, state: "quarantined" };
  updateStore((store) => ({ ...store, cases: [item, ...store.cases] }));
  return item;
}

export function reviewQuarantineCase(input: { caseId: string; action: "release" | "reject"; operatorId: string; reason: string }) {
  const outcome: { value?: ReviewCase } = {};
  updateStore((store) => {
    const current = store.cases.find((entry) => entry.id === input.caseId);
    if (!current) throw new Error("Quarantine case was not found.");
    if (current.state !== "quarantined") throw new Error("Quarantine case was already reviewed.");
    if (!input.operatorId.trim() || !input.reason.trim()) throw new Error("operatorId and reason are required.");
    if (input.action === "release" && !Object.values(current.checks).every(Boolean)) throw new Error("Quarantined package cannot be released while checks are failing.");
    const next: ReviewCase = { ...current, state: input.action === "release" ? "released" : "rejected", operatorId: input.operatorId.trim(), reason: input.reason.trim(), reviewedAt: new Date().toISOString() };
    outcome.value = next;
    return { ...store, cases: store.cases.map((entry) => entry.id === current.id ? next : entry) };
  });
  if (!outcome.value) throw new Error("Quarantine review did not complete.");
  return outcome.value;
}

export function rehearseExtensionQuarantineReview() {
  const released = createQuarantineCase({ extensionId: "community.safe-tool", version: "1.0.0", packageDigest: "a".repeat(64), checks: { signature: true, sandbox: true, dependencies: true } });
  const rejected = createQuarantineCase({ extensionId: "community.unsafe-tool", version: "1.0.0", packageDigest: "b".repeat(64), checks: { signature: false, sandbox: true, dependencies: false } });
  const releasedResult = reviewQuarantineCase({ caseId: released.id, action: "release", operatorId: "local-security-reviewer", reason: "All required checks passed." });
  let failedReleaseDenied = false;
  try { reviewQuarantineCase({ caseId: rejected.id, action: "release", operatorId: "local-security-reviewer", reason: "Should fail." }); } catch { failedReleaseDenied = true; }
  const rejectedResult = reviewQuarantineCase({ caseId: rejected.id, action: "reject", operatorId: "local-security-reviewer", reason: "Signature and dependency checks failed." });
  const checks = { passingPackageReleased: releasedResult.state === "released", failedPackageReleaseDenied: failedReleaseDenied, failedPackageRejected: rejectedResult.state === "rejected", operatorAuditRecorded: Boolean(releasedResult.operatorId && rejectedResult.operatorId) };
  const receipt: Receipt = { id: `quarantine-review-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", checks, releasedCaseId: released.id, rejectedCaseId: rejected.id };
  updateStore((store) => ({ ...store, receipts: [receipt, ...store.receipts].slice(0, 100) }));
  return receipt;
}

export function readExtensionQuarantineReviewEvidence() {
  const store = readStore();
  return { ...store, ok: true as const, generatedAt: new Date().toISOString(), latestPassing: store.receipts.find((entry) => entry.status === "pass") || null, totals: { cases: store.cases.length, quarantined: store.cases.filter((entry) => entry.state === "quarantined").length, released: store.cases.filter((entry) => entry.state === "released").length, rejected: store.cases.filter((entry) => entry.state === "rejected").length }, path: STORE_FILE };
}
