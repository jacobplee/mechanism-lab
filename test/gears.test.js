import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spurGear, gearPair, gearTrain, openBelt, defaultModels, polar, involuteFn } from '../src/index.js';
import { checkGearPair, checkGearShape, checkMesh, checkIdlerTrain, checkBelt } from '../src/checks/gears.js';
import { allPass, fails } from './helpers.js';

/** Teeth with straight 20-degree flanks (the basic-rack shape), not involutes. */
function straightFlankGear(N, m, backlash) {
  const r = (m * N) / 2, ra = r + m, rf = r - 1.25 * m, P = (2 * Math.PI) / N, T = Math.tan(Math.PI / 9);
  const hp = (Math.PI * m) / 4 - backlash / 4;
  const ha = (hp - m * T) / ra, hr = (hp + 1.25 * m * T) / rf;
  const outline = [];
  for (let k = 0; k < N; k++) {
    const c = k * P;
    for (let i = 0; i <= 12; i++) { const t = i / 12; outline.push(polar(rf + (ra - rf) * t, c - (hr + (ha - hr) * t))); }
    for (let i = 1; i < 4; i++) outline.push(polar(ra, c - ha + (2 * ha * i) / 4));
    for (let i = 12; i >= 0; i--) { const t = i / 12; outline.push(polar(rf + (ra - rf) * t, c + (hr + (ha - hr) * t))); }
    for (let i = 1; i < 5; i++) outline.push(polar(rf, c + hr + ((P - 2 * hr) * i) / 5));
  }
  return { kind: 'spurGear', N, m, r, rb: r * Math.cos(Math.PI / 9), ra, rf, pressureDeg: 20, backlash, outline };
}

describe('Involute gear pair (M7)', () => {
  it('shipped 18/30 pair passes every check', () => allPass(checkGearPair(defaultModels().gearPair)));

  for (const [N1, N2, m, ang] of [[17, 17, 2, 0], [14, 26, 4, 0.7], [20, 60, 1, 1.1], [25, 40, 2.5, -2], [18, 30, 4, Math.PI]]) {
    it(`${N1}/${N2} at module ${m} passes every check`, () => {
      const B = 0.04 * m;
      allPass(checkGearPair(gearPair(spurGear({ N: N1, m, backlash: B }), spurGear({ N: N2, m, backlash: B }), ang)));
    });
  }

  it('a zero-backlash pair still meshes without interference', () => {
    allPass(checkGearPair(gearPair(spurGear({ N: 18, m: 4 }), spurGear({ N: 30, m: 4 }))));
  });

  it('tooth thickness at the pitch circle is half the circular pitch', () => {
    // From the outline: the angular width of tooth 0 where it crosses r.
    const g = spurGear({ N: 24, m: 3 });
    // The outline starts at the root of tooth 0's leading flank, so the first
    // crossing of the pitch circle is that flank.
    let half = NaN;
    for (let i = 0; i + 1 < g.outline.length; i++) {
      const [a, b] = [g.outline[i], g.outline[i + 1]], ra = Math.hypot(...a), rb = Math.hypot(...b);
      if ((ra - g.r) * (rb - g.r) <= 0) {
        const t = (g.r - ra) / (rb - ra);
        half = -Math.atan2(a[1] + t * (b[1] - a[1]), a[0] + t * (b[0] - a[0]));
        break;
      }
    }
    assert.ok(Math.abs(2 * half * g.r - (Math.PI * g.m) / 2) < 1e-3 * g.m, `tooth thickness ${2 * half * g.r}`);
  });

  it('involute function matches tabulated values', () => {
    assert.ok(Math.abs(involuteFn((20 * Math.PI) / 180) - 0.014904) < 1e-6);
    assert.ok(Math.abs(involuteFn((25 * Math.PI) / 180) - 0.029975) < 1e-6);
  });

  it('mutation: straight-flank teeth are not involutes and are not conjugate (M7b, M7f, M7h)', () => {
    const res = checkGearPair(gearPair(straightFlankGear(18, 4, 0.16), straightFlankGear(30, 4, 0.16)));
    fails(res, 'M7b');
    fails(res, 'M7f');
    fails(res, 'M7h');
  });

  it('mutation: a 25-degree gear labelled 20 degrees (M7b, M7c)', () => {
    const res = checkGearShape({ ...spurGear({ N: 24, m: 3, pressureDeg: 25 }), pressureDeg: 20 });
    fails(res, 'M7b');
    fails(res, 'M7c');
  });

  it('mutation: driven gear half a tooth out of phase lands tooth on tooth (M7f)', () => {
    const t = defaultModels().gearPair;
    const bad = { ...t, pose(p) { const q = t.pose(p); return { ...q, phis: [q.phis[0], q.phis[1] + Math.PI / t.gears[1].N] }; } };
    fails(checkMesh(bad, 0), 'M7f');
  });

  it('mutation: driven gear turned at the tooth-count ratio inverted (M7e, M7f)', () => {
    const t = defaultModels().gearPair, [g1, g2] = t.gears;
    const bad = { ...t, pose(p) { const q = t.pose(p); return { ...q, phis: [p, -(g2.N / g1.N) * p + (q.phis[1] + (g1.N / g2.N) * p)] }; } };
    const res = checkMesh(bad, 0);
    fails(res, 'M7e');
    fails(res, 'M7f');
  });

  it('mutation: centre distance opened up by 2 % (M7a, M7g)', () => {
    const t = defaultModels().gearPair;
    const c1 = t.centres[1];
    const res = checkMesh({ ...t, centres: [t.centres[0], [c1[0] * 1.02, c1[1]]] }, 0);
    fails(res, 'M7a');
    fails(res, 'M7g');
  });

  it('mutation: a 12-tooth pinion against 34 teeth runs off its involute (M7h)', () => {
    // Below 17 teeth at 20 degrees a generated pinion is undercut. Without the
    // undercut, the mating tip works below the base circle, where the flank is
    // no longer an involute, and the contact stops being conjugate.
    fails(checkGearPair(gearPair(spurGear({ N: 12, m: 4, backlash: 0.16 }), spurGear({ N: 34, m: 4, backlash: 0.16 }))), 'M7h');
  });
});

describe('Idler train (M8)', () => {
  it('shipped train passes every check', () => allPass(checkIdlerTrain(defaultModels().idlerTrain.train)));

  it('a four-gear train (two idlers) keeps the ratio of its end gears', () => {
    const m = 2, B = 0.08;
    const t = gearTrain([18, 25, 21, 36].map((N) => spurGear({ N, m, backlash: B })), [0.3, -0.5, 0.2]);
    allPass(checkIdlerTrain(t, { idlers: [19, 30] }));
  });

  it('mutation: a train that reports the last mesh ratio as the whole ratio (M8b)', () => {
    const t = defaultModels().idlerTrain.train;
    const [a, b, c] = t.gears;
    const bad = { ...t, pose(p) { const q = t.pose(p); return { ...q, phis: [p, q.phis[1], (b.N / c.N) * p] }; } };
    fails(checkIdlerTrain(bad), 'M8b');
  });
});

describe('Open belt (M9)', () => {
  it('shipped belt passes every check', () => allPass(checkBelt(defaultModels().idlerTrain.belt)));

  it('passes for 200 random pulley pairs', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) {
      const r1 = 2 + rnd() * 60, r2 = 2 + rnd() * 60;
      const d = Math.abs(r1 - r2) + 1 + rnd() * 200, a = rnd() * 2 * Math.PI;
      const c1 = [rnd() * 100 - 50, rnd() * 100 - 50];
      allPass(checkBelt(openBelt(c1, r1, [c1[0] + d * Math.cos(a), c1[1] + d * Math.sin(a)], r2)));
    }
  });

  it('equal pulleys give parallel runs one diameter apart', () => {
    const b = openBelt([0, 0], 20, [100, 0], 20);
    for (const [P, Q] of b.runs) assert.ok(Math.abs(P[1] - Q[1]) < 1e-12 && Math.abs(Math.abs(P[1]) - 20) < 1e-12);
  });

  it('mutation: runs drawn by offsetting the centre line by each radius are not tangent (M9b)', () => {
    const b = openBelt([0, 0], 30, [120, 20], 12);
    const [c1, c2] = [b.pulleys[0].c, b.pulleys[1].c];
    const th = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
    const off = (c, r, s) => [c[0] + r * Math.cos(th + s * Math.PI / 2), c[1] + r * Math.sin(th + s * Math.PI / 2)];
    const naive = { ...b, runs: [[off(c1, 30, 1), off(c2, 12, 1)], [off(c1, 30, -1), off(c2, 12, -1)]] };
    fails(checkBelt(naive), 'M9b');
  });

  it('mutation: a driven pulley turning the wrong way is a crossed belt (M9e)', () => {
    const b = openBelt([0, 0], 30, [120, 20], 12);
    fails(checkBelt({ ...b, pose: (p) => ({ phi1: p, phi2: (-p * 30) / 12 }) }), 'M9e');
  });
});
