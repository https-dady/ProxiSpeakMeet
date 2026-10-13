/**
 * Seed helper — works against a local OR a remote MONGO_URI (Atlas, Render's
 * managed MongoDB, …). The 2dsphere index is created here too, which is the
 * one thing the geospatial engine cannot work without.
 *
 *   npm run seed                                  # indexes + rooms
 *   npm run seed -- --users=50                    # + 50 synthetic avatars
 *   npm run seed -- --users=50 --room=studio
 *   npm run seed -- --users=50 --flush            # replace that room's avatars
 *   MONGO_URI="mongodb+srv://…" npm run seed      # any remote database
 */
import process from 'node:process';
import mongoose from 'mongoose';
import { connectMongo, disconnectMongo, ensureIndexes } from '../src/db/mongo.js';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';
import UserPresence from '../src/models/UserPresence.js';
import { buildDefaultRoom, persistRoom } from '../src/services/roomService.js';
import { createGeoTransform } from '../src/utils/geo.js';

const log = logger.child('seed');

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value === undefined ? true : value];
  }),
);

const ROOMS = ['lobby', 'studio', 'lounge'];
const redact = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

async function main() {
  const target = config.mongo.uri;
  log.info(`target: ${redact(target)}`);

  await connectMongo();
  log.info(`connected to ${mongoose.connection.name || 'proxispeak'}`);

  // Idempotent and safe on an empty remote database: creates
  // UserPresence.location: 2dsphere plus the unique/lookup indexes.
  await ensureIndexes();
  log.info('indexes ensured (UserPresence.location = 2dsphere)');

  for (const roomId of ROOMS) {
    const existing = await mongoose.connection.collection('rooms').findOne({ roomId });
    if (existing) {
      log.info(`room "${roomId}" already present — left untouched`);
      continue;
    }
    await persistRoom(buildDefaultRoom(roomId));
    log.info(`room "${roomId}" created`);
  }

  const count = Number(args.users ?? 0);
  if (count > 0) {
    const roomId = String(args.room ?? 'lobby');
    const room = buildDefaultRoom(roomId);
    const transform = createGeoTransform({ ...config.world, width: room.width, height: room.height });

    if (args.flush) {
      const { deletedCount } = await UserPresence.deleteMany({ roomId });
      log.info(`flushed ${deletedCount ?? 0} existing avatars in "${roomId}"`);
    }

    const operations = [];
    for (let i = 0; i < count; i += 1) {
      // Deterministic pseudo-random layout: a few tight clusters plus strays,
      // which is exactly the shape a real office has.
      const cluster = i % 4;
      const cx = room.width * (0.25 + cluster * 0.18);
      const cy = room.height * (0.3 + ((cluster * 37) % 40) / 100);
      const x = Math.round(Math.min(Math.max(cx + Math.sin(i * 12.9898) * 60, 0), room.width));
      const y = Math.round(Math.min(Math.max(cy + Math.cos(i * 78.233) * 60, 0), room.height));
      const [lon, lat] = transform.pixelToGeo(x, y);
      operations.push({
        updateOne: {
          filter: { sessionId: `seed-${roomId}-${i}`, roomId },
          update: {
            $set: {
              sessionId: `seed-${roomId}-${i}`,
              instanceId: 'seed',
              roomId,
              name: `Bot ${String(i).padStart(2, '0')}`,
              color: '#7d8590',
              avatar: 'circle',
              x,
              y,
              angle: 0,
              location: { type: 'Point', coordinates: [lon, lat] },
              micEnabled: true,
              lastSeen: new Date(),
            },
          },
          upsert: true,
        },
      });
    }
    const result = await UserPresence.bulkWrite(operations, { ordered: false });
    log.info(
      `seeded ${operations.length} synthetic avatars into "${roomId}" ` +
        `(upserted=${result.upsertedCount}, modified=${result.modifiedCount})`,
    );
  }

  const indexes = await UserPresence.collection.indexes();
  log.info(`UserPresence indexes: ${indexes.map((index) => JSON.stringify(index.key)).join(', ')}`);
  log.info('done');

  await disconnectMongo();
}

main().catch(async (err) => {
  log.error(err);
  if (err?.name === 'MongooseServerSelectionError') {
    log.error('Could not reach MongoDB. Check MONGO_URI (and the network access list for Atlas).');
  }
  await disconnectMongo().catch(() => {});
  process.exit(1);
});