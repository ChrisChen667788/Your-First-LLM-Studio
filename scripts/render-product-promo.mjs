#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/assets/product-tour');
const raw = path.join(root, 'output/product-tour');
const name = 'first-llm-studio-promo';
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
const fps = 30, duration = 30;
const preview = process.argv.includes('--preview');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const run = args => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
await mkdir(raw, { recursive: true });
await mkdir(out, { recursive: true });

// Bind only to loopback and reject traversal; render assets never use external network.
const server = createServer(async (req, res) => {
  try {
    const file = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://local').pathname)}`);
    assert.ok(file.startsWith(`${root}${path.sep}`));
    res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const errors = [];
const quality = { viewports: [], frames: [], deterministic: false, moving: false };
const trainingArchive = JSON.parse(await readFile(path.join(root, 'docs/release-evidence/finetune-qwen4b-lora-2026-07-01/run-manifest.json'), 'utf8'));
const expectedCheckpoints = trainingArchive.validationSeries.filter(point => point.step >= 100 && point.step <= 800).map(point => [point.step, point.loss]);
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(`${origin}/videos/first-llm-studio-promo/index.html?render`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.filmReady, { timeout: 30000 });
  const times = [1.7, 7.5, 12.8, 18, 22.6, 27.4];
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const time of times) {
      const check = await page.evaluate(t => {
        window.seekFilm(t);
        const stage = document.querySelector('#stage').getBoundingClientRect();
        const active = document.querySelectorAll('.beat')[window.filmState.index];
        const boxes = [...active.querySelectorAll('.content, .source, .link, .runtime-copy')].map(el => {
          const r = el.getBoundingClientRect();
          return { className: el.className, inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1, overflow: el.scrollWidth > el.clientWidth + 1 };
        });
        const canvas = document.querySelector('#sculpture');
        const gl = canvas.getContext('webgl2');
        const pixels = new Uint8Array(1920 * 1080 * 4);
        gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let painted = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 32) painted++;
        return { ...window.filmState, boxes, painted };
      }, time);
      assert.ok(check.boxes.every(b => b.inside && !b.overflow), `Layout overflow: ${JSON.stringify(check)}`);
      assert.deepEqual(check.checkpointPoints, expectedCheckpoints);
      if ([0,1,5].includes(check.index)) assert.ok(check.painted > 30000, '3D sculpture rendered blank');
      quality.viewports.push({ viewport, time, ...check });
      if (viewport.width === 1920) {
        const file = path.join(raw, `preview-${check.index}.png`);
        const bytes = await page.screenshot({ path: file });
        quality.frames.push({ time, file: path.relative(root, file), sha256: sha(bytes) });
      } else await page.screenshot({ path: path.join(raw, `mobile-${check.index}.png`) });
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  const sample = async t => { await page.evaluate(time => window.seekFilm(time), t); return sha(await page.screenshot()); };
  const first = await sample(2);
  quality.moving = first !== await sample(3);
  await sample(17);
  quality.deterministic = first === await sample(2);
  assert.ok(quality.moving && quality.deterministic);
  assert.deepEqual(errors, []);
  await writeFile(path.join(raw, 'visual-qa.json'), `${JSON.stringify(quality, null, 2)}\n`);
  run(['-i', path.join(raw, 'preview-%d.png'), '-vf', 'scale=640:360,tile=3x2:padding=8:margin=8:color=0x171917', '-frames:v', '1', path.join(raw, 'contact-sheet.jpg')]);
  if (preview) { console.log(`Preview and desktop/mobile QA: ${raw}`); }
  else {
    const silent = path.join(raw, 'product-film-silent.mp4');
    const cacheFile = path.join(raw, 'raw-render-receipt.json');
    const cacheInputs = ['videos/first-llm-studio-promo/index.html','videos/first-llm-studio-promo/scene.mjs','videos/first-llm-studio-promo/package-lock.json','docs/release-evidence/finetune-qwen4b-lora-2026-07-01/run-manifest.json'];
    const inputHashes = {};
    for (const file of cacheInputs) inputHashes[file] = sha(await readFile(path.join(root,file)));
    if (process.argv.includes('--reuse-raw')) {
      const cached = JSON.parse(await readFile(cacheFile,'utf8'));
      assert.deepEqual(cached.inputHashes,inputHashes,'Raw render is stale; render without --reuse-raw');
      assert.equal(cached.videoSha256,sha(await readFile(silent)),'Raw video changed');
    }
    if (!process.argv.includes('--reuse-raw')) {
      const encoder = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
      const completed = once(encoder, 'close');
      encoder.stdin.on('error', () => {});
      try {
        for (let frame = 0; frame < duration * fps; frame++) {
          await page.evaluate(t => window.seekFilm(t), frame / fps);
          const bytes = await page.screenshot();
          if (!encoder.stdin.write(bytes)) await once(encoder.stdin, 'drain');
          if (frame % 150 === 0) console.log(`Rendered ${frame}/${duration * fps} frames`);
        }
      } finally { encoder.stdin.end(); }
      const [code] = await completed;
      assert.equal(code, 0, 'Frame encoder failed');
      await writeFile(cacheFile,JSON.stringify({ inputHashes, videoSha256:sha(await readFile(silent)) },null,2));
    }
    const audio = path.join(raw, 'original-score.wav');
    execFileSync(process.execPath, [path.join(root, 'scripts/synthesize-product-score.mjs'), audio], { stdio: 'inherit' });
    const mp4 = path.join(out, `${name}.mp4`), gif = path.join(out, `${name}.gif`), poster = path.join(out, `${name}.jpg`);
    run(['-i', silent, '-i', audio, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=8', '-c:a', 'aac', '-ar', '48000', '-b:a', '160k', '-t', String(duration), '-movflags', '+faststart', mp4]);
    run(['-ss', '1.7', '-i', mp4, '-frames:v', '1', '-q:v', '2', poster]);
    for (const [rate, width, colors] of [[8,760,64],[6,720,48],[5,640,40]]) {
      run(['-i', mp4, '-vf', `fps=${rate},scale=${width}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}[p];[b][p]paletteuse=dither=bayer`, '-loop', '0', gif]);
      if ((await stat(gif)).size < 6 * 1024 * 1024) break;
    }
    const probe = JSON.parse(execFileSync(ffprobe, ['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels','-of','json',mp4], { encoding:'utf8' }));
    const artifacts = {};
    for (const [kind,file] of Object.entries({ mp4,gif,poster })) {
      const bytes = await readFile(file);
      artifacts[kind] = { file:path.relative(root,file), bytes:bytes.length, sha256:sha(bytes) };
    }
    assert.ok(artifacts.mp4.bytes < 20 * 1024 * 1024);
    assert.ok(artifacts.gif.bytes < 6 * 1024 * 1024);
    const sources = ['videos/first-llm-studio-promo/index.html','videos/first-llm-studio-promo/scene.mjs','videos/first-llm-studio-promo/package-lock.json','scripts/render-product-promo.mjs','scripts/synthesize-product-score.mjs','docs/release-evidence/finetune-qwen4b-lora-2026-07-01/run-manifest.json','docs/release-evidence/v1.6.5-benchmark-reproducibility-latest.json','docs/release-evidence/v1.2.1-runtime-fabric-acceptance-2026-08-30.json','docs/release-evidence/v1.6.3-benchmark-qualification-latest.json'];
    const receipts = [];
    for (const file of sources) receipts.push({ file,sha256:sha(await readFile(path.join(root,file))) });
    const manifest = {
      schemaVersion:'first-llm-studio.product-promo.v2', renderedAt:new Date().toISOString(), durationSeconds:Number(probe.format.duration),
      creativeDirection:'Data in Motion: full-bleed Three.js model sculpture, kinetic typography, sourced checkpoint curve, 500-sample field, illustrative runtime traces; no UI screenshot collage.',
      video:probe.streams.find(s=>s.codec_type==='video'), audio:probe.streams.find(s=>s.codec_type==='audio'),
      audioProvenance:'Original deterministic procedural electronic score and transition sounds; generated from repository source, no vendor audio or third-party samples.',
      currentCaptureManifest:'docs/assets/product-tour/2026-10-06/manifest.json',
      metrics:{ modelBillions:4,peakTrainingMemoryGb:3.316,trainingSteps:816,bestValidationLoss:.066,bestStep:800,scoredSamples:500,scorerReplayAgreementPercent:100,modelAccuracyPercent:32,verifiedRuntimes:3,localSmokeTokensPerSecond:234.02,smokeRuns:3 },
      checkpointPoints:expectedCheckpoints,
      visualQa:{ desktopAndMobileChecks:quality.viewports.length,deterministic:quality.deterministic,moving:quality.moving,nonblankSculpture:true,overflow:false },
      evidenceBoundary:'Historical local evidence only. The sculpture, sample reveal and runtime traces are artistic representations, not live telemetry. Loss is not task quality; scorer replay agreement is not model accuracy; one-prompt three-run throughput is not a general performance promise. No new benchmark, customer ROI, external acceptance or production approval.',
      sources:receipts, artifacts,
    };
    await writeFile(path.join(out,'promo-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
    console.log(JSON.stringify(manifest,null,2));
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
