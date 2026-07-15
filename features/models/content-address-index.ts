import { existsSync, statSync } from "fs";
import { readModelAcquisitionRegistry } from "@/features/models/model-acquisition";

export const MODEL_CONTENT_INDEX_SCHEMA_VERSION = "models.content-address-index.v1" as const;

export function readModelContentAddressIndex() {
  const completed = readModelAcquisitionRegistry().jobs.filter((job) =>
    job.status === "completed" && job.verifiedSha256 && job.completedFile && existsSync(job.completedFile),
  );
  const groups = new Map<string, typeof completed>();
  for (const job of completed) groups.set(job.verifiedSha256 as string, [...(groups.get(job.verifiedSha256 as string) || []), job]);
  const objects = [...groups.entries()].map(([sha256, jobs]) => {
    const sizes = jobs.map((job) => {
      try { return statSync(job.completedFile as string).size; } catch { return 0; }
    });
    const canonicalBytes = Math.max(0, ...sizes);
    return {
      sha256,
      canonicalPath: jobs[0]?.completedFile || null,
      bytes: canonicalBytes,
      references: jobs.map((job) => ({ jobId: job.id, path: job.completedFile, source: job.source, modelId: job.modelId })),
      duplicateCopies: Math.max(0, jobs.length - 1),
      potentialSavingsBytes: canonicalBytes * Math.max(0, jobs.length - 1),
    };
  });
  return {
    ok: true as const,
    schemaVersion: MODEL_CONTENT_INDEX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "read-only-reconciliation" as const,
    objects,
    totals: {
      objects: objects.length,
      references: objects.reduce((sum, object) => sum + object.references.length, 0),
      duplicateCopies: objects.reduce((sum, object) => sum + object.duplicateCopies, 0),
      potentialSavingsBytes: objects.reduce((sum, object) => sum + object.potentialSavingsBytes, 0),
    },
    blockers: ["Automatic hardlink/delete deduplication remains disabled until filesystem and external-disk capability checks pass."],
  };
}
