// Eccentric (circular) cam with a flat-faced translating follower.
//
// The cam is a circle of radius R whose centre is offset e from the shaft. A
// flat face resting on it sits exactly R above the cam centre, so the follower
// moves as e sin(theta): simple harmonic motion with a total lift of 2e.
// Kinematically it is a Scotch yoke in disguise.
//
// Frame: shaft at the origin, follower axis along y, face above the cam
// (negative y is up on screen).

import { polar, circle } from './geom.js';

export function camFollower({ R = 30, e = 11, faceW = 64, stemLen = 46 } = {}) {
  if (e >= R) throw new Error('cam: eccentricity must be smaller than the cam radius');
  return {
    kind: 'camFollower',
    params: { R, e },
    geometry: { faceW, stemLen, faceT: 6, outline: circle([e, 0], R, 180) },
    pose(theta) {
      const camCentre = polar(e, theta);
      const faceY = camCentre[1] - R;      // face rests on the highest point
      return { theta, camCentre, faceY, follower: [0, faceY], contact: [camCentre[0], faceY] };
    },
  };
}
