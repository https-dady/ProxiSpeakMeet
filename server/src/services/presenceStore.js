/**
 * In-memory presence table — the authoritative *hot path* state.
 *
 * With 50+ users at 10 Hz the socket layer must not round-trip MongoDB for
 * every keystroke, so movements land here first and are flushed to MongoDB in
 * batches (PRESENCE_FLUSH_MS). MongoDB therefore always holds the same truth,
 * it is just written a fraction of a second behind; the Spatial Audit reads
 * straight from MongoDB, which is what proves the $near / $geoWithin path.
 */
import UserPresence from '../models/UserPresence.js';

export class PresenceStore {
  #users = new Map(); // sessionId -> user
  #dirty = new Set(); // sessionIds pending flush
  #transform;
  #log;

  constructor({ transform, logger }) {
    this.#transform = transform;
    this.#log = logger;
  }

  add(user) {
    this.#users.set(user.id, {
      id: user.id,
      roomId: user.roomId,
      name: user.name,
      color: user.color,
      avatar: user.avatar ?? 'circle',
      x: user.x,
      y: user.y,
      angle: user.angle ?? 0,
      micEnabled: user.micEnabled !== false,
      instanceId: user.instanceId ?? '',
      lastSeen: Date.now(),
      updatedAt: Date.now(),
    });
    this.#dirty.add(user.id);
    return this.#users.get(user.id);
  }

  get(id) {
    return this.#users.get(id);
  }

  has(id) {
    return this.#users.has(id);
  }

  remove(id) {
    this.#dirty.delete(id);
    return this.#users.delete(id);
  }

  size() {
    return this.#users.size;
  }

  all() {
    return this.#users.values();
  }

  byRoom(roomId) {
    const list = [];
    for (const user of this.#users.values()) if (user.roomId === roomId) list.push(user);
    return list;
  }

  byInstance(instanceId) {
    const list = [];
    for (const user of this.#users.values()) if (user.instanceId === instanceId) list.push(user);
    return list;
  }

  touch(id) {
    const user = this.#users.get(id);
    if (user) user.lastSeen = Date.now();
    return user;
  }

  /**
   * Apply an authoritative position. Returns the stored user so callers can
   * diff neighbour sets without a second lookup.
   */
  move(id, { x, y, angle }) {
    const user = this.#users.get(id);
    if (!user) return null;
    if (typeof x === 'number') user.x = x;
    if (typeof y === 'number') user.y = y;
    if (typeof angle === 'number') user.angle = angle;
    user.updatedAt = Date.now();
    user.lastSeen = user.updatedAt;
    this.#dirty.add(id);
    return user;
  }

  setMicEnabled(id, micEnabled) {
    const user = this.#users.get(id);
    if (!user) return null;
    user.micEnabled = Boolean(micEnabled);
    this.#dirty.add(id);
    return user;
  }

  markDirty(id) {
    if (this.#users.has(id)) this.#dirty.add(id);
  }

  dirtyCount() {
    return this.#dirty.size;
  }

  /** Everything needed to rebuild a MongoDB document for one user. */
  #toDocument(user) {
    const [lon, lat] = this.#transform.pixelToGeo(user.x, user.y);
    return {
      sessionId: user.id,
      instanceId: user.instanceId,
      roomId: user.roomId,
      name: user.name,
      color: user.color,
      avatar: user.avatar,
      x: user.x,
      y: user.y,
      angle: user.angle,
      location: { type: 'Point', coordinates: [lon, lat] },
      micEnabled: user.micEnabled,
      lastSeen: new Date(user.lastSeen),
    };
  }

  /** Batch-write every dirty user to MongoDB. Called on an interval. */
  async flush() {
    if (this.#dirty.size === 0) return 0;
    const batch = [...this.#dirty];
    this.#dirty.clear();

    const operations = [];
    for (const id of batch) {
      const user = this.#users.get(id);
      if (!user) continue; // disconnected while queued — handled by deleteOne
      const doc = this.#toDocument(user);
      operations.push({
        updateOne: {
          filter: { sessionId: id, roomId: user.roomId },
          update: { $set: doc },
          upsert: true,
        },
      });
    }
    if (operations.length === 0) return 0;

    try {
      await UserPresence.bulkWrite(operations, { ordered: false });
      return operations.length;
    } catch (err) {
      this.#log.error(`presence flush failed for ${operations.length} users:`, err.message);
      // Re-queue so the next tick retries rather than losing positions.
      for (const op of operations) this.#dirty.add(op.updateOne.filter.sessionId);
      return 0;
    }
  }

  /** Delete a user from MongoDB (called on disconnect). */
  async removeFromMongo(id) {
    try {
      await UserPresence.deleteOne({ sessionId: id });
    } catch (err) {
      this.#log.error(`failed to delete presence ${id}:`, err.message);
    }
  }

  /**
   * Drop documents whose session disappeared (crash / hard disconnect) so the
   * geospatial index never serves ghosts.
   */
  async pruneStale({ staleAfterMs, roomId }) {
    const cutoff = new Date(Date.now() - staleAfterMs);
    const filter = { lastSeen: { $lt: cutoff } };
    if (roomId) filter.roomId = roomId;
    const result = await UserPresence.deleteMany(filter);
    return result.deletedCount ?? 0;
  }
}

export default PresenceStore;