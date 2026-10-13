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

// dotenv never overrides an already-set key, so the more specific file is
// loaded first and therefore has the higher effective priority.
for (const candidate of [path.join(SERVER_ROOT, '.env'), path.join(REPO_ROOT, '.env')]) {
  if (fs.existsSync(candidate)) dotenv.config({ path: candidate });
}

const str = (key, fallback) => {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
};

const num = (key, fallback, { min = -Infinity, max = Infinity } = {}) => {
  const raw = process.env[key];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Env ${key} must be a number, got "${raw}"`);
  if (value < min || value > max) throw new Error(`Env ${key} must be within [${min}, ${max}], got ${value}`);
  return value;
};

const list = (key, fallback) => {
  const raw = str(key, fallback);
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const nodeEnv = str('NODE_ENV', 'development');

export const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  logLevel: str('LOG_LEVEL', 'info'),

  server: Object.freeze({
    // Render (and every PaaS) injects PORT; 4000 stays the local default.
    port: num('PORT', 4000, { min: 1, max: 65535 }),
    host: str('HOST', '0.0.0.0'),
    /**
     * Allowed browser origins. Empty = "single-origin deployment": the client
     * bundle is served by this same Express app, so any origin that reaches us
     * is the app itself. Set CLIENT_URL to lock it down.
     */
    clientOrigins: list('CLIENT_URL', ''),
    // Directory holding the built client (client/dist). Auto-detected.
    clientDist: str('CLIENT_DIST', ''),
    instanceId: str('INSTANCE_ID', '') || `node-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
  }),

  mongo: Object.freeze({
    uri: str('MONGO_URI', 'mongodb://127.0.0.1:27017/proxispeak'),
    serverSelectionTimeoutMS: num('MONGO_TIMEOUT_MS', 8000, { min: 500 }),
  }),

  redis: Object.freeze({
    // Empty/unset = single-instance mode (no Pub/Sub, no adapter). Set it to
    // `redis://…` locally or `rediss://…` for Render's TLS-enabled Redis.
    url: str('REDIS_URL', ''),
    keyPrefix: str('REDIS_PREFIX', 'proxispeak:'),
  }),

  webrtc: Object.freeze({
    iceServers: Object.freeze([{ urls: str('STUN_URL', 'stun:stun.l.google.com:19302') }]),
  }),

  world: Object.freeze({
    width: num('WORLD_WIDTH', 1920, { min: 200 }),
    height: num('WORLD_HEIGHT', 1080, { min: 200 }),
    centerLat: num('WORLD_CENTER_LAT', 37.7749, { min: -90, max: 90 }),
    centerLon: num('WORLD_CENTER_LON', -122.4194, { min: -180, max: 180 }),
    pixelsPerMeter: num('PIXELS_PER_METER', 10, { min: 0.0001, max: 1e6 }),
    earshotRadiusPx: num('EARSHT_RADIUS_PX', 100, { min: 10, max: 5000 }),
    // Two users whose distance is below this are considered one conversation group.
    clusterGapPx: num('CLUSTER_GAP_PX', 100, { min: 1 }),
    maxSpeedPxPerSec: num('MAX_SPEED_PX_PER_SEC', 900, { min: 1 }),
  }),

  spatial: Object.freeze({
    /** hybrid = in-memory hot path + MongoDB as source of truth (default).
     *  mongo  = every proximity lookup goes through $near / $geoWithin. */
    queryMode: str('SPATIAL_QUERY_MODE', 'hybrid'),
    auditBudgetMs: num('SPATIAL_AUDIT_BUDGET_MS', 20, { min: 1 }),
    clusterRefreshMs: num('CLUSTER_REFRESH_MS', 2000, { min: 100 }),
    presenceFlushMs: num('PRESENCE_FLUSH_MS', 500, { min: 50 }),
  }),

  presence: Object.freeze({
    positionThrottleMs: num('POSITION_THROTTLE_MS', 100, { min: 16 }),
    heartbeatIntervalMs: num('HEARTBEAT_INTERVAL_MS', 10000, { min: 1000 }),
    staleAfterMs: num('PEER_STALE_MS', 30000, { min: 2000 }),
    sweepIntervalMs: num('PEER_SWEEP_MS', 5000, { min: 500 }),
    reconcileIntervalMs: num('PEER_RECONCILE_MS', 500, { min: 50 }),
  }),

  limits: Object.freeze({
    positionEventsPerSec: num('LIMIT_POSITION_EPS', 30),
    signalEventsPerSec: num('LIMIT_SIGNAL_EPS', 60),
    auditSamples: num('LIMIT_AUDIT_SAMPLES', 25, { min: 1, max: 200 }),
    maxUsersPerRoom: num('LIMIT_USERS_PER_ROOM', 200, { min: 2 }),
  }),
});

export default config;