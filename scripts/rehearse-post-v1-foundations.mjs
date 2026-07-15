import { createHash, generateKeyPairSync, sign } from "crypto";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import http from "http";
import os from "os";
import path from "path";

const studioBaseUrl = (process.env.FIRST_LLM_STUDIO_BASE_URL || "http://127.0.0.1:3011").replace(/\/+$/, "");
const evidenceDir = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const fixture = Buffer.from("first-llm-studio-range-fixture\n".repeat(12_000), "utf8");
const fixtureSha256 = createHash("sha256").update(fixture).digest("hex");

function jsonResponse(response, status, payload, headers = {}) {
  response.writeHead(status, { "content-type": "application/octet-stream", ...headers });
  response.end(payload);
}

const fixtureServer = http.createServer((request, response) => {
  if (request.url !== "/model.bin") return jsonResponse(response, 404, Buffer.from("not found"));
  const range = request.headers.range?.match(/^bytes=(\d+)-(\d+)$/);
  if (!range) {
    return jsonResponse(response, 200, fixture, {
      "content-length": String(fixture.length),
      etag: `"${fixtureSha256}"`,
    });
  }
  const start = Number(range[1]);
  const end = Math.min(Number(range[2]), fixture.length - 1);
  if (start >= fixture.length) {
    response.writeHead(416, { "content-range": `bytes */${fixture.length}` });
    return response.end();
  }
  const chunk = fixture.subarray(start, end + 1);
  return jsonResponse(response, 206, chunk, {
    "content-length": String(chunk.length),
    "content-range": `bytes ${start}-${end}/${fixture.length}`,
    "accept-ranges": "bytes",
    etag: `"${fixtureSha256}"`,
  });
});

async function postJson(pathname, body, acceptedStatuses = [200]) {
  const response = await fetch(`${studioBaseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!acceptedStatuses.includes(response.status)) {
    throw new Error(`${pathname} returned HTTP ${response.status}: ${payload.error || payload.message || "unknown error"}`);
  }
  return payload;
}

async function main() {
  await new Promise((resolve) => fixtureServer.listen(0, "127.0.0.1", resolve));
  const address = fixtureServer.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not expose a TCP port.");
  const tempDir = path.join(evidenceDir, "model-downloads", `range-rehearsal-${Date.now()}`);
  const destination = path.join(tempDir, "model.bin");
  mkdirSync(tempDir, { recursive: true });
  let preserveTransferArtifact = false;
  try {
    const desktop = await postJson("/api/desktop/package-rehearsal", undefined);
    const created = await postJson("/api/models/acquisitions", {
      action: "create",
      source: "url",
      modelId: "range-fixture",
      revision: fixtureSha256.slice(0, 12),
      destination,
      artifactUrl: `http://127.0.0.1:${address.port}/model.bin`,
      expectedSha256: fixtureSha256,
      bytesTotal: fixture.length,
    });
    let job = (await postJson("/api/models/acquisitions", { action: "start", jobId: created.job.id })).job;
    job = (await postJson("/api/models/acquisitions", { action: "transfer-step", jobId: job.id, chunkBytes: 65_536 })).job;
    await postJson("/api/models/acquisitions", { action: "pause", jobId: job.id });
    job = (await postJson("/api/models/acquisitions", { action: "resume", jobId: job.id })).job;
    for (let index = 0; index < 20 && job.status !== "completed"; index += 1) {
      job = (await postJson("/api/models/acquisitions", { action: "transfer-step", jobId: job.id, chunkBytes: 65_536 })).job;
    }
    if (job.status !== "completed" || job.verifiedSha256 !== fixtureSha256) {
      throw new Error("Range transfer rehearsal did not complete with the expected digest.");
    }

    const pair = generateKeyPairSync("ed25519");
    const extensionPayload = Buffer.from("signed extension package fixture", "utf8");
    const extensionDigest = createHash("sha256").update(extensionPayload).digest("hex");
    const extensionSignature = sign(null, Buffer.from(extensionDigest, "hex"), pair.privateKey).toString("base64");
    const extensionManifest = {
      schemaVersion: "first-llm-extension.v1",
      id: "local-rehearsal.signed-tool",
      name: "Signed rehearsal tool",
      version: "1.0.0",
      publisher: "local-rehearsal-ci",
      kind: "tool",
      entrypoint: "index.mjs",
      permissions: ["workspace:read"],
      compatibleStudio: ">=1.0.0",
      digest: extensionDigest,
      signature: extensionSignature,
    };
    const publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const extensionAccepted = await postJson("/api/extensions", {
      manifest: extensionManifest,
      payloadBase64: extensionPayload.toString("base64"),
      publicKeyPem,
    });
    const extensionRejected = await postJson(
      "/api/extensions",
      {
        manifest: extensionManifest,
        payloadBase64: Buffer.from("tampered payload", "utf8").toString("base64"),
        publicKeyPem,
      },
      [422],
    );

    let execution = (await postJson("/api/workflows", { action: "create", input: "Run a protected action safely." })).execution;
    const eventSeed = Date.now();
    const events = [
      { id: `start-${eventSeed}`, type: "start" },
      { id: `prompt-${eventSeed}`, type: "node-succeeded", nodeId: "prompt" },
      { id: `model-${eventSeed}`, type: "node-succeeded", nodeId: "model", condition: "protected_tool_requested" },
      { id: `approval-${eventSeed}`, type: "approval-granted", nodeId: "approval", condition: "approved" },
      { id: `tool-${eventSeed}`, type: "node-succeeded", nodeId: "tool", idempotencyKey: `tool-effect-${eventSeed}` },
      { id: `verify-${eventSeed}`, type: "node-succeeded", nodeId: "verify" },
      { id: `answer-${eventSeed}`, type: "node-succeeded", nodeId: "answer", output: "Protected action completed and verified." },
    ];
    let duplicateSideEffectSuppressed = false;
    for (const event of events) {
      execution = (await postJson("/api/workflows", { action: "dispatch", executionId: execution.id, event })).execution;
      if (event.nodeId === "tool") {
        const eventCount = execution.events.length;
        const duplicate = (await postJson("/api/workflows", { action: "dispatch", executionId: execution.id, event })).execution;
        duplicateSideEffectSuppressed = duplicate.events.length === eventCount && duplicate.currentNodeId === execution.currentNodeId;
        execution = duplicate;
      }
    }
    if (execution.status !== "completed" || !duplicateSideEffectSuppressed) {
      throw new Error(`Workflow rehearsal stopped at ${execution.status} or repeated a protected side effect.`);
    }
    const governance = await postJson("/api/governance", undefined);
    if (!governance.rehearsal?.ok) throw new Error("Workspace isolation rehearsal failed.");
    const ollama = await fetch(`${studioBaseUrl}/api/runtime/ollama`).then((response) => response.json());
    const report = {
      schemaVersion: "experiments.post-v1-runtime-rehearsal.v1",
      generatedAt: new Date().toISOString(),
      desktop: { status: desktop.report.status, developerIdVerified: desktop.report.developerId.verified },
      transfer: { jobId: job.id, bytes: job.bytesDownloaded, sha256: job.verifiedSha256, pauseResume: true, artifactPath: job.completedFile },
      ollama: { available: ollama.available, version: ollama.version, error: ollama.error },
      extensions: {
        accepted: extensionAccepted.accepted,
        signatureVerified: extensionAccepted.signatureVerified,
        tamperedRejected: extensionRejected.accepted === false,
        quarantine: Boolean(extensionRejected.quarantine),
      },
      workflow: { executionId: execution.id, status: execution.status, events: execution.events.length, duplicateSideEffectSuppressed },
      governance: governance.rehearsal,
    };
    mkdirSync(evidenceDir, { recursive: true });
    const reportPath = path.join(evidenceDir, "post-v1-runtime-rehearsal.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    preserveTransferArtifact = true;
    console.log(JSON.stringify({ ok: true, reportPath, report }, null, 2));
  } finally {
    fixtureServer.close();
    if (!preserveTransferArtifact) rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  fixtureServer.close();
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
