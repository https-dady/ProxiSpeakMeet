import test from 'node:test';
import assert from 'node:assert/strict';

import { ValidationError } from '../src/utils/errors.js';
import {
  requireActiveRoomMembership,
} from '../src/sockets/membership.js';

const roomId = 'lobby';
const socketId = 'socket-123';

function fixture(overrides = {}) {
  const user = {
    id: socketId,
    roomId,
    name: 'Ada',
  };

  const socket = {
    id: socketId,
    data: {
      userId: socketId,
      roomId,
    },
    rooms: new Set([socketId, roomId]),
  };

  const store = {
    get: (id) => (
      id === socketId ? user : undefined
    ),
  };

  return {
    identity: { roomId },
    socket,
    store,
    ...overrides,
  };
}

function assertMembershipRejected(
  context,
  expectedMessage,
) {
  assert.throws(
    () => requireActiveRoomMembership(context),
    (error) => {
      assert.ok(error instanceof ValidationError);

      assert.match(
        error.message,
        expectedMessage,
      );

      return true;
    },
  );
}

test(
  'accepts consistent active room membership',
  () => {
    const context = fixture();

    const result = requireActiveRoomMembership(
      context,
    );

    assert.equal(result.roomId, roomId);
    assert.equal(result.user.id, socketId);
  },
);

test(
  'rejects sockets that have not joined a room',
  () => {
    assertMembershipRejected(
      fixture({ identity: null }),
      /join a room first/,
    );
  },
);

test(
  'rejects sockets no longer in the Socket.IO room',
  () => {
    const context = fixture();

    context.socket.rooms.delete(roomId);

    assertMembershipRejected(
      context,
      /active room membership is required/,
    );
  },
);

test(
  'rejects mismatched socket room metadata',
  () => {
    const context = fixture();

    context.socket.data.roomId = 'another-room';

    assertMembershipRejected(
      context,
      /active room membership is required/,
    );
  },
);

test(
  'rejects missing presence records',
  () => {
    const context = fixture();

    context.store.get = () => undefined;

    assertMembershipRejected(
      context,
      /active room membership is required/,
    );
  },
);

test(
  'rejects presence records belonging to another room',
  () => {
    const context = fixture();

    context.store.get = () => ({
      id: socketId,
      roomId: 'another-room',
    });

    assertMembershipRejected(
      context,
      /active room membership is required/,
    );
  },
);