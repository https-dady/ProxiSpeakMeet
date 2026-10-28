/**
 * MongoDB connection lifecycle.
 *
 * MongoDB is mandatory for the geospatial engine.
 * Connection listeners are registered once, and concurrent connection
 * requests share the same pending connection attempt.
 *
 * Explicit DNS configuration is supported for MongoDB Atlas SRV URIs
 * to avoid failures caused by the system's default DNS resolver.
 */

import dns from 'node:dns';
import mongoose from 'mongoose';

import config from '../config/index.js';
import logger from '../utils/logger.js';

import UserPresence from '../models/UserPresence.js';
import Room from '../models/Room.js';
import SpatialAudit from '../models/SpatialAudit.js';

mongoose.set('strictQuery', true);

const log = logger.child('mongo');

const DEFAULT_DNS_SERVERS = ['8.8.8.8', '8.8.4.4'];

let connectionListenersRegistered = false;
let connectionPromise = null;

/**
 * Configure DNS servers for MongoDB Atlas SRV resolution.
 *
 * MONGODB_DNS_SERVERS can override the defaults:
 *
 * MONGODB_DNS_SERVERS=8.8.8.8,8.8.4.4
 *
 * Configure this before mongoose.connect() so the initial SRV lookup
 * uses the selected DNS servers.
 */
function configureDnsServers() {
  const configuredServers = process.env.MONGODB_DNS_SERVERS
    ?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  const dnsServers = configuredServers?.length
    ? configuredServers
    : DEFAULT_DNS_SERVERS;

  dns.setServers(dnsServers);

  log.info(
    `DNS servers configured for MongoDB SRV resolution: ${
      dnsServers.join(', ')
    }`,
  );
}

/**
 * Establish MongoDB connection listeners once.
 */
function registerConnectionListeners() {
  if (connectionListenersRegistered) {
    return;
  }

  const connection = mongoose.connection;

  connection.on('connected', () => {
    log.info('connected');
  });

  connection.on('error', (err) => {
    log.error('connection error:', err.message);
  });

  connection.on('disconnected', () => {
    log.warn('disconnected');
  });

  connectionListenersRegistered = true;
}

/**
 * Establish a MongoDB connection.
 *
 * Concurrent callers share one pending connection attempt.
 * Initial connection failures are propagated to the caller.
 *
 * DNS servers are configured before connecting when the URI uses
 * mongodb+srv://.
 */
export async function connectMongo({
  uri = config.mongo.uri,
} = {}) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  registerConnectionListeners();

  connectionPromise = (async () => {
    try {
      if (typeof uri !== 'string' || !uri.trim()) {
        throw new Error('MongoDB connection URI is missing.');
      }

      if (uri.startsWith('mongodb+srv://')) {
        configureDnsServers();
      }

      await mongoose.connect(uri, {
        serverSelectionTimeoutMS:
          config.mongo.serverSelectionTimeoutMS,
        maxPoolSize: 50,
        minPoolSize: 5,
        retryWrites: true,
      });

      return mongoose.connection;
    } catch (err) {
      // Do not log the complete URI because it may contain credentials.
      log.error(
        `Cannot establish MongoDB connection: ${err.message}`,
      );

      log.error(
        'MongoDB is required by the geospatial engine. ' +
          'Verify DNS resolution, the MongoDB URI, and network access.',
      );

      throw err;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Disconnect MongoDB safely.
 *
 * If a connection attempt is pending, wait for it to settle
 * before deciding whether a disconnect is necessary.
 */
export async function disconnectMongo() {
  if (connectionPromise) {
    await connectionPromise.catch(() => {});
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Create every index required by the application.
 *
 * Index creation is idempotent and runs during startup.
 * MongoDB must already be connected.
 */
export async function ensureIndexes() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      'Cannot ensure MongoDB indexes: database is not connected.',
    );
  }

  const [presence, room, audit] = await Promise.all([
    UserPresence.createIndexes(),
    Room.createIndexes(),
    SpatialAudit.createIndexes(),
  ]);

  return {
    presence,
    room,
    audit,
  };
}

export { mongoose };