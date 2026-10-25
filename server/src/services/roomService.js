/**
 * Room persistence and in-memory room cache.
 *
 * Default rooms remain available when MongoDB is temporarily unreachable.
 * Failed persistence is retained in a per-room retry queue and retried after
 * MongoDB reconnects or when that room is requested again.
 */
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const log = logger.child('rooms');
const cache = new Map();
const pendingPersistence = new Map();
const inFlightPersistence = new Map();

let retryOnReconnectRunning = false;

function isTransientMongoError(err) {
  const name = String(err?.name ?? '');
  const message = String(err?.message ?? '');

  return (
    [
      'MongoServerSelectionError',
      'MongoNetworkError',
      'MongoNetworkTimeoutError',
      'MongooseServerSelectionError',
    ].includes(name) ||
    /not connected|ECONNREFUSED|buffering timed out|MongoServerSelectionError|server selection timed out|connection closed|connection refused/i.test(
      message,
    )
  );
}

/**
 * Errors that retrying without changing the submitted room cannot fix.
 */
function isPermanentPersistenceError(err) {
  const name = String(err?.name ?? '');
  const code = Number(err?.code);

  return (
    name === 'ValidationError' ||
    name === 'CastError' ||
    code === 11000 || // Duplicate key
    code === 121       // MongoDB document validation failure
  );
}

/** Generate a deterministic default office blueprint. */
export function buildDefaultRoom(roomId, world = config.world) {
  const { width: w, height: h } = world;

  const obstacles = [
    {
      id: 'wall-core',
      type: 'wall',
      x: w / 2 - 20,
      y: h / 2 - 150,
      w: 40,
      h: 300,
      blocksAudio: true,
      attenuation: 0.12,
    },
    {
      id: 'screen-1',
      type: 'screen',
      x: w * 0.18,
      y: h * 0.22,
      w: 180,
      h: 14,
      blocksAudio: true,
      attenuation: 0.45,
    },
    {
      id: 'screen-2',
      type: 'screen',
      x: w * 0.18,
      y: h * 0.55,
      w: 180,
      h: 14,
      blocksAudio: true,
      attenuation: 0.45,
    },
    {
      id: 'desk-a',
      type: 'desk',
      x: w * 0.68,
      y: h * 0.2,
      w: 150,
      h: 70,
      blocksAudio: true,
      attenuation: 0.5,
    },
    {
      id: 'desk-b',
      type: 'desk',
      x: w * 0.68,
      y: h * 0.32,
      w: 150,
      h: 70,
      blocksAudio: true,
      attenuation: 0.5,
    },
    {
      id: 'desk-c',
      type: 'desk',
      x: w * 0.22,
      y: h * 0.72,
      w: 200,
      h: 60,
      blocksAudio: true,
      attenuation: 0.5,
    },
    {
      id: 'pillar-1',
      type: 'pillar',
      x: w * 0.45,
      y: h * 0.2,
      w: 34,
      h: 34,
      blocksAudio: true,
      attenuation: 0.25,
    },
    {
      id: 'pillar-2',
      type: 'pillar',
      x: w * 0.6,
      y: h * 0.68,
      w: 34,
      h: 34,
      blocksAudio: true,
      attenuation: 0.25,
    },
    {
      id: 'plant-1',
      type: 'plant',
      x: w * 0.85,
      y: h * 0.66,
      w: 26,
      h: 26,
      blocksAudio: true,
      attenuation: 0.65,
    },
    {
      id: 'plant-2',
      type: 'plant',
      x: w * 0.08,
      y: h * 0.42,
      w: 26,
      h: 26,
      blocksAudio: true,
      attenuation: 0.65,
    },
  ];

  const spawnPoints = Array.from({ length: 24 }, (_, i) => {
    const cols = 6;

    return {
      x: Math.round(w * 0.12 + (i % cols) * (w * 0.15)),
      y: Math.round(h * 0.12 + Math.floor(i / cols) * (h * 0.2)),
    };
  }).map((point) => ({
    x: Math.min(point.x, w - 40),
    y: Math.min(point.y, h - 40),
  }));

  return {
    roomId,
    name: prettyRoomName(roomId),
    description: 'Default office blueprint generated on first join.',
    width: w,
    height: h,
    obstacles,
    spawnPoints,
  };
}

const prettyRoomName = (roomId) =>
  String(roomId)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ') || 'Lobby';

/** Convert a Mongoose document or plain object to the client wire format. */
export function toRoomWire(doc) {
  return {
    roomId: doc.roomId,
    name: doc.name,
    description: doc.description ?? '',
    width: doc.width,
    height: doc.height,
    obstacles: (doc.obstacles ?? []).map((obstacle) => ({
      id: obstacle.id,
      type: obstacle.type,
      x: obstacle.x,
      y: obstacle.y,
      w: obstacle.w,
      h: obstacle.h,
      blocksAudio: obstacle.blocksAudio !== false,
      attenuation: obstacle.attenuation ?? 0.2,
    })),
    spawnPoints: (doc.spawnPoints ?? []).map((point) => ({
      x: point.x,
      y: point.y,
    })),
  };
}

function rememberPending(room) {
  pendingPersistence.set(room.roomId, room);
}

/**
 * Validate geometry before query-based persistence.
 *
 * Mongoose document pre('validate') hooks do not run for findOneAndUpdate().
 * These checks therefore protect every room write through this service.
 */
function assertRoomGeometry(room) {
  const width = room?.width;
  const height = room?.height;

  if (!Number.isFinite(width) || width < 200) {
    throw new ValidationError(
      'Room width must be a finite number of at least 200',
      { field: 'width' },
    );
  }

  if (!Number.isFinite(height) || height < 200) {
    throw new ValidationError(
      'Room height must be a finite number of at least 200',
      { field: 'height' },
    );
  }

  const obstacles = room.obstacles ?? [];
  const spawnPoints = room.spawnPoints ?? [];

  if (!Array.isArray(obstacles)) {
    throw new ValidationError('Room obstacles must be an array', {
      field: 'obstacles',
    });
  }

  if (!Array.isArray(spawnPoints)) {
    throw new ValidationError('Room spawn points must be an array', {
      field: 'spawnPoints',
    });
  }

  for (const [index, obstacle] of obstacles.entries()) {
    const validObstacle =
      obstacle !== null &&
      typeof obstacle === 'object' &&
      Number.isFinite(obstacle.x) &&
      Number.isFinite(obstacle.y) &&
      Number.isFinite(obstacle.w) &&
      Number.isFinite(obstacle.h) &&
      obstacle.x >= 0 &&
      obstacle.y >= 0 &&
      obstacle.w >= 1 &&
      obstacle.h >= 1 &&
      obstacle.x + obstacle.w <= width &&
      obstacle.y + obstacle.h <= height;

    if (!validObstacle) {
      throw new ValidationError(
        `Obstacle at index ${index} must have positive dimensions and fit within room bounds`,
        { field: 'obstacles', index },
      );
    }
  }

  for (const [index, point] of spawnPoints.entries()) {
    const validSpawnPoint =
      point !== null &&
      typeof point === 'object' &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= width &&
      point.y <= height;

    if (!validSpawnPoint) {
      throw new ValidationError(
        `Spawn point at index ${index} must be within room bounds`,
        { field: 'spawnPoints', index },
      );
    }
  }
}

/**
 * Persist a room once per roomId.
 * Failed writes remain pending for a later retry.
 */
async function persistWithRetryQueue(room) {
  // Validate before entering the persistence/retry path.
  // Invalid geometry must never be queued as a temporary database failure.
  assertRoomGeometry(room);

  const roomId = room.roomId;
  const existingOperation = inFlightPersistence.get(roomId);

  if (existingOperation) {
    return existingOperation;
  }

  const operation = (async () => {
    try {
      const doc = await Room.findOneAndUpdate(
        { roomId },
        { $set: room },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        },
      ).lean();

      if (!doc) {
        throw new Error(
          `MongoDB did not return persisted room "${roomId}"`,
        );
      }

      const wire = toRoomWire(doc);

      cache.set(roomId, wire);
      pendingPersistence.delete(roomId);

      log.info(`room "${roomId}" persisted`);

      return wire;
        } catch (err) {
      const permanent = isPermanentPersistenceError(err);
      const databaseUnavailable =
        mongoose.connection.readyState !== 1;
      const transient = isTransientMongoError(err);

      if (!permanent && (transient || databaseUnavailable)) {
        rememberPending(room);

        log.warn(
          `room "${roomId}" persistence deferred: ${err.message}`,
        );
      } else {
        log.error(
          `room "${roomId}" persistence failed permanently: ${err.message}`,
        );
      }

      throw err;
    } finally {
      inFlightPersistence.delete(roomId);
    }
  })();

  inFlightPersistence.set(roomId, operation);

  return operation;
}

/** Retry pending room writes sequentially after MongoDB reconnects. */
export async function retryPendingRoomPersistence() {
  if (
    retryOnReconnectRunning ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  retryOnReconnectRunning = true;

  try {
    for (const room of [...pendingPersistence.values()]) {
      if (mongoose.connection.readyState !== 1) {
        break;
      }

      try {
        await persistWithRetryQueue(room);
      } catch {
        // Keep the room queued for the next retry opportunity.
      }
    }
  } finally {
    retryOnReconnectRunning = false;
  }
}

mongoose.connection.on('connected', () => {
  void retryPendingRoomPersistence();
});

export async function getRoom(roomId, { persist = false } = {}) {
  const cached = cache.get(roomId);

  if (cached) {
    if (persist && pendingPersistence.has(roomId)) {
      try {
        await persistWithRetryQueue(
          pendingPersistence.get(roomId),
        );
      } catch {
        // The cached room remains available if persistence is unavailable.
      }
    }

    return cache.get(roomId) ?? cached;
  }

  let doc = null;

  try {
    doc = await Room.findOne({ roomId }).lean();
  } catch (err) {
    if (
      !isTransientMongoError(err) &&
      mongoose.connection.readyState === 1
    ) {
      throw err;
    }

    log.warn(
      `room "${roomId}" lookup unavailable; using default blueprint: ${err.message}`,
    );
  }

  if (doc) {
    const room = toRoomWire(doc);
    cache.set(roomId, room);
    return room;
  }

  const blueprint = buildDefaultRoom(roomId);
  cache.set(roomId, blueprint);

  if (persist) {
    try {
      await persistWithRetryQueue(blueprint);
    } catch {
      // The room remains usable and queued for persistence retry.
    }
  }

  return cache.get(roomId) ?? blueprint;
}

export async function listRooms() {
  const roomsById = new Map();
  let databaseAvailable = false;

  // 1. Load persisted rooms from MongoDB.
  try {
    const docs = await Room.find(
      {},
      {
        roomId: 1,
        name: 1,
        description: 1,
        width: 1,
        height: 1,
        obstacles: 1,
        spawnPoints: 1,
      },
    )
      .sort({ roomId: 1 })
      .limit(100)
      .lean();

    databaseAvailable = true;

    for (const doc of docs) {
      if (doc?.roomId) {
        roomsById.set(doc.roomId, toRoomWire(doc));
      }
    }
  } catch (err) {
    if (
      !isTransientMongoError(err) &&
      mongoose.connection.readyState === 1
    ) {
      throw err;
    }

    log.warn(
      `room catalogue unavailable; falling back to in-memory rooms: ${err.message}`,
    );
  }

  // 2. Add pending rooms.
  // Pending rooms may contain newer room configuration that MongoDB
  // has not successfully persisted yet, so they take precedence.
  for (const [roomId, room] of pendingPersistence.entries()) {
    if (room?.roomId) {
      roomsById.set(roomId, toRoomWire(room));
    }
  }

  // 3. Add cached rooms that are not already present.
  // Persisted rooms remain authoritative unless a pending write exists.
  for (const [roomId, room] of cache.entries()) {
    if (room?.roomId && !roomsById.has(roomId)) {
      roomsById.set(roomId, toRoomWire(room));
    }
  }

  // 4. Guarantee a usable lobby.
  // Prefer a persisted, pending, or cached lobby if one already exists.
  if (!roomsById.has('lobby')) {
    roomsById.set('lobby', buildDefaultRoom('lobby'));
  }

  // 5. Return a deterministic, duplicate-free catalogue.
  const rooms = [...roomsById.values()];

  rooms.sort((a, b) => a.roomId.localeCompare(b.roomId));

  return rooms;
}

export async function requireRoom(roomId) {
  const room = await getRoom(roomId);

  if (!room) {
    throw new NotFoundError(`Room "${roomId}" not found`);
  }

  return room;
}

export async function persistRoom(room) {
  assertRoomGeometry(room);

  const wire = toRoomWire(room);

  return persistWithRetryQueue(wire);
}

export function invalidateRoomCache(roomId) {
  if (roomId) {
    cache.delete(roomId);
  } else {
    cache.clear();
  }
}

/** Synchronous cache read for hot-path services. */
export function getCachedRoom(roomId) {
  return cache.get(roomId) ?? null;
}

/** Choose the spawn point furthest from current occupants. */
export function chooseSpawn(spawnPoints, occupants = []) {
  if (!spawnPoints?.length) {
    return { x: 60, y: 60 };
  }

  let best = spawnPoints[0];
  let bestScore = -Infinity;

  for (const point of spawnPoints) {
    let nearest = Number.POSITIVE_INFINITY;

    for (const occupant of occupants) {
      nearest = Math.min(
        nearest,
        Math.hypot(occupant.x - point.x, occupant.y - point.y),
      );
    }

    const score =
      nearest === Number.POSITIVE_INFINITY ? 0 : nearest;

    if (score > bestScore) {
      bestScore = score;
      best = point;
    }
  }

  return best;
}