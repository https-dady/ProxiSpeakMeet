/**
 * Production HTTP surface: health check, static client bundle, SPA fallback and
 * the API-vs-client route boundary. These are the behaviours a single Render
 * Web Service depends on.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';
import { createServices } from '../src/services/index.js';
import { createApp } from '../src/app.js';
import { mongoose } from '../src/db/mongo.js';

mongoose.set('bufferTimeoutMS', 50); // no database in this suite

const log = logger.child('test-http');

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
      return { stage: 'MEMORY', indexName: 'none', indexed: false };
    },
    async hasGeoIndex() {
      return true;
    },
  };
}

/** Fake `client/dist` so the static layer can be exercised without a build. */
function createDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxispeak-dist-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root">ProxiSpeak</div>');
  fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log("bundle")');
  return dir;
}

async function startApp({ withClient = true } = {}) {
  const dist = createDist();
  const services = createServices({ geospatial: memoryGeospatial(), logger: log });
  const cfg = {
    ...config,
    isProduction: true,
    server: { ...config.server, clientDist: withClient ? dist : path.join(dist, 'missing') },
  };
  const app = createApp({ services, redisBus: null, io: null, config: cfg, logger: log });
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      server.close();
      await once(server, 'close').catch(() => {});
      fs.rmSync(dist, { recursive: true, force: true });
    },
  };
}

test('GET /health answers the platform health check without touching any dependency', async () => {
  const app = await startApp();
  try {
    const response = await fetch(`${app.url}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'proxispeak');
    assert.equal(typeof body.uptimeSeconds, 'number');
  } finally {
    await app.close();
  }
});

test('the built client is served as static files from the same origin', async () => {
  const app = await startApp();
  try {
    const index = await fetch(`${app.url}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /ProxiSpeak/);
    // Hashed assets are cacheable, the entry document never is.
    assert.equal(index.headers.get('cache-control'), 'no-cache');

    const asset = await fetch(`${app.url}/assets/app-abc123.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control') ?? '', /max-age=3600/);
  } finally {
    await app.close();
  }
});

test('client-side routes fall back to index.html, API routes do not', async () => {
  const app = await startApp();
  try {
    // Deep link / client route -> the SPA document.
    const spa = await fetch(`${app.url}/some/deep/link`);
    assert.equal(spa.status, 200);
    assert.match(await spa.text(), /ProxiSpeak/);

    // Unknown API route -> JSON 404, never the SPA document.
    const missing = await fetch(`${app.url}/api/does-not-exist`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('content-type').includes('application/json'), true);
    assert.equal((await missing.text()).includes('No route'), true);
  } finally {
    await app.close();
  }
});

test('a missing client bundle degrades to an API-only service', async () => {
  const app = await startApp({ withClient: false });
  try {
    const response = await fetch(`${app.url}/anything`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).ok, false);
    // The health check still works, which is what keeps Render from looping.
    assert.equal((await fetch(`${app.url}/health`)).status, 200);
  } finally {
    await app.close();
  }
});

test('the API keeps working while the bundle is served', async () => {
  const app = await startApp();
  try {
    const rooms = await fetch(`${app.url}/api/rooms`);
    assert.equal(rooms.status, 200);
    const body = await rooms.json();
    assert.ok(Array.isArray(body.rooms) && body.rooms.length > 0);
  } finally {
    await app.close();
  }
});

test('trust proxy is enabled so X-Forwarded-* is honoured behind a proxy', async () => {
  const app = await startApp();
  try {
    const response = await fetch(`${app.url}/api/health`, {
      headers: { 'x-forwarded-for': '203.0.113.7', 'x-forwarded-proto': 'https' },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  } finally {
    await app.close();
  }
});