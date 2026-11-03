// verify(): run every check suite against a set of models and report.
//
// The demo page calls this on load with the exact models it animates.

import { defaultModels } from './defaults.js';
import { checkScotchYoke, checkCrankSlider, checkCamFollower, checkFourBar } from './checks/linkages.js';
import { checkGeneva } from './checks/geneva.js';
import { checkRatchet } from './checks/ratchet.js';
import { checkGearPair, checkIdlerTrain, checkBelt } from './checks/gears.js';

export const CHECKS = {
  scotchYoke: { title: 'Scotch yoke', run: checkScotchYoke },
  crankSlider: { title: 'Crank-slider', run: checkCrankSlider },
  geneva: { title: 'Geneva drive', run: checkGeneva },
  camFollower: { title: 'Eccentric cam and follower', run: checkCamFollower },
  ratchet: { title: 'Ratchet and pawl', run: checkRatchet },
  fourBar: { title: 'Four-bar linkage', run: checkFourBar },
  gearPair: { title: 'Involute gear pair', run: checkGearPair },
  idlerTrain: { title: 'Idler train and belt', run: (m) => [...checkIdlerTrain(m.train), ...checkBelt(m.belt)] },
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function verify(models = defaultModels(), only = null) {
  const results = [];
  const timing = {};
  for (const [key, spec] of Object.entries(CHECKS)) {
    if (!models[key] || (only && !only.includes(key))) continue;
    const t0 = now();
    for (const r of spec.run(models[key])) results.push({ mechanism: key, ...r });
    timing[key] = now() - t0;
  }
  const failed = results.filter((r) => !r.pass);
  return { pass: failed.length === 0, total: results.length, passed: results.length - failed.length, failed, results, timing };
}
