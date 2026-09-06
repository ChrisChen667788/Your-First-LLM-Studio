import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";

// Only a temporary data directory and loopback transport are used in this rehearsal.
assert.ok(process.env.LOCAL_AGENT_DATA_DIR?.includes("evidence-collection-integration-"));
process.chdir(process.env.LOCAL_AGENT_DATA_DIR);
let modelCalls = 0;
let completionCalls = 0;
let fail = false;
const server = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, "Bearer integration-only");
  if (request.url === "/v1/models") {
    modelCalls++;
    response.writeHead(fail ? 503 : 200, { "content-type": "application/json" });
    response.end(JSON.stringify(fail ? { error: "unavailable" } : { data: [{ id: "deepseek-v4-pro" }, { id: "deepseek-v4-flash" }] }));
    return;
  }
  if (request.url === "/v1/chat/completions") {
    completionCalls++;
    let body = "";
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body) as { messages?: Array<{ content?: unknown }> };
    const prompt = String(payload.messages?.at(-1)?.content || "");
    const token = prompt.match(/FIRST_LLM_ROUTING_\d{2}/)?.[0] || "";
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: token } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
    return;
  }
  response.writeHead(404).end();
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
process.env.DEEPSEEK_API_KEY = "integration-only";
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(url.origin, `http://127.0.0.1:${address.port}`, "Integration test may never contact a real provider");
  return nativeFetch(input, init);
};
try {
  const service = await import("../../features/evidence/collection-service");
  const { executeEvidenceCollection } = await import("../../features/evidence/collection-execution");
  const { evidenceCollectionStorePath, readEvidenceCollectionStore } = await import("../../features/evidence/collection-store");
  const { readOperationalEvidenceCandidates } = await import("../../features/evidence/operational-receipts");
  const queue = {
    planVersion: "v4.2.4", sourceMilestone: "v4.0.0", subjectId: "deepseek-api",
    organizationId: "studio-org", operatorId: "operator-alpha", idempotencyKey: "integration-catalog-request",
  };
  const queued = service.queueEvidenceCollection(queue).job;
  assert.equal(service.queueEvidenceCollection(queue).deduplicated, true);
  const worker = { jobId: queued.id, workerId: "worker-alpha", expectedRevision: queued.revision };
  fail = true;
  await assert.rejects(executeEvidenceCollection(worker), /fresh, non-empty/);
  let job = readEvidenceCollectionStore().jobs[0]!;
  assert.equal(job.status, "retry-wait");
  job = service.retryEvidenceCollection({ jobId: job.id, actorId: queue.operatorId, expectedRevision: job.revision });
  fail = false;
  const submitted = await executeEvidenceCollection({ ...worker, expectedRevision: job.revision });
  job = submitted.job;
  assert.equal(modelCalls, 2);
  assert.equal(job.attempt, 2);
  assert.equal(job.status, "review");
  assert.equal(readOperationalEvidenceCandidates().length, 0);
  assert.throws(() => service.reviewEvidenceCollection({ jobId: job.id, expectedRevision: job.revision, reviewerId: queue.operatorId, decision: "accepted", reason: "Receipt inspected." }), /distinct/);
  const reviewed = service.reviewEvidenceCollection({ jobId: job.id, expectedRevision: job.revision, reviewerId: "reviewer-beta", decision: "accepted", reason: "Transport fixture verified, not production evidence." });
  assert.equal(reviewed.job.status, "accepted");
  assert.ok(reviewed.job.review?.candidateDigest);
  assert.equal(service.reviewEvidenceCollection({ jobId: job.id, expectedRevision: reviewed.job.revision, reviewerId: "reviewer-beta", decision: "accepted", reason: "Recover completed link." }).candidateDigest, reviewed.candidateDigest);
  assert.equal(readOperationalEvidenceCandidates().length, 1);
  const persisted = JSON.parse(readFileSync(evidenceCollectionStorePath(), "utf8"));
  assert.equal(persisted.jobs[0].review.candidateDigest, reviewed.candidateDigest);
  assert.equal(JSON.stringify(persisted).includes("integration-only"), false);
  const again = service.queueEvidenceCollection({ ...queue, idempotencyKey: "integration-catalog-fresh-request" }).job;
  await executeEvidenceCollection({ ...worker, jobId: again.id, expectedRevision: again.revision });
  assert.equal(modelCalls, 3, "Explicit execution must bypass the model-list cache");
  assert.equal(completionCalls, 0);
  const qualityOne = service.queueEvidenceCollection({ ...queue, planVersion: "v4.2.5", sourceMilestone: "v4.0.1", idempotencyKey: "integration-quality-request" }).job;
  const qualityResult = await executeEvidenceCollection({ ...worker, jobId: qualityOne.id, expectedRevision: qualityOne.revision });
  assert.equal(qualityResult.job.status, "review");
  assert.equal(qualityResult.validation.checks.requiredMetrics, true);
  assert.equal(qualityResult.validation.ok, true);
  const shadowOne = service.queueEvidenceCollection({ ...queue, planVersion: "v4.2.5", sourceMilestone: "v4.0.2", idempotencyKey: "integration-shadow-request" }).job;
  const shadowResult = await executeEvidenceCollection({ ...worker, jobId: shadowOne.id, expectedRevision: shadowOne.revision });
  assert.equal(shadowResult.validation.checks.requiredMetrics, true);
  assert.equal(completionCalls, 80);
  console.log("durable collection integration passed");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
