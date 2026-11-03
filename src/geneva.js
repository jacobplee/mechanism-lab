// External Geneva drive.
//
// A pin on the driver enters a radial slot in the star wheel, turns it by one
// station (2π/n), and leaves. For the rest of the driver's revolution a
// locking disc on the driver sits in a concave arc on the star and holds it
// still. The output is intermittent: drive, then a genuinely motionless dwell.
//
// The centre distance is not a free choice. For the pin to enter the slot
// without a shock it must arrive moving along the slot, which means the
// driver radius is perpendicular to the slot at entry. That right triangle
// fixes c = a / sin(π/n).
//
// Frame: driver centre O1 at the origin, star centre O2 at (c, 0). Slot k of
// the star sits at local angle π + 2πk/n.

import { TAU, polar, arc, circle, resampleClosed } from './geom.js';

export function geneva({
  n = 4,              // number of slots
  a = 40,             // driver crank radius (to the pin centre)
  pinR = 4,           // pin radius
  slotPlay = 0.3,     // slot half-width beyond the pin radius
  endPlay = 0.6,      // how far the slot bottom sits beyond the pin's deepest point
  lockPlay = 0.2,     // radial gap between locking disc and the star's locking arc
  reliefPlay = 0.3,   // gap kept between the relief cut and the star as it sweeps past
  lockR,              // locking disc radius (derived below when not given)
  outerR,             // star outside radius (derived below when not given)
  gammaFrac = 0.9,    // how far the locking arc reaches toward the slot mouths (0..1)
  relief = 'swept',   // 'swept' (generated from the star's motion), 'circle' (classic), or false
} = {}) {
  if (n < 3) throw new Error('geneva: needs at least 3 slots');
  const half = Math.PI / n;
  const c = a / Math.sin(half);              // forced centre distance
  const R0 = Math.sqrt(c * c - a * a);        // star radius where the pin enters
  const w = pinR + slotPlay;                  // slot half-width
  const Rs = outerR ?? Math.hypot(R0, w);     // star outside radius
  const sEnd = c - a - endPlay;               // centre of the slot's rounded end
  const sMouth = Math.sqrt(Rs * Rs - w * w);  // where a slot wall meets the rim
  const dMouth = Math.atan2(w, sMouth);       // angular half-width of a slot mouth

  // Locking arc. It is centred where the driver centre sits when the star is
  // locked, and its ends meet the rim three quarters of the way from the
  // bisector to the slot mouth, which leaves a lobe of rim either side.
  const gamma = gammaFrac * (half - dMouth);
  const rho = lockR != null ? lockR + lockPlay
    : Math.sqrt(c * c + Rs * Rs - 2 * c * Rs * Math.cos(gamma));
  const rl = rho - lockPlay;                  // locking disc radius
  const gammaUsed = Math.acos((c * c + Rs * Rs - rho * rho) / (2 * c * Rs));
  const Rr = Rs + reliefPlay;                 // relief cut radius
  const alphaM = Math.PI / 2 - half;          // half the engagement window

  if (sEnd <= w / Math.sin(half)) throw new Error('geneva: slots run into each other at the hub');
  if (!(gammaUsed < half - dMouth)) throw new Error('geneva: locking arc runs into the slot mouth');
  if (c - Rr <= 0) throw new Error('geneva: relief cut reaches the driver shaft');

  // ---- star outline, star frame
  const star = [];
  for (let k = 0; k < n; k++) {
    const t = Math.PI + k * 2 * half;          // slot k centreline
    const u = [Math.cos(t), Math.sin(t)], v = [-Math.sin(t), Math.cos(t)];
    const P = (s, off) => [s * u[0] + off * v[0], s * u[1] + off * v[1]];
    // in along the -w wall, round the end, out along the +w wall
    for (let i = 0; i <= 6; i++) star.push(P(sMouth + ((sEnd - sMouth) * i) / 6, -w));
    for (let i = 1; i < 12; i++) {
      const ph = -Math.PI / 2 - (Math.PI * i) / 12;
      star.push(P(sEnd + w * Math.cos(ph), w * Math.sin(ph)));
    }
    for (let i = 0; i <= 6; i++) star.push(P(sEnd + ((sMouth - sEnd) * i) / 6, w));
    // rim lobe, locking arc, rim lobe up to the next slot
    const b = t + half;                         // bisector toward the next slot
    star.push(...arc([0, 0], Rs, t + dMouth, b - gammaUsed, 5).slice(1));
    const Z = polar(c, b);                      // locking arc centre
    const e0 = Math.atan2(Math.sin(b - gammaUsed) * Rs - Z[1], Math.cos(b - gammaUsed) * Rs - Z[0]);
    const e1 = Math.atan2(Math.sin(b + gammaUsed) * Rs - Z[1], Math.cos(b + gammaUsed) * Rs - Z[0]);
    // The arc runs the short way round on the star's side of Z.
    let sweep = e1 - e0;
    while (sweep > Math.PI) sweep -= TAU;
    while (sweep < -Math.PI) sweep += TAU;
    star.push(...arc(Z, rho, e0, e0 + sweep, 24).slice(1, -1));
    star.push(...arc([0, 0], Rs, b + gammaUsed, t + 2 * half - dMouth, 5).slice(0, -1));
  }

  // ---- driver locking disc with its relief cut, driver frame (pin along +x)
  const starTurn = (alpha) => -Math.atan2(a * Math.sin(alpha), c - a * Math.cos(alpha));
  let lockDisc;
  if (relief === 'swept') {
    // The relief is generated, not drawn. Run the star through its indexing
    // motion, look at it from the driver (which is turning too), and take the
    // disc back to stay clear of every point the star reaches. That removes
    // only what the star actually sweeps, so the disc keeps as much of its
    // locking rim as possible either side of the cut.
    // Only star points at least c - rl from the star centre can ever reach
    // the disc, whatever the star's angle.
    const dense = resampleClosed(star, 0.4).filter(([x, y]) => Math.hypot(x, y) >= c - rl - reliefPlay);
    // Step the motion so that no point moves more than one angular bin of the
    // disc between samples (each bin also takes its neighbours' limits). The
    // star turns fastest mid-index, at a/(c - a) times the driver's speed.
    const B = 720;
    const reach = (c + rl) * (a / (c - a)) + rl;
    const steps = Math.ceil((2 * alphaM * reach) / ((rl * TAU) / B));
    const near = new Array(B).fill(Infinity);
    for (let i = 0; i <= steps; i++) {
      const al = -alphaM + (2 * alphaM * i) / steps;
      const be = starTurn(al);
      const cb = Math.cos(be), sb = Math.sin(be), ca = Math.cos(al), sa = Math.sin(al);
      for (const [x, y] of dense) {
        const wx = c + x * cb - y * sb, wy = x * sb + y * cb;     // world
        const dx = wx * ca + wy * sa, dy = -wx * sa + wy * ca;    // driver frame
        const rr = Math.hypot(dx, dy);
        if (rr > rl + reliefPlay) continue;
        const bin = Math.floor(((Math.atan2(dy, dx) + Math.PI) / TAU) * B) % B;
        if (rr < near[bin]) near[bin] = rr;
      }
    }
    const radius = near.map((_, b) =>
      Math.min(rl, Math.min(near[(b + B - 1) % B], near[b], near[(b + 1) % B]) - reliefPlay));
    const shaft = Math.min(...radius);
    if (shaft < pinR + 1) throw new Error('geneva: relief cuts too close to the driver shaft');
    lockDisc = [];
    for (let b = 0; b < B; b++) {
      const plain = radius[b] === rl && radius[(b + 1) % B] === rl && radius[(b + B - 1) % B] === rl;
      if (plain && b % 6) continue;                 // thin out the untouched rim
      lockDisc.push(polar(radius[b], ((b + 0.5) / B) * TAU - Math.PI));
    }
  } else if (relief === 'circle') {
    // The classic relief: a cut of the star's outside radius, centred where
    // the star centre sits when the pin is on the line of centres.
    const eta = Math.acos((rl * rl + c * c - Rr * Rr) / (2 * rl * c));
    const zeta = Math.atan2(rl * Math.sin(eta), c - rl * Math.cos(eta));
    lockDisc = [
      ...arc([0, 0], rl, eta, TAU - eta, 72),
      ...arc([c, 0], Rr, Math.PI + zeta, Math.PI - zeta, 28).slice(1, -1),
    ];
  } else {
    lockDisc = circle([0, 0], rl, 96);
  }
  const pinLocal = circle([a, 0], pinR, 28);

  return {
    kind: 'geneva',
    params: { n, a, pinR },
    geometry: {
      c, R0, Rs, w, sEnd, sMouth, rl, rho, Rr, alphaM,
      driverCentre: [0, 0], starCentre: [c, 0],
      slotAngles: Array.from({ length: n }, (_, k) => Math.PI + k * 2 * half),
      starOutline: star, lockOutline: lockDisc, pinOutline: pinLocal,
    },
    /** theta: driver angle (pin direction). star: star wheel rotation. */
    pose(theta) {
      const turns = Math.floor((theta + Math.PI) / TAU);
      const alpha = theta - turns * TAU;        // in [-π, π)
      const engaged = Math.abs(alpha) <= alphaM;
      // While engaged, the slot points at the pin; otherwise it is locked half
      // a station either side of the line of centres.
      const beta = engaged ? starTurn(alpha) : (alpha > 0 ? -half : half);
      return { theta, star: -turns * 2 * half + beta, pin: polar(a, theta), engaged };
    },
  };
}
