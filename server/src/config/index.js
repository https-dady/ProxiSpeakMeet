/**
 * Central configuration. Every tunable lives here and is sourced from .env
 * (server/.env wins over the repo-root .env). Nothing else in the codebase
 * reads process.env directly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.resolve(__dirname, '..', '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

// Load server/.env first. Existing process environment variables take
// precedence, and the root .env supplies values that are still missing.
for (const candidate of [
  path.join(SERVER_ROOT, '.env'),
  path.join(REPO_ROOT, '.env'),
]) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}

const str = (key, fallback) => {
  const value = process.env[key];

  return value === undefined || value.trim() === ''
    ? fallback
    : value.trim();
};

const num = (
  key,
  fallback,
  { min = -Infinity, max = Infinity } = {},
) => {
  const raw = process.env[key];

  const value =
    raw === undefined || raw.trim() === ''
      ? fallback
      : Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`Env ${key} must be a number, got "${raw}"`);
  }

  if (value < min || value > max) {
    throw new Error(
      `Env ${key} must be within [${min}, ${max}], got ${value}`,
    );
  }

  return value;
};

const list = (key, fallback) => {
  return str(key, fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

function enumValue(key, fallback, allowedValues) {
  const value = str(key, fallback);

  if (!allowedValues.includes(value)) {
    throw new Error(
      `Invalid ${key}="${value}". Allowed values: ${allowedValues.join(', ')}`,
    );
  }

  return value;
}

const nodeEnv = enumValue(
  'NODE_ENV',
  'development',
  ['development', 'test', 'production'],
);

const logLevel = enumValue(
  'LOG_LEVEL',
  'info',
  ['error', 'warn', 'info', 'debug'],
);

const spatialQueryMode = enumValue(
  'SPATIAL_QUERY_MODE',
  'hybrid',
  ['hybrid', 'mongo'],
);

const mongoUri = str(
  'MONGO_URI',
  'mongodb://127.0.0.1:27017/proxispeak',
);

// Production must never silently fall back to a local MongoDB instance.
if (nodeEnv === 'production' && !process.env.MONGO_URI?.trim()) {
  throw new Error(
    'MONGO_URI must be explicitly configured in production.',
  );
}

export const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  logLevel,

  server: Object.freeze({
    // Render and other hosting platforms inject PORT.
    port: num('PORT', 4000, {
      min: 1,
      max: 65535,
    }),

    host: str('HOST', '0.0.0.0'),

    /**
     * Allowed browser origins.
     * Empty means no explicit origin allowlist is configured.
     */
    clientOrigins: list('CLIENT_URL', ''),

    // Directory holding the built client. Auto-detected by the app.
    clientDist: str('CLIENT_DIST', ''),

    instanceId:
      str('INSTANCE_ID', '') ||
      `node-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
  }),

  mongo: Object.freeze({
    uri: mongoUri,

    serverSelectionTimeoutMS: num('MONGO_TIMEOUT_MS', 8000, {
      min: 500,
    }),
  }),

  redis: Object.freeze({
    // Empty means single-instance mode without the Redis adapter.
    url: str('REDIS_URL', ''),

    keyPrefix: str('REDIS_PREFIX', 'proxispeak:'),
  }),

  webrtc: Object.freeze({
    iceServers: Object.freeze([
      {
        urls: str(
          'STUN_URL',
          'stun:stun.l.google.com:19302',
        ),
      },
    ]),
  }),

  world: Object.freeze({
    width: num('WORLD_WIDTH', 1920, {
      min: 200,
    }),

    height: num('WORLD_HEIGHT', 1080, {
      min: 200,
    }),

    centerLat: num('WORLD_CENTER_LAT', 37.7749, {
      min: -90,
      max: 90,
    }),

    centerLon: num('WORLD_CENTER_LON', -122.4194, {
      min: -180,
      max: 180,
    }),

    pixelsPerMeter: num('PIXELS_PER_METER', 10, {
      min: 0.0001,
      max: 1e6,
    }),

    earshotRadiusPx: num('EARSHT_RADIUS_PX', 100, {
      min: 10,
      max: 5000,
    }),

    clusterGapPx: num('CLUSTER_GAP_PX', 100, {
      min: 1,
    }),

    maxSpeedPxPerSec: num('MAX_SPEED_PX_PER_SEC', 900, {
      min: 1,
    }),
  }),

  spatial: Object.freeze({
    // hybrid = in-memory hot path + MongoDB source of truth.
    // mongo = proximity queries use MongoDB geospatial queries.
    queryMode: spatialQueryMode,

    auditBudgetMs: num('SPATIAL_AUDIT_BUDGET_MS', 20, {
      min: 1,
    }),

    clusterRefreshMs: num('CLUSTER_REFRESH_MS', 2000, {
      min: 100,
    }),

    presenceFlushMs: num('PRESENCE_FLUSH_MS', 500, {
      min: 50,
    }),
  }),

  presence: Object.freeze({
    positionThrottleMs: num('POSITION_THROTTLE_MS', 100, {
      min: 16,
    }),

    heartbeatIntervalMs: num('HEARTBEAT_INTERVAL_MS', 10000, {
      min: 1000,
    }),

    staleAfterMs: num('PEER_STALE_MS', 30000, {
      min: 2000,
    }),

    sweepIntervalMs: num('PEER_SWEEP_MS', 5000, {
      min: 500,
    }),

    reconcileIntervalMs: num('PEER_RECONCILE_MS', 500, {
      min: 50,
    }),
  }),

  limits: Object.freeze({
    positionEventsPerSec: num('LIMIT_POSITION_EPS', 30),

    signalEventsPerSec: num('LIMIT_SIGNAL_EPS', 60),

    auditSamples: num('LIMIT_AUDIT_SAMPLES', 25, {
      min: 1,
      max: 200,
    }),

    maxUsersPerRoom: num('LIMIT_USERS_PER_ROOM', 200, {
      min: 2,
    }),
  }),
});

export default config;