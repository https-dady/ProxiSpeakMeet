/**
 * Room API integration tests.
 *
 * Verifies that the room catalogue and room-detail endpoints preserve the
 * layout fields required by the existing ProxiSpeak client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';
import { createServices } from '../src/services/index.js';
import { createApp } from '../src/app.js';
import { mongoose } from '../src/db/mongo.js';

mongoose.set('bufferTimeoutMS', 50);

const log = logger.child('test-rooms');

function memoryGeospatial() {
  return {
    async findPeersInRadius() {
      return [];
    },
    async countWithinRadius() {
      return 0;
    },
    async buildClusters() {
      return { participants: 0, clusters: [] };
    },
    async explainNear() {
      return {
        stage: 'MEMORY',
        indexName: 'none',
        indexed: false,
      };
    },
    async hasGeoIndex() {
      return true;
    },
  };
}

async function startApp() {
  const services = createServices({
    geospatial: memoryGeospatial(),
    logger: log,
  });

  const app = createApp({
    services,
    redisBus: null,
    io: null,
    config: {
      ...config,
      isProduction: false,
      server: {
        ...config.server,
        clientDist: '/non-existent-test-client-dist',
      },
    },
    logger: log,
  });

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');

  await once(server, 'listening');

  return {
    url: `http://127.0.0.1:${server.address().port}`,

    async close() {
      if (!server.listening) return;

      server.close();
      await once(server, 'close');
    },
  };
}

function assertRoomLayout(room) {
  assert.equal(typeof room.roomId, 'string');
  assert.equal(typeof room.name, 'string');
  assert.equal(typeof room.description, 'string');

  assert.ok(Number.isFinite(room.width));
  assert.ok(Number.isFinite(room.height));
  assert.ok(room.width >= 200);
  assert.ok(room.height >= 200);

  assert.ok(Array.isArray(room.obstacles));
  assert.ok(Array.isArray(room.spawnPoints));

  for (const obstacle of room.obstacles) {
    assert.equal(typeof obstacle.id, 'string');
    assert.equal(typeof obstacle.type, 'string');

    for (const field of ['x', 'y', 'w', 'h', 'attenuation']) {
      assert.ok(
        Number.isFinite(obstacle[field]),
        `Obstacle field "${field}" must be finite`,
      );
    }

    assert.equal(typeof obstacle.blocksAudio, 'boolean');
    assert.ok(obstacle.x >= 0);
    assert.ok(obstacle.y >= 0);
    assert.ok(obstacle.w > 0);
    assert.ok(obstacle.h > 0);
    assert.ok(obstacle.x + obstacle.w <= room.width);
    assert.ok(obstacle.y + obstacle.h <= room.height);
    assert.ok(obstacle.attenuation >= 0 && obstacle.attenuation <= 1);
  }

  for (const point of room.spawnPoints) {
    assert.ok(Number.isFinite(point.x));
    assert.ok(Number.isFinite(point.y));
    assert.ok(point.x >= 0 && point.x <= room.width);
    assert.ok(point.y >= 0 && point.y <= room.height);
  }
}

test('GET /api/rooms returns complete room layouts and live-user counts', async () => {
  const app = await startApp();

  try {
    const response = await fetch(`${app.url}/api/rooms`);

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.ok(Array.isArray(body.rooms));
    assert.ok(body.rooms.length > 0);

    for (const entry of body.rooms) {
      assertRoomLayout(entry);
      assert.ok(Number.isInteger(entry.liveUsers));
      assert.ok(entry.liveUsers >= 0);
    }
  } finally {
    await app.close();
  }
});

test('GET /api/rooms/:roomId returns a complete room layout', async () => {
  const app = await startApp();

  try {
    const response = await fetch(`${app.url}/api/rooms/lobby`);

    assert.equal(response.status, 200);

    const body = await response.json();

    assertRoomLayout(body.room);
    assert.equal(body.room.roomId, 'lobby');
    assert.ok(Number.isInteger(body.liveUsers));
    assert.ok(body.liveUsers >= 0);
  } finally {
    await app.close();
  }
});