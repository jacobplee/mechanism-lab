// Checks for involute gears, gear trains and open belts.
//
// Tooth shape is checked on the outline itself (flank normals against the
// base circle), and meshing is checked by placing both outlines where the
// pose says they are and measuring the gap between them.

import { check, angles } from './check.js';
import { TAU, sub, dot, norm, dist, cross, angleOf, clearanceEdges, inside } from '../geom.js';
import { spurGear, gearTrain } from '../gears.js';

// ---------------------------------------------------------------- one gear

export function checkGearShape(gear, label = `${gear.N}T`) {
  const { N, m, outline } = gear;
  const phi = (gear.pressureDeg * Math.PI) / 180;
  const r = (m * N) / 2;
  const rb = r * Math.cos(phi);
  const ra = r + m;
  const radius = outline.map((p) => norm(p));

  // Flank chords: consecutive vertices strictly between base and tip circles.
  // An involute's normal is tangent to its base circle, so the perpendicular
  // bisector of a short flank chord passes the centre at distance rb.
  // Root circle: the outline's smallest radius. Root-arc vertices are not flank.
  const rRoot = Math.min(...radius);
  const onFlank = (i) => radius[i] > Math.max(rb, rRoot) * (1 + 1e-9) && radius[i] < ra * (1 - 1e-9);
  const dists = [];
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    if (!onFlank(i) || !onFlank(j)) continue;
    const ch = sub(outline[j], outline[i]);
    const mid = [(outline[i][0] + outline[j][0]) / 2, (outline[i][1] + outline[j][1]) / 2];
    dists.push(Math.abs(dot(mid, ch)) / norm(ch));
  }
  const normalErr = dists.length ? Math.max(...dists.map((d) => Math.abs(d - rb))) : NaN;
  const sorted = dists.slice().sort((x, y) => x - y);
  const rbMeasured = sorted[Math.floor(sorted.length / 2)];
  const pressure = (Math.acos(rbMeasured / r) * 180) / Math.PI;

  // Teeth: runs of vertices on the tip circle, counted round the outline.
  let teeth = 0;
  const atTip = (i) => radius[i] >= ra * (1 - 1e-9);
  for (let i = 0; i < outline.length; i++) {
    if (atTip(i) && !atTip((i - 1 + outline.length) % outline.length)) teeth++;
  }

  return [
    check('M7b', `${label}: flank normals tangent to base circle (error / m)`, normalErr / m, '<=', 1e-3),
    check('M7c', `${label}: pressure angle at pitch circle (deg off ${gear.pressureDeg})`,
      Math.abs(pressure - gear.pressureDeg), '<=', 0.05),
    check('M7d', `${label}: teeth counted on the outline`, teeth, '==', N),
  ];
}

// ---------------------------------------------------------------- one mesh

/** Where two gears can touch: around the pitch point, out to where their tip circles cross. */
function meshRegion(train, i) {
  const [O1, O2] = [train.centres[i], train.centres[i + 1]];
  const [g1, g2] = [train.gears[i], train.gears[i + 1]];
  const d = dist(O1, O2);
  const u = sub(O2, O1).map((v) => v / d);
  const pitch = [O1[0] + u[0] * g1.r, O1[1] + u[1] * g1.r];
  const x = (d * d - g2.ra ** 2 + g1.ra ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, g1.ra ** 2 - x * x));
  const X = [O1[0] + u[0] * x - u[1] * h, O1[1] + u[1] * x + u[0] * h];
  return { c: pitch, r: Math.max(dist(pitch, X), g1.m * 1.5) + g1.m };
}

/**
 * Signed gap between gears i and i+1 at input angle phi0, with gear i+1 turned
 * an extra `extra` radians. Only edges inside the mesh region are measured,
 * and only those are moved into world coordinates.
 */
function meshGapFn(train, i) {
  const region = meshRegion(train, i);
  const cap = 4 * train.gears[i].m;
  const side = (k, phi) => {
    const g = train.gears[k], O = train.centres[k];
    const c = Math.cos(phi), s = Math.sin(phi);
    const lx = (region.c[0] - O[0]) * c + (region.c[1] - O[1]) * s;
    const ly = -(region.c[0] - O[0]) * s + (region.c[1] - O[1]) * c;
    const r2 = region.r * region.r;
    const P = g.outline, n = P.length;
    const near = new Uint8Array(n);
    for (let j = 0; j < n; j++) near[j] = (P[j][0] - lx) ** 2 + (P[j][1] - ly) ** 2 <= r2 ? 1 : 0;
    const world = (v) => [O[0] + v[0] * c - v[1] * s, O[1] + v[0] * s + v[1] * c];
    const edges = [];
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      if (near[j] || near[j2]) edges.push([world(P[j]), world(P[j2])]);
    }
    const isIn = (q) => inside([(q[0] - O[0]) * c + (q[1] - O[1]) * s, -(q[0] - O[0]) * s + (q[1] - O[1]) * c], P);
    return { edges, isIn };
  };
  return (phi0, extra = 0, signOnly = false) => {
    const ph = train.pose(phi0).phis;
    const a = side(i, ph[i]), b = side(i + 1, ph[i + 1] + extra);
    return clearanceEdges(a.edges, b.edges, a.isIn, b.isIn, cap, signOnly);
  };
}

export function checkMesh(train, i = 0, { phases = 48, conjugate = true } = {}) {
  const [g1, g2] = [train.gears[i], train.gears[i + 1]];
  const tag = `${g1.N}T-${g2.N}T`;
  const gap = meshGapFn(train, i);

  // Input angle that turns gear i through one tooth pitch.
  const k = train.pose(1).phis[i] - train.pose(0).phis[i];
  const step = TAU / g1.N / Math.abs(k);
  const th = angles(phases, 0.123, step);

  // e. speed ratio from the pose
  const d1 = train.pose(1.7).phis[i] - train.pose(0.2).phis[i];
  const d2 = train.pose(1.7).phis[i + 1] - train.pose(0.2).phis[i + 1];

  // f. never interfere
  let minClear = Infinity;
  for (const t of th) minClear = Math.min(minClear, gap(t));

  // g. backlash each way: turn the driven gear until it touches.
  const room = (t, sgn) => {
    let lo = 0, hi = Math.PI / g2.N;
    for (let n = 0; n < 32; n++) {
      const mid = (lo + hi) / 2;
      if (gap(t, sgn * mid, true) > 0) lo = mid; else hi = mid;
    }
    return lo * g2.r;           // as arc length on the pitch circle
  };
  const designSide = (g1.backlash + g2.backlash) / 4;
  let sideErr = 0, plus = 0;
  for (const t of [th[0], th[Math.floor(phases / 2)]]) {
    const p = room(t, 1), m = room(t, -1);
    if (t === th[0]) plus = p;
    const scale = Math.max(designSide, 0.01 * g1.m);
    sideErr = Math.max(sideErr, Math.abs(p - designSide) / scale, Math.abs(m - designSide) / scale);
  }

  // h. conjugate action: close one flank at the first phase, then hold that
  // offset through a whole tooth cycle. Contact must neither open nor bite.
  const closed = plus / g2.r;
  let drift = 0;
  if (conjugate) for (const t of th) drift = Math.max(drift, Math.abs(gap(t, closed)));

  return [
    check('M7a', `${tag}: centre distance = m(N1 + N2)/2`,
      Math.abs(dist(train.centres[i], train.centres[i + 1]) - (g1.m * (g1.N + g2.N)) / 2), '<=', 1e-9),
    check('M7e', `${tag}: speed ratio = -N1/N2`, Math.abs(d2 / d1 + g1.N / g2.N), '<=', 1e-12),
    check('M7f', `${tag}: no interference over a tooth cycle (clearance)`, minClear, '>=', 0),
    check('M7g', `${tag}: backlash split evenly (worst side error, fraction)`, sideErr, '<=', 0.05),
    ...(conjugate ? [check('M7h', `${tag}: flank closed, contact held over a tooth cycle (/ m)`, drift / g1.m, '<=', 2e-3)] : []),
  ];
}

export function checkGearPair(train) {
  return [...checkGearShape(train.gears[0]), ...checkGearShape(train.gears[1]), ...checkMesh(train, 0)];
}

// ---------------------------------------------------------------- idler train

export function checkIdlerTrain(train, { idlers = [17, 23, 31] } = {}) {
  const out = [];
  for (let i = 0; i + 1 < train.gears.length; i++) {
    out.push(...checkMesh(train, i, { conjugate: false }).filter((c) => ['M7a', 'M7f', 'M7g'].includes(c.id))
      .map((c) => ({ ...c, id: 'M8a' })));
  }
  // The ratio across any simple train is set by the end gears alone; idlers
  // change direction, not speed. Swap the idler and measure it again.
  const first = train.gears[0], last = train.gears[train.gears.length - 1];
  const k = train.gears.length - 1;
  const expected = (k % 2 ? -1 : 1) * (first.N / last.N);
  const ratioOf = (t) => {
    const a = t.pose(0.4).phis, b = t.pose(1.9).phis;
    return (b[b.length - 1] - a[a.length - 1]) / (b[0] - a[0]);
  };
  let err = Math.abs(ratioOf(train) - expected);
  for (const N of idlers) {
    const mid = train.gears.slice(1, -1).map((g) => spurGear({ N, m: g.m, backlash: g.backlash }));
    const alt = gearTrain([first, ...mid, last], train.angles, train.centres[0]);
    err = Math.max(err, Math.abs(ratioOf(alt) - expected));
  }
  out.push(check('M8b', `output ratio = ${expected > 0 ? '+' : '-'}N_in/N_out with idlers ${idlers.join(', ')} and shipped`,
    err, '<=', 1e-12));
  return out;
}

// ---------------------------------------------------------------- open belt

export function checkBelt(belt) {
  const [{ c: c1, r: r1 }, { c: c2, r: r2 }] = belt.pulleys;
  const runs = belt.runs;
  const d = dist(c1, c2);

  let onRim = 0, perp = 0, crossed = 0;
  for (const [P, Q] of runs) {
    onRim = Math.max(onRim, Math.abs(dist(P, c1) - r1), Math.abs(dist(Q, c2) - r2));
    const run = sub(Q, P), L = norm(run);
    perp = Math.max(perp,
      Math.abs(dot(sub(P, c1), run)) / (r1 * L),
      Math.abs(dot(sub(Q, c2), run)) / (r2 * L));
    if (Math.sign(cross(run, sub(c1, P))) !== Math.sign(cross(run, sub(c2, P)))) crossed++;
  }
  // The drawn path must pass through the tangent points it was built on.
  const path = belt.path();
  for (const [P, Q] of runs) {
    for (const T of [P, Q]) onRim = Math.max(onRim, Math.min(...path.map((v) => dist(v, T))));
  }

  // Length, measured from the tangent points: two runs plus the wrap on each
  // pulley, taking the arc that faces away from the other pulley.
  const wrap = (c, A, B, away) => {
    const a = angleOf(sub(A, c)), b = angleOf(sub(B, c));
    const span = (((b - a) % TAU) + TAU) % TAU;
    const toAway = (((away - a) % TAU) + TAU) % TAU;
    return toAway < span ? span : TAU - span;
  };
  const measured = dist(...runs[0]) + dist(...runs[1]) +
    r1 * wrap(c1, runs[0][0], runs[1][0], angleOf(sub(c1, c2))) +
    r2 * wrap(c2, runs[0][1], runs[1][1], angleOf(sub(c2, c1)));
  const closedForm = 2 * Math.sqrt(d * d - (r1 - r2) ** 2) + Math.PI * (r1 + r2) +
    2 * (r1 - r2) * Math.asin((r1 - r2) / d);

  const p = belt.pose(1.234);
  const slip = Math.abs(p.phi1 * r1 - p.phi2 * r2);
  const sameWay = Math.sign(p.phi1) === Math.sign(p.phi2);

  return [
    check('M9a', 'tangent points on both rims and on the drawn path', onRim, '<=', 1e-9),
    check('M9b', 'runs perpendicular to both radii', perp, '<=', 1e-12),
    check('M9c', 'both runs external (crossed runs)', crossed, '==', 0),
    check('M9d', 'length = closed-form open-belt length', Math.abs(measured - closedForm), '<=', 1e-9),
    check('M9e', 'no slip: equal surface speed, same direction', sameWay ? slip : NaN, '<=', 1e-12),
  ];
}
