// In-line crank and slider (the piston mechanism).
//
// Same job as the Scotch yoke with a finite connecting rod, and the rod is the
// whole difference: the slider position is r cos(theta) + sqrt(L^2 - r^2
// sin^2(theta)), which is not a sinusoid. Its second harmonic is the reason an
// engine's piston dwells longer at bottom dead centre than at top.
//
// Frame: crank centre at the origin, slider axis along +x.

import { polar } from './geom.js';

export function crankSlider({ r = 24, L = 66, pinR = 3.5, pistonW = 20, pistonH = 26 } = {}) {
  if (L <= r) throw new Error('crank-slider: rod must be longer than the crank');
  return {
    kind: 'crankSlider',
    params: { r, L },
    geometry: { pinR, pistonW, pistonH, boreFrom: L - r - pistonW / 2 - 4, boreTo: L + r + pistonW / 2 + 6 },
    pose(theta) {
      const crankPin = polar(r, theta);
      // Exact rod-length constraint, not the small-angle approximation.
      const x = crankPin[0] + Math.sqrt(L * L - crankPin[1] * crankPin[1]);
      return { theta, crankPin, slider: [x, 0] };
    },
  };
}
