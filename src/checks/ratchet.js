// Checks for the ratchet and pawl.
//
// The tip is measured against the wheel outline placed at the wheel angle,
// the pawl body against the same outline, and the blocking claim by actually
// turning the wheel backward and asking whether the tooth face runs into the
// tip.

import { check, angles } from './check.js';
import { sub, cross, norm, place, inside, distToOutline, clearance, dot, pointSegDist } from '../geom.js';

export function checkRatchet(model, N = 2880) {
  const { n } = model.params;
  const { outline, pivot, body } = model.geometry;
  const poses = angles(N).map((t) => model.pose(t));

  let offOutline = 0, bodyClear = Infinity;
  for (const p of poses) {
    if (!p.tip) { offOutline = NaN; break; }
    const W = place(outline, p.phi);
    offOutline = Math.max(offOutline, distToOutline(p.tip, W));
    bodyClear = Math.min(bodyClear, clearance(place(body, p.pawl, pivot), W));
  }

  // Clicks: the pawl drops (its angle jumps toward the wheel) once per tooth.
  const psi = poses.map((p) => p.pawl);
  const range = Math.max(...psi) - Math.min(...psi);
  let clicks = 0;
  for (let i = 0; i < N; i++) {
    const d = psi[(i + 1) % N] - psi[i];
    if (Math.abs(d) > 0.3 * range) clicks++;
  }

  // Blocking and self-engagement at every tooth, from the engaged position
  // (tip in the root corner, against the face).
  //
  // Nudge the wheel and hold the pawl. If the tip ends up inside the wheel,
  // find the edge it hit and the force that edge puts on the tip. A radial
  // edge is a tooth face; anything else is a slope. Backward, the face must
  // hit the tip and its force must pull the pawl further in. Forward, either
  // nothing hits it or a slope does, and the slope's force lifts the pawl so
  // it can ride over.
  const nudge = (0.5 * Math.PI) / 180;
  const contact = (tip, W) => {
    let best = Infinity, edge = null;
    for (let i = 0; i < W.length; i++) {
      const A = W[i], B = W[(i + 1) % W.length];
      const d = pointSegDist(tip, A, B);
      if (d < best) { best = d; edge = [A, B]; }
    }
    const [A, B] = edge;
    const dir = sub(B, A), mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const radial = Math.abs(cross(dir, mid)) / (norm(dir) * norm(mid)) < 1e-6;
    let nrm = [-dir[1] / norm(dir), dir[0] / norm(dir)];
    if (inside([mid[0] + nrm[0] * 0.01, mid[1] + nrm[1] * 0.01], W)) nrm = [-nrm[0], -nrm[1]];
    // Positive: the force turns the pawl so its tip moves toward the wheel centre.
    const arm = sub(tip, pivot);
    const inward = Math.sign(dot([-arm[1], arm[0]], [-tip[0], -tip[1]]));
    return { radial, pull: (inward * cross(arm, nrm)) / norm(arm) };
  };
  let unblocked = 0, minPull = Infinity;
  for (let k = 0; k < n; k++) {
    const e = model.engagedAt(k);
    const Wb = place(outline, e.phi - nudge);
    if (!inside(e.tip, Wb)) { unblocked++; continue; }
    const hit = contact(e.tip, Wb);
    if (!hit.radial) unblocked++;
    minPull = Math.min(minPull, hit.pull);
    const Wf = place(outline, e.phi + nudge);
    if (inside(e.tip, Wf)) {
      const ride = contact(e.tip, Wf);
      if (ride.radial || ride.pull >= 0) unblocked++;
    }
  }

  return [
    check('M5a', 'pawl tip lies on the wheel outline', offOutline, '<=', 1e-9),
    check('M5b', 'pawl never penetrates the wheel (clearance)', bodyClear, '>=', -1e-9),
    check('M5c', 'clicks per revolution', clicks, '==', n),
    check('M5d', 'reverse blocked, forward free at every tooth (failures)', unblocked, '==', 0),
    check('M5e', 'reverse load pulls the pawl in (normalised moment)', minPull, '>=', 1e-6),
  ];
}
