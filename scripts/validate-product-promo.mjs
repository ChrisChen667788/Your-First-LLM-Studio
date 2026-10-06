#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const captureDir = path.join(root, "docs/assets/product-tour/2026-10-06");
const promoDir = path.join(root, "docs/assets/product-tour");
const expectedImages = new Map([
  ["agent.png", "/agent"],
  ["compare.png", "/compare"],
  ["fine-tune.png", "/fine-tune"],
  ["benchmarks.png", "/benchmarks"],
  ["models.png", "/models"],
  ["retrieval.png", "/retrieval"],
  ["experiments.png", "/experiments"],
  ["admin.png", "/admin"],
]);

function inside(base, relative) {
  const resolved = path.resolve(base, relative);
  assert.ok(resolved.startsWith(`${base}${path.sep}`), `Path escapes ${base}: ${relative}`);
  return resolved;
}

async function verifyDigest(file, receipt) {
  const bytes = await readFile(file);
  assert.equal(bytes.length, receipt.bytes, `Byte count changed: ${file}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), receipt.sha256, `SHA-256 changed: ${file}`);
  return bytes;
}

function probe(file) {
  return JSON.parse(execFileSync(process.env.FFPROBE_PATH ?? "ffprobe", [
    "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height",
    "-of", "json", file,
  ], { encoding: "utf8" }));
}

const capture = JSON.parse(await readFile(path.join(captureDir, "manifest.json"), "utf8"));
assert.equal(capture.schemaVersion, "first-llm-studio.product-tour-capture.v1");
assert.equal(capture.images.length, expectedImages.size);
assert.ok(capture.sourceHead && capture.captureContext && capture.redactionPolicy);
for (const image of capture.images) {
  assert.equal(expectedImages.get(image.file), image.route, `Unexpected screenshot or route: ${image.file}`);
  const bytes = await verifyDigest(inside(captureDir, image.file), image);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `Not a PNG: ${image.file}`);
  assert.equal(bytes.readUInt32BE(16), image.width);
  assert.equal(bytes.readUInt32BE(20), image.height);
  assert.equal(image.width, 1920);
  assert.equal(image.height, 1200);
  assert.ok(Number.isInteger(image.redactedTextNodes) && image.redactedTextNodes >= 0);
}

const promo = JSON.parse(await readFile(path.join(promoDir, "promo-manifest.json"), "utf8"));
assert.equal(promo.schemaVersion, "first-llm-studio.product-promo.v1");
assert.equal(promo.currentCaptureManifest, "docs/assets/product-tour/2026-10-06/manifest.json");
assert.deepEqual(Object.keys(promo.artifacts).sort(), ["gif", "mp4", "poster"]);
for (const receipt of Object.values(promo.artifacts)) {
  await verifyDigest(inside(root, receipt.file), receipt);
}
assert.ok(promo.artifacts.mp4.bytes < 20 * 1024 * 1024);
assert.ok(promo.artifacts.gif.bytes < 6 * 1024 * 1024);
const video = probe(inside(root, promo.artifacts.mp4.file));
const picture = video.streams.find((stream) => stream.codec_type === "video");
assert.equal(picture?.codec_name, "h264");
assert.equal(picture?.width, 1600);
assert.equal(picture?.height, 900);
assert.equal(video.streams.some((stream) => stream.codec_type === "audio"), false);
assert.ok(Number(video.format.duration) >= 20 && Number(video.format.duration) <= 24);
assert.equal(Number(Number(video.format.duration).toFixed(3)), promo.durationSeconds);
for (const [kind, minWidth] of [["gif", 680], ["poster", 1600]]) {
  const media = probe(inside(root, promo.artifacts[kind].file));
  const stream = media.streams.find((item) => item.codec_type === "video");
  assert.ok(stream?.width >= minWidth, `${kind} is unexpectedly small`);
  assert.ok(stream?.height > 300, `${kind} height is unexpectedly small`);
}

const entryPoints = ["README.md", "README.zh-CN.md", "modelscope/README.md", "docs/product-tour-and-positioning-2026-10-06.md"];
for (const entry of entryPoints) {
  const documentPath = path.join(root, entry);
  const document = await readFile(documentPath, "utf8");
  const references = [...document.matchAll(/(?:src|href)="([^"]+)"|\]\(([^)]+)\)/g)]
    .map((match) => match[1] ?? match[2])
    .filter((reference) => reference.includes("product-tour/") && !reference.startsWith("http"));
  assert.ok(references.length >= 2, `Missing product media references: ${entry}`);
  for (const reference of references) {
    const target = decodeURIComponent(reference.split("#")[0]);
    const file = path.resolve(path.dirname(documentPath), target);
    assert.ok(file.startsWith(`${root}${path.sep}`), `Product media link escapes repository: ${entry} -> ${reference}`);
    assert.ok((await stat(file)).isFile(), `Broken product media link: ${entry} -> ${reference}`);
  }
}

console.log(`Product media OK: ${capture.images.length} screenshots, 3 promo artifacts, ${entryPoints.length} document entry points.`);
