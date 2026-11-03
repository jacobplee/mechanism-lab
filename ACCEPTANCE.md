# Acceptance criteria

Written before any code. The build is done when every line below passes. Each
criterion has an ID that the tests and `REPORT.md` refer back to.

Tolerances are absolute in model units (millimetres, radians) unless stated.

## Principle behind every check

A check states a property of the mechanism itself: a constraint it must obey,
a geometric fact, or a closed-form result from the textbook. It then measures
the model's pose output against that property. It never re-runs the formula the
model used to produce the pose, and it reads dimensions off the model object
rather than from literals. A check derived from the implementation agrees with
the implementation no matter how wrong both are.

## Packaging and hygiene

- **P1** Zero dependencies. `package.json` has no `dependencies` or
  `devDependencies`. `npm test` runs `node --test` and every test passes.
- **P2** The library (`src/`) is plain ES modules that never touch the DOM, so
  the same code runs in Node and in the browser.
- **P3** No build step. `index.html` loads the ES modules directly and works
  from any static file server.
- **P4** MIT license, copyright Jacob Lee. `package.json` author is Jacob Lee.
- **P5** A test scans every tracked text file and fails on email addresses,
  phone numbers or absolute home-directory paths. A separate scan for terms
  from the author's other projects (term list kept outside the repository, so
  the list itself does not leak) also comes back clean.
- **P6** Nothing carried over from the source site: no scroll coupling, paper
  or perforations, raster art plates, drafting title block, or hand-drawn
  stroke roughening.
- **P7** Local git only. No remote configured, nothing pushed. Every commit
  message ends with the two required trailer lines.

## Verification design

- **V1** Checks live in `src/checks/` and import only the geometry helpers and
  the model's public surface (`params`, `geometry`, `pose()`). They never import
  drawing code.
- **V2** Every check suite is shown to fail on at least one deliberately broken
  design. Each such mutation test names the specific check that must go red.
- **V3** `verify()` runs the full check set on the exact models the demo
  animates and returns a structured report: mechanism, check name, measured
  value, limit, pass/fail.

## Mechanism checks (all pass on the shipped designs)

### M1 Scotch yoke
- a. Crank pin stays on its circle, |OP| = r (1e-9).
- b. Pin centre stays on the slot centreline (1e-9).
- c. Pin stays inside the slot ends for the whole revolution (margin >= 0).
- d. Yoke moves only along its guide (1e-9).
- e. Output is a pure sinusoid: harmonics 2 to 8 below 1e-9 of the fundamental.
- f. Stroke = 2r (1e-9).

### M2 Crank-slider
- a. Connecting-rod length is constant (1e-9).
- b. Slider stays on its axis (1e-9).
- c. Stroke = 2r, dead centres at L + r and L - r (1e-9).
- d. Not a pure sinusoid: the measured second harmonic matches the series
  L(λ²/4 + λ⁴/16 + 15λ⁶/512), λ = r/L, within 0.1 %.

### M3 Geneva drive (4 slots shipped; 3 to 8 slots tested)
- a. Centre distance c = a / sin(π/n) (1e-9).
- b. Pin enters and leaves tangentially: angle driver-centre, pin, star-centre
  is 90° at the handoff (1e-9).
- c. Pin centre stays on the slot centreline throughout engagement (1e-9).
- d. One driver turn indexes the star exactly 2π/n (1e-9).
- e. The dwell is motionless (1e-12).
- f. Handoff is continuous in angle (1e-6) and the star's angular velocity is
  zero there (1e-5).
- g. Drive fraction = 1/2 - 1/n, within the sampling resolution.
- h. The pin never cuts into the star (outline clearance >= 0 at every sampled
  angle).
- i. The locking disc clears the star at every sampled angle (clearance >= 0).
- j. The lock holds: at every dwell angle, turning the star 2° either way runs
  it into the driver.

### M4 Eccentric cam and flat-faced follower
- a. Follower face is tangent to the cam: cam-centre-to-face distance = R (1e-9).
- b. The drawn cam outline touches the face without penetrating it (gap no
  larger than the outline's chord sag).
- c. Total lift = 2e (1e-9).
- d. Motion is simple harmonic: harmonics 2 to 8 below 1e-9 of the fundamental.
- e. Follower stays on its axis (1e-9).

### M5 Ratchet and pawl
- a. The pawl tip lies on the wheel outline at every sampled angle (1e-9).
- b. The pawl tip never penetrates the wheel.
- c. Exactly n clicks (pawl drops) per revolution of an n-tooth wheel.
- d. Reverse rotation is blocked at every tooth: turning the wheel back 0.5°
  from each engaged position drives the tooth face into the pawl tip, while
  turning it forward 0.5° does not.
- e. A reverse load is self-engaging: the tooth-face force's moment about the
  pawl pivot pulls the pawl into the tooth.

### M6 Four-bar linkage (crank-rocker)
- a. Grashof: s + l <= p + q, and the crank is the shortest link.
- b. The linkage closes at every crank angle.
- c. All link lengths stay constant (1e-9).
- d. No branch flip over a full revolution.
- e. Rocker extremes equal the toggle-position prediction from the law of
  cosines (1e-6 rad).
- f. Transmission-angle extremes equal the prediction at the two
  crank-collinear-with-ground positions (1e-6 rad).
- g. Transmission angle stays within 40° to 140° (design guideline).

### M7 Involute spur gear pair
- a. Centre distance = r1 + r2 = m(N1 + N2)/2 (1e-9).
- b. Flank normals are tangent to the base circle r cos 20° (the involute
  property), within 1e-3 m.
- c. Pressure angle at the pitch circle is 20°, within 0.05°.
- d. Tooth count measured from the outline equals N.
- e. Speed ratio = -N1/N2 (1e-12).
- f. No interference at any sampled phase across a tooth cycle (clearance >= 0).
- g. Phase-locked: the backlash is split evenly, each side equal to half the
  design backlash within 5 %.
- h. Conjugate action: with one flank closed, contact is maintained at every
  sampled phase, |clearance| <= 2e-3 m.

### M8 Idler train
- a. Every mesh in the train passes M7 a, f and g.
- b. Output ratio = (-1)^k N_in/N_out for k meshes, independent of the idler
  tooth counts (checked with three different idlers).

### M9 Open belt
- a. Tangent points lie on both rims (1e-9).
- b. Each straight run is perpendicular to both radii (1e-12).
- c. Both runs are external tangents (open belt, not crossed).
- d. Belt length equals the closed-form open-belt length (1e-9).
- e. No slip: surface speeds are equal and both pulleys turn the same way (1e-12).

## Demo page

- **D1** `index.html` animates every mechanism above as clean SVG, with no
  external requests.
- **D2** It runs `verify()` on load and shows a pass/fail badge with the count;
  each panel shows its own result and can list its checks.
- **D3** Light and dark themes follow the system setting. No horizontal scroll
  at 375 px wide. Play/pause control; `prefers-reduced-motion` starts paused.
- **D4** In headless Chrome: no console errors, and the badge reports all
  checks passing.

## Documentation

- **R1** README: what it is, an animated GIF of each mechanism, how
  verification works, how to run it. Plain register, no em dashes, no hype
  words. Includes the line "Built with AI coding agents; every mechanism is
  checked numerically against its kinematics."
- **R2** The README images are reproducible with `tools/capture.mjs`, whose
  optional dependencies are not dependencies of the library.
- **R3** `REPORT.md` lists every criterion here with its result, the test
  count, and the decisions left before the repository goes public.
