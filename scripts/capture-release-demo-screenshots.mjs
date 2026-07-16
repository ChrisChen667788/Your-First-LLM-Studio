#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "docs", "demo-capture-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const args = process.argv.slice(2);
const flowArgIndex = args.indexOf("--flow");
const flowFilter = flowArgIndex >= 0 ? args[flowArgIndex + 1] : "";
const baseUrl = (process.env.BASE_URL || manifest.baseUrl || "http://localhost:3011").replace(/\/$/, "");
const viewport = manifest.viewport || {};
const width = Number(viewport.width) || 1920;
const height = Number(viewport.height) || 1200;
const deviceScaleFactor = Number(viewport.deviceScaleFactor) || 2;
const flows = Array.isArray(manifest.flows)
  ? manifest.flows.filter((flow) => !flowFilter || flow.id === flowFilter)
  : [];

if (!flows.length) {
  console.error(flowFilter ? `No demo capture flow matched ${flowFilter}.` : "No demo capture flows found.");
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor,
    colorScheme: "dark",
  });
  for (const flow of flows) {
    const route = String(flow.route || "/");
    const outputPath = path.join(root, String(flow.screenshotPath || ""));
    if (!flow.screenshotPath) {
      throw new Error(`Flow ${flow.id || route} is missing screenshotPath.`);
    }
    const page = await context.newPage();
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 60_000 });
    if (flow.selector) {
      const target = page.locator(String(flow.selector));
      await target.waitFor({ state: "visible", timeout: 30_000 });
      await target.screenshot({ path: outputPath });
    } else {
      await page.screenshot({ path: outputPath, fullPage: flow.fullPage === true });
    }
    await page.close();
    const relative = path.relative(root, outputPath);
    console.log(`[capture] ${flow.id || route} -> ${relative}`);
  }
  await context.close();
  manifest.generatedAt = new Date().toISOString();
  manifest.baseUrl = baseUrl;
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
} finally {
  await browser.close();
}
