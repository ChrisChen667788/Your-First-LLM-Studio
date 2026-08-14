import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { readJsonFileDurably, updateJsonFileDurably } from "@/features/persistence/durable-json-file";

export const GOVERNANCE_ACCESS_REVIEW_SCHEMA_VERSION = "governance.access-review.v1" as const;
type Review = { id: string; workspaceId: string; requesterId: string; subjectId: string; resource: string; permission: string; state: "pending" | "approved" | "denied" | "revoked" | "expired"; requestedAt: string; expiresAt: string; reviewerId?: string; decisionReason?: string; decidedAt?: string };
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; checks: Record<string, boolean>; reviewId: string };
type Store = { schemaVersion: typeof GOVERNANCE_ACCESS_REVIEW_SCHEMA_VERSION; reviews: Review[]; receipts: Receipt[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "governance-access-review.json");
const emptyStore = (): Store => ({ schemaVersion: GOVERNANCE_ACCESS_REVIEW_SCHEMA_VERSION, reviews: [], receipts: [] });
const isStore = (value: unknown): value is Store => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Store>;
  return candidate.schemaVersion === GOVERNANCE_ACCESS_REVIEW_SCHEMA_VERSION && Array.isArray(candidate.reviews) && Array.isArray(candidate.receipts);
};
const readStore = () => readJsonFileDurably(STORE_FILE, emptyStore, isStore);
const updateStore = (mutator: (store: Store) => Store) => updateJsonFileDurably(STORE_FILE, emptyStore, mutator, isStore);

export function requestAccessReview(input: { workspaceId: string; requesterId: string; subjectId: string; resource: string; permission: string; ttlMinutes?: number }) {
  if (Object.values(input).some((value) => typeof value === "string" && !value.trim())) throw new Error("Access review fields are required.");
  const now = new Date();
  const review: Review = { ...input, id: `access-review-${randomUUID()}`, state: "pending", requestedAt: now.toISOString(), expiresAt: new Date(now.getTime() + (input.ttlMinutes || 60) * 60_000).toISOString() };
  updateStore((store) => ({ ...store, reviews: [review, ...store.reviews] }));
  return review;
}

export function decideAccessReview(input: { reviewId: string; reviewerId: string; reviewerRole: "security-admin" | "workspace-owner" | "builder"; decision: "approve" | "deny"; reason: string; now?: Date }) {
  const outcome: { value?: Review } = {};
  updateStore((store) => {
    const current = store.reviews.find((entry) => entry.id === input.reviewId);
    if (!current) throw new Error("Access review was not found.");
    if (current.state !== "pending") throw new Error("Access review is not pending.");
    if (current.requesterId === input.reviewerId) throw new Error("Four-eyes policy forbids self approval.");
    if (!["security-admin", "workspace-owner"].includes(input.reviewerRole)) throw new Error("Reviewer role cannot decide access requests.");
    const now = input.now || new Date();
    if (Date.parse(current.expiresAt) <= now.getTime()) throw new Error("Access review expired before decision.");
    if (!input.reason.trim()) throw new Error("Decision reason is required.");
    const next: Review = { ...current, state: input.decision === "approve" ? "approved" : "denied", reviewerId: input.reviewerId, decisionReason: input.reason.trim(), decidedAt: now.toISOString() };
    outcome.value = next;
    return { ...store, reviews: store.reviews.map((entry) => entry.id === current.id ? next : entry) };
  });
  if (!outcome.value) throw new Error("Access review decision did not complete.");
  return outcome.value;
}

export function rehearseGovernanceAccessReview() {
  const review = requestAccessReview({ workspaceId: "workspace-a", requesterId: "builder-a", subjectId: "service-account-eval", resource: "dataset:private-eval", permission: "read", ttlMinutes: 30 });
  let selfApprovalDenied = false;
  try { decideAccessReview({ reviewId: review.id, reviewerId: "builder-a", reviewerRole: "workspace-owner", decision: "approve", reason: "Invalid self approval." }); } catch { selfApprovalDenied = true; }
  const approved = decideAccessReview({ reviewId: review.id, reviewerId: "security-admin-b", reviewerRole: "security-admin", decision: "approve", reason: "Time-bounded evaluation access approved." });
  const checks = { selfApprovalDenied, independentReviewerApproved: approved.state === "approved", reviewerAudited: approved.reviewerId === "security-admin-b", reasonAudited: Boolean(approved.decisionReason), workspaceScoped: approved.workspaceId === "workspace-a" };
  const receipt: Receipt = { id: `access-review-receipt-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", checks, reviewId: review.id };
  updateStore((store) => ({ ...store, receipts: [receipt, ...store.receipts].slice(0, 100) }));
  return receipt;
}

export function readGovernanceAccessReviewEvidence() {
  const store = readStore();
  return { ...store, ok: true as const, generatedAt: new Date().toISOString(), latestPassing: store.receipts.find((entry) => entry.status === "pass") || null, totals: { reviews: store.reviews.length, pending: store.reviews.filter((entry) => entry.state === "pending").length, approved: store.reviews.filter((entry) => entry.state === "approved").length }, path: STORE_FILE };
}
