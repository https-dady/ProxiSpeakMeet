/**
 * Redis Pub/Sub wiring.
 *
 * 1. @socket.io/redis-adapter fans every Socket.io broadcast out to the other
 *    Node instances, which is what makes the signaling server horizontally
 *    scalable.
 * 2. A raw Pub/Sub channel carries instance-to-instance domain events
 *    (presence lifecycle, audit results, room updates).
 *
 * Redis is OPTIONAL at boot. On Render the managed instance may be missing,
 * cold, or briefly unavailable, so a failure degrades to single-instance mode
 * with one loud, actionable log block instead of a crash loop:
 *
 *   Redis unavailable (<reason>) -> running in SINGLE-INSTANCE mode.
 *
 * The app is fully functional on a single node; only cross-instance broadcast
 * is disabled until REDIS_URL is set.
 */
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const log = logger.child('redis');

export const CHANNELS = Object.freeze({
  events: `${config.redis.keyPrefix}events`,
});

const subscribers = new Set();

/** Render's managed Redis is TLS: any `rediss://` URL enables it. */
const isTls = /^rediss:/i.test(config.redis.url || '');

const redactUrl = (url = '') => url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

function buildClient(role, tls) {
  const client = new Redis(config.redis.url, {
    lazyConnect: true,
    // Never queue work forever: if Redis goes down the server must degrade, not
    // hang. Commands reject quickly instead of buffering without bound.
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    retryStrategy: (attempt) => Math.min(attempt * 250, 5000),
    ...(tls ? { tls } : {}),
  });

  // One clear warning per outage, then debug noise: no log spam, no crash.
  let reported = false;
  client.on('error', (err) => {
    // ioredis rejects `connect()` with a generic "Connection is closed." — keep
    // the real cause so the boot log tells the operator what to fix.
    client.lastConnectionError = err;
    if (!reported) {
      reported = true;
      log.warn(`${role} client error: ${err.message}`);
    } else {
      log.debug(`${role} client error: ${err.message}`);
    }
  });
  client.on('reconnecting', () => {
    if (!reported) {
      reported = true;
      log.warn(`${role} client is reconnecting to ${redactUrl(config.redis.url)}`);
    }
  });
  client.on('ready', () => {
    if (reported) log.info(`${role} client reconnected — Pub/Sub is live again`);
    reported = false;
  });

  return client;
}

export async function createRedisBus() {
  if (!config.redis.url) return singleInstanceBus('REDIS_URL is empty');

  // Verify the TLS chain first; only if it is not trusted do we retry once
  // without verification, and we say so loudly when we do.
  const attempts = isTls ? [{ tls: {} }, { tls: { rejectUnauthorized: false }, insecure: true }] : [{}];
  let lastError = null;

  for (const attempt of attempts) {
    const pub = buildClient('publisher', attempt.tls);
    const sub = buildClient('subscriber', attempt.tls);
    try {
      await Promise.all([pub.connect(), sub.connect()]);
      if (attempt.insecure) {
        log.warn('Redis TLS certificate is not in the public CA chain — continuing without verification.');
      }
      pub.on('message', dispatch);
      activePub = pub;
      liveClients.push(pub, sub);
      log.info(
        `connected to ${redactUrl(config.redis.url)} (adapter + pub/sub enabled${isTls ? ', TLS' : ''})`,
      );
      return {
        mode: 'redis',
        pub,
        sub,
        adapter: createAdapter(pub, sub),
        publish,
        subscribe,
        close,
      };
    } catch (err) {
      lastError = pub.lastConnectionError ?? sub.lastConnectionError ?? err;
      pub.disconnect();
      sub.disconnect();
      log.debug(`redis connect attempt failed: ${lastError.message}`);
    }
  }

  return singleInstanceBus(lastError?.message ?? 'unknown error');
}

/** Fan a domain event out to every instance (including this one, via Socket.io). */
function publish(event) {
  try {
    // `enableOfflineQueue: false` means a publish while Redis is down rejects
    // immediately; that is the intended graceful degradation.
    activePub?.publish(CHANNELS.events, JSON.stringify({ ...event, origin: config.server.instanceId })).catch((err) =>
      log.debug(`publish skipped (redis down): ${err.message}`),
    );
  } catch (err) {
    log.debug(`publish skipped: ${err.message}`);
  }
}

/** Reference to the live publisher, set only when Redis connected. */
let activePub = null;

function subscribe(handler) {
  subscribers.add(handler);
}

function dispatch(channel, raw) {
  if (channel !== CHANNELS.events) return;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  // Never re-process our own broadcast.
  if (payload.origin === config.server.instanceId) return;
  for (const handler of subscribers) {
    try {
      handler(payload);
    } catch (err) {
      log.error('subscriber threw:', err.message);
    }
  }
}

async function close() {
  subscribers.clear();
  activePub = null;
  const clients = liveClients;
  liveClients.length = 0;
  await Promise.allSettled(clients.map((client) => client.quit()));
}

const liveClients = [];

/** Domain event envelope published across instances. */
export function makeEvent(type, payload) {
  return { type, payload, at: Date.now() };
}

function singleInstanceBus(reason) {
  log.warn(
    [
      '',
      `Redis unavailable (${reason}) -> running in SINGLE-INSTANCE mode.`,
      '  The app is fully functional on one node; cross-instance broadcast is off.',
      '  To enable scaling set REDIS_URL (rediss://… on Render) and redeploy.',
      '',
    ].join('\n'),
  );

  return {
    mode: 'single',
    pub: null,
    sub: null,
    adapter: null,
    publish() {},
    subscribe() {},
    async close() {},
  };
}