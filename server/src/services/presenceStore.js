/**
 * In-memory presence table — the authoritative hot-path state.
 *
 * Movement updates land in memory first and are flushed to MongoDB in
 * batches. The flush lifecycle is serialized so that disconnect cleanup
 * cannot race an in-flight presence upsert and leave a stale document.
 */
import UserPresence from '../models/UserPresence.js';

export class PresenceStore {
  #users = new Map(); // sessionId -> user
  #dirty = new Set(); // sessionIds pending flush
  #transform;
  #log;
  #flushInFlight = null;
  #persistenceQueue = Promise.resolve();

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

    for (const user of this.#users.values()) {
      if (user.roomId === roomId) {
        list.push(user);
      }
    }

    return list;
  }

  byInstance(instanceId) {
    const list = [];

    for (const user of this.#users.values()) {
      if (user.instanceId === instanceId) {
        list.push(user);
      }
    }

    return list;
  }

  touch(id) {
    const user = this.#users.get(id);

    if (user) {
      user.lastSeen = Date.now();
    }

    return user;
  }

  /**
   * Apply an authoritative position.
   * Returns the stored user so callers can diff neighbour sets.
   */
  move(id, { x, y, angle }) {
    const user = this.#users.get(id);

    if (!user) {
      return null;
    }

    if (typeof x === 'number') {
      user.x = x;
    }

    if (typeof y === 'number') {
      user.y = y;
    }

    if (typeof angle === 'number') {
      user.angle = angle;
    }

    user.updatedAt = Date.now();
    user.lastSeen = user.updatedAt;

    this.#dirty.add(id);

    return user;
  }

  setMicEnabled(id, micEnabled) {
    const user = this.#users.get(id);

    if (!user) {
      return null;
    }

    user.micEnabled = Boolean(micEnabled);
    this.#dirty.add(id);

    return user;
  }

  markDirty(id) {
    if (this.#users.has(id)) {
      this.#dirty.add(id);
    }
  }

  dirtyCount() {
    return this.#dirty.size;
  }

  /**
   * Build the MongoDB representation of a user.
   */
  #toDocument(user) {
    const [lon, lat] = this.#transform.pixelToGeo(
      user.x,
      user.y,
    );

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
      location: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      micEnabled: user.micEnabled,
      lastSeen: new Date(user.lastSeen),
    };
  }

  /**
   * Serialize flushes.
   *
   * If a flush is already in progress, callers share its promise rather
   * than starting another concurrent bulkWrite.
   */
  async flush() {
  if (this.#flushInFlight) {
    return this.#flushInFlight;
  }

  const operation = this.#persistenceQueue.then(
    () => this.#flushDirty(),
  );

  // Serialize every MongoDB persistence operation.
  this.#persistenceQueue = operation.catch(() => {});

  this.#flushInFlight = operation;

  try {
    return await operation;
  } finally {
    if (this.#flushInFlight === operation) {
      this.#flushInFlight = null;
    }
  }
}

  /**
   * Write the current dirty batch.
   */
  async #flushDirty() {
    if (this.#dirty.size === 0) {
      return 0;
    }

    const batch = [...this.#dirty];
    this.#dirty.clear();

    const operations = [];

    for (const id of batch) {
      const user = this.#users.get(id);

      // The user may have disconnected after entering the dirty batch.
      if (!user) {
        continue;
      }

      const doc = this.#toDocument(user);

      operations.push({
        updateOne: {
          filter: {
            sessionId: id,
            roomId: user.roomId,
          },
          update: {
            $set: doc,
          },
          upsert: true,
        },
      });
    }

    if (operations.length === 0) {
      return 0;
    }

    try {
      await UserPresence.bulkWrite(
        operations,
        { ordered: false },
      );

      return operations.length;
    } catch (err) {
      this.#log.error(
        `presence flush failed for ${operations.length} users:`,
        err.message,
      );

      // Preserve the existing retry behavior. A disconnected user's
      // requeued ID will be skipped if it no longer exists in memory.
      for (const operation of operations) {
        this.#dirty.add(
          operation.updateOne.filter.sessionId,
        );
      }

      return 0;
    }
  }

  /**
   * Delete a user from MongoDB.
   *
   * Wait for an active batch to finish before deleting. Otherwise, a
   * previously-started upsert could complete after this deletion and
   * recreate a stale presence document.
   */
  async removeFromMongo(id) {
  const operation = this.#persistenceQueue.then(
    async () => {
      // Clear the retry marker when the deletion reaches the queue.
      this.#dirty.delete(id);

      try {
        await UserPresence.deleteOne({
          sessionId: id,
        });
      } catch (err) {
        this.#log.error(
          `failed to delete presence ${id}:`,
          err.message,
        );
      }
    },
  );

  // Ensure later persistence operations wait for this deletion.
  this.#persistenceQueue = operation.catch(() => {});

  await operation;
}

  /**
   * Remove documents whose sessions disappeared after a crash or
   * hard disconnect.
   */
  async pruneStale({ staleAfterMs, roomId }) {
    const cutoff = new Date(
      Date.now() - staleAfterMs,
    );

    const filter = {
      lastSeen: {
        $lt: cutoff,
      },
    };

    if (roomId) {
      filter.roomId = roomId;
    }

    const result = await UserPresence.deleteMany(filter);

    return result.deletedCount ?? 0;
  }
}

export default PresenceStore;