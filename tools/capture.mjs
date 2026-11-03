// Optional tooling: check the demo page in headless Chrome and render the
// README images from it.
//
// Not part of the library or its tests. It needs puppeteer-core, pngjs and
// gifenc, installed anywhere you like, plus a local Chrome:
//
//   npm install --prefix <dir> puppeteer-core pngjs gifenc
//   CAPTURE_DEPS=<dir> node tools/capture.mjs            # check + images
//   CAPTURE_DEPS=<dir> node tools/capture.mjs --check    # check only
//
// CHROME_PATH overrides the browser location. Each run uses a fresh,
// temporary Chrome profile.

import http from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const deps = process.env.CAPTURE_DEPS;
if (!deps) { console.error('Set CAPTURE_DEPS to a folder with puppeteer-core, pngjs and gifenc installed.'); process.exit(2); }
const req = createRequire(join(deps, 'node_modules', 'noop.js'));
const puppeteer = req('puppeteer-core');
const { PNG } = req('pngjs');
const { GIFEncoder, quantize, applyPalette } = req('gifenc');
const checkOnly = process.argv.includes('--check');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---- a static file server for the repository
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/plain' };
const server = http.createServer(async (rq, rs) => {
  const url = new URL(rq.url, 'http://x');
  const p = normalize(join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
  if (!p.startsWith(root)) { rs.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(p); } catch { rs.writeHead(404).end(); return; }
  rs.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const profile = await mkdtemp(join(tmpdir(), 'mechlab-chrome-'));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: profile, args: ['--no-first-run', '--hide-scrollbars'] });
const results = [];
const note = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

async function open(url, { width = 1280, height = 900, scale = 1, media = [] } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  if (media.length) await page.emulateMediaFeatures(media);
  await page.goto(url, { waitUntil: 'load' });
  const report = await page.evaluate(async () => {
    const r = await window.mechanismLab.report;
    return { pass: r.pass, total: r.total, failed: r.failed.length, badge: document.getElementById('badge').textContent };
  });
  return { page, errors, external, report };
}

try {
  // D1, D2, D4: desktop, light
  const d = await open(base + '?still');
  note('D4 no console errors (desktop, light)', d.errors.length === 0, d.errors.join(' | '));
  note('D1 no external requests', d.external.length === 0, d.external.join(' '));
  note('D2/D4 badge reports every check passing', d.report.pass && d.report.failed === 0, `${d.report.badge}`);
  const panels = await d.page.$$eval('.panel svg.mech', (s) => s.length);
  note('D1 one animated panel per mechanism', panels === 8, `${panels} panels`);

  // D3: dark theme renders and differs from light
  const k = await open(base + '?still', { media: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  const bg = await k.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  note('D3 dark theme follows the system setting', k.errors.length === 0 && bg !== 'rgb(245, 245, 242)', bg);

  // D3: phone width, no horizontal scroll
  const ph = await open(base, { width: 375, height: 800, scale: 2 });
  const over = await ph.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  note('D3 no horizontal scroll at 375 px', over <= 0, `overflow ${over}px`);

  // D3: reduced motion starts paused
  const rm = await open(base, { media: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const btn = await rm.page.$eval('#play', (b) => b.textContent);
  note('D3 prefers-reduced-motion starts paused', btn === 'Play', `button reads "${btn}"`);

  // D1: the page actually animates
  const an = await open(base);
  const t0 = await an.page.$eval('#panel-geneva .readout', (e) => e.textContent);
  await new Promise((r) => setTimeout(r, 600));
  const t1 = await an.page.$eval('#panel-geneva .readout', (e) => e.textContent);
  const g0 = await an.page.$eval('#panel-scotchYoke .readout', (e) => e.textContent);
  await new Promise((r) => setTimeout(r, 300));
  const g1 = await an.page.$eval('#panel-scotchYoke .readout', (e) => e.textContent);
  note('D1 panels animate', g0 !== g1 || t0 !== t1, `${g0} -> ${g1}`);

  if (!checkOnly) {
    const out = join(root, 'docs', 'img');
    await mkdir(out, { recursive: true });
    // Overview screenshot.
    const light = [{ name: 'prefers-color-scheme', value: 'light' }];
    const ov = await open(base + '?still', { width: 1240, height: 900, scale: 1, media: light });
    await ov.page.evaluate(() => { for (const d of document.querySelectorAll('details')) d.open = false; });
    await writeFile(join(out, 'overview.png'), await ov.page.screenshot({ fullPage: true }));
    console.log('wrote docs/img/overview.png');

    // One looping GIF per mechanism, of the drawing itself.
    const g = await open(base + '?still', { width: 1240, height: 900, scale: 1.5, media: light });
    const keys = await g.page.evaluate(() => Object.keys(window.mechanismLab.panels));
    const FRAMES = { ratchet: 72, gearPair: 72, idlerTrain: 64, geneva: 72 };
    for (const key of keys) {
      const handle = await g.page.$(`#panel-${key} svg.mech`);
      const { period, start } = await g.page.evaluate((k) => ({ period: window.mechanismLab.panels[k].period, start: 0.6 }), key);
      const n = FRAMES[key] ?? 60;
      const enc = GIFEncoder();
      let palette = null;
      for (let i = 0; i < n; i++) {
        await g.page.evaluate((k, a) => window.mechanismLab.show(k, a), key, start + (period * i) / n);
        const png = PNG.sync.read(Buffer.from(await handle.screenshot({ type: 'png' })));
        const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
        if (!palette) palette = quantize(rgba, 48);
        enc.writeFrame(applyPalette(rgba, palette), png.width, png.height, { palette, delay: 40 });
      }
      enc.finish();
      const file = join(out, `${key}.gif`);
      await writeFile(file, enc.bytes());
      // If ImageMagick is installed, let it store only what changes per frame.
      const opt = spawnSync('magick', [file, '-layers', 'optimize', file]);
      console.log(`wrote docs/img/${key}.gif (${n} frames${opt.status === 0 ? ', optimised' : ''})`);
    }
  }
} finally {
  await browser.close();
  server.close();
  await rm(profile, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `${failed.length} demo checks failed` : `all ${results.length} demo checks passed`);
process.exit(failed.length ? 1 : 0);
