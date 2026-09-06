import { z } from "zod";

const text = z.string().trim().min(1).max(240);
const revision = z.number().int().positive();
const job = { jobId: text, expectedRevision: revision };
const worker = { ...job, workerId: text };
const lease = { ...worker, fenceToken: revision };
const ttlMs = z.number().int().min(5_000).max(600_000).optional();

export const evidenceCollectionRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("queue"), planVersion: text, sourceMilestone: text,
    subjectId: text, organizationId: text, operatorId: text, idempotencyKey: text }),
  z.strictObject({ action: z.literal("claim"), ...worker, ttlMs }),
  z.strictObject({ action: z.literal("execute"), ...worker }),
  z.strictObject({ action: z.literal("heartbeat"), ...lease, ttlMs }),
  z.strictObject({ action: z.literal("submit-receipt"), ...lease, receipt: z.record(z.string(), z.unknown()) }),
  z.strictObject({ action: z.literal("fail"), ...lease, reason: text }),
  z.strictObject({ action: z.literal("retry"), ...job, actorId: text }),
  z.strictObject({ action: z.literal("cancel"), ...job, actorId: text, reason: text }),
  z.strictObject({ action: z.literal("review"), ...job, reviewerId: text,
    decision: z.enum(["accepted", "rejected"]), reason: text }),
  z.strictObject({ action: z.literal("record-train") }),
  z.strictObject({ action: z.literal("export-bundle") }),
]);
