import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const output = path.join(process.cwd(), "docs/assets/github-hero-data.png");
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
    background: linear-gradient(135deg, #061321 0%, #091827 58%, #07111d 100%);
  }
  .frame { position: relative; width: 1600px; height: 900px; overflow: hidden; border: 1px solid #1d3a52; border-radius: 38px; background: linear-gradient(135deg, rgba(8, 27, 46, .98), rgba(4, 13, 25, .98)); }
  .frame::before { content: ""; position: absolute; inset: 0; background: linear-gradient(108deg, rgba(52, 211, 231, .07), transparent 34%, transparent 70%, rgba(244, 190, 86, .06)); pointer-events: none; }
  .frame::after { content: ""; position: absolute; left: 720px; top: 0; bottom: 0; width: 1px; background: linear-gradient(transparent, rgba(92, 155, 191, .28) 30%, rgba(92, 155, 191, .05) 75%, transparent); }
  .eyebrow { position: absolute; top: 90px; left: 104px; margin: 0; color: #70e3ef; font-size: 17px; font-weight: 750; letter-spacing: 4px; }
  .copy { position: absolute; top: 156px; left: 102px; width: 538px; }
  h1 { margin: 0; color: #f8fafc; font-size: 82px; line-height: .98; letter-spacing: -4px; font-weight: 770; }
  h1 span { color: #67e8f9; }
  .lead { margin: 34px 0 0; color: #bdcede; font-size: 27px; line-height: 1.36; letter-spacing: -.4px; }
  .rule { width: 124px; height: 3px; margin: 48px 0 20px; border-radius: 2px; background: #55d5df; }
  .meta { margin: 0; color: #7088a1; font-size: 13px; font-weight: 750; letter-spacing: 2.7px; }
  .dashboard { position: absolute; top: 76px; right: 74px; width: 756px; height: 748px; padding: 28px; border: 1px solid #294862; border-radius: 25px; background: rgba(5, 16, 29, .84); box-shadow: 0 32px 88px rgba(0, 0, 0, .46), inset 0 1px rgba(255, 255, 255, .05); transform: perspective(1600px) rotateY(-3deg) rotateX(1deg); }
  .dash-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 21px; border-bottom: 1px solid #1e3b54; }
  .dash-title { color: #d7e7f5; font-size: 12px; font-weight: 750; letter-spacing: 2.6px; }
  .dash-status { display: flex; align-items: center; gap: 8px; color: #86efac; font-size: 11px; font-weight: 750; letter-spacing: 1.2px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #5eead4; box-shadow: 0 0 16px rgba(94, 234, 212, .8); }
  .dash-sub { display: flex; justify-content: space-between; margin: 20px 0 17px; color: #68819a; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; }
  .signals { display: grid; grid-template-columns: 1.18fr .82fr; gap: 15px; }
  .card { position: relative; min-width: 0; overflow: hidden; border: 1px solid #1d3d57; border-radius: 16px; background: linear-gradient(145deg, rgba(15, 36, 56, .96), rgba(7, 20, 35, .98)); }
  .card::after { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, rgba(255, 255, 255, .05), transparent 27%); pointer-events: none; }
  .training { height: 278px; padding: 20px; }
  .evaluation { height: 278px; padding: 20px; }
  .runtime { grid-column: 1 / -1; height: 178px; padding: 20px; }
  .provenance { grid-column: 1 / -1; height: 158px; padding: 20px; }
  .label { color: #77d9e7; font-size: 11px; font-weight: 750; letter-spacing: 2.2px; }
  .card h2 { margin: 11px 0 0; color: #f2f7fb; font-size: 21px; line-height: 1.15; letter-spacing: -.3px; }
  .muted { color: #7189a2; font-size: 11px; }
  .chart { display: block; width: 100%; height: 104px; margin-top: 15px; }
  .chart-grid { stroke: #214056; stroke-width: 1; }
  .chart-line { fill: none; stroke: #55d5df; stroke-linecap: round; stroke-linejoin: round; stroke-width: 4; }
  .chart-line-secondary { fill: none; stroke: #a7f3d0; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.5; }
  .chart-point { fill: #55d5df; stroke: #d8fbff; stroke-width: 2; }
  .metric-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-top: 7px; }
  .metric { color: #effcff; font-size: 24px; font-weight: 760; letter-spacing: -.8px; }
  .metric small { color: #6f91a9; font-size: 11px; font-weight: 650; letter-spacing: 0; }
  .metric-accent { color: #a7f3d0; }
  .score-ring { display: grid; place-items: center; width: 105px; height: 105px; margin: 15px auto 11px; border: 11px solid #17364e; border-top-color: #55d5df; border-right-color: #55d5df; border-radius: 50%; transform: rotate(26deg); }
  .score-ring span { color: #f4fbff; font-size: 22px; font-weight: 780; transform: rotate(-26deg); }
  .eval-caption { text-align: center; color: #88a0b5; font-size: 10px; letter-spacing: 1px; }
  .runtime-row { display: grid; grid-template-columns: 1.1fr .9fr .9fr 1fr; gap: 12px; margin-top: 21px; }
  .runtime-cell { padding-right: 12px; border-right: 1px solid #1f3b53; }
  .runtime-cell:last-child { border-right: 0; }
  .runtime-name { color: #d9e7f2; font-size: 12px; font-weight: 700; }
  .runtime-value { margin-top: 9px; color: #67e8c2; font-size: 19px; font-weight: 760; }
  .runtime-note { margin-top: 4px; color: #6f899f; font-size: 10px; }
  .mini-bars { display: flex; align-items: flex-end; gap: 5px; height: 26px; margin-top: 8px; }
  .mini-bars i { display: block; width: 9px; border-radius: 2px 2px 0 0; background: #55d5df; }
  .mini-bars i:nth-child(1) { height: 11px; opacity: .42; }
  .mini-bars i:nth-child(2) { height: 17px; opacity: .58; }
  .mini-bars i:nth-child(3) { height: 22px; opacity: .76; }
  .mini-bars i:nth-child(4) { height: 26px; }
  .provenance-row { display: grid; grid-template-columns: 1.25fr .75fr; gap: 18px; align-items: center; margin-top: 16px; }
  .heatmap { display: grid; grid-template-columns: repeat(14, 1fr); gap: 4px; }
  .heatmap i { height: 14px; border-radius: 3px; background: #17344b; }
  .heatmap i:nth-child(3n) { background: #2b7f8b; }
  .heatmap i:nth-child(4n) { background: #4bd3d0; }
  .heatmap i:nth-child(7n) { background: #d0aa55; }
  .prov-stat { color: #e5f7fb; font-size: 20px; font-weight: 760; }
  .prov-stat span { color: #7a93aa; font-size: 11px; font-weight: 650; }
  .corner { position: absolute; z-index: 3; width: 8px; height: 8px; border: 1px solid #69e2eb; }
  .corner-a { top: 55px; right: 55px; border-left: 0; border-bottom: 0; }
  .corner-b { bottom: 51px; left: 55px; border-right: 0; border-top: 0; border-color: #dfb95e; }
</style>
</head>
<body>
  <main class="frame">
    <div class="corner corner-a"></div><div class="corner corner-b"></div>
    <p class="eyebrow">OPEN SOURCE / LOCAL-FIRST / APPLE SILICON</p>
    <section class="copy">
      <h1>First LLM<br><span>Studio</span></h1>
      <p class="lead">Train adapters.<br>Read benchmark data.<br>Keep runtime performance visible.</p>
      <div class="rule"></div>
      <p class="meta">TRAINING · EVALUATION · PERFORMANCE</p>
    </section>
    <section class="dashboard" aria-label="Model training, evaluation, and runtime performance signals">
      <header class="dash-head"><span class="dash-title">MODEL WORKBENCH / SIGNALS</span><span class="dash-status"><i class="dot"></i> SAMPLE TELEMETRY</span></header>
      <div class="dash-sub"><span>PRODUCT PREVIEW</span><span>V1.5.1 / APPLE SILICON</span></div>
      <div class="signals">
        <article class="card training">
          <div class="label">TRAIN / LORA</div><h2>Best checkpoint</h2><div class="muted">Adapter training · 800 steps · eval every 100</div>
          <svg class="chart" viewBox="0 0 360 104" preserveAspectRatio="none" aria-hidden="true"><path class="chart-grid" d="M0 15H360M0 52H360M0 89H360"/><path class="chart-line" d="M6 16 L43 64 L78 80 L116 86 L154 89 L193 91 L230 90 L268 92 L306 91 L350 92"/><path class="chart-line-secondary" d="M6 13 L43 66 L78 81 L116 87 L154 90 L193 91 L230 91 L268 91 L306 91 L350 91"/><circle class="chart-point" cx="350" cy="92" r="5"/></svg>
          <div class="metric-row"><div class="metric metric-accent">0.07 <small>best eval loss</small></div><div class="metric">800 <small>steps</small></div></div>
        </article>
        <article class="card evaluation">
          <div class="label">EVAL / BENCHMARK</div><h2>Clear, repeatable scoring</h2><div class="score-ring"><span>92%</span></div><div class="eval-caption">500 items · reproducible scoring</div>
        </article>
        <article class="card runtime">
          <div class="label">RUNTIME / FABRIC</div><h2>Performance you can inspect</h2>
          <div class="runtime-row"><div class="runtime-cell"><div class="runtime-name">p95 latency</div><div class="runtime-value">0.86 s</div><div class="runtime-note">local response time</div></div><div class="runtime-cell"><div class="runtime-name">Throughput</div><div class="runtime-value">247 tok/s</div><div class="runtime-note">steady generation lane</div></div><div class="runtime-cell"><div class="runtime-name">Backends</div><div class="runtime-value">6 / 6</div><div class="runtime-note">runtime paths ready</div></div><div class="runtime-cell"><div class="runtime-name">Health</div><div class="runtime-value">99.2%</div><div class="mini-bars"><i></i><i></i><i></i><i></i></div></div></div>
        </article>
        <article class="card provenance">
          <div class="label">EVIDENCE / COVERAGE</div><div class="provenance-row"><div><h2>Every signal keeps its lineage</h2><div class="muted">Replay · trace · benchmark · runtime recovery</div></div><div><div class="heatmap">${Array.from({ length: 28 }, () => "<i></i>").join("")}</div><div class="prov-stat">14 / 14 <span>domains tracked</span></div></div></div>
        </article>
      </div>
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
