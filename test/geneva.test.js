import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { geneva, circle } from '../src/index.js';
import { checkGeneva } from '../src/checks/geneva.js';
import { allPass, fails, mutate } from './helpers.js';

describe('Geneva drive (M3)', () => {
  it('shipped 4-slot design passes every check', () => allPass(checkGeneva(geneva())));

  for (const n of [3, 4, 5, 6, 8]) {
    it(`${n}-slot drive passes every check`, () => {
      // A 3-slot star needs a tighter lock clearance to hold within 2 degrees.
      allPass(checkGeneva(geneva({ n, pinR: 3, lockPlay: 0.1, reliefPlay: 0.2 })));
    });
  }

  it('centre distance and engagement window follow from the slot count', () => {
    for (const n of [3, 4, 6]) {
      const g = geneva({ n, pinR: 3 }).geometry;
      assert.ok(Math.abs(g.c * Math.sin(Math.PI / n) - 40) < 1e-12);
      assert.ok(Math.abs(g.alphaM - (Math.PI / 2 - Math.PI / n)) < 1e-15);
    }
  });

  it('mutation: star placed 3 % too far away; pin leaves the slot line (M3a, M3c)', () => {
    const m = geneva();
    const bad = mutate(m, { geometry: { starCentre: [m.geometry.c * 1.03, 0] } });
    const res = checkGeneva(bad);
    fails(res, 'M3a');
    fails(res, 'M3c');
  });

  it('mutation: star angle computed with the wrong centre distance jumps at the handoff (M3b, M3f)', () => {
    const m = geneva(), wrong = 1.05 * m.geometry.c, { a } = m.params, n = 4;
    const bad = mutate(m, {
      pose(t) {
        const p = m.pose(t);
        if (!p.engaged) return p;
        const turns = Math.floor((t + Math.PI) / (2 * Math.PI));
        const al = t - turns * 2 * Math.PI;
        return { ...p, star: -turns * (2 * Math.PI) / n - Math.atan2(a * Math.sin(al), wrong - a * Math.cos(al)) };
      },
    });
    const res = checkGeneva(bad);
    fails(res, 'M3c');
    fails(res, 'M3f');
  });

  it('mutation: locking disc without a relief cut hits the star while indexing (M3i)', () => {
    fails(checkGeneva(geneva({ relief: false })), 'M3i');
  });

  it('mutation: a locking disc smaller than its locking arc does not lock (M3j)', () => {
    const m = geneva();
    const bad = mutate(m, { geometry: { lockOutline: circle([0, 0], m.geometry.rl * 0.85, 96) } });
    fails(checkGeneva(bad), 'M3j');
  });

  it('mutation: the classic circular relief, at the same clearances, leaves the star free just after the pin leaves (M3j)', () => {
    fails(checkGeneva(geneva({ relief: 'circle' })), 'M3j');
  });

  it('mutation: a star that keeps creeping through the dwell is caught (M3e)', () => {
    const m = geneva();
    const bad = mutate(m, { pose(t) { const p = m.pose(t); return p.engaged ? p : { ...p, star: p.star + 1e-4 * Math.sin(t) }; } });
    fails(checkGeneva(bad), 'M3e');
  });
});
