#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3011").replace(
  /\/+$/u,
  "",
);
const llamaBaseUrl = (
  process.env.LLAMA_CPP_BASE_URL || "http://127.0.0.1:11435"
).replace(/\/+$/u, "");
const ollamaModel = value("--ollama-model", "qwen3:0.6b");
const mlxModel = value("--mlx-model", "local-qwen3-0.6b");
const llamaAlias = value("--llama-alias", "qwen3-0.6b-llamacpp");
const publishPath = value("--publish");
const outputDir = path.join(root, "output", "release-evidence");
const logPath = path.join(outputDir, "v1.2.1-llama-server.log");
let llamaProcess = null;

function resolveLlamaModelPath() {
  if (process.env.LLAMA_CPP_MODEL_PATH) return process.env.LLAMA_CPP_MODEL_PATH;
  const modelfile = execFileSync(
    "ollama",
    ["show", "--modelfile", ollamaModel],
    { encoding: "utf8" },
  );
  const from = modelfile
    .split(/\r?\n/u)
    .find((line) => line.startsWith("FROM "));
  if (!from) {
    throw new Error(`Could not resolve a GGUF path from ${ollamaModel}.`);
  }
  return from.slice(5).trim();
}

async function fetchJson(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15 * 60_000),
  });
  const payload = await response.json();
  if (!response.ok && !payload.receipt) {
    throw new Error(
      payload.error || `${pathname} returned HTTP ${response.status}.`,
    );
  }
  return payload;
}

async function isLlamaReady() {
  try {
    const response = await fetch(`${llamaBaseUrl}/health`, {
      signal: AbortSignal.timeout(1_500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForLlama() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await isLlamaReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`llama.cpp did not become ready at ${llamaBaseUrl}.`);
}

async function startLlamaIfNeeded() {
  if (await isLlamaReady()) return false;
  const modelPath = resolveLlamaModelPath();
  const url = new URL(llamaBaseUrl);
  mkdirSync(outputDir, { recursive: true });
  const logFd = openSync(logPath, "w");
  llamaProcess = spawn(
    process.env.LLAMA_CPP_SERVER_PATH || "llama-server",
    [
      "-m",
      modelPath,
      "--alias",
      llamaAlias,
      "--host",
      url.hostname,
      "--port",
      url.port || "11435",
      "-ngl",
      "99",
      "--ctx-size",
      "4096",
      "--parallel",
      "2",
      "--jinja",
    ],
    {
      cwd: root,
      stdio: ["ignore", logFd, logFd],
    },
  );
  closeSync(logFd);
  llamaProcess.once("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[v1.2.1] llama-server exited with code ${code}`);
    }
  });
  await waitForLlama();
  return true;
}

function stopLlama() {
  if (llamaProcess && !llamaProcess.killed) llamaProcess.kill("SIGTERM");
}

process.on("SIGINT", () => {
  stopLlama();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopLlama();
  process.exit(143);
});

let spawnedLlama = false;
try {
  spawnedLlama = await startLlamaIfNeeded();
  console.log(
    `[v1.2.1] running Runtime Fabric acceptance with MLX=${mlxModel}, Ollama=${ollamaModel}, llama.cpp=${llamaAlias}`,
  );
  const acceptance = await fetchJson("/api/runtime/fabric-acceptance", {
    method: "POST",
    body: JSON.stringify({
      models: {
        mlx: mlxModel,
        ollama: ollamaModel,
        "llama.cpp": llamaAlias,
      },
    }),
  });
  const promotion = await fetchJson("/api/runtime/fabric-promotion");
  const evidence = {
    schemaVersion: "runtime.v1.2.1-real-fabric-evidence.v1",
    generatedAt: new Date().toISOString(),
    status:
      promotion.localStatus === "pass" ? "local-pass" : "evidence-needed",
    acceptance: acceptance.receipt,
    promotion,
    runner: {
      spawnedLlama,
      llamaBaseUrl,
      llamaAlias,
      localOnly: true,
    },
  };
  const outputPath = path.join(
    outputDir,
    "v1.2.1-runtime-fabric-acceptance.json",
  );
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (publishPath) {
    const resolved = path.resolve(root, publishPath);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  console.log(
    JSON.stringify(
      {
        status: evidence.status,
        realBackends: acceptance.receipt?.totals,
        adapterContract: acceptance.receipt?.adapterContract,
        acceptanceDigest: acceptance.receipt?.evidenceDigest,
        promotionDigest: promotion.evidenceDigest,
        productionStatus: promotion.productionStatus,
        productionBlockers: promotion.productionBlockers,
        outputPath,
        publishPath: publishPath || null,
      },
      null,
      2,
    ),
  );
  if (acceptance.receipt?.status !== "pass") {
    throw new Error(
      `Runtime Fabric acceptance is HOLD: ${(acceptance.receipt?.blockers || []).join(" ")}`,
    );
  }
} finally {
  if (spawnedLlama) stopLlama();
}
