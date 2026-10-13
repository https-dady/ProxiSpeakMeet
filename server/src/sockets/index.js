/**
 * Socket.io signaling server (Week 1 + 2).
 *
 * Responsibilities
 *  - room lifecycle (join / leave / rejoin after a reconnect)
 *  - authoritative avatar position with anti-teleport validation
 *  - P2P handshake orchestration: offers/answers/ICE are relayed ONLY between
 *    avatars that the PeerGraph says are inside each other's earshot
 *  - cross-instance events through Redis Pub/Sub
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
import { validateRoomJoin, validatePosition, validateSignal, validateMediaState } from './validation.js';

const AVATAR_RADIUS = 14; // pixels; collision half-extent

export function createSocketServer({ httpServer, services, redisBus, config: cfg = config, logger: log = logger }) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin(cfg),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Long enough to survive a sleeping laptop, short enough to drop ghosts.
    pingInterval: 10000,
    pingTimeout: 8000,
    maxHttpBufferSize: 1e6,
    transports: ['websocket', 'polling'],
  });

  if (redisBus?.adapter) {
    io.adapter(redisBus.adapter);
    log.info(`socket.io redis adapter attached (instance ${cfg.server.instanceId})`);
  }

  // `services` needs a way to reach the socket layer, so the emitter is bound
  // after the server exists.
  services.peerGraph.setEmitter?.((to, event, payload) => io.to(to).emit(event, payload));

  io.on('connection', (socket) => onConnection({ socket, io, services, redisBus, cfg, log }));

  return io;
}

function onConnection({ socket, io, services, redisBus, cfg, log }) {
  const { store, peerGraph, getRoom, chooseSpawn } = services;
  const socketsLog = log.child(socket.id.slice(0, 6));

  const positionBucket = new TokenBucket({ capacity: cfg.limits.positionEventsPerSec, refillPerSec: cfg.limits.positionEventsPerSec });
  const signalBucket = new TokenBucket({ capacity: cfg.limits.signalEventsPerSec, refillPerSec: cfg.limits.signalEventsPerSec });

  /** @type {{roomId:string,name:string,color:string,avatar:string}|null} */
  let identity = null;

  const safe = (handler) => async (payload, ack) => {
    try {
      const result = await handler(payload);
      if (typeof ack === 'function') ack({ ok: true, ...result });
    } catch (err) {
      const status = err.status ?? 500;
      if (status >= 500) socketsLog.error(`${err.name}: ${err.message}`);
      else socketsLog.debug(`rejected event: ${err.message}`);
      if (typeof ack === 'function') ack({ ok: false, error: err.message, field: err.details?.field });
      else socket.emit('system:error', { message: err.message });
    }
  };

  // ---------------------------------------------------------------- join ---
  socket.on(
    'room:join',
    safe(async (payload) => {
      const { roomId, name, color, avatar, spawn } = validateRoomJoin(payload, { world: cfg.world });
      const occupants = store.byRoom(roomId);

      if (occupants.length >= cfg.limits.maxUsersPerRoom && !occupants.some((u) => u.id === socket.id)) {
        throw Object.assign(new Error(`room "${roomId}" is full (${cfg.limits.maxUsersPerRoom} max)`), { status: 503 });
      }

      const room = await getRoom(roomId, { persist: true });
      const position = spawn ?? chooseSpawn(room.spawnPoints, occupants);

      // Leave a previous room cleanly before switching (handles reconnects that
      // reuse a different socket id, and room switching without a reload).
      if (identity && identity.roomId !== roomId) await leaveRoom('room-switch');

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
      identity = { roomId, name, color, avatar };

      socket.data.userId = socket.id;
      socket.data.roomId = roomId;
      await socket.join(roomId);

      const peers = occupants.map(wireUser);
      socket.to(roomId).emit('peer:joined', { peer: wireUser(user) });

      socketsLog.info(`joined ${roomId} as "${name}" (${occupants.length} others)`);

      return {
        self: wireUser(user),
        room,
        peers,
        config: {
          earshotRadiusPx: cfg.world.earshotRadiusPx,
          clusterGapPx: cfg.world.clusterGapPx,
          positionThrottleMs: cfg.presence.positionThrottleMs,
          heartbeatIntervalMs: cfg.presence.heartbeatIntervalMs,
          iceServers: cfg.webrtc.iceServers,
          instanceId: cfg.server.instanceId,
          scaleMode: redisBus?.mode ?? 'single',
        },
      };
    }),
  );

  // ---------------------------------------------------- media readiness ---
  // getUserMedia must succeed on *both* ends before an offer is created,
  // otherwise the negotiation dies on a MediaStream-less transceiver.
  socket.on(
    'peer:media-ready',
    safe(async (payload) => {
      if (!identity) throw new ValidationError('join a room first');
      const { micEnabled } = validateMediaState(payload);
      const user = store.get(socket.id);
      if (!user) throw new ValidationError('unknown session');
      user.ready = true;
      store.setMicEnabled(socket.id, micEnabled);
      store.markDirty(socket.id);
      socket.to(identity.roomId).emit('peer:media-state', { id: socket.id, micEnabled });
      peerGraph.reconcile(store.byRoom(identity.roomId));
      return {};
    }),
  );

  // ---------------------------------------------------------- movement ----
  socket.on(
    'position:update',
    safe(async (payload) => {
      if (!identity) throw new ValidationError('join a room first');
      if (!positionBucket.take()) return {}; // throttled: silently drop, never queue

      const previous = store.get(socket.id);
      if (!previous) throw new ValidationError('unknown session');

      const next = validatePosition(payload, {
        world: cfg.world,
        previous,
        maxSpeedPxPerSec: cfg.world.maxSpeedPxPerSec,
        minDtMs: cfg.presence.positionThrottleMs,
        now: Date.now(),
      });

      // Furniture blocks movement, not just sound.
      const room = services.getCachedRoom(identity.roomId);
      const resolved = room
        ? resolveCollision(next.x, next.y, AVATAR_RADIUS, room.obstacles)
        : { x: next.x, y: next.y, hit: false };

      const user = store.move(socket.id, { x: resolved.x, y: resolved.y, angle: next.angle });
      store.markDirty(socket.id);

      // Delta broadcast (never the whole room) — this is the 50+ user path.
      socket.to(identity.roomId).volatile.emit('presence:moved', {
        id: user.id,
        x: user.x,
        y: user.y,
        angle: user.angle,
      });

      // Entering / leaving earshot adds or removes mesh edges immediately.
      const members = store.byRoom(identity.roomId);
      peerGraph.reconcileMember(user, members);
      peerGraph.refreshSoundFactors(members);

      // Echo the authoritative position so the client can reconcile prediction.
      return { x: user.x, y: user.y, angle: user.angle, hit: resolved.hit, clamped: Boolean(next.clamped) };
    }),
  );

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
      if (!identity) throw new ValidationError('join a room first');
      const roomId = requireString(payload?.roomId ?? identity.roomId, 'roomId');
      const members = store.byRoom(roomId).map(wireUser);
      socket.emit('presence:snapshot', { roomId, peers: members, edges: peerGraph.stats() });
      return { peers: members.length };
    }),
  );

  // ------------------------------------------------------- WebRTC relay ---
  socket.on(
    'peer:signal',
    safe(async (payload) => {
      if (!identity) throw new ValidationError('join a room first');
      if (!signalBucket.take()) throw Object.assign(new Error('signal rate limit'), { status: 429 });

      const { to, data } = validateSignal(payload);
      if (to === socket.id) return {};

      // Hard rule: signalling is only ever relayed for an edge the PeerGraph
      // currently owns. This single check is what keeps stale offers and
      // out-of-range negotiations from ever reaching a browser.
      const edge = peerGraph.noteSignal(socket.id, to);
      if (!edge) {
        socketsLog.debug(`dropped ${data.type} for ${to} (no edge in earshot)`);
        return {};
      }
      if (data.type === 'answer') peerGraph.markLive(socket.id, to);

      io.to(to).emit('peer:signal', { from: socket.id, data, generation: edge.generation });
      return {};
    }),
  );

  // ---------------------------------------------------------- disconnect --
  async function leaveRoom(reason) {
    if (!identity) return;
    const { roomId } = identity;
    peerGraph.removeUser(socket.id, reason);
    socket.to(roomId).emit('peer:left', { id: socket.id, reason });
    // `leave()` returns a promise on the async adapters and a value otherwise,
    // so it is awaited defensively rather than chained.
    try {
      await Promise.resolve(socket.leave(roomId));
    } catch {
      /* adapter already dropped the membership */
    }
    store.remove(socket.id);
    await store.removeFromMongo(socket.id);
    redisBus?.publish(makeEvent('presence:leave', { id: socket.id, roomId, instanceId: cfg.server.instanceId }));
    identity = null;
    socket.data.roomId = null;
    peerGraph.reconcile(store.byRoom(roomId));
    socketsLog.info(`left ${roomId} (${reason})`);
  }

  socket.on('disconnect', async (reason) => {
    try {
      await leaveRoom(reason);
    } catch (err) {
      socketsLog.error('disconnect cleanup failed:', err.message);
    }
  });

  socket.on('error', (err) => socketsLog.error('socket error:', err.message));

  socket.emit('system:hello', {
    instanceId: cfg.server.instanceId,
    scaleMode: redisBus?.mode ?? 'single',
    serverTime: Date.now(),
  });
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