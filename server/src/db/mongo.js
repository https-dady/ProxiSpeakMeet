/**
 * MongoDB connection lifecycle.
 *
 * MongoDB is mandatory for the geospatial engine.
 * Connection listeners are registered once, and concurrent connection
 * requests share the same pending connection attempt.
 */

import mongoose from 'mongoose';

import config from '../config/index.js';
import logger from '../utils/logger.js';

import UserPresence from '../models/UserPresence.js';
import Room from '../models/Room.js';
import SpatialAudit from '../models/SpatialAudit.js';

mongoose.set('strictQuery', true);

const log = logger.child('mongo');

let connectionListenersRegistered = false;
let connectionPromise = null;

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

  connectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS:
        config.mongo.serverSelectionTimeoutMS,
      maxPoolSize: 50,
      minPoolSize: 5,
      retryWrites: true,
    })
    .then(() => mongoose.connection)
    .catch((err) => {
      log.error(
        `Cannot reach MongoDB at "${uri}".\n` +
          '  Start it with: docker compose up -d mongo ' +
          '(or: mongod --dbpath ./data)\n' +
          '  MongoDB is required by the geospatial engine.',
      );

      throw err;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

/**
 * Disconnect MongoDB safely.
 *
 * If a connection attempt is still pending, wait for it to settle
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