/**
 * End-to-end signaling test: a real Socket.io server, real clients, no MongoDB
 * (the geospatial service is swapped for an in-memory double that implements
 * the same contract). This covers join, earshot negotiation, signalling relay,
 * radius exit/re-entry, disconnect cleanup and input validation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { io as createClient } from 'socket.io-client';

import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';
import { createServices } from '../src/services/index.js';
import { createSocketServer } from '../src/sockets/index.js';
import { mongoose } from '../src/db/mongo.js';
import { distancePx } from '../src/utils/geo.js';

mongoose.set('bufferTimeoutMS', 50); // no database in this suite; fail fast

const log = logger.child('test-socket');

/** In-memory stand-in for the MongoDB-backed GeospatialService. */
function createMemoryGeospatial(store) {
  const members = () => [...store.all()];
  return {
    async findPeersInRadius({ roomId, sessionId, x, y, radiusPx }) {
      return members()
        .filter((u) => u.roomId === roomId && u.id !== sessionId && distancePx(x, y, u.x, u.y) <= radiusPx)
        .map((u) => ({ ...u, sessionId: u.id, distanceMeters: distancePx(x, y, u.x, u.y) / 10, distancePx: distancePx(x, y, u.x, u.y) }))
        .sort((a, b) => a.distancePx - b.distancePx);
    },
    async countWithinRadius({ roomId, x, y, radiusPx }) {
      return members().filter((u) => u.roomId === roomId && distancePx(x, y, u.x, u.y) <= radiusPx).length;
    },
    async buildClusters({ roomId, clusterGapPx }) {
      const room = members().filter((u) => u.roomId === roomId);
      return {
        participants: room.length,
        clusters: room.map((u) => ({ id: u.id, size: 1, centroid: { x: u.x, y: u.y }, members: [{ sessionId: u.id }] })),
      };
    },
    async explainNear() {
      return { stage: 'GEO_NEAR', indexName: 'location_2dsphere', indexed: true, totalDocsExamined: 4, totalKeysExamined: 4, nReturned: 2 };
    },
    async hasGeoIndex() {
      return true;
    },
  };
}

async function startServer(cfg = config) {
  const services = createServices({ config: cfg, logger: log });
  services.geospatial = createMemoryGeospatial(services.store);

  const httpServer = http.createServer();
  httpServer.on('request', (req, res) => {
    res.writeHead(404).end();
  });
  const io = createSocketServer({ httpServer, services, redisBus: null, config: cfg, logger: log });
  httpServer.listen(0);
  await once(httpServer, 'listening');
  services.peerGraph.setEmitter((to, event, payload) => io.to(to).emit(event, payload));

  const { port } = httpServer.address();
  return {
    services,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      io.close();
      httpServer.close();
      await once(httpServer, 'close').catch(() => {});
    },
  };
}

function client(url) {
  return createClient(url, { transports: ['websocket'], reconnection: false, forceNew: true });
}

function waitFor(socket, event, predicate = () => true, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for "${event}"`));
    }, timeout);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

const join = (socket, payload) =>
  new Promise((resolve, reject) => {
    socket.emit('room:join', payload, (ack) => (ack?.ok ? resolve(ack) : reject(new Error(ack?.error ?? 'join failed'))));
  });

const emit = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, (ack) => resolve(ack)));

const move = async (socket, x, y, angle = 0) => emit(socket, 'position:update', { x, y, angle });
const ready = async (socket) => emit(socket, 'peer:media-ready', { micEnabled: true });

/** Listeners must be attached before the readiness broadcast that triggers them. */
const negotiatePair = async (a, b) => {
  const forA = waitFor(a, 'peer:negotiate');
  const forB = waitFor(b, 'peer:negotiate');
  await Promise.all([ready(a), ready(b)]);
  return Promise.all([forA, forB]);
};

async function withServer(run, cfg = config) {
  const server = await startServer(cfg);
  try {
    await run(server);
  } finally {
    await server.close();
  }
}

test('join returns the room blueprint and announces the newcomer', async () => {
  await withServer(async ({ services, url }) => {
    const a = client(url);
    const b = client(url);
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);

    const ackA = await join(a, { roomId: 'lobby', name: 'Ada', color: '#ff0000', spawn: { x: 500, y: 500 } });
    assert.equal(ackA.self.name, 'Ada');
    assert.ok(ackA.room.obstacles.length > 0, 'room obstacles are shipped on join');
    assert.equal(ackA.config.earshotRadiusPx, config.world.earshotRadiusPx);
    assert.deepEqual(ackA.config.iceServers, config.webrtc.iceServers);

    const joined = waitFor(a, 'peer:joined');
    const ackB = await join(b, { roomId: 'lobby', name: 'Bob', spawn: { x: 520, y: 500 } });
    assert.equal(ackB.peers.length, 1, 'the joiner receives the current snapshot');

    const event = await joined;
    assert.equal(event.peer.name, 'Bob');
    a.close();
    b.close();
    void services;
  });
});

test('two users inside earshot negotiate exactly once, one initiator', async () => {
  await withServer(async ({ url }) => {
    const a = client(url);
    const b = client(url);
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);

    await join(a, { roomId: 'lobby', name: 'Ada', spawn: { x: 500, y: 500 } });
    await join(b, { roomId: 'lobby', name: 'Bob', spawn: { x: 540, y: 500 } });

    const [payloadA, payloadB] = await negotiatePair(a, b);
    assert.notEqual(payloadA.initiator, payloadB.initiator);
    assert.equal(payloadA.generation, payloadB.generation);
    assert.equal(payloadA.peer.name, 'Bob');

    // Repeated reconciles must not open a second connection.
    let extra = 0;
    a.on('peer:negotiate', () => (extra += 1));
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.equal(extra, 0);

    a.close();
    b.close();
  });
});

test('signalling is relayed only between connected peers', async () => {
  await withServer(async ({ url }) => {
    const a = client(url);
    const b = client(url);
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    await join(a, { roomId: 'lobby', name: 'Ada', spawn: { x: 500, y: 500 } });
    await join(b, { roomId: 'lobby', name: 'Bob', spawn: { x: 520, y: 500 } });
    await negotiatePair(a, b);

    const inbound = waitFor(b, 'peer:signal', (p) => p.from);
    await emit(a, 'peer:signal', { to: b.id, data: { type: 'offer', sdp: 'v=0\r\n' } });
    const relayed = await inbound;
    assert.equal(relayed.data.type, 'offer');
    assert.equal(relayed.data.sdp, 'v=0\r\n');

    // A stranger (no edge) can never inject a signal into somebody's browser.
    let leaked = 0;
    b.on('peer:signal', () => (leaked += 1));
    const ack = await emit(a, 'peer:signal', { to: 'someone-with-no-edge', data: { type: 'offer', sdp: 'v=0' } });
    assert.equal(ack.ok, true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(leaked, 0);

    a.close();
    b.close();
  });
});

test('leaving the radius hangs the call up, re-entering renegotiates with a new generation', async () => {
  await withServer(async ({ url }) => {
    const a = client(url);
    const b = client(url);
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    await join(a, { roomId: 'lobby', name: 'Ada', spawn: { x: 500, y: 500 } });
    await join(b, { roomId: 'lobby', name: 'Bob', spawn: { x: 520, y: 500 } });
    const [first] = await negotiatePair(a, b);
    assert.equal(first.peer.name, 'Bob');

    // Walk 400px away: outside the 100px earshot circle.
    const hungUp = waitFor(b, 'peer:hangup', (p) => p.reason === 'out-of-range');
    await move(b, 900, 500);
    const hangup = await hungUp;
    assert.equal(hangup.generation, first.generation);

    // Walk back: a brand new negotiation with a strictly higher generation.
    const renegotiated = waitFor(a, 'peer:negotiate', (p) => p.generation > first.generation);
    await move(b, 505, 500);
    const second = await renegotiated;
    assert.ok(second.generation > first.generation);
    assert.equal(second.peer.name, 'Bob');

    a.close();
    b.close();
  });
});

test('a peer without microphone access is never connected', async () => {
  await withServer(async ({ url }) => {
    const a = client(url);
    const b = client(url);
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    await join(a, { roomId: 'lobby', name: 'Ada', spawn: { x: 500, y: 500 } });
    await join(b, { roomId: 'lobby', name: 'Bob', spawn: { x: 505, y: 500 } });

    let negotiated = 0;
    a.on('peer:negotiate', () => (negotiated += 1));
    await ready(a); // only Ada is ready
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(negotiated, 0, 'no negotiation without both microphones');

    const late = waitFor(a, 'peer:negotiate');
    await ready(b);
    await late;
    assert.equal(negotiated, 1);

    a.close();
    b.close();
  });
});

test('disconnect closes every mesh edge and notifies the room', async () => {
  await withServer(async ({ services, url }) => {
    const a = client(url);
    const b = client(url);
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    await join(a, { roomId: 'lobby', name: 'Ada', spawn: { x: 500, y: 500 } });
    await join(b, { roomId: 'lobby', name: 'Bob', spawn: { x: 510, y: 500 } });
    await negotiatePair(a, b);
    assert.equal(services.peerGraph.size, 1);

    // The server reports the socket.io disconnect reason ("client namespace
    // disconnect", "transport close", ...); what matters is the identity.
    // socket.io clears `socket.id` on disconnect, so capture it first.
    const bId = b.id;
    const left = waitFor(a, 'peer:left', (p) => p.id === bId);
    const hungUp = waitFor(a, 'peer:hangup', (p) => p.peerId === bId);
    b.close();

    assert.equal((await left).reason.length > 0, true);
    await hungUp;
    assert.equal(services.peerGraph.size, 0, 'no stale edges survive a disconnect');
    assert.equal(services.store.has(bId), false);

    a.close();
  });
});

test('position updates are validated, clamped and fanned out', async () => {
  await withServer(async ({ services, url }) => {
    const a = client(url);
    const b = client(url);
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    await join(a, { roomId: 'lobby', name: 'Ada', spawn: { x: 500, y: 500 } });
    await join(b, { roomId: 'lobby', name: 'Bob', spawn: { x: 900, y: 900 } });

    const moved = waitFor(b, 'presence:moved', (p) => p.id === a.id);
    const ack = await move(a, 520, 500, 1.25);
    assert.equal(ack.ok, true);
    assert.deepEqual({ x: ack.x, y: ack.y }, { x: 520, y: 500 });
    const event = await moved;
    assert.deepEqual({ x: event.x, y: event.y }, { x: 520, y: 500 });

    // Walk to the far edge in legal steps (the anti-teleport guard only credits
    // one throttle tick of travel per update).
    for (let x = 620; x <= 1900; x += 100) await move(a, x, 500);
    const clampedX = await move(a, 99999, 500);
    assert.equal(clampedX.x, config.world.width, 'x is clamped to the office width');
    assert.equal(clampedX.clamped, false, 'a legal step is not flagged as clamped');

    for (let y = 400; y >= 100; y -= 100) await move(a, config.world.width, y);
    const clampedY = await move(a, config.world.width, -50);
    assert.equal(clampedY.y, 0, 'y is clamped to the office height');

    // A teleport is refused: the avatar only moves as far as it could walk.
    const teleport = await move(a, 200, 200);
    assert.equal(teleport.clamped, true);
    assert.ok(services.store.get(a.id).x > 1700, 'position is pulled back to just before the edge');

    // Invalid input is rejected with a reason instead of crashing the server.
    const bad = await emit(a, 'position:update', { x: 'left', y: 10 });
    assert.equal(bad.ok, false);
    assert.equal(bad.field, 'x');

    a.close();
    b.close();
  });
});

test('furniture blocks movement, not just sound', async () => {
  await withServer(async ({ services, url }) => {
    const socket = client(url);
    await once(socket, 'connect');
    const room = await services.getRoom('lobby');
    const wall = room.obstacles[0];

    await join(socket, { roomId: 'lobby', name: 'Ada', spawn: { x: wall.x + wall.w / 2, y: wall.y - 40 } });
    await ready(socket);
    const ack = await move(socket, wall.x + wall.w / 2, wall.y + wall.h / 2);
    assert.equal(ack.ok, true);
    assert.equal(ack.hit, true, 'the move was resolved against the obstacle');
    const user = services.store.get(socket.id);
    const insideWall = user.x > wall.x && user.x < wall.x + wall.w && user.y > wall.y && user.y < wall.y + wall.h;
    assert.equal(insideWall, false, 'the avatar was pushed out of the wall');

    socket.close();
  });
});

test('a full room is rejected instead of silently degrading', async () => {
  const tinyRoom = { ...config, limits: { ...config.limits, maxUsersPerRoom: 1 } };
  await withServer(async ({ url }) => {
    const a = client(url);
    const b = client(url);
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);
    await join(a, { roomId: 'lobby', name: 'Ada', spawn: { x: 500, y: 500 } });
    const ack = await new Promise((resolve) => b.emit('room:join', { roomId: 'lobby', name: 'Bob' }, resolve));
    assert.equal(ack.ok, false);
    assert.match(ack.error, /full/);

    a.close();
    b.close();
  }, tinyRoom);
});