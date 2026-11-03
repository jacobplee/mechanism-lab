import { describe, it } from 'node:test';
import { scotchYoke, crankSlider, camFollower, fourBar, polar } from '../src/index.js';
import { checkScotchYoke, checkCrankSlider, checkCamFollower, checkFourBar } from '../src/checks/linkages.js';
import { allPass, fails, mutate } from './helpers.js';

describe('Scotch yoke (M1)', () => {
  it('shipped design passes every check', () => allPass(checkScotchYoke(scotchYoke())));
  it('passes across crank radii', () => {
    for (const r of [5, 18, 30, 75]) allPass(checkScotchYoke(scotchYoke({ r, pinR: r / 6 })));
  });
  it('mutation: a slot cut too short lets the pin run out of it (M1c)', () => {
    fails(checkScotchYoke(scotchYoke({ endPlay: -3 })), 'M1c');
  });
  it('mutation: a yoke driven like a crank-slider is not a pure sinusoid (M1b, M1e)', () => {
    const m = scotchYoke();
    const L = 60, bad = mutate(m, {
      pose(t) {
        const pin = polar(m.params.r, t);
        return { theta: t, pin, yoke: [0, pin[1] + L - Math.sqrt(L * L - pin[0] ** 2)] };
      },
    });
    const res = checkScotchYoke(bad);
    fails(res, 'M1b');
    fails(res, 'M1e');
  });
});

describe('Crank-slider (M2)', () => {
  it('shipped design passes every check', () => allPass(checkCrankSlider(crankSlider())));
  it('passes across rod ratios up to r/L = 0.4', () => {
    for (const [r, L] of [[10, 100], [20, 70], [24, 66], [30, 76]]) allPass(checkCrankSlider(crankSlider({ r, L })));
  });
  it('mutation: the small-angle slider formula stretches the rod (M2a)', () => {
    const m = crankSlider();
    const { r, L } = m.params;
    const bad = mutate(m, {
      pose(t) {
        const crankPin = polar(r, t);
        return { theta: t, crankPin, slider: [r * Math.cos(t) + L - ((r * r) / (2 * L)) * Math.sin(t) ** 2, 0] };
      },
    });
    fails(checkCrankSlider(bad), 'M2a');
  });
  it('mutation: a pure sinusoid in place of the slider misses the second harmonic (M2d)', () => {
    const m = crankSlider();
    const { r, L } = m.params;
    const bad = mutate(m, { pose: (t) => ({ theta: t, crankPin: polar(r, t), slider: [L + r * Math.cos(t), 0] }) });
    fails(checkCrankSlider(bad), 'M2d');
  });
});

describe('Eccentric cam and flat follower (M4)', () => {
  it('shipped design passes every check', () => allPass(checkCamFollower(camFollower())));
  it('passes across eccentricities', () => {
    for (const e of [2, 6, 11, 20]) allPass(checkCamFollower(camFollower({ e, faceW: 2 * e + 20 })));
  });
  it('mutation: follower a quarter turn out of phase leaves the cam (M4a)', () => {
    const m = camFollower();
    const { R, e } = m.params;
    const bad = mutate(m, {
      pose(t) {
        const camCentre = polar(e, t), faceY = e * Math.cos(t) - R;
        return { theta: t, camCentre, faceY, follower: [0, faceY], contact: [camCentre[0], faceY] };
      },
    });
    fails(checkCamFollower(bad), 'M4a');
  });
  it('mutation: a face narrower than 2e loses the contact point (M4e)', () => {
    fails(checkCamFollower(camFollower({ e: 11, faceW: 18 })), 'M4e');
  });
});

describe('Four-bar crank-rocker (M6)', () => {
  it('shipped design passes every check', () => allPass(checkFourBar(fourBar())));
  it('passes for other well-proportioned crank-rockers', () => {
    allPass(checkFourBar(fourBar({ ground: 100, crank: 30, coupler: 92, rocker: 50 })));
    allPass(checkFourBar(fourBar({ ground: 70, crank: 20, coupler: 65, rocker: 34, branch: 1 })));
  });
  it('mutation: a non-Grashof linkage cannot turn its crank fully (M6a, M6b)', () => {
    const res = checkFourBar(fourBar({ ground: 50, crank: 35, coupler: 30, rocker: 40 }));
    fails(res, 'M6a');
    fails(res, 'M6b');
  });
  it('mutation: a solver that drifts the coupler joint stretches a link (M6c)', () => {
    const m = fourBar();
    const bad = mutate(m, { pose(t) { const p = m.pose(t); return { ...p, C: [p.C[0] + 0.05 * Math.sin(t), p.C[1]] }; } });
    fails(checkFourBar(bad), 'M6c');
  });
  it('mutation: choosing the branch per frame lets the linkage snap through (M6d)', () => {
    const m = fourBar(), other = fourBar({ branch: 1 });
    const bad = mutate(m, { pose: (t) => (Math.sin(t) > 0 ? m.pose(t) : other.pose(t)) });
    fails(checkFourBar(bad), 'M6d');
  });
  it('mutation: a poorly proportioned linkage fails the transmission-angle guideline (M6g)', () => {
    fails(checkFourBar(fourBar({ ground: 70, crank: 34, coupler: 84, rocker: 66 })), 'M6g');
  });
});
