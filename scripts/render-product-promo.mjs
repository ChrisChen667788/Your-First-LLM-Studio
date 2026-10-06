#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "videos/first-llm-studio-promo/index.html");
const outDir = path.join(root, "docs/assets/product-tour");
const rawDir = path.join(root, "output/product-tour/raw");
const rawVideo = path.join(root, "output/product-tour/product-promo.webm");
const mp4 = path.join(outDir, "first-llm-studio-promo.mp4");
const gif = path.join(outDir, "first-llm-studio-promo.gif");
const poster = path.join(outDir, "first-llm-studio-promo.jpg");
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";

function run(program, args) {
  execFileSync(program, args, { cwd: root, stdio: "inherit" });
}

async function digest(file) {
  const bytes = await readFile(file);
  return { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

await mkdir(rawDir, { recursive: true });
await mkdir(outDir, { recursive: true });
if (!process.argv.includes("--reuse-raw")) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
      recordVideo: { dir: rawDir, size: { width: 1600, height: 900 } },
    });
    const page = await context.newPage();
    const video = page.video();
    await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = Array.from(document.images);
      await Promise.all(images.map((image) => image.decode()));
      document.body.classList.add("playing");
    });
    await page.waitForTimeout(20_800);
    await page.close();
    await context.close();
    if (!video) throw new Error("Playwright did not record the promo composition.");
    await video.saveAs(rawVideo);
  } finally {
    await browser.close();
  }
}

run(ffmpeg, ["-y", "-loglevel", "error", "-i", rawVideo, "-vf", "fps=30", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
run(ffmpeg, ["-y", "-loglevel", "error", "-ss", "1.25", "-i", mp4, "-frames:v", "1", "-q:v", "3", poster]);
run(ffmpeg, ["-y", "-loglevel", "error", "-i", mp4, "-vf", "fps=8,scale=760:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer", "-loop", "0", gif]);
if ((await stat(gif)).size > 6 * 1024 * 1024) {
  run(ffmpeg, ["-y", "-loglevel", "error", "-i", mp4, "-vf", "fps=6,scale=680:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=48[p];[s1][p]paletteuse=dither=bayer", "-loop", "0", gif]);
}

const probe = JSON.parse(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,avg_frame_rate", "-of", "json", mp4], { encoding: "utf8" }));
const artifacts = {};
for (const [name, file] of Object.entries({ mp4, gif, poster })) {
  artifacts[name] = { file: path.relative(root, file), ...(await digest(file)) };
}
if (artifacts.mp4.bytes > 20 * 1024 * 1024) throw new Error("MP4 exceeds the 20 MiB repository budget.");
if (artifacts.gif.bytes > 6 * 1024 * 1024) throw new Error("GIF exceeds the 6 MiB README budget.");

const manifest = {
  schemaVersion: "first-llm-studio.product-promo.v1",
  renderedAt: new Date().toISOString(),
  durationSeconds: Number(Number(probe.format.duration).toFixed(3)),
  video: probe.streams.find((stream) => stream.width),
  audio: "none; deliberately silent for README autoplay",
  currentCaptureManifest: "docs/assets/product-tour/2026-10-06/manifest.json",
  archivedEvidence: [
    "docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png",
    "docs/assets/screenshots/math500-reproducibility-performance.png",
  ],
  evidenceBoundary: "The film is a motion-graphics montage of isolated current UI screenshots and labeled historical local evidence, not a live end-to-end recording, customer outcome, external acceptance, public release, or production approval.",
  artifacts,
};
await writeFile(path.join(outDir, "promo-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
