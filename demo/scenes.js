// One scene per mechanism: how to draw it, and nothing else.
//
// Each scene builds its parts once from the model's geometry, then moves them
// every frame to wherever model.pose() says they are. The checks in
// src/checks/ never look at this file.

import { el, pathD, circleD, capsuleD, rectD, pose, centreMark, groundPivot } from './svg.js';
import { TAU, polar, circle, dist, sub, angleOf, openBelt } from '../src/index.js';

const deg = (r) => (r * 180) / Math.PI;

/** Bounding box of a list of points, as [x0, y0, x1, y1]. */
function bounds(points, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/** A wheel body: outline polygon (or circle) with a bore and optional holes. */
function wheelD(outline, { bore = 5, holes = 0, holeR = 0, holeAt = 0, key = false } = {}) {
  let d = pathD(outline);
  if (key) {
    // bore with a keyway notch at angle 0
    const kw = bore * 0.5, kd = bore * 0.35, pts = [];
    const a0 = Math.asin(kw / 2 / bore);
    for (let i = 0; i <= 40; i++) pts.push(polar(bore, a0 + ((TAU - 2 * a0) * i) / 40));
    pts.push([bore + kd, -kw / 2], [bore + kd, kw / 2]);
    d += pathD(pts.reverse());
  } else {
    d += circleD([0, 0], bore);
  }
  for (let k = 0; k < holes; k++) d += circleD(polar(holeAt, (k / holes) * TAU + Math.PI / holes), holeR);
  return d;
}

function pulleyD(r, holes = 4) {
  return wheelD(circle([0, 0], r, 96), { bore: Math.max(3, r * 0.2), holes, holeR: r * 0.17, holeAt: r * 0.58 }) +
    circleD([0, 0], r - 2.2);
}

// ---------------------------------------------------------------- linkages

const scotchYoke = {
  key: 'scotchYoke',
  title: 'Scotch yoke',
  caption: 'A crank pin running in a straight slot drives the yoke as a pure sinusoid, x = r sin θ. With no connecting rod there is no second harmonic.',
  period: TAU, rate: 0.25,
  plot: (m) => ({ f: (t) => m.pose(t).yoke[1], label: 'yoke travel against crank angle' }),
  build(svg, m) {
    const { r, pinR } = m.params;
    const { slotLen, slotW, yokeW, yokeH } = m.geometry;
    // The model slides the yoke along y; turn the drawing so it slides across the page.
    const g = el('g', { transform: 'rotate(-90)' }, svg);
    const railX = yokeW / 2 + 1.5, railH = r + yokeH / 2 + 8;
    for (const s of [-1, 1]) el('path', { d: rectD(s > 0 ? railX : -railX - 5, -railH, 5, 2 * railH), class: 'ground' }, g);
    const crank = el('g', {}, g);
    el('path', { d: capsuleD(r, 2 * pinR + 5), class: 'part alt' }, crank);
    el('path', { d: circleD([0, 0], 9) + circleD([0, 0], 4), class: 'part alt', 'fill-rule': 'evenodd' }, crank);
    const yoke = el('g', {}, g);
    // yoke body with the slot as a hole
    el('path', {
      d: rectD(-yokeW / 2, -yokeH / 2, yokeW, yokeH) + capsuleD(slotLen - slotW, slotW, -(slotLen - slotW) / 2, 0),
      class: 'part glass', 'fill-rule': 'evenodd',
    }, yoke);
    el('path', { d: rectD(-3.5, -yokeH / 2 - 22, 7, 22), class: 'part accent' }, yoke);
    const pin = el('path', { d: circleD([0, 0], pinR), class: 'part pin' }, g);
    centreMark(g, [0, 0], 6);
    return {
      bounds: [-(r + yokeH / 2 + 22) - 2, -(railX + 6), r + yokeH / 2 + 10, railX + 6],
      update(t) {
        const p = m.pose(t);
        crank.setAttribute('transform', pose(0, 0, t));
        yoke.setAttribute('transform', pose(p.yoke[0], p.yoke[1]));
        pin.setAttribute('transform', pose(p.pin[0], p.pin[1]));
        return `yoke x = ${p.yoke[1].toFixed(1)} mm`;
      },
    };
  },
};

const crankSlider = {
  key: 'crankSlider',
  title: 'Crank and slider',
  caption: 'The same job with a connecting rod. The rod adds a second harmonic, so the piston moves slower near bottom dead centre (the crank end) than near top dead centre. The dashed curve is the pure sinusoid for comparison.',
  period: TAU, rate: 0.25,
  plot: (m) => ({ f: (t) => m.pose(t).slider[0], ref: (t) => m.params.L + m.params.r * Math.cos(t), label: 'piston position against crank angle' }),
  build(svg, m) {
    const { r, L } = m.params;
    const { pinR, pistonW, pistonH, boreFrom, boreTo } = m.geometry;
    const wall = pistonH / 2 + 0.6;
    for (const s of [-1, 1]) el('path', { d: rectD(boreFrom, s > 0 ? wall : -wall - 5, boreTo - boreFrom, 5), class: 'ground' }, svg);
    el('path', { d: rectD(boreTo, -wall - 5, 5, 2 * wall + 10), class: 'ground' }, svg);
    const crank = el('g', {}, svg);
    el('path', { d: circleD([0, 0], r + pinR + 5) + circleD([0, 0], 4), class: 'part alt', 'fill-rule': 'evenodd' }, crank);
    el('path', { d: capsuleD(r, 8), class: 'part alt' }, crank);
    const piston = el('g', {}, svg);
    el('path', { d: rectD(-pistonW / 2, -pistonH / 2, pistonW, pistonH), class: 'part accent' }, piston);
    for (const y of [-pistonH / 2 + 4, pistonH / 2 - 4]) el('path', { d: `M${-pistonW / 2} ${y}h${pistonW}`, class: 'thin' }, piston);
    const rod = el('path', { d: capsuleD(L, 7), class: 'part' }, svg);
    const pin = el('path', { d: circleD([0, 0], pinR), class: 'part pin' }, svg);
    const wrist = el('path', { d: circleD([0, 0], 2.6), class: 'part pin' }, svg);
    centreMark(svg, [0, 0], 6);
    el('path', { d: `M${-r - 12} 0H${boreTo + 8}`, class: 'centreline' }, svg);
    return {
      bounds: [-(r + pinR + 6), -(r + pinR + 6), boreTo + 6, r + pinR + 6],
      update(t) {
        const p = m.pose(t);
        crank.setAttribute('transform', pose(0, 0, t));
        piston.setAttribute('transform', pose(p.slider[0], 0));
        rod.setAttribute('transform', pose(p.crankPin[0], p.crankPin[1], angleOf(sub(p.slider, p.crankPin))));
        pin.setAttribute('transform', pose(...p.crankPin));
        wrist.setAttribute('transform', pose(...p.slider));
        return `piston x = ${p.slider[0].toFixed(1)} mm`;
      },
    };
  },
};

const geneva = {
  key: 'geneva',
  title: 'Geneva drive',
  caption: 'One turn of the driver indexes the star a quarter turn; a locking disc then holds it still for the other 270°. The centre distance is forced: c = a / sin(π/n). The relief in the disc is generated from the star’s own motion.',
  period: TAU, rate: 0.3,
  plotFrom: Math.PI,
  plot: (m) => ({ f: (t) => -m.pose(t).star, label: 'star angle against driver angle' }),
  build(svg, m) {
    const g = m.geometry, { a, pinR } = m.params;
    const star = el('path', { d: pathD(g.starOutline) + circleD([0, 0], 6), class: 'part', 'fill-rule': 'evenodd' }, svg);
    const drv = el('g', {}, svg);
    el('path', { d: pathD(g.lockOutline) + circleD([0, 0], 4), class: 'part alt', 'fill-rule': 'evenodd' }, drv);
    el('path', { d: capsuleD(a, 2 * pinR + 3), class: 'part alt' }, drv);
    el('path', { d: circleD([a, 0], pinR), class: 'part pin accent' }, drv);
    centreMark(svg, [0, 0], 6);
    centreMark(svg, g.starCentre, 6);
    return {
      bounds: [-(a + pinR + 4), -g.Rs - 3, g.c + g.Rs + 3, g.Rs + 3],
      update(t) {
        const p = m.pose(t);
        drv.setAttribute('transform', pose(0, 0, t));
        star.setAttribute('transform', pose(g.starCentre[0], g.starCentre[1], p.star));
        return `star ${(((-deg(p.star) % 360) + 360) % 360).toFixed(1)}°, ${p.engaged ? 'driving' : 'locked'}`;
      },
    };
  },
};

const camFollower = {
  key: 'camFollower',
  title: 'Eccentric cam and flat follower',
  caption: 'A round cam on an offset shaft lifts a flat-faced follower by exactly 2e in simple harmonic motion. Kinematically it is a Scotch yoke.',
  period: TAU, rate: 0.25,
  plot: (m) => ({ f: (t) => -m.pose(t).faceY, label: 'follower lift against cam angle' }),
  build(svg, m) {
    const { R, e } = m.params;
    const { faceW, stemLen, faceT } = m.geometry;
    const lo = -(R + e), hi = -(R - e);                    // face height range
    const guideTop = hi - faceT - stemLen + 4, guideBot = lo - faceT - 4;
    for (const s of [-1, 1]) el('path', { d: rectD(s > 0 ? 5 : -12, guideTop, 7, guideBot - guideTop), class: 'ground' }, svg);
    const cam = el('path', { d: wheelD(circle([e, 0], R, 120), { bore: 4.5, key: true }), class: 'part alt', 'fill-rule': 'evenodd' }, svg);
    const foll = el('g', {}, svg);
    el('path', { d: rectD(-4, -faceT - stemLen, 8, stemLen), class: 'part accent' }, foll);
    el('path', { d: rectD(-faceW / 2, -faceT, faceW, faceT), class: 'part accent' }, foll);
    const dot = el('path', { d: circleD([0, 0], 1.6), class: 'contact' }, svg);
    centreMark(svg, [0, 0], 6);
    return {
      bounds: [-Math.max(faceW / 2, R + e) - 3, lo - faceT - stemLen - 3, Math.max(faceW / 2, R + e) + 3, R + e + 3],
      update(t) {
        const p = m.pose(t);
        cam.setAttribute('transform', pose(0, 0, t));
        foll.setAttribute('transform', pose(0, p.faceY));
        dot.setAttribute('transform', pose(...p.contact));
        return `lift ${(-p.faceY - (R - e)).toFixed(1)} of ${(2 * e).toFixed(0)} mm`;
      },
    };
  },
};

const ratchet = {
  key: 'ratchet',
  title: 'Ratchet and pawl',
  caption: 'Turning forward, the pawl tip is solved onto each tooth slope and drops into the next gap. Turning backward, the tooth face runs into the tip, and the load pulls the pawl further in.',
  period: TAU / 4, rate: 0.08,
  plot: (m) => ({ f: (t) => -m.pose(t).pawl, label: 'pawl lift against wheel angle (three teeth)' }),
  build(svg, m) {
    const g = m.geometry, { R } = m.params;
    groundPivot(svg, g.pivot, 18, 7, -1);
    const wheel = el('path', { d: wheelD(g.outline, { bore: 6, holes: 4, holeR: 5, holeAt: 18 }), class: 'part', 'fill-rule': 'evenodd' }, svg);
    const pawl = el('g', {}, svg);
    el('path', { d: pathD(g.body), class: 'part accent' }, pawl);
    el('path', { d: circleD([0, 0], 2.4), class: 'part pin' }, pawl);
    // free direction
    const a0 = -0.35, a1 = 0.55, rr = R + 7;
    el('path', { d: `M${polar(rr, a0).join(' ')}A${rr} ${rr} 0 0 1 ${polar(rr, a1).join(' ')}`, class: 'arrow', 'marker-end': 'url(#arrowhead)' }, svg);
    centreMark(svg, [0, 0], 6);
    return {
      bounds: [-R - 4, g.pivot[1] - 15, R + 10, R + 4],
      update(t) {
        const p = m.pose(t);
        wheel.setAttribute('transform', pose(0, 0, t));
        pawl.setAttribute('transform', pose(g.pivot[0], g.pivot[1], p.pawl));
        return `tooth ${p.tooth + 1} of ${m.params.n} under the pawl`;
      },
    };
  },
};

const fourBar = {
  key: 'fourBar',
  title: 'Four-bar linkage',
  caption: 'A crank-rocker that satisfies Grashof’s condition, solved by circle intersection every frame on a fixed branch. The dashed curve is the path of the marked point on the coupler.',
  period: TAU, rate: 0.25,
  plot: (m) => ({ f: (t) => { const p = m.pose(t); return angleOf(sub(p.C, m.geometry.D)); }, label: 'rocker angle against crank angle' }),
  build(svg, m) {
    const { crank, coupler, rocker } = m.params, { A, D } = m.geometry;
    const pts = [];
    for (let i = 0; i <= 240; i++) { const p = m.pose((i / 240) * TAU); pts.push(p.P, p.C, p.B); }
    el('path', { d: pathD(pts.filter((_, i) => i % 3 === 0)), class: 'trace' }, svg);
    groundPivot(svg, A, 16, 7, 1);
    groundPivot(svg, D, 16, 7, 1);
    const cr = el('path', { d: capsuleD(crank, 7), class: 'part alt' }, svg);
    const plate = el('path', { class: 'part glass' }, svg);
    const cp = el('path', { d: capsuleD(coupler, 7), class: 'part' }, svg);
    const rk = el('path', { d: capsuleD(rocker, 7), class: 'part accent' }, svg);
    const pins = [A, D, 0, 0].map(() => el('path', { d: circleD([0, 0], 2.2), class: 'part pin' }, svg));
    const dot = el('path', { d: circleD([0, 0], 2.2), class: 'contact' }, svg);
    pins[0].setAttribute('transform', pose(...A));
    pins[1].setAttribute('transform', pose(...D));
    return {
      bounds: bounds([...pts, [A[0], A[1] + 12], [D[0], D[1] + 12], [A[0] - crank, 0], [D[0] + rocker, 0]], 7),
      update(t) {
        const p = m.pose(t);
        cr.setAttribute('transform', pose(A[0], A[1], t));
        cp.setAttribute('transform', pose(p.B[0], p.B[1], angleOf(sub(p.C, p.B))));
        rk.setAttribute('transform', pose(D[0], D[1], angleOf(sub(p.C, D))));
        plate.setAttribute('d', pathD([p.B, p.P, p.C]));
        pins[2].setAttribute('transform', pose(...p.B));
        pins[3].setAttribute('transform', pose(...p.C));
        dot.setAttribute('transform', pose(...p.P));
        const mu = Math.acos(Math.max(-1, Math.min(1,
          ((p.B[0] - p.C[0]) * (D[0] - p.C[0]) + (p.B[1] - p.C[1]) * (D[1] - p.C[1])) / (coupler * rocker))));
        return `transmission angle ${deg(mu).toFixed(0)}°`;
      },
    };
  },
};

// ---------------------------------------------------------------- gears

function gearBody(parent, gear, opts = {}) {
  const hub = Math.max(5, gear.r * 0.2);
  const d = wheelD(gear.outline, {
    bore: hub * 0.55, key: !!opts.key, holes: opts.holes || 0,
    holeR: Math.min((gear.rf - hub) * 0.3, gear.r * 0.17), holeAt: (gear.rf + hub) / 2,
  });
  return el('path', { d, class: `part ${opts.cls || ''}`, 'fill-rule': 'evenodd' }, parent);
}

const gearPair = {
  key: 'gearPair',
  title: 'Involute gear pair',
  caption: '18 and 30 teeth, module 4, 20° involute flanks. Centre distance is the sum of the pitch radii (dashed) and the driven gear is phased tooth into gap. The accent line is the line of action, tangent to both base circles.',
  period: TAU, rate: 0.12,
  build(svg, t) {
    const [g1, g2] = t.gears, [O1, O2] = t.centres;
    const phi = (g1.pressureDeg * Math.PI) / 180;
    const u = sub(O2, O1).map((v) => v / dist(O1, O2));
    const at = (O, rr, a) => [O[0] + rr * Math.cos(a), O[1] + rr * Math.sin(a)];
    const base = angleOf(u);
    const T1 = at(O1, g1.rb, base - phi), T2 = at(O2, g2.rb, base - phi + Math.PI);
    const b1 = gearBody(svg, g1, { key: true, cls: 'alt' });
    const b2 = gearBody(svg, g2, { holes: 5 });
    for (const [O, g] of [[O1, g1], [O2, g2]]) {
      el('path', { d: circleD(O, g.r), class: 'pitch' }, svg);
      el('path', { d: circleD(O, g.rb), class: 'basecircle' }, svg);
      centreMark(svg, O, 7);
    }
    el('path', { d: pathD([T1, T2], false), class: 'action' }, svg);
    el('path', { d: `M${O1[0] - 8} ${O1[1]}L${O2[0] + 8} ${O2[1]}`, class: 'centreline' }, svg);
    return {
      bounds: bounds([at(O1, g1.ra, Math.PI), at(O1, g1.ra, -Math.PI / 2), at(O1, g1.ra, Math.PI / 2),
        at(O2, g2.ra, 0), at(O2, g2.ra, -Math.PI / 2), at(O2, g2.ra, Math.PI / 2)], 3),
      update(a) {
        const p = t.pose(a);
        b1.setAttribute('transform', pose(O1[0], O1[1], p.phis[0]));
        b2.setAttribute('transform', pose(O2[0], O2[1], p.phis[1]));
        return `ratio ${(-g1.N / g2.N).toFixed(3)} (−${g1.N}/${g2.N})`;
      },
    };
  },
};

const idlerTrain = {
  key: 'idlerTrain',
  title: 'Idler train and open belt',
  caption: 'An idler changes the direction of rotation, not the ratio. The output shaft carries a pulley; the open belt runs on the exact external tangents and turns both pulleys the same way.',
  period: (8 / 20) * TAU, rate: 0.12,
  build(svg, md) {
    const { train, belt, beltOn } = md;
    const [p1, p2] = belt.pulleys;
    const w = 1.6;
    // The band's edges are open belts themselves, on pulleys w bigger and w smaller.
    const edge = (dw) => openBelt(p1.c, p1.r + dw, p2.c, p2.r + dw).path(120);
    el('path', { d: pathD(edge(w)) + pathD(edge(-w)), class: 'belt', 'fill-rule': 'evenodd' }, svg);
    const bodies = train.gears.map((g, i) => gearBody(svg, g, { holes: [5, 0, 4][i] ?? 0, cls: i === 1 ? 'alt' : '' }));
    train.centres.forEach((O) => centreMark(svg, O, 6));
    const pul1 = el('path', { d: pulleyD(p1.r), class: 'part accent', 'fill-rule': 'evenodd' }, svg);
    const pul2 = el('path', { d: pulleyD(p2.r), class: 'part accent', 'fill-rule': 'evenodd' }, svg);
    centreMark(svg, p2.c, 5);
    const pts = [...train.centres.flatMap((O, i) => circle(O, train.gears[i].ra, 16)), ...circle(p2.c, p2.r + w, 16)];
    return {
      bounds: bounds(pts, 3),
      update(a) {
        const p = train.pose(a);
        train.gears.forEach((g, i) => bodies[i].setAttribute('transform', pose(train.centres[i][0], train.centres[i][1], p.phis[i])));
        const out = p.phis[beltOn];
        const q = belt.pose(out);
        pul1.setAttribute('transform', pose(p1.c[0], p1.c[1], q.phi1));
        pul2.setAttribute('transform', pose(p2.c[0], p2.c[1], q.phi2));
        return `in ${(deg(a) % 360).toFixed(0)}°, out ${(((deg(out) % 360) + 360) % 360).toFixed(0)}°`;
      },
    };
  },
};

export const SCENES = [scotchYoke, crankSlider, geneva, camFollower, ratchet, fourBar, gearPair, idlerTrain];
