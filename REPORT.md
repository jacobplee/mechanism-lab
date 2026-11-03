# Report

What the library and demo contain, the result of every criterion in
[ACCEPTANCE.md](ACCEPTANCE.md) with its evidence, and the test suite.

## What is built

- **Library (`src/`)**: dependency-free ES modules, no DOM access. Models for
  the Scotch yoke, crank-slider, 4-slot Geneva drive (any n >= 3), eccentric
  cam with flat-faced follower, ratchet and pawl, four-bar crank-rocker, true
  20° involute spur gears, gear pairs and idler trains, and open belts on exact
  external tangents. Each model exposes `params`, `geometry` and `pose()`.
- **Checks (`src/checks/`) and `verify()`**: 65 checks across the 8 shipped
  designs, each stated from the mechanism (constraint, geometric fact or
  closed-form result) and measured on the pose output. They import only
  geometry helpers and the gear builder.
- **Demo (`index.html`, `demo/`)**: static page, no build step, no external
  requests. Animates all eight as clean SVG, runs `verify()` on the same model
  objects it draws, shows a pass/fail badge and per-panel check tables with
  measured values. Light/dark, phone layout, play/pause, reduced motion.
- **Tests (`test/`)**: `node --test`, no dependencies.
- **Tools (`tools/capture.mjs`)**: optional headless-Chrome check of the demo
  and the README GIF renderer.
- **Docs**: README with one animated GIF per mechanism, `ACCEPTANCE.md`
  (written and committed before any code), this report, MIT `LICENSE`, and a
  GitHub Actions workflow for Node 18/20/22.

## Acceptance results

All criteria pass.

| ID | Result | Evidence |
| --- | --- | --- |
| P1 | pass | `package.json` has no dependencies; `npm test` is `node --test`; 77/77 tests pass (hygiene test checks the first two). |
| P2 | pass | Hygiene test scans `src/` for `document.`, `window.`, `navigator.`. |
| P3 | pass | `index.html` loads `demo/app.js` as a module; served by a plain static server in `tools/capture.mjs`. |
| P4 | pass | `LICENSE` MIT, "Copyright (c) 2026 Jacob Lee"; `package.json` author "Jacob Lee" (tested). |
| P5 | pass | Hygiene test: no emails, phone numbers or home paths in any text file. One-off scan for personal and other-project terms (list kept outside the repo): no hits. Image files contain no embedded paths. |
| P6 | pass | No scroll coupling, perforations, plates, title block or stroke roughening; hygiene test greps for leftovers. |
| P7 | pass | Every commit ends with the two trailer lines. |
| V1 | pass | Test asserts `src/checks/*` import only `../geom.js`, `./check.js`, `../gears.js`. |
| V2 | pass | 29 mutation tests, each asserting a named check fails; every suite M1 to M9 has at least one (list below). |
| V3 | pass | `verify()` returns `{pass, total, passed, failed, results, timing}`; the demo calls it on its own model objects. A test parses `ACCEPTANCE.md` and fails if any mechanism criterion has no check. |
| M1a to M9e | pass | 65/65 checks on the shipped designs; values in the table below. Also passing across 3 to 8 Geneva slots, 5 ratchet variants, gear pairs from 14 to 60 teeth at modules 1 to 4, a four-gear train, and 200 random belts. |
| D1 | pass | Headless Chrome: 8 animated panels, readouts change over time, no requests outside the local server. |
| D2 | pass | Badge reads "Verified: 65 of 65 checks pass"; each panel shows its count and a check table. |
| D3 | pass | Dark scheme applies (body background changes); 375 px wide has 0 px horizontal overflow; reduced motion starts paused. |
| D4 | pass | No console errors or failed requests; badge reports all passing. |
| R1 | pass | README covers what, GIFs, verification, running; no em dashes or hype words (tested); includes the AI line verbatim. |
| R2 | pass | `tools/capture.mjs` regenerates `docs/img/` (3.1 MB total). |
| R3 | pass | This file. The decisions before publishing (name, commit identity, Pages) were settled before the first push. |

D1 to D4 are checked by `tools/capture.mjs` (8/8 pass), not by `node --test`,
because they need a browser.

Notes on the criteria, so nothing is hidden:

- P5 was reworded before any code was written: the other-project term list
  stays out of the repo, so that scan is a one-off rather than a test.
- Where a check measures more than the criterion asked, it was added, never
  relaxed: M3c also checks the pin is within the slot's length while
  driving; M4e also checks the contact point stays on the face; M6a is split
  into the Grashof inequality and "crank is the shortest link".
- M3j is reported as a count of free nudges (482 tested, 0 free) rather than
  a clearance value. M4b allows 1e-9 of floating-point penetration.

## Tests

77 tests in 6 files (`node --test`, about 15 s on this machine), all passing.
29 of them are mutation tests:

- straight-flank teeth are not involutes and are not conjugate (M7b, M7f, M7h)
- a 25-degree gear labelled 20 degrees (M7b, M7c)
- driven gear half a tooth out of phase lands tooth on tooth (M7f)
- driven gear turned at the tooth-count ratio inverted (M7e, M7f)
- centre distance opened up by 2 % (M7a, M7g)
- a 12-tooth pinion against 34 teeth runs off its involute (M7h)
- a train that reports the last mesh ratio as the whole ratio (M8b)
- runs drawn by offsetting the centre line by each radius are not tangent (M9b)
- a driven pulley turning the wrong way is a crossed belt (M9e)
- star placed 3 % too far away; pin leaves the slot line (M3a, M3c)
- star angle computed with the wrong centre distance jumps at the handoff (M3b, M3f)
- locking disc without a relief cut hits the star while indexing (M3i)
- a locking disc smaller than its locking arc does not lock (M3j)
- the classic circular relief, at the same clearances, leaves the star free just after the pin leaves (M3j)
- a star that keeps creeping through the dwell is caught (M3e)
- a slot cut too short lets the pin run out of it (M1c)
- a yoke driven like a crank-slider is not a pure sinusoid (M1b, M1e)
- the small-angle slider formula stretches the rod (M2a)
- a pure sinusoid in place of the slider misses the second harmonic (M2d)
- follower a quarter turn out of phase leaves the cam (M4a)
- a face narrower than 2e loses the contact point (M4e)
- a non-Grashof linkage cannot turn its crank fully (M6a, M6b)
- a solver that drifts the coupler joint stretches a link (M6c)
- choosing the branch per frame lets the linkage snap through (M6d)
- a poorly proportioned linkage fails the transmission-angle guideline (M6g)
- pivot inside the tangent line, so a reverse load pushes the pawl out (M5e)
- a pawl rocked by a sawtooth instead of solved onto the teeth (M5a)
- a flat-bottomed pawl body drags on the tooth slopes (M5b)
- teeth with their faces reversed no longer stop reverse rotation (M5d)

## verify() on the shipped designs

| ID | Mechanism | Check | Measured | Limit | Result |
| --- | --- | --- | --- | --- | --- |
| M1a | scotchYoke | crank pin stays on its circle | 7.1e-15 | <= 1.0e-9 | pass |
| M1b | scotchYoke | pin centre stays on the slot centreline | 0 | <= 1.0e-9 | pass |
| M1c | scotchYoke | pin stays inside the slot ends (margin) | 2 | >= 0 | pass |
| M1d | scotchYoke | yoke moves only along its guide | 0 | <= 1.0e-9 | pass |
| M1e | scotchYoke | output is a pure sinusoid (harmonics 2-8 / fundamental) | 1.1e-16 | <= 1.0e-9 | pass |
| M1f | scotchYoke | stroke = 2r | 0 | <= 1.0e-9 | pass |
| M2a | crankSlider | connecting-rod length is constant | 2.8e-14 | <= 1.0e-9 | pass |
| M2b | crankSlider | slider stays on its axis | 0 | <= 1.0e-9 | pass |
| M2c | crankSlider | stroke = 2r | 0 | <= 1.0e-9 | pass |
| M2c | crankSlider | dead centres at L + r and L - r | 0 | <= 1.0e-9 | pass |
| M2d | crankSlider | second harmonic matches the series (relative error) | 1.7e-4 | <= 0.0010 | pass |
| M3a | geneva | centre distance c = a / sin(pi/n) | 0 | <= 1.0e-9 | pass |
| M3b | geneva | tangential entry and exit (cos of angle O1-pin-O2) | 1.4e-16 | <= 1.0e-9 | pass |
| M3c | geneva | pin centre on the slot centreline while driving | 1.4e-14 | <= 1.0e-9 | pass |
| M3c | geneva | pin centre within the slot length while driving (excess) | 0 | <= 1.0e-9 | pass |
| M3d | geneva | one driver turn indexes 2*pi/n | 0 | <= 1.0e-9 | pass |
| M3e | geneva | dwell is motionless | 0 | <= 1.0e-12 | pass |
| M3f | geneva | handoff continuous in angle | 0 | <= 1.0e-6 | pass |
| M3f | geneva | star velocity zero at handoff | 5.0e-7 | <= 1.0e-5 | pass |
| M3g | geneva | drive fraction = 1/2 - 1/n | 0 | <= 2.8e-4 | pass |
| M3h | geneva | pin never cuts into the star (clearance) | 0.3000 | >= 0 | pass |
| M3i | geneva | locking disc clears the star (clearance) | 0.1829 | >= 0 | pass |
| M3j | geneva | lock holds: star nudged 2 deg either way hits the driver (free cases) | 0 | = 0 | pass |
| M4a | camFollower | face tangent to the cam (centre-to-face distance = R) | 3.6e-15 | <= 1.0e-9 | pass |
| M4b | camFollower | drawn cam outline touches the face, never penetrates | -1.4e-14 | in [-1.0e-9, 0.0046] | pass |
| M4c | camFollower | total lift = 2e | 0 | <= 1.0e-9 | pass |
| M4d | camFollower | simple harmonic (harmonics 2-8 / fundamental) | 6.7e-16 | <= 1.0e-9 | pass |
| M4e | camFollower | follower stays on its axis | 0 | <= 1.0e-9 | pass |
| M4e | camFollower | contact point stays on the follower face (margin) | 21 | >= 0 | pass |
| M5a | ratchet | pawl tip lies on the wheel outline | 3.1e-14 | <= 1.0e-9 | pass |
| M5b | ratchet | pawl never penetrates the wheel (clearance) | -3.6e-15 | >= -1.0e-9 | pass |
| M5c | ratchet | clicks per revolution | 12 | = 12 | pass |
| M5d | ratchet | reverse blocked, forward free at every tooth (failures) | 0 | = 0 | pass |
| M5e | ratchet | reverse load pulls the pawl in (normalised moment) | 0.4147 | >= 1.0e-6 | pass |
| M6a | fourBar | Grashof: s + l - (p + q) <= 0 | -9 | <= 0 | pass |
| M6a | fourBar | crank is the shortest link | 0 | <= 0 | pass |
| M6b | fourBar | closes at every crank angle (open positions) | 0 | = 0 | pass |
| M6c | fourBar | link lengths constant | 4.3e-14 | <= 1.0e-9 | pass |
| M6d | fourBar | no branch flip (sign changes) | 0 | = 0 | pass |
| M6e | fourBar | rocker extremes = toggle-position prediction | 6.7e-16 | <= 1.0e-6 | pass |
| M6f | fourBar | transmission-angle extremes = prediction | 1.1e-16 | <= 1.0e-6 | pass |
| M6g | fourBar | transmission angle within 40-140 deg (excess, deg) | -9.3218 | <= 0 | pass |
| M7b | gearPair | 18T: flank normals tangent to base circle (error / m) | 2.4e-4 | <= 0.0010 | pass |
| M7c | gearPair | 18T: pressure angle at pitch circle (deg off 20) | 0.0045 | <= 0.0500 | pass |
| M7d | gearPair | 18T: teeth counted on the outline | 18 | = 18 | pass |
| M7b | gearPair | 30T: flank normals tangent to base circle (error / m) | 2.9e-4 | <= 0.0010 | pass |
| M7c | gearPair | 30T: pressure angle at pitch circle (deg off 20) | 0.0033 | <= 0.0500 | pass |
| M7d | gearPair | 30T: teeth counted on the outline | 30 | = 30 | pass |
| M7a | gearPair | 18T-30T: centre distance = m(N1 + N2)/2 | 0 | <= 1.0e-9 | pass |
| M7e | gearPair | 18T-30T: speed ratio = -N1/N2 | 0 | <= 1.0e-12 | pass |
| M7f | gearPair | 18T-30T: no interference over a tooth cycle (clearance) | 0.0753 | >= 0 | pass |
| M7g | gearPair | 18T-30T: backlash split evenly (worst side error, fraction) | 0.0198 | <= 0.0500 | pass |
| M7h | gearPair | 18T-30T: flank closed, contact held over a tooth cycle (/ m) | 4.2e-4 | <= 0.0020 | pass |
| M8a | idlerTrain | 20T-17T: centre distance = m(N1 + N2)/2 | 7.1e-15 | <= 1.0e-9 | pass |
| M8a | idlerTrain | 20T-17T: no interference over a tooth cycle (clearance) | 0.0564 | >= 0 | pass |
| M8a | idlerTrain | 20T-17T: backlash split evenly (worst side error, fraction) | 0.0176 | <= 0.0500 | pass |
| M8a | idlerTrain | 17T-32T: centre distance = m(N1 + N2)/2 | 0 | <= 1.0e-9 | pass |
| M8a | idlerTrain | 17T-32T: no interference over a tooth cycle (clearance) | 0.0564 | >= 0 | pass |
| M8a | idlerTrain | 17T-32T: backlash split evenly (worst side error, fraction) | 0.0255 | <= 0.0500 | pass |
| M8b | idlerTrain | output ratio = +N_in/N_out with idlers 17, 23, 31 and shipped | 0 | <= 1.0e-12 | pass |
| M9a | idlerTrain | tangent points on both rims and on the drawn path | 3.6e-15 | <= 1.0e-9 | pass |
| M9b | idlerTrain | runs perpendicular to both radii | 6.1e-16 | <= 1.0e-12 | pass |
| M9c | idlerTrain | both runs external (crossed runs) | 0 | = 0 | pass |
| M9d | idlerTrain | length = closed-form open-belt length | 5.7e-14 | <= 1.0e-9 | pass |
| M9e | idlerTrain | no slip: equal surface speed, same direction | 0 | <= 1.0e-12 | pass |
