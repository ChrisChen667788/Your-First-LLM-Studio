#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/assets/product-tour/2026-10-06");
const baseUrl = process.env.PRODUCT_TOUR_BASE_URL ?? "http://127.0.0.1:3013";
const shots = [
  { name: "agent.png", route: "/agent", select: "Local Qwen3 0.6B" },
  { name: "compare.png", route: "/compare" },
  { name: "fine-tune.png", route: "/fine-tune", scrollY: 690 },
  { name: "benchmarks.png", route: "/benchmarks" },
  { name: "models.png", route: "/models" },
  { name: "retrieval.png", route: "/retrieval" },
  { name: "experiments.png", route: "/experiments" },
  { name: "admin.png", route: "/admin" },
];

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

await mkdir(outDir, { recursive: true });
const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1200 },
  deviceScaleFactor: 1,
  locale: "zh-CN",
  colorScheme: "dark",
});
const page = await context.newPage();
const images = [];

async function redactMachinePaths() {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let redactions = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const original = node.nodeValue || "";
      const safe = original.replace(/\/Users\/[^\s"'\\]+/g, "/local/demo-dataset.jsonl");
      if (safe !== original) {
        node.nodeValue = safe;
        redactions += 1;
      }
    }
    return redactions;
  });
}

try {
  for (const shot of shots) {
    await page.goto(`${baseUrl}${shot.route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator("body").waitFor();
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.addStyleTag({
      content: "*,*::before,*::after{animation-duration:.001s!important;transition-duration:0s!important;scroll-behavior:auto!important}nextjs-portal,[data-nextjs-toast]{display:none!important}",
    });
    if (shot.select) {
      await page.getByText(shot.select, { exact: true }).first().click();
    }
    if (shot.scrollY) await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY);
    await page.waitForTimeout(750);
    const redactedTextNodes = await redactMachinePaths();

    const visibleText = await page.locator("body").innerText();
    if (/\/Users\/|\/home\/[^\s/]+|\b(?:sk-|ghp_)[A-Za-z0-9_-]{16,}/.test(visibleText)) {
      throw new Error(`Sensitive text detected on ${shot.route}; no screenshot published.`);
    }

    const file = path.join(outDir, shot.name);
    await page.screenshot({ path: file, fullPage: false });
    const bytes = await readFile(file);
    images.push({
      file: shot.name,
      route: shot.route,
      width: 1920,
      height: 1200,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      redactedTextNodes,
    });
  }
} finally {
  await browser.close();
}

const manifest = {
  schemaVersion: "first-llm-studio.product-tour-capture.v1",
  capturedAt: new Date().toISOString(),
  sourceHead: git("rev-parse", "HEAD"),
  workingTreeDirty: Boolean(git("status", "--porcelain")),
  appVersion: "v1.5.1",
  captureContext: "Local standalone build with a fresh, isolated temporary data directory; no customer or production workload.",
  redactionPolicy: "Absolute /Users/... paths in UI text are replaced with /local/demo-dataset.jsonl before capture; no model outputs or metrics are changed.",
  images,
};
await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
