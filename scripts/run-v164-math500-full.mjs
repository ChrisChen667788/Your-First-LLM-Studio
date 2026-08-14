import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const baseUrl = readArg("--base-url", "http://127.0.0.1:3011").replace(/\/$/, "");
const runId = readArg("--run-id");
const targetId = readArg("--target-id", "local-qwen3-0.6b");
const maxTokens = Number(readArg("--max-tokens", "512"));

if (!runId || !runId.startsWith("math500-full-")) {
  throw new Error("A valid --run-id is required.");
}

const startedAt = new Date().toISOString();
console.log(`[${startedAt}] starting ${runId} on ${targetId}`);

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({
              status: response.statusCode || 500,
              ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300,
              payload: JSON.parse(raw),
            });
          } catch (error) {
            reject(new Error(`Benchmark route returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      },
    );
    request.on("error", reject);
    request.setTimeout(0);
    request.end(body);
  });
}

const requestBody = JSON.stringify({
    runId,
    benchmarkMode: "dataset",
    datasetId: "math-500-qualified",
    datasetSampleLimit: 500,
    targetIds: [targetId],
    runs: 1,
    contextWindow: 8192,
    maxTokens,
    providerProfile: "balanced",
    thinkingMode: "standard",
    runNote: "v1.6.4 full qualified MATH-500 run with pinned Math-Verify scoring",
});
const response = await postJson(`${baseUrl}/api/benchmarks`, requestBody);
const payload = response.payload;
const root =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const outputDir = path.join(root, "official-benchmark-runs");
mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${runId}.json`);
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
writeFileSync(
  temporaryPath,
  `${JSON.stringify(
    {
      schemaVersion: "benchmark.official-run-launch-receipt.v1",
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      targetId,
      maxTokens,
      httpStatus: response.status,
      ok: response.ok && payload?.ok === true,
      payload,
    },
    null,
    2,
  )}\n`,
);
renameSync(temporaryPath, outputPath);
console.log(`[${new Date().toISOString()}] completed ${runId} HTTP ${response.status}`);
if (!response.ok || payload?.ok !== true) process.exitCode = 1;
