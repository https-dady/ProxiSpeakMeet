/** MongoDB connection lifecycle. A database is mandatory for this project. */
import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import UserPresence from '../models/UserPresence.js';
import Room from '../models/Room.js';
import SpatialAudit from '../models/SpatialAudit.js';

mongoose.set('strictQuery', true);

const log = logger.child('mongo');

export async function connectMongo({ uri = config.mongo.uri } = {}) {
  mongoose.connection.on('connected', () => log.info('connected'));
  mongoose.connection.on('error', (err) => log.error('connection error:', err.message));
  mongoose.connection.on('disconnected', () => log.warn('disconnected'));

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: config.mongo.serverSelectionTimeoutMS,
      maxPoolSize: 50,
      minPoolSize: 5,
      retryWrites: true,
    });
  } catch (err) {
    log.error(
      `Cannot reach MongoDB at "${uri}".\n` +
        '  Start it with:  docker compose up -d mongo   (or: mongod --dbpath ./data)\n' +
        '  The geospatial engine stores every avatar as a 2dsphere GeoJSON point, so MongoDB is required.',
    );
    throw err;
  }

  return mongoose.connection;
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

/**
 * Create every index the app depends on — most importantly the 2dsphere index
 * on UserPresence.location that backs $near / $geoWithin. Idempotent, and run
 * on every boot so a fresh (remote) database is usable immediately without a
 * manual migration step.
 */
export async function ensureIndexes() {
  const [presence, room, audit] = await Promise.all([
    UserPresence.createIndexes(),
    Room.createIndexes(),
    SpatialAudit.createIndexes(),
  ]);
  return { presence, room, audit };
}

export { mongoose };