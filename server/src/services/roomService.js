/**
 * Room persistence (Week 4). Layouts + furniture obstacles live in MongoDB and
 * are shipped to every client on join so the canvas and the occlusion model
 * agree on where the walls are.
 *
 * A room that is not in MongoDB is materialised from the default blueprint the
 * first time somebody asks for it, so the app is usable with an empty database.
 */
import Room from '../models/Room.js';
import config from '../config/index.js';
import { NotFoundError } from '../utils/errors.js';

const cache = new Map(); // roomId -> room document (plain object)

/** Deterministic blueprint so every instance builds the same default room. */
export function buildDefaultRoom(roomId, world = config.world) {
  const { width: w, height: h } = world;
  const obstacles = [
    // Heavy concrete spine across the middle of the floor.
    { id: 'wall-core', type: 'wall', x: w / 2 - 20, y: h / 2 - 150, w: 40, h: 300, blocksAudio: true, attenuation: 0.12 },
    // Meeting room: light screen, sound leaks.
    { id: 'screen-1', type: 'screen', x: w * 0.18, y: h * 0.22, w: 180, h: 14, blocksAudio: true, attenuation: 0.45 },
    { id: 'screen-2', type: 'screen', x: w * 0.18, y: h * 0.55, w: 180, h: 14, blocksAudio: true, attenuation: 0.45 },
    // Desk clusters: noticeably deaden sound, still talkable.
    { id: 'desk-a', type: 'desk', x: w * 0.68, y: h * 0.2, w: 150, h: 70, blocksAudio: true, attenuation: 0.5 },
    { id: 'desk-b', type: 'desk', x: w * 0.68, y: h * 0.32, w: 150, h: 70, blocksAudio: true, attenuation: 0.5 },
    { id: 'desk-c', type: 'desk', x: w * 0.22, y: h * 0.72, w: 200, h: 60, blocksAudio: true, attenuation: 0.5 },
    // Structural pillars + soft blockers.
    { id: 'pillar-1', type: 'pillar', x: w * 0.45, y: h * 0.2, w: 34, h: 34, blocksAudio: true, attenuation: 0.25 },
    { id: 'pillar-2', type: 'pillar', x: w * 0.6, y: h * 0.68, w: 34, h: 34, blocksAudio: true, attenuation: 0.25 },
    { id: 'plant-1', type: 'plant', x: w * 0.85, y: h * 0.66, w: 26, h: 26, blocksAudio: true, attenuation: 0.65 },
    { id: 'plant-2', type: 'plant', x: w * 0.08, y: h * 0.42, w: 26, h: 26, blocksAudio: true, attenuation: 0.65 },
  ];

  const spawnPoints = Array.from({ length: 24 }, (_, i) => {
    const cols = 6;
    return {
      x: Math.round(w * 0.12 + (i % cols) * (w * 0.15)),
      y: Math.round(h * 0.12 + Math.floor(i / cols) * (h * 0.2)),
    };
  }).map((p) => ({ x: Math.min(p.x, w - 40), y: Math.min(p.y, h - 40) }));

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
  roomId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ') || 'Lobby';

/** Normalise a mongoose doc / plain object into the wire format used by clients. */
export function toRoomWire(doc) {
  return {
    roomId: doc.roomId,
    name: doc.name,
    description: doc.description ?? '',
    width: doc.width,
    height: doc.height,
    obstacles: doc.obstacles.map((o) => ({
      id: o.id,
      type: o.type,
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      blocksAudio: o.blocksAudio !== false,
      attenuation: o.attenuation ?? 0.2,
    })),
    spawnPoints: (doc.spawnPoints ?? []).map((p) => ({ x: p.x, y: p.y })),
  };
}

export async function getRoom(roomId, { persist = false } = {}) {
  const cached = cache.get(roomId);
  if (cached) return cached;

  let doc = null;
  try {
    doc = await Room.findOne({ roomId }).lean();
  } catch (err) {
    // A missing room is normal on a cold database.
    if (!/not connected|ECONNREFUSED|buffering timed out/i.test(err.message)) throw err;
  }

  if (!doc) {
    const blueprint = buildDefaultRoom(roomId);
    cache.set(roomId, blueprint);
    if (persist) void persistRoom(blueprint).catch(() => {});
    return blueprint;
  }

  const room = toRoomWire(doc);
  cache.set(roomId, room);
  return room;
}

export async function listRooms() {
  let docs = [];
  try {
    docs = await Room.find({}, { roomId: 1, name: 1, description: 1, width: 1, height: 1 })
      .sort({ roomId: 1 })
      .limit(100)
      .lean();
  } catch (err) {
    // A cold/unreachable database should not take the room catalogue down.
    if (!/not connected|ECONNREFUSED|buffering timed out|MongoServerSelectionError/i.test(err.message)) throw err;
  }
  if (docs.length === 0) return [buildDefaultRoom('lobby')];
  return docs.map(toRoomWire);
}

export async function requireRoom(roomId) {
  const room = await getRoom(roomId);
  if (!room) throw new NotFoundError(`Room "${roomId}" not found`);
  return room;
}

export async function persistRoom(room) {
  const doc = await Room.findOneAndUpdate(
    { roomId: room.roomId },
    { $set: room },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const wire = toRoomWire(doc);
  cache.set(room.roomId, wire);
  return wire;
}

export function invalidateRoomCache(roomId) {
  if (roomId) cache.delete(roomId);
  else cache.clear();
}

/** Synchronous cache read — used by the PeerGraph, which runs on the hot path. */
export function getCachedRoom(roomId) {
  return cache.get(roomId) ?? null;
}

/** Pick the spawn point furthest from everyone already standing in the room. */
export function chooseSpawn(spawnPoints, occupants = []) {
  if (!spawnPoints?.length) return { x: 60, y: 60 };
  let best = spawnPoints[0];
  let bestScore = -Infinity;
  for (const point of spawnPoints) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const occupant of occupants) {
      nearest = Math.min(nearest, Math.hypot(occupant.x - point.x, occupant.y - point.y));
    }
    // Also prefer points that are at least one earshot from the walls' neighbours.
    const score = nearest === Number.POSITIVE_INFINITY ? 0 : nearest;
    if (score > bestScore) {
      bestScore = score;
      best = point;
    }
  }
  return best;
}