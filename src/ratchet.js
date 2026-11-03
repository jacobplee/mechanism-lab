// Ratchet and pawl.
//
// The wheel has sawtooth teeth: a gentle back slope and a steep radial face.
// Turning forward, the pawl tip rides up each slope and drops off the tooth
// tip into the next gap (one click per tooth). Turning backward, the face of
// the tooth runs straight into the tip and stops.
//
// The pawl is a rigid lever on a fixed pivot. Its tip is solved onto the
// wheel outline at every angle by intersecting the tip's circle about the
// pivot with the tooth slope it is riding on. Nothing is animated by eye.
//
// Which slope the tip is on is decided by the last drop: the tip stays on a
// tooth until that tooth's tip corner crosses the tip's circle, then falls to
// the slope behind it. That is a forward-running model, which is the only way
// a ratchet runs.
//
// Frame: wheel centre at the origin. With the wheel at angle 0 a tooth face
// stands at the top (angle -π/2); under reverse load the pawl tip bears on it
// just above the root.

import { TAU, polar, sub, angleOf } from './geom.js';

export function ratchet({
  n = 12,            // teeth
  R = 40,            // tip radius
  Rr = 31,           // root radius
  pawlLen = 34,      // pivot to tip
  tiltDeg = 24,      // pivot sits this far outside the tangent at the tip
  seat = 0.3,        // where the tip bears on a face, as a fraction of tooth depth
} = {}) {
  const p = TAU / n;
  const f0 = -Math.PI / 2;                       // face 0, local angle
  const face = (k) => f0 + k * p;

  // Wheel outline: each tooth is its tip corner, then the slope down to the
  // root at the next face. The next face is the radial edge back up.
  const outline = [];
  for (let k = 0; k < n; k++) outline.push(polar(R, face(k)), polar(Rr, face(k + 1)));

  // Pawl pivot, placed from the engaged position: tip bearing on face 0 a
  // little above the root, pawl leaning back along the tangent and tilted
  // outward by tiltDeg.
  const eps = (tiltDeg * Math.PI) / 180;
  const Rseat = Rr + seat * (R - Rr);
  const T0 = polar(Rseat, f0);
  const pivot = [T0[0] - pawlLen * Math.cos(eps), T0[1] - pawlLen * Math.sin(eps)];
  if (Math.hypot(...pivot) <= R + 4) throw new Error('ratchet: pawl pivot is inside the wheel');

  // World angle at which a tooth tip corner (radius R) lies on the tip's
  // circle: the moment of the drop. Of the two solutions, the one by the tip.
  const Pd = Math.hypot(...pivot), Pa = angleOf(pivot);
  const q = (R * R + Pd * Pd - pawlLen * pawlLen) / (2 * R * Pd);
  const cands = [Pa + Math.acos(q), Pa - Math.acos(q)];
  const near = (x) => Math.abs(Math.atan2(Math.sin(x - f0), Math.cos(x - f0)));
  const wDrop = near(cands[0]) < near(cands[1]) ? cands[0] : cands[1];

  // Pawl body in its own frame: x from the pivot toward the tip, +y toward the
  // wheel. A chisel tip: the underside climbs away from the tip faster than
  // any tooth slope it rides, so only the tip ever touches the wheel.
  const L = pawlLen;
  const body = [[-6, 6], [-6, -6], [L - 6, -10], [L, 0], [L - 8, -6.5], [8, -6.5], [6, 6]];

  function tipOnSlope(phi, j) {
    // slope of tooth j: from its tip corner to the root at the next face
    const A = polar(R, face(j) + phi), B = polar(Rr, face(j + 1) + phi);
    const d = sub(B, A), f = sub(A, pivot);
    const qa = d[0] * d[0] + d[1] * d[1];
    const qb = 2 * (f[0] * d[0] + f[1] * d[1]);
    const qc = f[0] * f[0] + f[1] * f[1] - pawlLen * pawlLen;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const ts = [(-qb - s) / (2 * qa), (-qb + s) / (2 * qa)].filter((t) => t >= -1e-12 && t <= 1 + 1e-12);
    if (!ts.length) return null;
    // Two hits on one slope cannot both be reachable; the tip is at the one
    // nearer the tooth's corner, which is where it has been riding toward.
    const t = Math.min(...ts);
    return [A[0] + t * d[0], A[1] + t * d[1]];
  }

  return {
    kind: 'ratchet',
    params: { n, R, Rr, pawlLen },
    geometry: { outline, pivot, body, wDrop, faceAngles: Array.from({ length: n }, (_, k) => face(k)) },
    /** phi: wheel angle, increasing is the free direction. */
    pose(phi) {
      // The tip rides the tooth whose corner is the next to reach the drop.
      const j = Math.ceil((wDrop - phi - f0) / p) - 1;
      const tip = tipOnSlope(phi, j);
      if (!tip) return { phi, tip: null, pawl: NaN, tooth: j };
      return { phi, tip, pawl: angleOf(sub(tip, pivot)), tooth: ((j % n) + n) % n };
    },
    /** Under reverse load: tip bearing on face k, which is brought to the top. */
    engagedAt(k) {
      const phi = -k * p;
      const tip = polar(Rseat, face(k) + phi);
      return { phi, tip, pawl: angleOf(sub(tip, pivot)) };
    },
  };
}
