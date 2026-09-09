#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync, statSync, writeFileSync } from "node:fs";

const { values } = parseArgs({ options: { action: { type: "string", default: "status" }, file: { type: "string" }, output: { type: "string" }, "expected-revision": { type: "string" }, "envelope-digest": { type: "string" }, "case-id": { type: "string" }, "url": { type: "string", default: process.env.BASE_URL || "http://127.0.0.1:3011" } } });
const base = new URL(values.url); const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
if (base.username || base.password || (!loopback && base.protocol !== "https:") || !["http:", "https:"].includes(base.protocol)) throw new Error("Use loopback HTTP or authenticated HTTPS without URL credentials.");
const action = values.action; const safeActions = ["status", "export", "preflight-rotation", "admit-rotation", "admit-decision", "claim-quarantine", "release-quarantine", "restore"];
if (!safeActions.includes(action)) throw new Error("Unknown action.");
const revision = values["expected-revision"] === undefined ? undefined : Number(values["expected-revision"]);
if (revision !== undefined && (!/^\d+$/u.test(values["expected-revision"]) || !Number.isSafeInteger(revision))) throw new Error("Expected revision must be a non-negative integer.");
let body;
if (["preflight-rotation", "admit-rotation", "admit-decision"].includes(action)) body = { action, envelopeDigest: values["envelope-digest"], ...(revision === undefined ? {} : { expectedRevision: revision }) };
else if (["claim-quarantine", "release-quarantine"].includes(action)) body = { action, caseId: values["case-id"], expectedRevision: revision };
else if (action === "restore") { if (!values.file || statSync(values.file).size > 2 * 1024 * 1024) throw new Error("Provide a JSON backup up to 2 MiB."); body = { action, expectedRevision: revision, bundle: JSON.parse(readFileSync(values.file, "utf8")) }; }
const url = new URL(`/api/experiments/activation-operations${action === "export" ? "?export=true" : ""}`, base); const token = process.env.FIRST_LLM_OPERATOR_TOKEN;
const headers = { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(process.env.FIRST_LLM_OPERATOR_ID ? { "x-first-llm-operator-id": process.env.FIRST_LLM_OPERATOR_ID } : {}) };
const response = await fetch(url, { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(90000), headers, body: body ? JSON.stringify(body) : undefined });
const result = await response.json(); if (!response.ok || result.ok === false) { console.error(JSON.stringify({ status: response.status, code: result.code || "request-failed" })); process.exitCode = 1; }
else if (values.output) { writeFileSync(values.output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 }); console.log(JSON.stringify({ ok: true, output: values.output })); } else console.log(JSON.stringify(result, null, 2));
