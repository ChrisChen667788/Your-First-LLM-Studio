#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync, statSync, writeFileSync } from "node:fs";

const { values } = parseArgs({ options: {
  action: { type: "string", default: "status" }, file: { type: "string" }, output: { type: "string" },
  "expected-revision": { type: "string" }, "dry-run": { type: "boolean", default: false },
  url: { type: "string", default: process.env.BASE_URL || "http://127.0.0.1:3011" },
} });
const base = new URL(values.url);
const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
if (base.username || base.password || (!loopback && base.protocol !== "https:") || !["http:", "https:"].includes(base.protocol)) {
  throw new Error("Use loopback HTTP or authenticated HTTPS without URL credentials.");
}
const action = values.action;
if (!["status", "import", "export", "restore", "register-manifest"].includes(action)) throw new Error("Unknown action.");
let body;
if (["import", "restore", "register-manifest"].includes(action)) {
  if (!values.file || statSync(values.file).size > 2 * 1024 * 1024) throw new Error("Provide a JSON input file up to 2 MiB.");
  const input = JSON.parse(readFileSync(values.file, "utf8"));
  if (action === "register-manifest") body = { action, manifest: input };
  else {
    const revision = Number(values["expected-revision"]);
    if (!/^\d+$/u.test(values["expected-revision"] || "") || !Number.isSafeInteger(revision)) throw new Error("Provide --expected-revision from the current status.");
    body = action === "import" ? { action, expectedRevision: revision, dryRun: values["dry-run"], envelopes: input }
      : { action, expectedRevision: revision, backup: input };
  }
}
const url = new URL(`/api/experiments/activation-intake${action === "export" ? "?export=true" : ""}`, base);
const token = process.env.FIRST_LLM_OPERATOR_TOKEN;
const response = await fetch(url, { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(90000),
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
const result = await response.json();
if (!response.ok || result.ok === false) { console.error(JSON.stringify({ status: response.status, code: result.code || "request-failed" })); process.exitCode = 1; }
else if (values.output) { writeFileSync(values.output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 }); console.log(JSON.stringify({ ok: true, output: values.output })); }
else console.log(JSON.stringify(result, null, 2));
