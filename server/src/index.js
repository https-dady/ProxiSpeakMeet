/**
 * Boot sequence:
 * config -> MongoDB -> Redis -> services -> HTTP -> sockets.
 *
 * Run multiple instances with the same REDIS_URL to enable
 * cross-instance Socket.IO broadcasting.
 */

import http from 'node:http';
import process from 'node:process';

import config from './config/index.js';
import logger from './utils/logger.js';

import {
  connectMongo,
  disconnectMongo,
  ensureIndexes,
} from './db/mongo.js';

import {
  createRedisBus,
  makeEvent,
} from './db/redis.js';

import { createServices } from './services/index.js';
import { createApp } from './app.js';
import { createSocketServer } from './sockets/index.js';
import { startRuntime } from './runtime.js';

const log = logger;

async function main() {
  log.info(
    `ProxiSpeak server starting (${config.nodeEnv}) ` +
      `as instance "${config.server.instanceId}"`,
  );

  await connectMongo();
  await ensureIndexes();

  log.info('MongoDB indexes ready (UserPresence.location: 2dsphere)');

  const redisBus = await createRedisBus();

  const services = createServices({ logger: log });

  await services
    .getRoom('lobby', { persist: true })
    .catch((err) => {
      log.warn('default room not persisted:', err.message);
    });

  const httpServer = http.createServer();

  const app = createApp({
    services,
    redisBus,
    config,
    logger: log,
  });

  httpServer.on('request', app);

  const io = createSocketServer({
    httpServer,
    services,
    redisBus,
    config,
    logger: log,
  });

  redisBus?.subscribe((event) => {
    switch (event.type) {
      case 'presence:leave':
        log.debug(
          `instance ${event.payload.instanceId} lost ${event.payload.id}`,
        );
        break;

      case 'audit:completed':
        io.to(event.payload.roomId).emit('audit:remote', {
          roomId: event.payload.roomId,
          p95Ms: event.payload.report?.queries?.near?.p95Ms ?? null,
          ok: event.payload.report?.ok ?? null,
          from: event.origin,
        });
        break;

      default:
        break;
    }
  });

  const stopRuntime = startRuntime({
    services,
    io,
    redisBus,
    config,
    logger: log,
  });

  // Reject startup if the requested port cannot be bound.
  await new Promise((resolve, reject) => {
    const onError = (err) => {
      httpServer.off('listening', onListening);
      reject(err);
    };

    const onListening = () => {
      httpServer.off('error', onError);
      resolve();
    };

    httpServer.once('error', onError);
    httpServer.once('listening', onListening);

    httpServer.listen(
      config.server.port,
      config.server.host,
    );
  });

  log.info(
    `HTTP + WebSocket listening on ` +
      `${config.server.host}:${config.server.port} ` +
      `(scale mode: ${redisBus.mode})`,
  );

  log.info(
    'Health: GET /health · Spatial audit: GET /api/spatial-audit?roomId=lobby',
  );

  redisBus?.publish(
    makeEvent('instance:up', {
      port: config.server.port,
    }),
  );

  let shutdownPromise = null;

  async function shutdown(signal) {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      log.info(`${signal} received, shutting down...`);

      let shutdownFailed = false;

      // 1. Stop background timers and await active runtime tasks.
      try {
        await stopRuntime();
      } catch (err) {
        shutdownFailed = true;
        log.error('runtime shutdown failed:', err);
      }

      // 2. Close Socket.IO and its underlying HTTP server.
      // Do not call httpServer.close() a second time.
      try {
        await new Promise((resolve) => {
          io.close(() => resolve());
        });
      } catch (err) {
        shutdownFailed = true;
        log.error('Socket.IO shutdown failed:', err);
      }

      // 3. Persist remaining dirty presence state.
      try {
        await services.store.flush();
      } catch (err) {
        shutdownFailed = true;
        log.error('presence flush failed during shutdown:', err);
      }

      // 4. Close Redis resources.
      try {
        await redisBus?.close();
      } catch (err) {
        shutdownFailed = true;
        log.error('Redis shutdown failed:', err);
      }

      // 5. Disconnect MongoDB last.
      try {
        await disconnectMongo();
      } catch (err) {
        shutdownFailed = true;
        log.error('MongoDB shutdown failed:', err);
      }

      if (shutdownFailed) {
        log.error('shutdown completed with errors');
        process.exitCode = 1;
      } else {
        log.info('bye');
        process.exitCode = 0;
      }
    })();

    return shutdownPromise;
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT').catch((err) => {
      log.error('unexpected SIGINT shutdown error:', err);
      process.exitCode = 1;
    });
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM').catch((err) => {
      log.error('unexpected SIGTERM shutdown error:', err);
      process.exitCode = 1;
    });
  });

  process.on('unhandledRejection', (reason) => {
    log.error('unhandled rejection:', reason);
  });
}

main().catch((err) => {
  log.error('fatal startup error:', err);
  process.exitCode = 1;
});