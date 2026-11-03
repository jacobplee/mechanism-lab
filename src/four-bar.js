// Four-bar linkage.
//
// Ground pivots A and D, crank AB, coupler BC, rocker CD. For each crank angle
// the joint C is found by intersecting the circle of radius |BC| about B with
// the circle of radius |CD| about D. Of the two intersections, the branch is
// chosen once and kept, so the linkage cannot snap through to its mirror
// image mid-stroke.
//
// Frame: A at the origin, D on the +x axis. With branch = -1 the coupler rides
// above the ground line on screen.

import { polar } from './geom.js';

export function fourBar({
  ground = 70, crank = 20, coupler = 65, rocker = 34,
  branch = -1,
  couplerPoint = [0.5, -22],   // point on the coupler: [fraction along BC, offset to its left]
} = {}) {
  const A = [0, 0], D = [ground, 0];
  function solve(theta) {
    const B = polar(crank, theta);
    const dx = D[0] - B[0], dy = D[1] - B[1];
    const d = Math.hypot(dx, dy);
    if (d > coupler + rocker || d < Math.abs(coupler - rocker) || d === 0) return null;
    const along = (coupler * coupler - rocker * rocker + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, coupler * coupler - along * along));
    const mx = B[0] + (along * dx) / d, my = B[1] + (along * dy) / d;
    const C = [mx - branch * (h * dy) / d, my + branch * (h * dx) / d];
    const ux = (C[0] - B[0]) / coupler, uy = (C[1] - B[1]) / coupler;
    const [f, off] = couplerPoint;
    const P = [B[0] + ux * coupler * f + uy * off, B[1] + uy * coupler * f - ux * off];
    return { B, C, P };
  }
  return {
    kind: 'fourBar',
    params: { ground, crank, coupler, rocker },
    geometry: { A, D, branch, couplerPoint },
    pose(theta) {
      const s = solve(theta);
      return s ? { theta, ...s } : { theta, B: polar(crank, theta), C: null, P: null };
    },
  };
}
