// The designs the demo animates and verify() checks by default.

import { scotchYoke } from './scotch-yoke.js';
import { crankSlider } from './crank-slider.js';
import { geneva } from './geneva.js';
import { camFollower } from './cam-follower.js';
import { ratchet } from './ratchet.js';
import { fourBar } from './four-bar.js';
import { spurGear, gearPair, gearTrain } from './gears.js';
import { openBelt } from './belt.js';

export function defaultModels() {
  // Gear pair: 18 and 30 teeth, module 4, 0.04 m of backlash.
  const pinion = spurGear({ N: 18, m: 4, backlash: 0.16 });
  const wheel = spurGear({ N: 30, m: 4, backlash: 0.16 });

  // Idler train into an open belt. The idler sits off the line of centres,
  // which is the usual reason to have one: to bridge a gap or turn a corner
  // without changing the ratio.
  const m = 3, B = 0.12;
  const train = gearTrain(
    [spurGear({ N: 20, m, backlash: B }), spurGear({ N: 17, m, backlash: B }), spurGear({ N: 32, m, backlash: B })],
    [-0.5, 0.42],
  );
  const out = train.centres[2];
  const belt = openBelt(out, 24, [out[0] - 132, out[1] + 62], 13);

  return {
    scotchYoke: scotchYoke(),
    crankSlider: crankSlider(),
    geneva: geneva(),
    camFollower: camFollower(),
    ratchet: ratchet(),
    fourBar: fourBar(),
    gearPair: gearPair(pinion, wheel, 0),
    idlerTrain: { train, belt, beltOn: 2 },
  };
}

