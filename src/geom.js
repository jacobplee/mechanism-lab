// Plane geometry shared by the models and the checks.
//
// Points are [x, y] arrays. The y axis points down, as in SVG, so a positive
// angle turns from +x toward +y (clockwise on screen). None of the kinematics
// depends on that choice; it only saves the renderer a flip.

export const TAU = Math.PI * 2;

export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const scale = (a, k) => [a[0] * k, a[1] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const norm = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const polar = (r, ang) => [r * Math.cos(ang), r * Math.sin(ang)];
export const angleOf = (a) => Math.atan2(a[1], a[0]);

/** Rotate point p by ang about the origin. */
export function rotate(p, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Rotate every point of a polygon by ang about the origin, then translate. */
export function place(points, ang = 0, at = [0, 0]) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return points.map(([x, y]) => [x * c - y * s + at[0], x * s + y * c + at[1]]);
}

/** Wrap an angle into [-P/2, P/2). */
export function wrap(a, P = TAU) {
  let v = ((a % P) + P) % P;
  if (v >= P / 2) v -= P;
  return v;
}

/** Points on a circle, counter-clockwise in the maths sense. */
export function circle(c, r, steps = 64) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
}

/** Points on an arc from a0 to a1 inclusive (either direction). */
export function arc(c, r, a0, a1, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
}

/** Insert points along a closed polygon so no edge is longer than maxSeg. */
export function resampleClosed(poly, maxSeg) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxSeg));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  return out;
}

/** Shortest distance from p to the segment ab. */
export function pointSegDist(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const L2 = abx * abx + aby * aby;
  let t = L2 > 0 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby));
}

/** Shortest distance from p to the boundary of a closed polygon. */
export function distToOutline(p, poly) {
  let best = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const d = pointSegDist(p, poly[i], poly[(i + 1) % n]);
    if (d < best) best = d;
  }
  return best;
}

/** Even-odd point-in-polygon test. Orientation does not matter. */
export function inside(p, poly) {
  let hit = false;
  const [x, y] = p;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

function segsCross(a, b, c, d) {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - c[0], vy = d[1] - c[1];
  const d1 = ux * (c[1] - a[1]) - uy * (c[0] - a[0]);
  const d2 = ux * (d[1] - a[1]) - uy * (d[0] - a[0]);
  if (!((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))) return false;
  const d3 = vx * (a[1] - c[1]) - vy * (a[0] - c[0]);
  const d4 = vx * (b[1] - c[1]) - vy * (b[0] - c[0]);
  return (d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0);
}

/**
 * Signed clearance between two closed polygons, as solid bodies.
 *
 * Positive: the gap between them. Negative: they overlap, and the magnitude is
 * how deep the deepest vertex of one sits inside the other. Distances larger
 * than `cap` are reported as `cap`, which lets the search skip every edge that
 * is obviously far away. An optional `region` circle {c, r} limits the search
 * to edges with an end inside it, for when contact can only happen there (two
 * gears can only touch where their tip circles overlap). With `signOnly`, an
 * overlap is reported as a tiny negative number without measuring its depth.
 */
export function clearance(A, B, { cap = 10, region = null, signOnly = false } = {}) {
  const [ax0, ay0, ax1, ay1] = bbox(A);
  const [bx0, by0, bx1, by1] = bbox(B);
  if (ax0 - cap > bx1 || bx0 - cap > ax1 || ay0 - cap > by1 || by0 - cap > ay1) return cap;

  const inRegion = region
    ? (p) => (p[0] - region.c[0]) ** 2 + (p[1] - region.c[1]) ** 2 <= region.r * region.r
    : () => true;
  // Edges of each polygon that come within `cap` of the other's bounding box.
  const near = (P, [x0, y0, x1, y1]) => {
    const out = [];
    for (let i = 0, n = P.length; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      if (Math.max(a[0], b[0]) < x0 - cap || Math.min(a[0], b[0]) > x1 + cap ||
          Math.max(a[1], b[1]) < y0 - cap || Math.min(a[1], b[1]) > y1 + cap) continue;
      if (!inRegion(a) && !inRegion(b)) continue;
      out.push([a, b]);
    }
    return out;
  };
  const eA = near(A, [bx0, by0, bx1, by1]);
  const eB = near(B, [ax0, ay0, ax1, ay1]);
  return clearanceEdges(eA, eB, (p) => inside(p, A), (p) => inside(p, B), cap, signOnly);
}

/**
 * The core of `clearance`, on pre-selected edge lists [[a, b], ...] and
 * point-in-body tests for each side. Exposed so a caller that already knows
 * where contact can happen (two gears) can hand over just those edges.
 */
export function clearanceEdges(eA, eB, insideA, insideB, cap = 10, signOnly = false) {
  if (!eA.length || !eB.length) return cap;

  // Outlines that cross overlap. Outlines that do not cross are either apart
  // or nested, and one inside test per polygon tells which.
  let crossing = false;
  for (const [a, b] of eA) {
    for (const [c, d] of eB) if (segsCross(a, b, c, d)) { crossing = true; break; }
    if (crossing) break;
  }
  const nested = !crossing && (insideB(eA[0][0]) || insideA(eB[0][0]));

  if (!crossing && !nested) {
    let gap = cap;
    // Point-to-edge distances, skipping any edge whose bounding box is
    // already further away than the best gap found so far.
    const scan = (from, to) => {
      const n = to.length;
      const x0 = new Float64Array(n), x1 = new Float64Array(n), y0 = new Float64Array(n), y1 = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        const [a, b] = to[k];
        x0[k] = Math.min(a[0], b[0]); x1[k] = Math.max(a[0], b[0]);
        y0[k] = Math.min(a[1], b[1]); y1[k] = Math.max(a[1], b[1]);
      }
      for (const [p] of from) {
        for (let k = 0; k < n; k++) {
          const dx = p[0] < x0[k] ? x0[k] - p[0] : p[0] > x1[k] ? p[0] - x1[k] : 0;
          const dy = p[1] < y0[k] ? y0[k] - p[1] : p[1] > y1[k] ? p[1] - y1[k] : 0;
          if (dx >= gap || dy >= gap) continue;
          const v = pointSegDist(p, to[k][0], to[k][1]);
          if (v < gap) gap = v;
        }
      }
    };
    scan(eA, eB);
    scan(eB, eA);
    return gap;
  }

  // Overlap: report how deep the deepest vertex of either sits in the other
  // (or just that they overlap, when the caller only needs the sign).
  if (signOnly) return -1e-15;
  let depth = 0;
  const probe = (from, to, isIn) => {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const [a] of to) {
      if (a[0] < bx0) bx0 = a[0]; if (a[0] > bx1) bx1 = a[0];
      if (a[1] < by0) by0 = a[1]; if (a[1] > by1) by1 = a[1];
    }
    for (const [p] of from) {
      if (p[0] < bx0 || p[0] > bx1 || p[1] < by0 || p[1] > by1) continue;
      if (!isIn(p)) continue;
      let d = Infinity;
      for (const [a, b] of to) d = Math.min(d, pointSegDist(p, a, b));
      if (d > depth) depth = d;
    }
  };
  probe(eA, eB, insideB);
  probe(eB, eA, insideA);
  return -Math.max(depth, 1e-15);
}

/**
 * Amplitude of harmonic k of a periodic signal sampled at N evenly spaced
 * points over one period: a plain DFT bin, scaled so a pure A*cos(k t) reads A.
 */
export function harmonic(samples, k) {
  const N = samples.length;
  let re = 0, im = 0;
  for (let j = 0; j < N; j++) {
    const t = (TAU * k * j) / N;
    re += samples[j] * Math.cos(t);
    im -= samples[j] * Math.sin(t);
  }
  return (2 / N) * Math.hypot(re, im);
}

/** Sample f at N evenly spaced angles over [0, 2π). */
export function sweep(N, f) {
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = f((i / N) * TAU, i);
  return out;
}

/** Root of a sign change of f on [lo, hi] by bisection. */
export function bisect(f, lo, hi, tol = 1e-13, maxIter = 200) {
  let flo = f(lo);
  for (let i = 0; i < maxIter && hi - lo > tol; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}
