// Scotch yoke.
//
// A crank pin rides in a straight slot cut across a sliding yoke. The slot
// only lets the pin move along it, so the yoke takes the pin's component
// across the slot and nothing else: its travel is exactly r sin(theta). There
// is no connecting rod and so no second-order term.
//
// Frame: crank centre at the origin. The slot runs along x; the yoke slides
// along y between fixed guides.

import { polar } from './geom.js';

export function scotchYoke({
  r = 30,            // crank radius (pin centre)
  pinR = 5,          // crank pin radius
  endPlay = 2,       // slot length beyond the pin's extreme travel, each end
  sidePlay = 0.4,    // slot width beyond the pin, each side
  yokeH = 24,        // yoke height across the slot
} = {}) {
  // The slot must be at least the pin's full travel along it (2r) plus the
  // pin itself. Sizing it by eye is how a drawn yoke ends up with the pin
  // outside the slot.
  const slotLen = 2 * (r + pinR + endPlay);
  const slotW = 2 * (pinR + sidePlay);
  const yokeW = slotLen + 16;
  return {
    kind: 'scotchYoke',
    params: { r, pinR },
    geometry: { slotLen, slotW, yokeW, yokeH, rodLen: r + yokeH + 34 },
    /** theta: crank angle. Returns world positions of the moving parts. */
    pose(theta) {
      const pin = polar(r, theta);
      // The slot is the constraint: the yoke follows the pin across it.
      return { theta, pin, yoke: [0, pin[1]] };
    },
  };
}
