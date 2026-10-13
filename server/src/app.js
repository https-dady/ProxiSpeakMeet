/**
 * Express surface: health, room catalogue, live stats and the Spatial Audit
 * endpoint used by the mid-project review.
 */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import config, { SERVER_ROOT } from './config/index.js';
import logger from './utils/logger.js';
import { requireString, requireFiniteNumber, clamp } from './utils/validate.js';
import { ValidationError, NotFoundError } from './utils/errors.js';
import { requireRoom } from './services/roomService.js';
import { corsOrigin } from './utils/origin.js';

export function createApp({ services, redisBus, io, config: cfg = config, logger: log = logger }) {
  const app = express();
  app.disable('x-powered-by');
  // Render terminates TLS at its proxy and forwards X-Forwarded-Proto; trusting
  // one hop keeps req.ip / protocol and rate-limit-style checks truthful.
  app.set('trust proxy', 1);
  app.use(cors({ origin: corsOrigin(cfg) }));
  app.use(express.json({ limit: '64kb' }));

  const startedAt = Date.now();

  /**
   * Liveness endpoint used by the Render health check. Deliberately free of
   * MongoDB/Redis calls so a blip in a backing service never marks a healthy
   * process as dead (and never causes the platform to restart it).
   */
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'proxispeak',
      instanceId: cfg.server.instanceId,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      scaleMode: redisBus?.mode ?? 'single',
      time: new Date().toISOString(),
    });
  });

  app.get('/api/health', async (req, res) => {
    const indexed = await services.geospatial.hasGeoIndex().catch(() => false);
    res.json({
      ok: true,
      status: 'healthy',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      instanceId: cfg.server.instanceId,
      scaleMode: redisBus?.mode ?? 'single',
      database: { uri: redact(cfg.mongo.uri), geoIndex: indexed, queryMode: cfg.spatial.queryMode },
      redis: { url: cfg.redis.url ? redact(cfg.redis.url) : null, mode: redisBus?.mode ?? 'single' },
      presence: { users: services.store.size(), dirty: services.store.dirtyCount() },
      mesh: services.peerGraph.stats(),
    });
  });

  app.get('/api/stats', (req, res) => {
    const users = [...services.store.all()];
    const byRoom = new Map();
    for (const user of users) byRoom.set(user.roomId, (byRoom.get(user.roomId) ?? 0) + 1);
    res.json({
      instanceId: cfg.server.instanceId,
      scaleMode: redisBus?.mode ?? 'single',
      users: users.length,
      byRoom: Object.fromEntries(byRoom),
      mesh: services.peerGraph.stats(),
      edges: services.peerGraph.snapshot().map((edge) => ({
        a: edge.a,
        b: edge.b,
        state: edge.state,
        soundFactor: Number(edge.soundFactor.toFixed(3)),
        generation: edge.generation,
      })),
    });
  });

  app.get('/api/rooms', async (req, res, next) => {
    try {
      const rooms = await services.listRooms();
      const live = new Map();
      for (const user of services.store.all()) live.set(user.roomId, (live.get(user.roomId) ?? 0) + 1);
      res.json({
        rooms: rooms.map((room) => ({ ...room, liveUsers: live.get(room.roomId) ?? 0 })),
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/rooms/:roomId', async (req, res, next) => {
    try {
      const roomId = requireString(req.params.roomId, 'roomId', { min: 1, max: 48 }).toLowerCase();
      const room = await requireRoom(roomId);
      const live = services.store.byRoom(roomId).length;
      res.json({ room, liveUsers: live });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/spatial-audit?roomId=lobby&x=960&y=540&radius=100&samples=25
   *
   * Returns the full audit report: per-operator timings against the 20 ms
   * budget, an accuracy cross-check and the winning query plan.
   */
  const runAudit = async (req, res, next) => {
    try {
      const params = { ...req.query, ...(req.body ?? {}) };
      const roomId = requireString(params.roomId ?? 'lobby', 'roomId', { min: 1, max: 48 }).toLowerCase();
      const room = await requireRoom(roomId);
      const x = clamp(requireFiniteNumber(Number(params.x ?? room.width / 2), 'x', { min: 0, max: cfg.world.width }), 0, cfg.world.width);
      const y = clamp(requireFiniteNumber(Number(params.y ?? room.height / 2), 'y', { min: 0, max: cfg.world.height }), 0, cfg.world.height);
      const radiusPx = clamp(
        requireFiniteNumber(Number(params.radius ?? cfg.world.earshotRadiusPx), 'radius', { min: 1, max: cfg.world.earshotRadiusPx * 5 }),
        1,
        cfg.world.earshotRadiusPx * 5,
      );
      const samples = clamp(
        Number(params.samples ?? cfg.limits.auditSamples) || cfg.limits.auditSamples,
        1,
        cfg.limits.auditSamples,
      );

      const report = await services.audit.run({
        roomId,
        x,
        y,
        radiusPx,
        samples,
        includeClusters: params.clusters !== 'false' && params.clusters !== false,
        includeExplain: params.explain !== 'false' && params.explain !== false,
        source: 'http',
        instanceId: cfg.server.instanceId,
      });

      // Surface every completed audit on every connected client (this is the
      // part that visibly proves the Redis fan-out across instances).
      io?.to(roomId).emit('audit:completed', {
        roomId,
        at: report.at,
        p95Ms: report.queries.near.p95Ms,
        withinBudget: report.withinBudget,
        matched: report.accuracy.matchedPeers,
        instanceId: cfg.server.instanceId,
      });
      redisBus?.publish({ type: 'audit:completed', payload: { roomId, report }, at: Date.now() });

      res.status(report.ok ? 200 : 503).json(report);
    } catch (err) {
      next(err);
    }
  };

  app.get('/api/spatial-audit', runAudit);
  app.post('/api/spatial-audit', runAudit);

  app.get('/api/spatial-audit/history', async (req, res, next) => {
    try {
      const roomId = requireString(req.query.roomId ?? 'lobby', 'roomId', { min: 1, max: 48 }).toLowerCase();
      res.json(await services.audit.history(roomId, clamp(Number(req.query.limit ?? 20) || 20, 1, 100)));
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------
  // Static client bundle (single Web Service: one process, one port).
  // Registered AFTER the API routes so /api/* can never be swallowed, and the
  // SPA fallback only answers GET/HEAD for client-side routes. Socket.io
  // requests (/socket.io/*) never reach Express — the Socket.io server
  // intercepts them on the same HTTP server.
  // ---------------------------------------------------------------------
  const clientDist = resolveClientDist(cfg);
  const hasClientBundle = fs.existsSync(path.join(clientDist, 'index.html'));

  if (hasClientBundle) {
    app.use(
      express.static(clientDist, {
        index: false,
        maxAge: cfg.isProduction ? '1h' : 0,
        setHeaders(res, filePath) {
          // Never cache the entry document itself, or a deploy leaves clients
          // pointing at hashed assets that no longer exist.
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );

    // The entry document is read once at boot: it never changes while the
    // process is alive (a deploy restarts us), and caching it removes a disk
    // read from every client-side route.
    const indexHtml = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');

    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path === '/health') return next();
      // A deploy replaces the bundle; never let a browser pin an old one.
      res.set('Cache-Control', 'no-cache');
      return res.status(200).type('html').send(indexHtml);
    });
    log.info(`serving client bundle from ${clientDist}`);
  } else {
    log.warn(
      `client bundle not found at ${clientDist} — serving API only. ` +
        'Run `npm run build` at the repo root (Render build command) to produce it.',
    );
  }

  app.use((req, res) => {
    res.status(404).json({ ok: false, error: `No route for ${req.method} ${req.path}` });
  });

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
  app.use((err, req, res, next) => {
    const status = err instanceof ValidationError ? 400 : err instanceof NotFoundError ? 404 : err.status ?? 500;
    if (status >= 500) log.error(`${req.method} ${req.originalUrl} ->`, err.message);
    res.status(status).json({ ok: false, error: err.message, field: err.details?.field });
  });

  return app;
}

/** Hide credentials in anything we print or return over HTTP. */
function redact(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

/**
 * Where the built client lives. Defaults to <repo>/client/dist and can be
 * overridden with CLIENT_DIST if the bundle is built somewhere else.
 */
function resolveClientDist(cfg) {
  if (cfg.server.clientDist) return path.resolve(cfg.server.clientDist);
  return path.resolve(SERVER_ROOT, '..', 'client', 'dist');
}

export default createApp;