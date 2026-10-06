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
    "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames,sample_rate,channels",
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
assert.equal(promo.schemaVersion, "first-llm-studio.product-promo.v2");
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
assert.equal(picture?.width, 1920);
assert.equal(picture?.height, 1080);
assert.equal(picture?.avg_frame_rate, "30/1");
assert.equal(Number(picture?.nb_frames), 900);
const audio = video.streams.find((stream) => stream.codec_type === "audio");
assert.equal(audio?.codec_name, "aac");
assert.equal(audio?.sample_rate, "48000");
assert.equal(audio?.channels, 2);
assert.equal(Number(video.format.duration), 30);
assert.equal(Number(Number(video.format.duration).toFixed(3)), promo.durationSeconds);
for (const [kind, minWidth] of [["gif", 640], ["poster", 1920]]) {
  const media = probe(inside(root, promo.artifacts[kind].file));
  const stream = media.streams.find((item) => item.codec_type === "video");
  assert.ok(stream?.width >= minWidth, `${kind} is unexpectedly small`);
  assert.ok(stream?.height > 300, `${kind} height is unexpectedly small`);
}

assert.ok(promo.audioProvenance.includes("Original deterministic"));
assert.ok(promo.evidenceBoundary.includes("scorer replay agreement is not model accuracy"));
assert.deepEqual(promo.visualQa, { desktopAndMobileChecks: 12, deterministic: true, moving: true, nonblankSculpture: true, overflow: false });
for (const receipt of promo.sources) {
  const bytes = await readFile(inside(root, receipt.file));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), receipt.sha256, `Film source drift: ${receipt.file}`);
}
const json = async file => JSON.parse(await readFile(path.join(root, file), "utf8"));
const training = await json("docs/release-evidence/finetune-qwen4b-lora-2026-07-01/run-manifest.json");
const math = await json("docs/release-evidence/v1.6.5-benchmark-reproducibility-latest.json");
const fabric = await json("docs/release-evidence/v1.2.1-runtime-fabric-acceptance-2026-08-30.json");
const smoke = await json("docs/release-evidence/v1.6.3-benchmark-qualification-latest.json");
assert.equal(promo.metrics.peakTrainingMemoryGb, training.metricsSummary.peakMemoryGb);
assert.equal(promo.metrics.trainingSteps, training.metricsSummary.latestStep);
assert.equal(promo.metrics.bestValidationLoss, training.metricsSummary.valid.best);
assert.equal(promo.metrics.bestStep, training.bestCheckpoint.step);
assert.ok(training.baseModel.includes("Qwen3-4B"));
assert.equal(promo.metrics.modelBillions, 4);
assert.equal(promo.metrics.scoredSamples, math.analysis.totals.scored);
assert.equal(promo.metrics.modelAccuracyPercent, math.analysis.accuracy);
assert.equal(promo.metrics.scorerReplayAgreementPercent, math.replay.agreementRate);
assert.equal(promo.metrics.verifiedRuntimes, fabric.acceptance.backends.filter(backend => backend.status === "pass" && backend.realProcess).length);
assert.ok(smoke.runtimeSmoke.report.includes(`| ${promo.metrics.localSmokeTokensPerSecond} |`));
assert.ok(smoke.runtimeSmoke.report.includes(`- Runs: ${promo.metrics.smokeRuns}`));
const composition = await readFile(path.join(root, "videos/first-llm-studio-promo/index.html"), "utf8");
assert.ok(!composition.includes("<img"), "Screenshot collage returned to the film");
for (const label of ["3.316 GB", "816", "0.066", "500", "100% SCORER REPLAY AGREEMENT", "MODEL ACCURACY 32%", "234.02", "1 prompt × 3 runs"]) {
  assert.ok(composition.includes(label), `Missing metric scope: ${label}`);
}
const scene = await readFile(path.join(root, "videos/first-llm-studio-promo/scene.mjs"), "utf8");
assert.ok(scene.includes("const points = checkpointPoints"), "Checkpoint curve must use the parsed training archive");
assert.deepEqual(promo.checkpointPoints, training.validationSeries.filter(point => point.step >= 100 && point.step <= 800).map(point => [point.step, point.loss]));
assert.ok(scene.includes("ARTISTIC TRACES / 示意动态"));

const storyboard = await json("videos/first-llm-studio-promo/storyboard.json");
assert.equal(storyboard.fps, 30);
assert.equal(storyboard.durationSeconds, 30);
assert.equal(storyboard.scenes.length, 6);
storyboard.scenes.forEach((beat, index) => {
  assert.equal(beat.start, index * 5);
  assert.equal(beat.end, (index + 1) * 5);
});

const entryPoints = ["README.md", "README.zh-CN.md", "modelscope/README.md", "docs/product-tour-and-positioning-2026-10-06.md", "docs/product-film-creative-review-2026-10-06.md"];
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
