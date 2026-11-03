// Checks for the Scotch yoke, crank-slider, cam and four-bar.
//
// Every check states a property of the mechanism and measures the model's
// pose output against it. Dimensions are read off the model.

import { check, worst, angles, extremes } from './check.js';
import { norm, dist, sub, dot, cross, harmonic, place } from '../geom.js';

const highHarmonics = (xs) => {
  let h = 0;
  for (let k = 2; k <= 8; k++) h = Math.max(h, harmonic(xs, k));
  return h / harmonic(xs, 1);
};

export function checkScotchYoke(model, N = 720) {
  const { r, pinR } = model.params;
  const { slotLen } = model.geometry;
  const poses = angles(N).map((t) => model.pose(t));
  const x0 = poses[0].yoke[0];
  const ys = poses.map((p) => p.yoke[1]);
  const span = extremes((t) => model.pose(t).yoke[1]);
  const margin = Math.min(...poses.map((p) => slotLen / 2 - (Math.abs(p.pin[0] - p.yoke[0]) + pinR)));
  return [
    check('M1a', 'crank pin stays on its circle', worst(poses, (p) => norm(p.pin) - r), '<=', 1e-9),
    check('M1b', 'pin centre stays on the slot centreline', worst(poses, (p) => p.pin[1] - p.yoke[1]), '<=', 1e-9),
    check('M1c', 'pin stays inside the slot ends (margin)', margin, '>=', 0),
    check('M1d', 'yoke moves only along its guide', worst(poses, (p) => p.yoke[0] - x0), '<=', 1e-9),
    check('M1e', 'output is a pure sinusoid (harmonics 2-8 / fundamental)', highHarmonics(ys), '<=', 1e-9),
    check('M1f', 'stroke = 2r', Math.abs(span.max - span.min - 2 * r), '<=', 1e-9),
  ];
}

export function checkCrankSlider(model, N = 720) {
  const { r, L } = model.params;
  const poses = angles(N).map((t) => model.pose(t));
  const xs = poses.map((p) => p.slider[0]);
  const span = extremes((t) => model.pose(t).slider[0]);
  // Second harmonic of sqrt(1 - λ² sin²θ), expanded: the textbook series.
  const lam = r / L;
  const series = L * (lam ** 2 / 4 + lam ** 4 / 16 + (15 * lam ** 6) / 512);
  const h2 = harmonic(xs, 2);
  return [
    check('M2a', 'connecting-rod length is constant', worst(poses, (p) => dist(p.crankPin, p.slider) - L), '<=', 1e-9),
    check('M2b', 'slider stays on its axis', worst(poses, (p) => p.slider[1]), '<=', 1e-9),
    check('M2c', 'stroke = 2r', Math.abs(span.max - span.min - 2 * r), '<=', 1e-9),
    check('M2c', 'dead centres at L + r and L - r', Math.max(Math.abs(span.max - (L + r)), Math.abs(span.min - (L - r))), '<=', 1e-9),
    check('M2d', 'second harmonic matches the series (relative error)', Math.abs(h2 - series) / series, '<=', 1e-3,
      `measured ${h2.toFixed(5)}, series ${series.toFixed(5)}`),
  ];
}

export function checkCamFollower(model, N = 720) {
  const { R, e } = model.params;
  const { faceW } = model.geometry;
  const poses = angles(N).map((t) => model.pose(t));
  const span = extremes((t) => model.pose(t).faceY);
  // The drawn outline: worst gap to the face, or the worst penetration.
  const outline = model.geometry.outline;
  const sag = R * (1 - Math.cos(Math.PI / outline.length));
  let maxGap = 0, minDist = Infinity;
  for (const p of poses) {
    let d = Infinity;
    for (const q of place(outline, p.theta)) d = Math.min(d, q[1] - p.faceY);
    maxGap = Math.max(maxGap, d);
    minDist = Math.min(minDist, d);
  }
  const contactMargin = Math.min(...poses.map((p) => faceW / 2 - Math.abs(p.contact[0] - p.follower[0])));
  return [
    check('M4a', 'face tangent to the cam (centre-to-face distance = R)',
      worst(poses, (p) => (p.camCentre[1] > p.faceY ? p.camCentre[1] - p.faceY - R : NaN)), '<=', 1e-9),
    check('M4b', 'drawn cam outline touches the face, never penetrates', minDist < 0 ? minDist : maxGap, 'in', [-1e-9, sag],
      `chord sag ${sag.toExponential(2)}`),
    check('M4c', 'total lift = 2e', Math.abs(span.max - span.min - 2 * e), '<=', 1e-9),
    check('M4d', 'simple harmonic (harmonics 2-8 / fundamental)', highHarmonics(poses.map((p) => p.faceY)), '<=', 1e-9),
    check('M4e', 'follower stays on its axis', worst(poses, (p) => p.follower[0] - poses[0].follower[0]), '<=', 1e-9),
    check('M4e', 'contact point stays on the follower face (margin)', contactMargin, '>=', 0),
  ];
}

export function checkFourBar(model, N = 3600) {
  const { ground, crank, coupler, rocker } = model.params;
  const { A, D } = model.geometry;
  const d = dist(A, D);
  const bars = [crank, coupler, rocker, d].sort((x, y) => x - y);
  const poses = angles(N).map((t) => model.pose(t));
  const closed = poses.filter((p) => p.C);
  let flips = 0, prev = 0;
  for (const p of closed) {
    const s = Math.sign(cross(sub(p.C, p.B), sub(D, p.B)));
    if (prev && s !== prev) flips++;
    prev = s;
  }
  // Rocker angle at D (between D->A and D->C) and transmission angle at C.
  const angleAt = (O, X, Y) => {
    const u = sub(X, O), v = sub(Y, O);
    return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (norm(u) * norm(v)))));
  };
  const rockerAt = (t) => { const p = model.pose(t); return p.C ? angleAt(D, A, p.C) : NaN; };
  const muAt = (t) => { const p = model.pose(t); return p.C ? angleAt(p.C, p.B, D) : NaN; };
  const rk = extremes(rockerAt, 1440), mu = extremes(muAt, 1440);
  // Predictions. Rocker extremes are the toggle positions, where crank and
  // coupler are collinear (|AC| = coupler ± crank). Transmission-angle extremes
  // are where the crank lies along the ground line (|BD| = ground ∓ crank).
  const lawCos = (x, y, opp) => Math.acos((x * x + y * y - opp * opp) / (2 * x * y));
  const rkPred = [lawCos(rocker, d, coupler - crank), lawCos(rocker, d, coupler + crank)];
  const muPred = [lawCos(coupler, rocker, d - crank), lawCos(coupler, rocker, d + crank)];
  const deg = 180 / Math.PI;
  return [
    check('M6a', 'Grashof: s + l - (p + q) <= 0', bars[0] + bars[3] - bars[1] - bars[2], '<=', 0),
    check('M6a', 'crank is the shortest link', crank - bars[0], '<=', 0),
    check('M6b', 'closes at every crank angle (open positions)', N - closed.length, '==', 0),
    check('M6c', 'link lengths constant', Math.max(
      worst(closed, (p) => dist(A, p.B) - crank),
      worst(closed, (p) => dist(p.B, p.C) - coupler),
      worst(closed, (p) => dist(p.C, D) - rocker),
      Math.abs(d - ground)), '<=', 1e-9),
    check('M6d', 'no branch flip (sign changes)', flips, '==', 0),
    check('M6e', 'rocker extremes = toggle-position prediction',
      Math.max(Math.abs(rk.min - rkPred[0]), Math.abs(rk.max - rkPred[1])), '<=', 1e-6,
      `swing ${(rk.min * deg).toFixed(2)} to ${(rk.max * deg).toFixed(2)} deg`),
    check('M6f', 'transmission-angle extremes = prediction',
      Math.max(Math.abs(mu.min - muPred[0]), Math.abs(mu.max - muPred[1])), '<=', 1e-6),
    check('M6g', 'transmission angle within 40-140 deg (excess, deg)',
      Math.max(40 - mu.min * deg, mu.max * deg - 140), '<=', 0,
      `range ${(mu.min * deg).toFixed(1)} to ${(mu.max * deg).toFixed(1)} deg`),
  ];
}
