import { describe, it } from 'node:test';
import { ratchet, polar, sub, angleOf } from '../src/index.js';
import { checkRatchet } from '../src/checks/ratchet.js';
import { allPass, fails, mutate } from './helpers.js';

describe('Ratchet and pawl (M5)', () => {
  it('shipped 12-tooth design passes every check', () => allPass(checkRatchet(ratchet())));

  for (const opts of [{ n: 8 }, { n: 10 }, { n: 16 }, { n: 20, Rr: 34 }, { n: 12, R: 60, Rr: 48, pawlLen: 50 }]) {
    it(`passes with ${JSON.stringify(opts)}`, () => allPass(checkRatchet(ratchet(opts))));
  }

  it('mutation: pivot inside the tangent line, so a reverse load pushes the pawl out (M5e)', () => {
    fails(checkRatchet(ratchet({ tiltDeg: -8 })), 'M5e');
  });

  it('mutation: a pawl rocked by a sawtooth instead of solved onto the teeth (M5a)', () => {
    const m = ratchet();
    const { pivot } = m.geometry, { n, pawlLen } = m.params;
    const base = angleOf(sub(m.engagedAt(0).tip, pivot));
    const bad = mutate(m, {
      pose(phi) {
        const frac = (((phi * n) / (2 * Math.PI)) % 1 + 1) % 1;
        const pawl = base - 0.25 * frac;
        const tip = [pivot[0] + pawlLen * Math.cos(pawl), pivot[1] + pawlLen * Math.sin(pawl)];
        return { phi, tip, pawl };
      },
    });
    fails(checkRatchet(bad), 'M5a');
  });

  it('mutation: a flat-bottomed pawl body drags on the tooth slopes (M5b)', () => {
    const m = ratchet();
    const L = m.params.pawlLen;
    fails(checkRatchet(mutate(m, { geometry: { body: [[-6, 6], [-6, -6], [L - 6, -10], [L, 0], [L - 16, 1.5], [6, 6]] } })), 'M5b');
  });

  it('mutation: teeth with their faces reversed no longer stop reverse rotation (M5d)', () => {
    const m = ratchet();
    const { n, R, Rr } = m.params;
    const p = (2 * Math.PI) / n, f0 = -Math.PI / 2;
    // Mirror image teeth: the slope now rises the other way round.
    const outline = [];
    for (let k = 0; k < n; k++) outline.push(polar(Rr, f0 + k * p), polar(R, f0 + (k + 1) * p));
    fails(checkRatchet(mutate(m, { geometry: { outline } })), 'M5d');
  });
});
