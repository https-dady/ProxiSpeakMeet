/**
 * Background runtime: the timers that turn event-driven state into a
 * consistent, MongoDB-backed picture.
 *
 * Shutdown clears all timers and waits for already-running tasks to settle
 * before the caller starts closing dependent resources.
 */

import config from './config/index.js';
import logger from './utils/logger.js';
import { makeEvent } from './db/redis.js';

export function startRuntime({
  services,
  io,
  redisBus,
  config: cfg = config,
  logger: log = logger,
}) {
  const timers = [];
  const inFlight = new Set();

  let stopping = false;
  let stopPromise = null;

  const every = (ms, fn, name) => {
    const handle = setInterval(() => {
      if (stopping) return;

      let task;

      task = Promise.resolve()
        .then(() => {
          if (stopping) return;
          return fn();
        })
        .catch((err) => {
          log.error(`${name} tick failed:`, err.message);
        })
        .finally(() => {
          inFlight.delete(task);
        });

      inFlight.add(task);
    }, ms);

    handle.unref?.();
    timers.push(handle);
  };

  // 1. Persist moved avatars in batches.
  every(
    cfg.spatial.presenceFlushMs,
    () => services.store.flush(),
    'presence-flush',
  );

  // 2. Safety-net mesh reconcile across populated rooms.
  every(cfg.presence.reconcileIntervalMs, () => {
    const rooms = new Set(
      [...services.store.all()].map((user) => user.roomId),
    );

    for (const roomId of rooms) {
      const members = services.store.byRoom(roomId);
      const { added, removed } = services.peerGraph.reconcile(members);

      if (added.length || removed.length) {
        io?.to(roomId).emit('mesh:stats', {
          roomId,
          ...services.peerGraph.stats(),
        });
      }
    }
  }, 'mesh-reconcile');

  // 3. Evict stale sessions and incomplete peer negotiations.
  every(cfg.presence.sweepIntervalMs, async () => {
    const now = Date.now();
    const ghosts = [];

    for (const user of services.store.all()) {
      if (now - user.lastSeen > cfg.presence.staleAfterMs) {
        ghosts.push(user);
      }
    }

    for (const ghost of ghosts) {
      log.warn(
        `evicting stale session ${ghost.id} ` +
          `(last seen ${now - ghost.lastSeen}ms ago)`,
      );

      services.peerGraph.removeUser(ghost.id, 'stale');

      io?.to(ghost.roomId).emit('peer:left', {
        id: ghost.id,
        reason: 'stale',
      });

      services.store.remove(ghost.id);

      await services.store.removeFromMongo(ghost.id);

      redisBus?.publish(
        makeEvent('presence:leave', {
          id: ghost.id,
          roomId: ghost.roomId,
          reason: 'stale',
        }),
      );
    }

    services.peerGraph.sweep();
  }, 'peer-sweep');

  // 4. Refresh proximity clusters from MongoDB.
  every(cfg.spatial.clusterRefreshMs, async () => {
    const rooms = new Map();

    for (const user of services.store.all()) {
      if (!rooms.has(user.roomId)) {
        rooms.set(user.roomId, []);
      }

      rooms.get(user.roomId).push(user);
    }

    for (const [roomId, members] of rooms) {
      if (members.length < 2) continue;

      const anchor = members[0];

      try {
        const { clusters } = await services.geospatial.buildClusters({
          roomId,
          x: anchor.x,
          y: anchor.y,
          clusterGapPx: cfg.world.clusterGapPx,
        });

        io?.to(roomId).emit('presence:clusters', {
          roomId,
          at: Date.now(),
          clusters: clusters.map((cluster) => ({
            id: cluster.id,
            size: cluster.size,
            centroid: cluster.centroid,
            members: cluster.members.map((member) => member.sessionId),
          })),
        });
      } catch (err) {
        log.debug(
          `cluster refresh for ${roomId} failed: ${err.message}`,
        );
      }
    }
  }, 'cluster-refresh');

  /**
   * Stop scheduling work and wait for active tasks.
   *
   * Repeated calls share the same shutdown promise.
   */
  function stopRuntime() {
    if (stopPromise) {
      return stopPromise;
    }

    stopping = true;

    for (const handle of timers) {
      clearInterval(handle);
    }

    timers.length = 0;

    stopPromise = (async () => {
      while (inFlight.size > 0) {
        await Promise.allSettled([...inFlight]);
      }
    })();

    return stopPromise;
  }

  return stopRuntime;
}

export default startRuntime;