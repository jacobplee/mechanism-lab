// Open belt between two pulleys.
//
// The straight runs are the two external common tangents. The tangent points
// sit at theta ± phi on both pulleys, where theta is the direction from
// pulley 1 to pulley 2 and phi = acos((r1 - r2) / d). That construction is
// exact for unequal pulleys; offsetting the centre line by a radius is not.
//
// An open belt turns both pulleys the same way, and with no slip the surface
// speeds match: omega2 = omega1 * r1 / r2.

import { TAU, polar, add, arc } from './geom.js';

export function openBelt(c1, r1, c2, r2) {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(r1 - r2)) throw new Error('openBelt: one pulley contains the other');
  const th = Math.atan2(dy, dx);
  const phi = Math.acos((r1 - r2) / d);
  const runs = [
    [add(c1, polar(r1, th + phi)), add(c2, polar(r2, th + phi))],
    [add(c1, polar(r1, th - phi)), add(c2, polar(r2, th - phi))],
  ];
  return {
    kind: 'openBelt',
    pulleys: [{ c: c1, r: r1 }, { c: c2, r: r2 }],
    runs,
    /** Closed path: wrap pulley 1 on its far side, cross, wrap pulley 2. */
    path(steps = 48) {
      const n1 = Math.max(4, Math.round((steps * (TAU - 2 * phi)) / TAU));
      const n2 = Math.max(4, Math.round((steps * 2 * phi) / TAU));
      return [...arc(c1, r1, th + phi, th - phi + TAU, n1), ...arc(c2, r2, th - phi, th + phi, n2)];
    },
    pose(phi1) {
      return { phi1, phi2: (phi1 * r1) / r2 };
    },
  };
}
