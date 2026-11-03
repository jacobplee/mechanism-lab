// Checks for the Geneva drive.
//
// The handoff angles are found from the model's own engagement flag by
// bisection, and everything else is measured on outlines placed where the
// pose says they are: the star where the star is, the pin where the pin is.

import { check, worst, angles } from './check.js';
import { TAU, sub, dot, cross, norm, dist, place, clearance } from '../geom.js';

/** Driver angle where the pose stops (or starts) being engaged. */
function handoff(model, from, to) {
  let lo = from, hi = to;
  const eLo = model.pose(lo).engaged;
  for (let i = 0; i < 200 && Math.abs(hi - lo) > 1e-15; i++) {
    const mid = (lo + hi) / 2;
    if (model.pose(mid).engaged === eLo) lo = mid; else hi = mid;
  }
  return { inside: eLo ? lo : hi, outside: eLo ? hi : lo };
}

export function checkGeneva(model, { N = 720, dwellSamples = 120, nudgeDeg = 2 } = {}) {
  const { n, a } = model.params;
  const g = model.geometry;
  const O1 = g.driverCentre, O2 = g.starCentre;
  const c = dist(O1, O2);

  const starAt = (s) => place(g.starOutline, s, O2);
  const lockAt = (t) => place(g.lockOutline, t, O1);
  const pinAt = (t) => place(g.pinOutline, t, O1);

  // Engagement window, measured: exit is between 0 and π, entry between -π and 0.
  const exit = handoff(model, 0, Math.PI);
  const entry = handoff(model, 0, -Math.PI);

  // b. tangential entry and exit: the driver radius is perpendicular to the
  // slot, so the pin arrives moving along it.
  const rightAngle = (t) => {
    const P = model.pose(t).pin;
    const u = sub(O1, P), v = sub(O2, P);
    return dot(u, v) / (norm(u) * norm(v));
  };

  // c. pin on the slot centreline while engaged, and between the slot's
  // mouth and its bottom (a pin outside the mouth is not driving anything).
  const engagedTh = angles(240, entry.inside, exit.inside - entry.inside).concat(exit.inside);
  let outOfSlot = 0;
  const offSlot = worst(engagedTh, (t) => {
    const p = model.pose(t);
    const rel = sub(p.pin, O2);
    let best = Infinity, along = 0;
    for (const s of g.slotAngles) {
      const u = [Math.cos(s + p.star), Math.sin(s + p.star)];
      if (dot(rel, u) <= 0) continue;
      const off = Math.abs(cross(u, rel));
      if (off < best) { best = off; along = dot(rel, u); }
    }
    outOfSlot = Math.max(outOfSlot, along - g.sMouth, g.sEnd - along);
    return best;
  });

  // d. one station per driver turn.
  const indexErr = worst([0.3, 1.7, 2.9, -2.2, 4.4], (t) =>
    Math.abs(model.pose(t + TAU).star - model.pose(t).star) - TAU / n);

  // e. dwell: from exit to the next entry, the star does not move at all.
  const dwellFrom = exit.outside, dwellTo = entry.outside + TAU;
  const dwellTh = angles(400, dwellFrom, dwellTo - dwellFrom).concat(dwellTo);
  const s0 = model.pose(dwellFrom).star;
  const dwellMove = worst(dwellTh, (t) => model.pose(t).star - s0);

  // f. continuous handoff, zero star velocity at it.
  const jump = Math.max(
    Math.abs(model.pose(exit.inside).star - model.pose(exit.outside).star),
    Math.abs(model.pose(entry.inside).star - model.pose(entry.outside).star));
  const h = 1e-6;
  const omega = Math.max(
    Math.abs((model.pose(exit.inside).star - model.pose(exit.inside - h).star) / h),
    Math.abs((model.pose(entry.inside + h).star - model.pose(entry.inside).star) / h));

  // g. drive fraction from where the star actually moves.
  const M = 7200;
  let moving = 0;
  for (let i = 0; i < M; i++) {
    const t0 = (i / M) * TAU, t1 = ((i + 1) / M) * TAU;
    if (Math.abs(model.pose(t1).star - model.pose(t0).star) > 1e-13) moving++;
  }
  const fraction = moving / M;

  // h, i. outline clearances over a revolution, dense through the drive.
  const sweepTh = angles(N, -Math.PI).concat(angles(240, entry.inside - 0.05, exit.inside - entry.inside + 0.1));
  let pinClear = Infinity, lockClear = Infinity;
  for (const t of sweepTh) {
    const p = model.pose(t);
    const S = starAt(p.star);
    // Gaps above 2 mm are reported as 2: only the smallest gap matters here.
    pinClear = Math.min(pinClear, clearance(pinAt(t), S, { cap: 2 }));
    lockClear = Math.min(lockClear, clearance(lockAt(t), S, { cap: 2 }));
  }

  // j. the lock holds: during the dwell, nudging the star either way runs it
  // into the driver (locking disc or pin).
  const nudge = (nudgeDeg * Math.PI) / 180;
  // The weak moments are just after the pin leaves and just before it
  // returns, when the relief is still facing the star, so sample those densely.
  const edge = (12 * Math.PI) / 180;
  const lockTh = angles(dwellSamples, dwellFrom, dwellTo - dwellFrom).concat(
    dwellTo, angles(60, dwellFrom, edge), angles(60, dwellTo - edge, edge));
  let free = 0;
  for (const t of lockTh) {
    const p = model.pose(t);
    const L = lockAt(t), P = pinAt(t);
    for (const sgn of [1, -1]) {
      const S = starAt(p.star + sgn * nudge);
      const hit = clearance(L, S, { cap: 1, signOnly: true }) < 0 || clearance(P, S, { cap: 1, signOnly: true }) < 0;
      if (!hit) free++;
    }
  }

  return [
    check('M3a', 'centre distance c = a / sin(pi/n)', Math.abs(c - a / Math.sin(Math.PI / n)), '<=', 1e-9),
    check('M3b', 'tangential entry and exit (cos of angle O1-pin-O2)',
      Math.max(Math.abs(rightAngle(exit.inside)), Math.abs(rightAngle(entry.inside))), '<=', 1e-9),
    check('M3c', 'pin centre on the slot centreline while driving', offSlot, '<=', 1e-9),
    check('M3c', 'pin centre within the slot length while driving (excess)', outOfSlot, '<=', 1e-9),
    check('M3d', 'one driver turn indexes 2*pi/n', indexErr, '<=', 1e-9),
    check('M3e', 'dwell is motionless', dwellMove, '<=', 1e-12),
    check('M3f', 'handoff continuous in angle', jump, '<=', 1e-6),
    check('M3f', 'star velocity zero at handoff', omega, '<=', 1e-5),
    check('M3g', 'drive fraction = 1/2 - 1/n', Math.abs(fraction - (0.5 - 1 / n)), '<=', 2 / M,
      `measured ${fraction.toFixed(4)}`),
    check('M3h', 'pin never cuts into the star (clearance)', pinClear, '>=', 0),
    check('M3i', 'locking disc clears the star (clearance)', lockClear, '>=', 0),
    check('M3j', `lock holds: star nudged ${nudgeDeg} deg either way hits the driver (free cases)`, free, '==', 0,
      `${2 * lockTh.length} nudges tested`),
  ];
}
