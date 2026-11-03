// Involute spur gears, gear pairs and idler trains.
//
// A tooth flank is the involute of the base circle (radius r cos φ for
// pressure angle φ). Two involute gears in mesh have a common normal that
// always passes through the pitch point, so the speed ratio stays exactly
// N1/N2 through the whole tooth engagement. That property (conjugate action)
// is what the checks test, by closing one flank and watching the gap.
//
// Standard full-depth proportions: addendum 1 m, dedendum 1.25 m. Below the
// base circle the flank is continued radially down to the root.
//
// Each gear's outline is drawn with tooth 0 centred on the local +x axis.

import { TAU, polar, place } from './geom.js';

export const involuteFn = (alpha) => Math.tan(alpha) - alpha;

export function spurGear({
  N, m,
  pressureDeg = 20,
  backlash = 0,          // circular backlash of a pair at the pitch circle; each gear takes half
  flankPoints = 24,
  tipPoints = 4,
  rootPoints = 5,
  addendum = 1, dedendum = 1.25,
} = {}) {
  if (!(N >= 6) || !(m > 0)) throw new Error('spurGear: needs N >= 6 and m > 0');
  const phi = (pressureDeg * Math.PI) / 180;
  const r = (m * N) / 2;
  const rb = r * Math.cos(phi);
  const ra = r + addendum * m;
  const rf = r - dedendum * m;
  const P = TAU / N;
  const halfPitch = Math.PI / (2 * N) - backlash / (4 * r);
  const half = (rho) => halfPitch + involuteFn(phi) - involuteFn(Math.acos(Math.min(1, rb / rho)));
  const rStart = Math.max(rb, rf);
  if (half(ra) <= 0) throw new Error('spurGear: teeth come to a point before the tip circle');

  // involute samples, evenly spaced in roll angle
  const t0 = Math.sqrt(Math.max(0, (rStart / rb) ** 2 - 1));
  const t1 = Math.sqrt((ra / rb) ** 2 - 1);
  const flank = [];
  for (let i = 0; i <= flankPoints; i++) {
    const t = t0 + ((t1 - t0) * i) / flankPoints;
    const rho = rb * Math.sqrt(1 + t * t);
    flank.push([rho, half(rho)]);
  }
  const hRoot = half(rStart);

  const pts = [];
  for (let k = 0; k < N; k++) {
    const c = k * P;
    if (rf < rb) pts.push(polar(rf, c - hRoot));
    for (const [rho, h] of flank) pts.push(polar(rho, c - h));
    for (let i = 1; i < tipPoints; i++) {
      const h = half(ra);
      pts.push(polar(ra, c - h + (2 * h * i) / tipPoints));
    }
    for (let i = flank.length - 1; i >= 0; i--) pts.push(polar(flank[i][0], c + flank[i][1]));
    if (rf < rb) pts.push(polar(rf, c + hRoot));
    for (let i = 1; i < rootPoints; i++) {
      pts.push(polar(rf, c + hRoot + ((P - 2 * hRoot) * i) / rootPoints));
    }
  }
  return { kind: 'spurGear', N, m, r, rb, ra, rf, pressureDeg, backlash, outline: pts };
}

/**
 * A row of gears, each meshing with the one before it.
 *
 * `angles[i]` is the direction from gear i to gear i+1. Centre distances are
 * the sum of the pitch radii. Each gear is phased so that when its driver
 * points a tooth along the line of centres it points a gap back.
 */
export function gearTrain(gears, angles = [], at = [0, 0]) {
  const centres = [at];
  const ratio = [1];   // dphi_i / dphi_0
  const offset = [0];  // phi_i = ratio_i * phi_0 + offset_i
  for (let i = 1; i < gears.length; i++) {
    const g0 = gears[i - 1], g1 = gears[i];
    const a = angles[i - 1] ?? 0;
    const d = g0.r + g1.r;
    centres.push([centres[i - 1][0] + d * Math.cos(a), centres[i - 1][1] + d * Math.sin(a)]);
    // phi1 = k*phi0 + C, and a tooth of g0 at angle a faces a gap of g1 at a + π.
    const k = -g0.N / g1.N;
    const C = a + Math.PI - Math.PI / g1.N - k * a;
    ratio.push(ratio[i - 1] * k);
    offset.push(k * offset[i - 1] + C);
  }
  return {
    kind: 'gearTrain',
    gears, centres, angles,
    pose(phi0) {
      return { phi0, phis: gears.map((_, i) => ratio[i] * phi0 + offset[i]) };
    },
    /** World outline of gear i at input angle phi0. */
    outlineAt(i, phi0, extraTurn = 0) {
      return place(gears[i].outline, ratio[i] * phi0 + offset[i] + extraTurn, centres[i]);
    },
  };
}

export const gearPair = (g1, g2, angle = 0, at = [0, 0]) => gearTrain([g1, g2], [angle], at);
