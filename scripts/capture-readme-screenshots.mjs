import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3011";
const outDir = path.resolve(process.env.README_SCREENSHOT_OUT_DIR ?? "docs/assets/screenshots");
const width = Number(process.env.README_SCREENSHOT_WIDTH ?? 1600);
const height = Number(process.env.README_SCREENSHOT_HEIGHT ?? 1000);
const deviceScaleFactor = Number(process.env.README_SCREENSHOT_DPR ?? 2);

const pages = [
  ["agent-workbench.png", "/agent"],
  ["compare-studio.png", "/compare"],
  ["fine-tune-studio.png", "/fine-tune"],
  ["models-studio.png", "/models"],
  ["benchmarks-studio.png", "/benchmarks"],
  ["retrieval-studio.png", "/retrieval"],
  ["admin-dashboard.png", "/admin"],
];

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch (systemChromeError) {
    try {
      return await chromium.launch({ headless: true });
    } catch (bundledChromiumError) {
      throw new Error(
        [
          "Unable to launch a screenshot browser.",
          "Install Google Chrome or run: ./node_modules/.bin/playwright install chromium",
          `System Chrome error: ${systemChromeError.message}`,
          `Bundled Chromium error: ${bundledChromiumError.message}`,
        ].join("\n"),
      );
    }
  }
}

await fs.mkdir(outDir, { recursive: true });

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor,
  locale: "zh-CN",
  colorScheme: "dark",
});
const page = await context.newPage();
page.setDefaultTimeout(45000);

const results = [];
for (const [name, route] of pages) {
  const file = path.join(outDir, name);
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("body").waitFor({ timeout: 15000 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page
    .addStyleTag({
      content: `
        *,
        *::before,
        *::after {
          animation-duration: 0.001s !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0s !important;
        }
      `,
    })
    .catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: file, fullPage: false });
  const stat = await fs.stat(file);
  results.push({ route, file, bytes: stat.size });
}

await browser.close();

console.log(JSON.stringify({ width, height, deviceScaleFactor, results }, null, 2));
