import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRoomJoin, validatePosition, validateSignal, validateMediaState } from '../src/sockets/validation.js';
import config from '../src/config/index.js';

const world = config.world;

test('room join normalises and bounds the payload', () => {
  const parsed = validateRoomJoin(
    { roomId: ' Studio-1 ', name: '  Ada  ', color: '#ff8800', avatar: 'square' },
    { world },
  );
  assert.deepEqual(parsed, { roomId: 'studio-1', name: 'Ada', color: '#ff8800', avatar: 'square', spawn: null });
});

test('room join rejects nonsense', () => {
  assert.throws(() => validateRoomJoin({ roomId: '../../etc/passwd' }, { world }), /roomId/);
  assert.throws(() => validateRoomJoin({ name: 'x'.repeat(200) }, { world }), /name/);
  assert.throws(() => validateRoomJoin({ color: 'red' }, { world }), /color/);
});

test('positions are clamped into the world', () => {
  const next = validatePosition({ x: 99999, y: -50 }, { world, previous: null, maxSpeedPxPerSec: 900, now: Date.now() });
  assert.equal(next.x, world.width);
  assert.equal(next.y, 0);
});

test('a client cannot teleport across the office', () => {
  const previous = { x: 100, y: 100, angle: 0, updatedAt: Date.now() };
  const now = previous.updatedAt + 100; // 100ms later
  const next = validatePosition({ x: 1800, y: 100 }, { world, previous, maxSpeedPxPerSec: 900, now });
  // 900px/s for 0.1s = 90px, plus 35% jitter tolerance = 121.5px of travel.
  assert.ok(next.x < 260, `expected a clamped x, got ${next.x}`);
  assert.equal(next.clamped, true);
});

test('normal movement passes through untouched', () => {
  const previous = { x: 100, y: 100, angle: 0, updatedAt: Date.now() };
  const now = previous.updatedAt + 100;
  const next = validatePosition({ x: 140, y: 130, angle: 7.5 }, { world, previous, maxSpeedPxPerSec: 900, now });
  assert.deepEqual({ x: next.x, y: next.y }, { x: 140, y: 130 });
  assert.ok(next.angle >= 0 && next.angle < Math.PI * 2, 'angle is normalised to [0, 2pi)');
});

test('signals are restricted to the three WebRTC message types', () => {
  assert.deepEqual(validateSignal({ to: 'peer-1', data: { type: 'offer', sdp: 'v=0' } }), {
    to: 'peer-1',
    data: { type: 'offer', sdp: 'v=0' },
  });
  assert.deepEqual(validateSignal({ to: 'peer-1', data: { type: 'candidate', candidate: null } }).data, {
    type: 'candidate',
    candidate: null,
  });
  assert.throws(() => validateSignal({ to: 'peer-1', data: { type: 'hangup' } }), /offer \| answer \| candidate/);
  assert.throws(() => validateSignal({ to: 'peer-1', data: { type: 'offer' } }), /sdp/);
  assert.throws(() => validateSignal({ data: { type: 'offer', sdp: 'v=0' } }), /"to"/);
  assert.throws(() => validateSignal({ to: 'p', data: { type: 'offer', sdp: 'x'.repeat(200 * 1024) } }), /too large/);
});

test('media state defaults to an enabled microphone', () => {
  assert.deepEqual(validateMediaState({}), { micEnabled: true });
  assert.deepEqual(validateMediaState({ micEnabled: false }), { micEnabled: false });
});