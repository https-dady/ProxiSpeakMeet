import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateRoomJoin,
  validatePosition,
  validateSignal,
  validateMediaState,
} from '../src/sockets/validation.js';

import config from '../src/config/index.js';

const world = config.world;

test('room join normalises and bounds the payload', () => {
  const parsed = validateRoomJoin({
    roomId: ' Studio-1 ',
    name: '  Ada  ',
    color: '#ff8800',
    avatar: 'square',
  }, { world });

  assert.deepEqual(parsed, {
    roomId: 'studio-1',
    name: 'Ada',
    color: '#ff8800',
    avatar: 'square',
    spawn: null,
  });
});

test('room join retains documented defaults when optional fields are omitted', () => {
  assert.deepEqual(validateRoomJoin({}, { world }), {
    roomId: 'lobby',
    name: 'Guest',
    color: '#4f8cff',
    avatar: 'circle',
    spawn: null,
  });
});

test('room join rejects malformed payloads and invalid field values', () => {
  assert.throws(
    () => validateRoomJoin('lobby', { world }),
    /payload.*object/i,
  );

  assert.throws(
    () => validateRoomJoin({ roomId: '../../etc/passwd' }, { world }),
    /roomId/,
  );

  assert.throws(
    () => validateRoomJoin({ name: 'x'.repeat(200) }, { world }),
    /name/,
  );

  assert.throws(
    () => validateRoomJoin({ color: 'red' }, { world }),
    /color/,
  );

  assert.throws(
    () => validateRoomJoin({ avatar: 'dragon' }, { world }),
    /avatar/,
  );

  assert.throws(
    () => validateRoomJoin({ spawn: { x: 1, y: '2' } }, { world }),
    /spawn\.y/,
  );
});

test('positions are clamped into the supplied room dimensions', () => {
  const next = validatePosition(
    { x: 99999, y: -50 },
    {
      world,
      previous: null,
      maxSpeedPxPerSec: 900,
      now: Date.now(),
    },
  );

  assert.equal(next.x, world.width);
  assert.equal(next.y, 0);
});

test('position validation rejects malformed payloads and invalid validator state', () => {
  assert.throws(
    () => validatePosition([], {
      world,
      previous: null,
      maxSpeedPxPerSec: 900,
      now: Date.now(),
    }),
    /payload.*object/i,
  );

  assert.throws(
    () => validatePosition({ x: 1, y: 2 }, {
      world,
      previous: null,
      maxSpeedPxPerSec: -1,
      now: Date.now(),
    }),
    /max movement speed/,
  );
});

test('a client cannot teleport across the office', () => {
  const previous = {
    x: 100,
    y: 100,
    angle: 0,
    updatedAt: Date.now(),
  };

  const now = previous.updatedAt + 100;

  const next = validatePosition(
    { x: 1800, y: 100 },
    {
      world,
      previous,
      maxSpeedPxPerSec: 900,
      now,
    },
  );

  assert.ok(next.x < 260, `expected a clamped x, got ${next.x}`);
  assert.equal(next.clamped, true);
});

test('normal movement passes through and normalizes angle', () => {
  const previous = {
    x: 100,
    y: 100,
    angle: 0,
    updatedAt: Date.now(),
  };

  const now = previous.updatedAt + 100;

  const next = validatePosition(
    { x: 140, y: 130, angle: 7.5 },
    {
      world,
      previous,
      maxSpeedPxPerSec: 900,
      now,
    },
  );

  assert.deepEqual(
    { x: next.x, y: next.y },
    { x: 140, y: 130 },
  );

  assert.ok(next.angle >= 0 && next.angle < Math.PI * 2);
});

test('signals normalize valid offers, answers, and end-of-candidates markers', () => {
  assert.deepEqual(validateSignal({
    to: 'peer-1',
    data: {
      type: 'offer',
      sdp: 'v=0',
    },
  }), {
    to: 'peer-1',
    data: {
      type: 'offer',
      sdp: 'v=0',
    },
  });

  assert.deepEqual(validateSignal({
    to: 'peer-1',
    data: {
      type: 'answer',
      sdp: 'v=0',
    },
  }).data, {
    type: 'answer',
    sdp: 'v=0',
  });

  assert.deepEqual(validateSignal({
    to: 'peer-1',
    data: {
      type: 'candidate',
      candidate: null,
    },
  }).data, {
    type: 'candidate',
    candidate: null,
  });
});

test('signals validate payload shape, type, SDP, ICE fields, and size', () => {
  assert.throws(
    () => validateSignal([]),
    /payload.*object/i,
  );

  assert.throws(
    () => validateSignal({
      to: 'peer-1',
      data: { type: 'hangup' },
    }),
    /offer \| answer \| candidate/,
  );

  assert.throws(
    () => validateSignal({
      to: 'peer-1',
      data: { type: 'offer' },
    }),
    /sdp/,
  );

  assert.throws(
    () => validateSignal({
      to: 'peer-1',
      data: {
        type: 'offer',
        sdp: '   ',
      },
    }),
    /sdp/,
  );

  assert.throws(
    () => validateSignal({
      data: {
        type: 'offer',
        sdp: 'v=0',
      },
    }),
    /"to"/,
  );

  assert.throws(
    () => validateSignal({
      to: 'peer-1',
      data: {
        type: 'offer',
        sdp: 'x'.repeat(200 * 1024),
      },
    }),
    /too large/,
  );

  assert.throws(
    () => validateSignal({
      to: 'peer-1',
      data: {
        type: 'candidate',
        candidate: { candidate: 42 },
      },
    }),
    /candidate.*string/i,
  );

  assert.throws(
    () => validateSignal({
      to: 'peer-1',
      data: {
        type: 'candidate',
        candidate: {
          candidate: 'candidate:1',
          sdpMLineIndex: -1,
        },
      },
    }),
    /non-negative integer/i,
  );
});

test('media state defaults safely and rejects non-boolean microphone flags', () => {
  assert.deepEqual(validateMediaState({}), {
    micEnabled: true,
  });

  assert.deepEqual(validateMediaState({ micEnabled: false }), {
    micEnabled: false,
  });

  assert.throws(
    () => validateMediaState({ micEnabled: 'false' }),
    /must be a boolean/i,
  );

  assert.throws(
    () => validateMediaState([]),
    /payload.*object/i,
  );
});