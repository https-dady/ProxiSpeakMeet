import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gainAtDistance,
  panAtDistance,
  lateralOffset,
  lowpassFor,
  distanceRatio,
  smoothstep,
} from '../src/audio/spatialMath.js';
import { soundFactorBetween } from '../src/audio/occlusion.js';
import { desiredDirection, resolveCollision, approach } from '../src/canvas/physics.js';

const EARSHOT = 100;
const FULL = 35;

test('gain is 1 inside the full-volume radius and 0 at the earshot edge', () => {
  assert.equal(gainAtDistance(0, { earshotPx: EARSHOT, fullVolumePx: FULL }), 1);
  assert.equal(gainAtDistance(FULL, { earshotPx: EARSHOT, fullVolumePx: FULL }), 1);
  assert.equal(gainAtDistance(EARSHOT, { earshotPx: EARSHOT, fullVolumePx: FULL }), 0);
  assert.equal(gainAtDistance(150, { earshotPx: EARSHOT, fullVolumePx: FULL }), 0);
});

test('the fall-off is monotonic and smooth (no audible step)', () => {
  let previous = Infinity;
  for (let d = FULL; d <= EARSHOT; d += 1) {
    const gain = gainAtDistance(d, { earshotPx: EARSHOT, fullVolumePx: FULL });
    assert.ok(gain <= previous + 1e-12, `gain must not increase at ${d}px`);
    previous = gain;
  }
  // Halfway through the transition is close to half volume.
  const middle = gainAtDistance((FULL + EARSHOT) / 2, { earshotPx: EARSHOT, fullVolumePx: FULL });
  assert.ok(Math.abs(middle - 0.5) < 0.02, `expected ~0.5, got ${middle}`);
});

test('sound factor scales the whole curve', () => {
  assert.equal(gainAtDistance(10, { earshotPx: EARSHOT, fullVolumePx: FULL, soundFactor: 0.1 }), 0.1);
  const muffled = gainAtDistance(60, { earshotPx: EARSHOT, fullVolumePx: FULL, soundFactor: 0.25 });
  const open = gainAtDistance(60, { earshotPx: EARSHOT, fullVolumePx: FULL });
  assert.ok(muffled < open);
});

test('stereo pan follows the listener facing direction', () => {
  // Facing +x (east). A peer to the south (+y) is in the right ear.
  assert.ok(panAtDistance({ dx: 0, dy: 80, distancePx: 80, listenerAngle: 0 }) > 0.5);
  assert.ok(panAtDistance({ dx: 0, dy: -80, distancePx: 80, listenerAngle: 0 }) < -0.5);
  // Facing south (+y): the peer straight ahead is now centred...
  assert.ok(Math.abs(panAtDistance({ dx: 0, dy: 80, distancePx: 80, listenerAngle: Math.PI / 2 })) < 1e-9);
  // ...and a peer to the west is on the right-hand side.
  assert.ok(panAtDistance({ dx: -80, dy: 0, distancePx: 80, listenerAngle: Math.PI / 2 }) > 0.5);
  // Directly ahead is centred.
  assert.equal(panAtDistance({ dx: 80, dy: 0, distancePx: 80, listenerAngle: 0 }), 0);
});

test('a peer outside earshot is silent and centred', () => {
  const pan = panAtDistance({ dx: 400, dy: 0, distancePx: 400, listenerAngle: 0, earshotPx: EARSHOT });
  assert.equal(pan, 0);
});

test('lateral offset is the projection onto the right-hand vector', () => {
  assert.equal(lateralOffset({ dx: 0, dy: 10, listenerAngle: 0 }), 10);
  // Facing south, "right" is west (-x), so a peer 10px east is on the left.
  assert.equal(lateralOffset({ dx: 10, dy: 0, listenerAngle: Math.PI / 2 }), -10);
});

test('lowpass closes as distance and occlusion increase', () => {
  const near = lowpassFor({ distancePx: 5, earshotPx: EARSHOT, soundFactor: 1 });
  const far = lowpassFor({ distancePx: 95, earshotPx: EARSHOT, soundFactor: 1 });
  const throughWall = lowpassFor({ distancePx: 5, earshotPx: EARSHOT, soundFactor: 0.05 });
  assert.ok(near > far, 'air absorption must roll off the top end');
  assert.ok(throughWall < near, 'a wall must take away more high end');
  assert.ok(throughWall >= 220 && near <= 20000);
});

test('smoothstep and distanceRatio clamp their input', () => {
  assert.equal(smoothstep(-1), 0);
  assert.equal(smoothstep(2), 1);
  assert.equal(distanceRatio(500, EARSHOT), 1);
  assert.equal(distanceRatio(-5, EARSHOT), 0);
});

test('furniture between two avatars attenuates them', () => {
  const wall = [{ id: 'w', x: 100, y: 100, w: 50, h: 50, blocksAudio: true, attenuation: 0.2 }];
  assert.equal(soundFactorBetween({ x: 50, y: 125 }, { x: 200, y: 125 }, wall).soundFactor, 0.2);
  assert.equal(soundFactorBetween({ x: 50, y: 50 }, { x: 200, y: 50 }, wall).soundFactor, 1);
  const open = { ...wall[0], blocksAudio: false };
  assert.equal(soundFactorBetween({ x: 50, y: 125 }, { x: 200, y: 125 }, [open]).soundFactor, 1);
});

test('keyboard input maps to a normalised direction', () => {
  const keys = new Set(['KeyW', 'KeyD']);
  const dir = desiredDirection(keys, null, { x: 0, y: 0 });
  assert.ok(Math.abs(dir.dx - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(dir.dy + Math.SQRT1_2) < 1e-9);
});

test('click-to-move stops when the target is reached', () => {
  const dir = desiredDirection(new Set(), { x: 110, y: 0 }, { x: 100, y: 0 });
  assert.equal(dir.arrived, false);
  assert.equal(dir.dx, 1);
  assert.equal(desiredDirection(new Set(), { x: 101, y: 0 }, { x: 100, y: 0 }).arrived, true);
});

test('the avatar cannot walk into furniture', () => {
  const solids = [{ id: 'desk', x: 100, y: 100, w: 100, h: 100 }];
  const pushed = resolveCollision(95, 150, 14, solids);
  assert.equal(pushed.x, 86);
  assert.equal(pushed.hit, true);
  assert.deepEqual(resolveCollision(400, 400, 14, solids), { x: 400, y: 400, hit: false });
});

test('acceleration is frame-rate independent', () => {
  // Half the time, half the delta -> the same distance covered.
  let velocity = 0;
  for (let i = 0; i < 10; i += 1) velocity = approach(velocity, 400, 200 * 0.05);
  const oneBigStep = approach(0, 400, 200 * 0.5);
  assert.ok(Math.abs(velocity - oneBigStep) < 1e-9);
});