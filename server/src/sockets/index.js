/**
 * Socket.io signaling server.
 *
 * Responsibilities:
 * - Room lifecycle: join, leave, switching and reconnect.
 * - Authoritative avatar movement and collision validation.
 * - WebRTC signaling relay.
 * - PeerGraph-driven proximity and spatial-audio events.
 * - Cross-instance events through Redis Pub/Sub.
 */
import { Server } from 'socket.io';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { TokenBucket } from '../utils/rateLimiter.js';
import { ValidationError } from '../utils/errors.js';
import { requireString } from '../utils/validate.js';
import { resolveCollision } from '../services/obstacleService.js';
import { makeEvent } from '../db/redis.js';
import { corsOrigin } from '../utils/origin.js';
import {
  validateRoomJoin,
  validatePosition,
  validateSignal,
  validateMediaState,
} from './validation.js';

const AVATAR_RADIUS = 14;

export function createSocketServer({
  httpServer,
  services,
  redisBus,
  config: cfg = config,
  logger: log = logger,
}) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin(cfg),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 8000,
    maxHttpBufferSize: 1e6,
    transports: ['websocket', 'polling'],
  });

  if (redisBus?.adapter) {
    io.adapter(redisBus.adapter);

    log.info(
      `socket.io redis adapter attached (instance ${cfg.server.instanceId})`,
    );
  }

  services.peerGraph.setEmitter?.((to, event, payload) => {
    io.to(to).emit(event, payload);
  });

  io.on('connection', (socket) => {
    onConnection({
      socket,
      io,
      services,
      redisBus,
      cfg,
      log,
    });
  });

  return io;
}

function onConnection({
  socket,
  io,
  services,
  redisBus,
  cfg,
  log,
}) {
  const {
    store,
    peerGraph,
    getRoom,
    chooseSpawn,
  } = services;

  const socketsLog = log.child(socket.id.slice(0, 6));

  const positionBucket = new TokenBucket({
    capacity: cfg.limits.positionEventsPerSec,
    refillPerSec: cfg.limits.positionEventsPerSec,
  });

  const signalBucket = new TokenBucket({
    capacity: cfg.limits.signalEventsPerSec,
    refillPerSec: cfg.limits.signalEventsPerSec,
  });

  let identity = null;
  let leaveInProgress = null;

  const safe = (handler) => async (payload, ack) => {
    try {
      const result = await handler(payload);

      if (typeof ack === 'function') {
        ack({ ok: true, ...result });
      }
    } catch (err) {
      const status = err.status ?? 500;

      if (status >= 500) {
        socketsLog.error(`${err.name}: ${err.message}`);
      } else {
        socketsLog.debug(`rejected event: ${err.message}`);
      }

      if (typeof ack === 'function') {
        ack({
          ok: false,
          error: err.message,
          field: err.details?.field,
        });
      } else {
        socket.emit('system:error', {
          message: err.message,
        });
      }
    }
  };

  function joinConfig() {
    return {
      earshotRadiusPx: cfg.world.earshotRadiusPx,
      clusterGapPx: cfg.world.clusterGapPx,
      positionThrottleMs: cfg.presence.positionThrottleMs,
      heartbeatIntervalMs: cfg.presence.heartbeatIntervalMs,
      iceServers: cfg.webrtc.iceServers,
      instanceId: cfg.server.instanceId,
      scaleMode: redisBus?.mode ?? 'single',
    };
  }

  // ------------------------------------------------------------- room join
  socket.on(
    'room:join',
    safe(async (payload) => {
      // Validate identity and room ID first. The global dimensions are used
      // only for this initial validation; spawn is validated against the
      // selected room after its configuration has been loaded.
      const {
        roomId,
        name,
        color,
        avatar,
      } = validateRoomJoin(payload, {
        world: cfg.world,
      });

      const room = await getRoom(roomId, {
        persist: true,
      });

      if (
        !room ||
        !Number.isFinite(room.width) ||
        !Number.isFinite(room.height) ||
        room.width < AVATAR_RADIUS * 2 ||
        room.height < AVATAR_RADIUS * 2
      ) {
        throw new ValidationError(
          'room configuration has invalid dimensions',
        );
      }

      const roomWorld = {
        width: room.width,
        height: room.height,
      };

      const occupants = store.byRoom(roomId);

      if (
        occupants.length >= cfg.limits.maxUsersPerRoom &&
        !occupants.some((user) => user.id === socket.id)
      ) {
        throw Object.assign(
          new Error(
            `room "${roomId}" is full (${cfg.limits.maxUsersPerRoom} max)`,
          ),
          { status: 503 },
        );
      }

      /*
       * Idempotent same-room join:
       * return the existing session and roster instead of re-adding the user
       * or broadcasting a duplicate peer:joined event.
       */
      if (identity?.roomId === roomId) {
        const existingUser = store.get(socket.id);

        if (existingUser) {
          const peers = store
            .byRoom(roomId)
            .filter((user) => user.id !== socket.id)
            .map(wireUser);

          return {
            self: wireUser(existingUser),
            room,
            peers,
            config: joinConfig(),
          };
        }
      }

      /*
       * If a caller explicitly supplies a spawn point, validate it against
       * the actual room. Do not silently clamp a point from one room into
       * another room's coordinate system.
       */
      let requestedSpawn = null;

      if (payload?.spawn !== undefined && payload?.spawn !== null) {
        const spawn = payload.spawn;

        if (
          typeof spawn !== 'object' ||
          Array.isArray(spawn) ||
          !Number.isFinite(spawn.x) ||
          !Number.isFinite(spawn.y)
        ) {
          throw new ValidationError(
            'spawn must contain finite x and y coordinates',
            { field: 'spawn' },
          );
        }

        if (
          spawn.x < AVATAR_RADIUS ||
          spawn.y < AVATAR_RADIUS ||
          spawn.x > roomWorld.width - AVATAR_RADIUS ||
          spawn.y > roomWorld.height - AVATAR_RADIUS
        ) {
          throw new ValidationError(
            'spawn coordinates must be within the selected room boundaries',
            { field: 'spawn' },
          );
        }

        requestedSpawn = {
          x: spawn.x,
          y: spawn.y,
        };
      }

      const preferredSpawn =
        requestedSpawn ??
        chooseSpawn(room.spawnPoints, occupants);

      const position = resolveSafeSpawn({
        room,
        preferredSpawn,
        occupants,
      });

      /*
       * Switching rooms must remove the old room membership and presence
       * before adding the user to the destination room.
       */
      if (identity && identity.roomId !== roomId) {
        await leaveRoom('room-switch');
      }

      const user = store.add({
        id: socket.id,
        roomId,
        name,
        color,
        avatar,
        x: Math.round(position.x),
        y: Math.round(position.y),
        angle: 0,
        instanceId: cfg.server.instanceId,
      });

      user.ready = false;

      identity = {
        roomId,
        name,
        color,
        avatar,
      };

      socket.data.userId = socket.id;
      socket.data.roomId = roomId;

      await socket.join(roomId);

      const peers = store
        .byRoom(roomId)
        .filter((peer) => peer.id !== socket.id)
        .map(wireUser);

      socket.to(roomId).emit('peer:joined', {
        peer: wireUser(user),
      });

      socketsLog.info(
        `joined ${roomId} as "${name}" (${peers.length} others)`,
      );

      return {
        self: wireUser(user),
        room,
        peers,
        config: joinConfig(),
      };
    }),
  );

  // ------------------------------------------------------ media readiness
  socket.on(
    'peer:media-ready',
    safe(async (payload) => {
      if (!identity) {
        throw new ValidationError('join a room first');
      }

      const { micEnabled } = validateMediaState(payload);
      const user = store.get(socket.id);

      if (!user) {
        throw new ValidationError('unknown session');
      }

      user.ready = true;

      store.setMicEnabled(socket.id, micEnabled);
      store.markDirty(socket.id);

      socket.to(identity.roomId).emit('peer:media-state', {
        id: socket.id,
        micEnabled,
      });

      peerGraph.reconcile(store.byRoom(identity.roomId));

      return {};
    }),
  );

  // ------------------------------------------------------------- movement
  socket.on(
    'position:update',
    safe(async (payload) => {
      if (!identity) {
        throw new ValidationError('join a room first');
      }

      if (!positionBucket.take()) {
        return {};
      }

      const previous = store.get(socket.id);

      if (!previous) {
        throw new ValidationError('unknown session');
      }

      // Use the actual dimensions of the active room.
      const room = services.getCachedRoom(identity.roomId);

      if (!room) {
        throw new ValidationError(
          'room configuration is unavailable',
        );
      }

      const roomWorld = {
        width: room.width,
        height: room.height,
      };

      const next = validatePosition(payload, {
        world: roomWorld,
        previous,
        maxSpeedPxPerSec: cfg.world.maxSpeedPxPerSec,
        minDtMs: cfg.presence.positionThrottleMs,
        now: Date.now(),
      });

      // Keep the avatar center inside the room, accounting for its radius.
      const boundedX = Math.min(
        Math.max(next.x, AVATAR_RADIUS),
        roomWorld.width - AVATAR_RADIUS,
      );

      const boundedY = Math.min(
        Math.max(next.y, AVATAR_RADIUS),
        roomWorld.height - AVATAR_RADIUS,
      );

      // Resolve furniture and wall collisions.
      const resolved = resolveCollision(
        boundedX,
        boundedY,
        AVATAR_RADIUS,
        room.obstacles,
      );

      // Collision resolution must not move the avatar outside the room.
      const finalX = Math.min(
        Math.max(resolved.x, AVATAR_RADIUS),
        roomWorld.width - AVATAR_RADIUS,
      );

      const finalY = Math.min(
        Math.max(resolved.y, AVATAR_RADIUS),
        roomWorld.height - AVATAR_RADIUS,
      );

      const user = store.move(socket.id, {
        x: finalX,
        y: finalY,
        angle: next.angle,
      });

      store.markDirty(socket.id);

      socket.to(identity.roomId).volatile.emit('presence:moved', {
        id: user.id,
        x: user.x,
        y: user.y,
        angle: user.angle,
      });

      const members = store.byRoom(identity.roomId);

      peerGraph.reconcileMember(user, members);
      peerGraph.refreshSoundFactors(members);

      return {
        x: user.x,
        y: user.y,
        angle: user.angle,
        hit: resolved.hit,
        clamped: Boolean(next.clamped),
      };
    }),
  );

  // ------------------------------------------------------------ heartbeat
  socket.on(
    'presence:heartbeat',
    safe(async () => {
      store.touch(socket.id);
      return {};
    }),
  );

  socket.on(
    'presence:request-sync',
    safe(async (payload) => {
      if (!identity) {
        throw new ValidationError('join a room first');
      }

      const roomId = requireString(
        payload?.roomId ?? identity.roomId,
        'roomId',
      );

      const members = store
        .byRoom(roomId)
        .map(wireUser);

      socket.emit('presence:snapshot', {
        roomId,
        peers: members,
        edges: peerGraph.stats(),
      });

      return {
        peers: members.length,
      };
    }),
  );

  // ----------------------------------------------------------- WebRTC relay
  socket.on(
    'peer:signal',
    safe(async (payload) => {
      if (!identity) {
        throw new ValidationError('join a room first');
      }

      if (!signalBucket.take()) {
        throw Object.assign(
          new Error('signal rate limit'),
          { status: 429 },
        );
      }

      const { to, data } = validateSignal(payload);

      if (to === socket.id) {
        return {};
      }

      const edge = peerGraph.noteSignal(socket.id, to);

      if (!edge) {
        socketsLog.debug(
          `dropped ${data.type} for ${to} (no edge in earshot)`,
        );

        return {};
      }

      if (data.type === 'answer') {
        peerGraph.markLive(socket.id, to);
      }

      io.to(to).emit('peer:signal', {
        from: socket.id,
        data,
        generation: edge.generation,
      });

      return {};
    }),
  );

  // ------------------------------------------------------------- room leave
  async function leaveRoom(reason) {
    if (leaveInProgress) {
      return leaveInProgress;
    }

    if (!identity) {
      return false;
    }

    const leavingIdentity = identity;
    const { roomId } = leavingIdentity;

    leaveInProgress = (async () => {
      try {
        peerGraph.removeUser(socket.id, reason);

        socket.to(roomId).emit('peer:left', {
          id: socket.id,
          reason,
        });

        try {
          await Promise.resolve(socket.leave(roomId));
        } catch {
          // The socket adapter may already have removed room membership.
        }

        store.remove(socket.id);
        await store.removeFromMongo(socket.id);

        redisBus?.publish(
          makeEvent('presence:leave', {
            id: socket.id,
            roomId,
            instanceId: cfg.server.instanceId,
          }),
        );

        peerGraph.reconcile(store.byRoom(roomId));

        socketsLog.info(`left ${roomId} (${reason})`);

        return true;
      } finally {
        if (identity === leavingIdentity) {
          identity = null;
        }

        socket.data.roomId = null;
        socket.data.userId = null;
        leaveInProgress = null;
      }
    })();

    return leaveInProgress;
  }

  socket.on(
    'room:leave',
    safe(async () => {
      const left = await leaveRoom('client-leave');

      return { left };
    }),
  );

  // ------------------------------------------------------------- disconnect
  socket.on('disconnect', async (reason) => {
    try {
      await leaveRoom(reason);
    } catch (err) {
      socketsLog.error(
        'disconnect cleanup failed:',
        err.message,
      );
    }
  });

  socket.on('error', (err) => {
    socketsLog.error('socket error:', err.message);
  });

  socket.emit('system:hello', {
    instanceId: cfg.server.instanceId,
    scaleMode: redisBus?.mode ?? 'single',
    serverTime: Date.now(),
  });
}

/**
 * Resolve an initial spawn against the selected room's dimensions and
 * solid obstacles. Prefer the requested/configured spawn, then try the
 * remaining configured spawn points, followed by deterministic fallback
 * candidates. If the room has no safe spawn, reject the join rather than
 * placing the avatar inside furniture or outside the room.
 */
function resolveSafeSpawn({
  room,
  preferredSpawn,
  occupants,
}) {
  const minX = AVATAR_RADIUS;
  const minY = AVATAR_RADIUS;
  const maxX = room.width - AVATAR_RADIUS;
  const maxY = room.height - AVATAR_RADIUS;

  const configuredPoints = Array.isArray(room.spawnPoints)
    ? room.spawnPoints
    : [];

  const candidates = [
    preferredSpawn,
    ...configuredPoints,
    { x: 60, y: 60 },
    { x: room.width / 2, y: room.height / 2 },
    { x: room.width - 60, y: 60 },
    { x: 60, y: room.height - 60 },
    { x: room.width - 60, y: room.height - 60 },
  ];

  // Add a deterministic grid as a final fallback for rooms whose configured
  // spawn points happen to overlap obstacles.
  const step = Math.max(AVATAR_RADIUS * 3, 48);

  for (let y = minY + step; y < maxY; y += step) {
    for (let x = minX + step; x < maxX; x += step) {
      candidates.push({ x, y });
    }
  }

  const seen = new Set();

  for (const candidate of candidates) {
    if (
      !candidate ||
      !Number.isFinite(candidate.x) ||
      !Number.isFinite(candidate.y)
    ) {
      continue;
    }

    const candidateX = clampNumber(candidate.x, minX, maxX);
    const candidateY = clampNumber(candidate.y, minY, maxY);
    const key = `${candidateX}:${candidateY}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const resolved = resolveCollision(
      candidateX,
      candidateY,
      AVATAR_RADIUS,
      room.obstacles ?? [],
    );

    const x = clampNumber(resolved.x, minX, maxX);
    const y = clampNumber(resolved.y, minY, maxY);

    if (!isSpawnClear(x, y, room.obstacles ?? [])) {
      continue;
    }

    /*
     * Prefer a valid candidate with reasonable separation from other users.
     * If all candidates are close to occupants, the first collision-free
     * candidate remains a valid fallback.
     */
    const occupiedByAvatar = occupants.some(
      (occupant) =>
        Math.hypot(occupant.x - x, occupant.y - y) <
        AVATAR_RADIUS * 2,
    );

    if (!occupiedByAvatar) {
      return { x, y };
    }
  }

  throw new ValidationError(
    'no safe spawn position is available in this room',
    { field: 'spawn' },
  );
}

/**
 * A spawn is clear only if the avatar circle does not overlap any solid
 * obstacle. Non-solid obstacles are intentionally ignored.
 */
function isSpawnClear(x, y, obstacles) {
  return !obstacles.some((obstacle) => {
    if (obstacle.solid === false) {
      return false;
    }

    const nearestX = clampNumber(
      x,
      obstacle.x,
      obstacle.x + obstacle.w,
    );

    const nearestY = clampNumber(
      y,
      obstacle.y,
      obstacle.y + obstacle.h,
    );

    const dx = x - nearestX;
    const dy = y - nearestY;

    return dx * dx + dy * dy < AVATAR_RADIUS * AVATAR_RADIUS;
  });
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const wireUser = (user) => ({
  id: user.id,
  name: user.name,
  color: user.color,
  avatar: user.avatar,
  x: user.x,
  y: user.y,
  angle: user.angle,
  micEnabled: user.micEnabled !== false,
  ready: user.ready === true,
});

export default createSocketServer;