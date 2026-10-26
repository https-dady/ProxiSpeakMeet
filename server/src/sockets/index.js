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
  requireActiveRoomMembership,
} from './membership.js';

import {
  getAuthorizedPeerSignalEdge,
} from './signalingAuthorization.js';

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
        ack({
          ok: true,
          ...result,
        });
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

  // -------------------------------------------------------------
  // Room join
  // -------------------------------------------------------------

  socket.on(
    'room:join',
    safe(async (payload) => {
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
       * An idempotent same-room join returns the existing session
       * instead of creating a duplicate presence record.
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

      let requestedSpawn = null;

      if (
        payload?.spawn !== undefined &&
        payload?.spawn !== null
      ) {
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

  // -------------------------------------------------------------
  // Microphone readiness
  // -------------------------------------------------------------

  socket.on(
    'peer:media-ready',
    safe(async (payload) => {
      requireActiveRoomMembership({
        identity,
        socket,
        store,
      });

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

  // -------------------------------------------------------------
  // Authoritative avatar movement
  // -------------------------------------------------------------

  socket.on(
    'position:update',
    safe(async (payload) => {
      requireActiveRoomMembership({
        identity,
        socket,
        store,
      });

      if (!positionBucket.take()) {
        return {};
      }

      const previous = store.get(socket.id);

      if (!previous) {
        throw new ValidationError('unknown session');
      }

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

      const boundedX = Math.min(
        Math.max(next.x, AVATAR_RADIUS),
        roomWorld.width - AVATAR_RADIUS,
      );

      const boundedY = Math.min(
        Math.max(next.y, AVATAR_RADIUS),
        roomWorld.height - AVATAR_RADIUS,
      );

      const resolved = resolveCollision(
        boundedX,
        boundedY,
        AVATAR_RADIUS,
        room.obstacles,
      );

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

  // -------------------------------------------------------------
  // Presence heartbeat
  // -------------------------------------------------------------

  socket.on(
    'presence:heartbeat',
    safe(async () => {
      requireActiveRoomMembership({
        identity,
        socket,
        store,
      });

      const user = store.touch(socket.id);

      if (!user) {
        throw new ValidationError(
          'active room membership is required',
        );
      }

      return {};
    }),
  );

  // -------------------------------------------------------------
  // Presence synchronization
  // -------------------------------------------------------------

  socket.on(
    'presence:request-sync',
    safe(async (payload) => {
      requireActiveRoomMembership({
        identity,
        socket,
        store,
      });

      const roomId = requireString(
        payload?.roomId ?? identity.roomId,
        'roomId',
      );

      /*
       * Step 1.1:
       * A socket can only request the snapshot of its authoritative room.
       */
      if (roomId !== identity.roomId) {
        throw new ValidationError(
          'cannot synchronize presence for another room',
        );
      }

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

  // -------------------------------------------------------------
  // WebRTC signaling relay
  // -------------------------------------------------------------

  socket.on(
    'peer:signal',
    safe(async (payload) => {
      /*
       * Step 1.2:
       * Verify the sender's active Socket.IO room membership and
       * authoritative PresenceStore record.
       */
      requireActiveRoomMembership({
        identity,
        socket,
        store,
      });

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

      /*
       * Step 1.3:
       * Both participants must have active presence records in the
       * sender's authoritative room, and a PeerGraph edge must exist
       * for that same room.
       */
      const authorizedEdge = getAuthorizedPeerSignalEdge({
        senderId: socket.id,
        recipientId: to,
        roomId: identity.roomId,
        store,
        peerGraph,
      });

      if (!authorizedEdge) {
        socketsLog.debug(
          `dropped ${data.type} for ${to} (not an authorized same-room peer)`,
        );

        // Preserve the existing acknowledgement contract.
        return {};
      }

      /*
       * Re-check the edge after updating its activity so that a stale
       * or replaced peer connection cannot receive the signal.
       */
      const edge = peerGraph.noteSignal(socket.id, to);

      if (
        !edge ||
        edge.generation !== authorizedEdge.generation ||
        edge.roomId !== identity.roomId
      ) {
        socketsLog.debug(
          `dropped ${data.type} for ${to} (peer edge changed during authorization)`,
        );

        return {};
      }

      if (data.type === 'answer') {
        peerGraph.markLive(socket.id, to);
      }

      /*
       * Keep the existing WebRTC signaling payload unchanged.
       */
      io.to(to).emit('peer:signal', {
        from: socket.id,
        data,
        generation: edge.generation,
      });

      return {};
    }),
  );

  // -------------------------------------------------------------
  // Room leave and cleanup
  // -------------------------------------------------------------

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
          // The adapter may already have removed room membership.
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

  // -------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------

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
 * Resolve an initial spawn using the selected room's dimensions,
 * solid obstacles and current occupants.
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

    const candidateX = clampNumber(
      candidate.x,
      minX,
      maxX,
    );

    const candidateY = clampNumber(
      candidate.y,
      minY,
      maxY,
    );

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

    const x = clampNumber(
      resolved.x,
      minX,
      maxX,
    );

    const y = clampNumber(
      resolved.y,
      minY,
      maxY,
    );

    if (!isSpawnClear(x, y, room.obstacles ?? [])) {
      continue;
    }

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
 * Check whether an avatar overlaps any solid obstacle.
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

    return (
      dx * dx + dy * dy <
      AVATAR_RADIUS * AVATAR_RADIUS
    );
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