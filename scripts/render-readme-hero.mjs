import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const output = path.join(root, "docs/assets/github-hero-product.png");
const imageData = (relativePath) => {
  const file = path.join(root, relativePath);
  return `data:image/png;base64,${readFileSync(file).toString("base64")}`;
};

const agent = imageData("docs/assets/screenshots/agent-workbench.png");
const compare = imageData("docs/assets/screenshots/compare-studio.png");
const fineTune = imageData("docs/assets/screenshots/fine-tune-studio.png");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: dark; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1600px; height: 900px; overflow: hidden; }
  body {
    color: #f8fafc;
    background:
      linear-gradient(rgba(75, 105, 145, .08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(75, 105, 145, .08) 1px, transparent 1px),
      #07111f;
    background-size: 48px 48px;
  }
  .frame { position: relative; width: 1600px; height: 900px; overflow: hidden; border: 1px solid #1c3049; border-radius: 38px; background: linear-gradient(135deg, rgba(9, 26, 47, .98), rgba(5, 13, 26, .96)); }
  .frame::before { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, rgba(42, 209, 231, .09), transparent 30%, transparent 68%, rgba(244, 190, 86, .07)); pointer-events: none; }
  .eyebrow { position: absolute; top: 104px; left: 112px; margin: 0; color: #7dd3fc; font-size: 18px; font-weight: 700; letter-spacing: 4px; }
  .copy { position: absolute; top: 168px; left: 110px; width: 550px; }
  h1 { margin: 0; color: #f8fafc; font-size: 84px; line-height: .98; letter-spacing: -4px; font-weight: 760; }
  h1 span { color: #6ee7f2; }
  .lead { margin: 36px 0 0; color: #b7c7da; font-size: 28px; line-height: 1.35; letter-spacing: -.5px; }
  .rule { width: 118px; height: 3px; margin: 52px 0 22px; border-radius: 2px; background: #50d5df; }
  .meta { margin: 0; color: #6f849e; font-size: 14px; font-weight: 700; letter-spacing: 2.8px; }
  .stack { position: absolute; top: 104px; right: 76px; width: 760px; height: 720px; }
  .window { position: absolute; overflow: hidden; border: 1px solid rgba(158, 193, 226, .38); border-radius: 20px; background: #0e1b2d; box-shadow: 0 32px 72px rgba(0, 0, 0, .42), 0 8px 18px rgba(0, 0, 0, .22); }
  .window::after { content: ""; position: absolute; inset: 0; border: 1px solid rgba(255, 255, 255, .06); border-radius: inherit; pointer-events: none; }
  .window-main { top: 24px; right: 0; width: 650px; height: 440px; transform: rotate(2.1deg); }
  .window-main img { width: 900px; height: 563px; object-fit: cover; object-position: 52% 17%; transform: translate(-105px, -40px); }
  .window-agent { top: 364px; left: 2px; width: 390px; height: 278px; transform: rotate(-3.2deg); z-index: 2; }
  .window-agent img { width: 520px; height: 325px; object-fit: cover; object-position: 38% 18%; transform: translate(-65px, -20px); }
  .window-finetune { right: 34px; bottom: 10px; width: 390px; height: 258px; transform: rotate(1.8deg); z-index: 3; }
  .window-finetune img { width: 520px; height: 325px; object-fit: cover; object-position: 56% 28%; transform: translate(-70px, -28px); }
  .pin { position: absolute; z-index: 5; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 5px rgba(80, 213, 223, .12), 0 0 24px rgba(80, 213, 223, .68); background: #50d5df; }
  .pin-one { top: 76px; right: 92px; }
  .pin-two { bottom: 58px; left: 418px; background: #f4be56; box-shadow: 0 0 0 5px rgba(244, 190, 86, .12), 0 0 24px rgba(244, 190, 86, .6); }
  .label { position: absolute; z-index: 6; color: #9fb4cd; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
  .label-one { top: 50px; right: 104px; }
  .label-two { bottom: 36px; left: 440px; color: #d9b66a; }
</style>
</head>
<body>
  <main class="frame">
    <p class="eyebrow">OPEN SOURCE / LOCAL-FIRST / APPLE SILICON</p>
    <section class="copy">
      <h1>First LLM<br><span>Studio</span></h1>
      <p class="lead">Compare model behavior.<br>See the runtime clearly.<br>Keep every run reviewable.</p>
      <div class="rule"></div>
      <p class="meta">MLX · AGENT · COMPARE · BENCHMARK</p>
    </section>
    <section class="stack" aria-label="Product workspace previews">
      <div class="pin pin-one"></div><div class="label label-one">LIVE WORKSPACE</div>
      <div class="window window-main"><img src="${compare}" alt="Compare Studio preview"></div>
      <div class="window window-agent"><img src="${agent}" alt="Agent workbench preview"></div>
      <div class="window window-finetune"><img src="${fineTune}" alt="Fine-tune Studio preview"></div>
      <div class="pin pin-two"></div><div class="label label-two">TRACE / RECOVERY / EVIDENCE</div>
    </section>
  </main>
</body>
</html>`;

mkdirSync(path.dirname(output), { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: output, type: "png" });
} finally {
  await browser.close();
}
console.log(output);
