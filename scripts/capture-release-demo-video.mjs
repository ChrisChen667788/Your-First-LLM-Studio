#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "docs", "demo-video-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const args = process.argv.slice(2);
const flowIndex = args.indexOf("--flow");
const flowId = flowIndex >= 0 ? args[flowIndex + 1] : "";
const emitGif = args.includes("--gif");
const baseUrl = (process.env.BASE_URL || manifest.baseUrl || "http://localhost:3011").replace(/\/+$/, "");
const ffmpegPath = process.env.FFMPEG_PATH || manifest.ffmpegPath || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || path.join(path.dirname(ffmpegPath), "ffprobe");
const flows = (manifest.flows || []).filter((flow) => !flowId || flow.id === flowId);
if (!flows.length) throw new Error(flowId ? `Unknown video flow: ${flowId}` : "No video flows configured.");
execFileSync(ffmpegPath, ["-version"], { stdio: "ignore" });

const browser = await chromium.launch();
try {
  for (const flow of flows) {
    const width = Number(flow.width) || 1280;
    const height = Number(flow.height) || 800;
    const rawDir = path.join(root, "output", "demo-video", "raw", flow.id);
    const webmPath = path.join(root, "output", "demo-video", `${flow.id}.webm`);
    const outputPath = path.join(root, flow.outputPath);
    rmSync(rawDir, { recursive: true, force: true });
    mkdirSync(rawDir, { recursive: true });
    mkdirSync(path.dirname(outputPath), { recursive: true });
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: "dark",
      recordVideo: { dir: rawDir, size: { width, height } },
    });
    const page = await context.newPage();
    const video = page.video();
    await page.goto(`${baseUrl}${flow.route}`, { waitUntil: "networkidle", timeout: 60_000 });
    for (const action of flow.actions || []) {
      const durationMs = Math.max(250, Number(action.durationMs) || 1000);
      if (action.type === "scroll") {
        await page.evaluate((y) => window.scrollTo({ top: Number(y), behavior: "smooth" }), action.y || 0);
      }
      await page.waitForTimeout(durationMs);
    }
    await page.close();
    await context.close();
    if (!video) throw new Error(`Playwright did not create a video for ${flow.id}.`);
    await video.saveAs(webmPath);
    execFileSync(ffmpegPath, [
      "-y", "-i", webmPath, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "22",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath,
    ], { stdio: "ignore" });
    if (emitGif && flow.gifPath) {
      const gifPath = path.join(root, flow.gifPath);
      mkdirSync(path.dirname(gifPath), { recursive: true });
      execFileSync(ffmpegPath, [
        "-y", "-i", outputPath,
        "-vf", "fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
        gifPath,
      ], { stdio: "ignore" });
    }
    const probe = JSON.parse(execFileSync(ffprobePath, [
      "-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", outputPath,
    ], { encoding: "utf8" }));
    const payload = readFileSync(outputPath);
    const metadata = {
      schemaVersion: "first-llm-studio.demo-video-evidence.v1",
      generatedAt: new Date().toISOString(),
      flowId: flow.id,
      route: flow.route,
      outputPath: flow.outputPath,
      width: probe.streams?.[0]?.width || width,
      height: probe.streams?.[0]?.height || height,
      durationSeconds: Number(Number(probe.format?.duration || 0).toFixed(3)),
      bytes: payload.length,
      sha256: createHash("sha256").update(payload).digest("hex"),
      codec: "h264/yuv420p",
      sourceFormat: "playwright-webm",
      ffmpegPath,
    };
    writeFileSync(`${outputPath}.metadata.json`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(metadata, null, 2));
  }
} finally {
  await browser.close();
}
