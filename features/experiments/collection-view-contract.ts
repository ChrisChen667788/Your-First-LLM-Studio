import { z } from "zod";

export const collectionQueueJobSchema = z.object({
  id: z.string(), planVersion: z.string(), sourceMilestone: z.string(), subjectId: z.string(),
  operatorId: z.string(), status: z.enum(["queued", "running", "retry-wait", "review", "accepted", "rejected", "failed", "cancelled"]),
  revision: z.number().int().positive(), attempt: z.number().int().nonnegative(), maxAttempts: z.number().int().positive(),
  submission: z.object({ receipt: z.record(z.string(), z.unknown()) }).nullable(),
  review: z.object({ reviewerId: z.string(), reason: z.string(), candidateDigest: z.string().nullable() }).nullable(),
  blockers: z.array(z.string()),
});
export type CollectionQueueJob = z.infer<typeof collectionQueueJobSchema>;

export const collectionViewSchema = z.object({
  totals: z.object({ versions: z.number(), sourcePassed: z.number(), localPassed: z.number(), jobs: z.number(), acceptedJobs: z.number(), reviewJobs: z.number() }),
  versions: z.array(z.object({
    version: z.string(), label: z.string(), kind: z.enum(["control", "collector", "release"]),
    sourceMilestones: z.array(z.string()), localStatus: z.enum(["pass", "hold"]),
    sourceStatus: z.enum(["pass", "hold"]), executionStatus: z.enum(["implemented", "planned"]), mode: z.string(),
    jobTotals: z.object({ total: z.number(), accepted: z.number(), review: z.number(), active: z.number() }), blockers: z.array(z.string()),
  })),
  stateDigest: z.string(), productionStatus: z.literal("blocked"),
  queue: z.object({ jobs: z.array(collectionQueueJobSchema) }),
  promotionBundle: z.looseObject({ status: z.enum(["ready", "hold"]), evidenceDigest: z.string() }),
});
export type CollectionView = z.infer<typeof collectionViewSchema>;
