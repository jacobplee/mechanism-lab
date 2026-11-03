// Demo page: draw every mechanism, animate it, and verify it.
//
// The models are built once. The same objects are drawn by the scenes and
// handed to verify(), so what is checked is exactly what is on screen.

import { defaultModels, verify, TAU } from '../src/index.js';
import { SCENES } from './scenes.js';
import { el, pathD } from './svg.js';

const query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const models = defaultModels();

let playing = !(reduced || query.has('still'));
let speed = 1;
let clock = 0;                     // seconds of animation time

const h = (tag, attrs = {}, parent = null, text = null) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
};

// ------------------------------------------------------------ panels

const grid = document.getElementById('grid');
const panels = SCENES.map((sc) => {
  const model = models[sc.key];
  const card = h('article', { class: 'panel', id: `panel-${sc.key}` }, grid);
  const head = h('div', { class: 'panel-head' }, card);
  h('h2', {}, head, sc.title);
  const status = h('span', { class: 'status pending' }, head, 'checking');
  const svg = el('svg', { class: 'mech', role: 'img', 'aria-label': `${sc.title}, animated` }, card);
  const drawn = sc.build(svg, model);
  const [x0, y0, x1, y1] = drawn.bounds;
  svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);

  let plot = null;
  if (sc.plot) {
    const spec = sc.plot(model);
    const psvg = el('svg', { class: 'plot', viewBox: '0 0 360 44', preserveAspectRatio: 'none', role: 'img', 'aria-label': spec.label }, card);
    const N = 360, xs = [], ys = [], rs = [];
    const from = sc.plotFrom ?? 0;
    for (let i = 0; i <= N; i++) {
      const a = from + (i / N) * sc.period;
      xs.push((i / N) * 360); ys.push(spec.f(a));
      if (spec.ref) rs.push(spec.ref(a));
    }
    const all = ys.concat(rs);
    const lo = Math.min(...all), hi = Math.max(...all);
    const Y = (v) => 40 - ((v - lo) / (hi - lo || 1)) * 36;
    el('path', { d: 'M0 42H360', class: 'axis' }, psvg);
    if (rs.length) el('path', { d: pathD(xs.map((x, i) => [x, Y(rs[i])]), false), class: 'ref' }, psvg);
    el('path', { d: pathD(xs.map((x, i) => [x, Y(ys[i])]), false), class: 'curve' }, psvg);
    const cursor = el('path', { class: 'cursor' }, psvg);
    const dot = el('path', { class: 'dot' }, psvg);
    plot = (a) => {
      const u = (((a - from) % sc.period) + sc.period) % sc.period;
      const x = (u / sc.period) * 360;
      cursor.setAttribute('d', `M${x.toFixed(2)} 0V44`);
      dot.setAttribute('d', `M${x.toFixed(2)} ${Y(spec.f(from + u)).toFixed(2)}h0`);
    };
  }

  const readout = h('p', { class: 'readout' }, card);
  h('p', { class: 'caption' }, card, sc.caption);
  const details = h('details', { class: 'checks' }, card);
  const summary = h('summary', {}, details, 'Checks');
  const table = h('table', {}, details);

  const start = 0.6;               // a pose that shows the mechanism mid-motion
  const angleAt = (seconds) => start + sc.rate * TAU * seconds;
  const render = (a) => {
    readout.textContent = drawn.update(a);
    if (plot) plot(a);
  };
  return { key: sc.key, sc, svg, card, status, summary, table, angleAt, render, period: sc.period };
});

// ------------------------------------------------------------ animation

function frame(now) {
  if (frame.last == null) frame.last = now;
  const dt = Math.min(0.1, (now - frame.last) / 1000);
  frame.last = now;
  if (playing) clock += dt * speed;
  if (playing || frame.dirty) {
    for (const p of panels) p.render(p.angleAt(clock));
    frame.dirty = false;
  }
  requestAnimationFrame(frame);
}
frame.dirty = true;
requestAnimationFrame(frame);

const playBtn = document.getElementById('play');
const syncPlay = () => { playBtn.textContent = playing ? 'Pause' : 'Play'; };
playBtn.addEventListener('click', () => { playing = !playing; syncPlay(); });
document.getElementById('speed').addEventListener('input', (e) => { speed = +e.target.value; });
syncPlay();

// ------------------------------------------------------------ verification

const fmt = (v) => {
  if (typeof v !== 'number') return String(v);
  if (Number.isInteger(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  return a < 1e-3 || a >= 1e4 ? v.toExponential(1) : v.toFixed(4);
};
const lim = (r) => (r.op === 'in' ? `in [${r.limit.map(fmt).join(', ')}]` : `${r.op === '==' ? '=' : r.op} ${fmt(r.limit)}`);

const badge = document.getElementById('badge');
const results = [];

async function runChecks() {
  for (const p of panels) {
    // One mechanism at a time, yielding between them so the animation keeps
    // running while the checks do.
    await new Promise((r) => setTimeout(r, 16));
    const rep = verify(models, [p.key]);
    results.push(...rep.results);
    const bad = rep.results.filter((r) => !r.pass).length;
    p.status.className = `status ${bad ? 'bad' : 'ok'}`;
    p.status.textContent = bad ? `${bad} of ${rep.total} checks fail` : `${rep.total} of ${rep.total} checks pass`;
    p.summary.textContent = `${rep.total} checks, ${Math.round(rep.timing[p.key])} ms`;
    for (const r of rep.results) {
      const tr = h('tr', {}, p.table);
      h('td', { class: `mark ${r.pass ? 'ok' : 'bad'}` }, tr, r.pass ? '✓' : '✗');
      h('td', { class: 'id' }, tr, r.id);
      h('td', {}, tr, r.name);
      h('td', { class: 'val', title: lim(r) }, tr, fmt(r.value));
    }
    badge.textContent = `Verifying ${results.length} checks`;
  }
  const failed = results.filter((r) => !r.pass);
  badge.className = `badge ${failed.length ? 'bad' : 'ok'}`;
  badge.textContent = failed.length
    ? `${failed.length} of ${results.length} checks fail`
    : `Verified: ${results.length} of ${results.length} checks pass`;
  return { pass: failed.length === 0, total: results.length, failed, results };
}

// A small handle for tools (the README image capture drives the page with it).
window.mechanismLab = {
  models,
  panels: Object.fromEntries(panels.map((p) => [p.key, p])),
  pause() { playing = false; syncPlay(); },
  show(key, angle) { const p = panels.find((q) => q.key === key); p.render(angle); },
  report: runChecks(),
};
