import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3012";
const output = path.resolve("output/playwright/activation-intake");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/experiments#activation-intake`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const inbox = page.locator("#activation-intake");
    await inbox.waitFor({ state: "visible", timeout: 90000 });
    await inbox.getByText(/Trust configuration required|待配置受信公钥|Trust configured|已配置受信公钥/).waitFor({ timeout: 90000 });
    const operations = page.locator("#activation-operations");
    await operations.waitFor({ state: "visible", timeout: 90000 });
    await operations.getByText(/Activation operations|激活运营控制/).waitFor({ timeout: 90000 });
    await inbox.scrollIntoViewIfNeeded();
    const initial = await inbox.ariaSnapshot();
    const file = inbox.locator('input[type="file"]');
    await file.setInputFiles({ name: "malformed.json", mimeType: "application/json", buffer: Buffer.from("{") });
    await inbox.getByRole("alert").waitFor();
    assert.match(await inbox.getByRole("alert").innerText(), /Invalid JSON|JSON 格式无效/);
    const name = `evidence-${"long-filename-".repeat(8)}.json`;
    await file.setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from("[]") });
    await inbox.getByText(name, { exact: true }).waitFor();
    await inbox.locator("select").selectOption("restore");
    assert.equal(await inbox.getByRole("button", { name: /^(Preview|预检)$/ }).count(), 0);
    await inbox.locator("select").selectOption("import");
    await inbox.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const headingVisible = await inbox.locator("h3").evaluate((heading) => {
      const box = heading.getBoundingClientRect();
      return heading.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
    });
    assert.ok(headingVisible, "The inbox heading is obscured.");
    const fits = await inbox.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { fits: element.scrollWidth <= element.clientWidth + 1,
        left: bounds.left, right: bounds.right, viewport: window.innerWidth };
    });
    assert.ok(fits.fits && fits.left >= 0 && fits.right <= fits.viewport + 1, JSON.stringify(fits));
    const screenshot = path.join(output, `intake-${viewport.width}@2x.png`);
    await inbox.screenshot({ path: screenshot });
    const operationFits = await operations.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { fits: element.scrollWidth <= element.clientWidth + 1,
        left: bounds.left, right: bounds.right, viewport: window.innerWidth };
    });
    assert.ok(operationFits.fits && operationFits.left >= 0 && operationFits.right <= operationFits.viewport + 1, JSON.stringify(operationFits));
    const operationScreenshot = path.join(output, `operations-${viewport.width}@2x.png`);
    await operations.screenshot({ path: operationScreenshot });
    results.push({ viewport, initial, screenshot, operationScreenshot, headingVisible, layout: fits, operationLayout: operationFits, pageErrors: errors });
    await context.close();
  }
} finally { await browser.close(); }
const report = { generatedAt: new Date().toISOString(), evidenceTier: "local-browser", baseUrl, results };
writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
assert.ok(results.every((result) => result.pageErrors.length === 0), "Page errors occurred; see report.");
