import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAuthorizedPeerSignalEdge,
} from '../src/sockets/signalingAuthorization.js';

const roomId = 'lobby';
const senderId = 'socket-a';
const recipientId = 'socket-b';

function createContext({
  senderRoom = roomId,
  recipientRoom = roomId,
  edgeRoom = roomId,
  includeSender = true,
  includeRecipient = true,
  includeEdge = true,
} = {}) {
  const users = new Map();

  if (includeSender) {
    users.set(senderId, {
      id: senderId,
      roomId: senderRoom,
    });
  }

  if (includeRecipient) {
    users.set(recipientId, {
      id: recipientId,
      roomId: recipientRoom,
    });
  }

  const edge = {
    a: senderId,
    b: recipientId,
    roomId: edgeRoom,
    generation: 7,
    state: 'pending',
  };

  return {
    senderId,
    recipientId,
    roomId,

    store: {
      get: (id) => users.get(id),
    },

    peerGraph: {
      edge: () => (
        includeEdge ? edge : null
      ),
    },
  };
}

test(
  'authorizes peers with active presence in the same room',
  () => {
    const context = createContext();

    const edge = getAuthorizedPeerSignalEdge(
      context,
    );

    assert.ok(edge);
    assert.equal(edge.roomId, roomId);
    assert.equal(edge.generation, 7);
  },
);

test(
  'rejects a recipient in another room',
  () => {
    const context = createContext({
      recipientRoom: 'private-room',
    });

    assert.equal(
      getAuthorizedPeerSignalEdge(context),
      null,
    );
  },
);

test(
  'rejects a sender whose presence does not match the room',
  () => {
    const context = createContext({
      senderRoom: 'private-room',
    });

    assert.equal(
      getAuthorizedPeerSignalEdge(context),
      null,
    );
  },
);

test(
  'rejects missing sender presence',
  () => {
    const context = createContext({
      includeSender: false,
    });

    assert.equal(
      getAuthorizedPeerSignalEdge(context),
      null,
    );
  },
);

test(
  'rejects missing recipient presence',
  () => {
    const context = createContext({
      includeRecipient: false,
    });

    assert.equal(
      getAuthorizedPeerSignalEdge(context),
      null,
    );
  },
);

test(
  'rejects missing PeerGraph edges',
  () => {
    const context = createContext({
      includeEdge: false,
    });

    assert.equal(
      getAuthorizedPeerSignalEdge(context),
      null,
    );
  },
);

test(
  'rejects a PeerGraph edge belonging to another room',
  () => {
    const context = createContext({
      edgeRoom: 'private-room',
    });

    assert.equal(
      getAuthorizedPeerSignalEdge(context),
      null,
    );
  },
);

test(
  'rejects incomplete authorization context',
  () => {
    assert.equal(
      getAuthorizedPeerSignalEdge({
        senderId,
        recipientId,
        roomId,
      }),
      null,
    );
  },
);