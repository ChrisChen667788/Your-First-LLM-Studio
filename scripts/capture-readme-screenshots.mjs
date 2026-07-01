import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

const deepCaptures = [
  {
    name: "fine-tune-training-curve.png",
    route: "/fine-tune",
    prepare: async (page) => {
      await clickByText(page, "作业与日志");
      await ensureSectionOpen(page, "已完成", "训练曲线");
      await scrollToText(page, "训练曲线", { maxTextLength: 40, offset: 140 });
    },
  },
  {
    name: "benchmark-run-evidence.png",
    route: "/benchmarks",
    prepare: async (page) => {
      await scrollToText(page, "最新 benchmark 证据", { maxTextLength: 80, offset: 120 });
    },
  },
  {
    name: "admin-benchmark-heatmap.png",
    route: "/admin",
    prepare: async (page) => {
      await scrollToText(page, "Benchmark 交叉热力图", { maxTextLength: 80, offset: 120 });
    },
  },
];

const chartCaptures = [
  {
    name: "fine-tune-qwen4b-lora-chart.png",
    svgName: "fine-tune-qwen4b-lora-chart.svg",
    sourceSvg:
      "docs/release-evidence/finetune-qwen4b-lora-2026-07-01/ft-job-qwen4b-lora-20260701-175225-chart-evidence.svg",
    width: 1680,
    height: 980,
  },
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

async function addScreenshotStyles(page) {
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

        nextjs-portal,
        [data-nextjs-toast],
        .__nextjs-dev-overlay,
        .nextjs-toast-errors-parent {
          display: none !important;
        }
      `,
    })
    .catch(() => {});
}

async function prepareRoute(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("body").waitFor({ timeout: 15000 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await addScreenshotStyles(page);
  await page.waitForTimeout(1000);
}

async function clickByText(page, text) {
  await page.evaluate((targetText) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, "");
    const normalizedTarget = normalize(targetText);
    const button = Array.from(document.querySelectorAll("button, [role='button'], a")).find(
      (element) => normalize(element.textContent).includes(normalizedTarget),
    );
    if (button instanceof HTMLElement) button.click();
  }, text);
  await page.waitForTimeout(700);
}

async function hasShortText(page, text, maxTextLength = 80) {
  return page.evaluate(
    ({ targetText, maxLength }) =>
      Array.from(document.querySelectorAll("h1,h2,h3,h4,p,span,button"))
        .map((element) => String(element.textContent || "").replace(/\s+/g, " ").trim())
        .some((entry) => entry.includes(targetText) && entry.length <= maxLength),
    { targetText: text, maxLength: maxTextLength },
  );
}

async function ensureSectionOpen(page, sectionText, expectedText) {
  if (await hasShortText(page, expectedText, 80)) return;
  await clickByText(page, sectionText);
  await page.waitForTimeout(800);
}

async function scrollToText(page, text, options = {}) {
  const maxTextLength = options.maxTextLength ?? 120;
  const offset = options.offset ?? 120;
  await page.evaluate(
    ({ targetText, maxLength, scrollOffset }) => {
      const matches = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,p,span,button,section,article,div"),
      )
        .map((element) => {
          const textContent = String(element.textContent || "").replace(/\s+/g, " ").trim();
          const rect = element.getBoundingClientRect();
          return {
            element,
            textContent,
            length: textContent.length,
            top: rect.top + window.scrollY,
          };
        })
        .filter((entry) => entry.textContent.includes(targetText) && entry.length <= maxLength)
        .sort((left, right) => left.length - right.length || left.top - right.top);
      const match = matches[0];
      if (!match || !(match.element instanceof HTMLElement)) return;
      match.element.scrollIntoView({ block: "start", inline: "nearest" });
      window.scrollBy(0, -scrollOffset);
    },
    { targetText: text, maxLength: maxTextLength, scrollOffset: offset },
  );
  await page.waitForTimeout(700);
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
  await prepareRoute(page, route);
  await page.screenshot({ path: file, fullPage: false });
  const stat = await fs.stat(file);
  results.push({ route, file, bytes: stat.size });
}

for (const capture of deepCaptures) {
  const file = path.join(outDir, capture.name);
  await prepareRoute(page, capture.route);
  await capture.prepare(page);
  await page.screenshot({ path: file, fullPage: false });
  const stat = await fs.stat(file);
  results.push({ route: capture.route, file, bytes: stat.size });
}

for (const capture of chartCaptures) {
  const sourceSvg = path.resolve(capture.sourceSvg);
  const outSvg = path.join(outDir, capture.svgName);
  const outPng = path.join(outDir, capture.name);
  await fs.copyFile(sourceSvg, outSvg);
  await page.setViewportSize({ width: capture.width, height: capture.height });
  await page.goto(pathToFileURL(sourceSvg).href, { waitUntil: "load", timeout: 30000 });
  await page.screenshot({ path: outPng, fullPage: false });
  const stat = await fs.stat(outPng);
  results.push({ route: "release-evidence:lora-chart", file: outPng, bytes: stat.size });
}

await browser.close();

console.log(JSON.stringify({ width, height, deviceScaleFactor, results }, null, 2));
