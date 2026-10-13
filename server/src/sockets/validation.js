/** Payload validation for every socket event the server accepts. */
import { ValidationError } from '../utils/errors.js';
import { isPlainObject, requireFiniteNumber, requireString, round2, clamp } from '../utils/validate.js';

const ROOM_ID = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SIGNAL_TYPES = new Set(['offer', 'answer', 'candidate']);
const MAX_SIGNAL_BYTES = 96 * 1024; // an SDP blob is the biggest thing we relay

export const AVATARS = ['circle', 'square', 'triangle', 'hex'];

export function validateRoomJoin(payload, { world }) {
  const data = isPlainObject(payload) ? payload : {};
  const rawRoomId = requireString(data.roomId ?? 'lobby', 'roomId', { min: 1, max: 48 });
  const roomId = rawRoomId.toLowerCase();
  if (!ROOM_ID.test(roomId)) {
    throw new ValidationError('"roomId" may only contain a-z, 0-9, "-" and "_"', { field: 'roomId' });
  }
  const name = requireString(data.name ?? 'Guest', 'name', { min: 1, max: 24 });
  const color = data.color === undefined || data.color === null ? '#4f8cff' : requireString(data.color, 'color', { pattern: HEX_COLOR });
  const avatar = AVATARS.includes(data.avatar) ? data.avatar : 'circle';
  const spawn = isPlainObject(data.spawn) && Number.isFinite(data.spawn.x) && Number.isFinite(data.spawn.y)
    ? { x: clamp(data.spawn.x, 0, world.width), y: clamp(data.spawn.y, 0, world.height) }
    : null;

  return { roomId, name, color, avatar, spawn };
}

export function validatePosition(payload, { world, previous, maxSpeedPxPerSec, now, minDtMs = 16 }) {
  const data = isPlainObject(payload) ? payload : {};
  const x = requireFiniteNumber(data.x, 'x', { min: -1e6, max: 1e6 });
  const y = requireFiniteNumber(data.y, 'y', { min: -1e6, max: 1e6 });
  const angle = data.angle === undefined ? (previous?.angle ?? 0) : requireFiniteNumber(data.angle, 'angle');

  const bounded = {
    x: round2(clamp(x, 0, world.width)),
    y: round2(clamp(y, 0, world.height)),
    angle: round2(((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)),
  };

  // Anti-cheat: a client cannot teleport. Anything faster than the configured
  // top speed is clamped back to what was physically reachable since the last
  // authoritative update. `minDtMs` is the client's broadcast throttle, so one
  // update is never credited with less travel than a real tick would allow.
  if (previous) {
    const dt = Math.max(minDtMs, now - previous.updatedAt) / 1000;
    const distance = Math.hypot(bounded.x - previous.x, bounded.y - previous.y);
    const maxDistance = maxSpeedPxPerSec * dt * 1.35; // 35% tolerance for jitter/lag
    if (distance > maxDistance && distance > 0) {
      const ratio = maxDistance / distance;
      bounded.x = round2(previous.x + (bounded.x - previous.x) * ratio);
      bounded.y = round2(previous.y + (bounded.y - previous.y) * ratio);
      bounded.clamped = true;
    }
  }
  return bounded;
}

export function validateSignal(payload) {
  const data = isPlainObject(payload) ? payload : {};
  const to = requireString(data.to, 'to', { min: 1, max: 64 });
  const signal = isPlainObject(data.data) ? data.data : null;
  if (!signal) throw new ValidationError('"data" must be an object', { field: 'data' });
  if (!SIGNAL_TYPES.has(signal.type)) throw new ValidationError('"data.type" must be offer | answer | candidate', { field: 'data.type' });

  const size = Buffer.byteLength(JSON.stringify(signal));
  if (size > MAX_SIGNAL_BYTES) throw new ValidationError('signal payload too large', { field: 'data', size });

  if (signal.type === 'candidate') {
    // End-of-candidates marker has no candidate field.
    if (signal.candidate === null || signal.candidate === undefined) return { to, data: { type: 'candidate', candidate: null } };
    if (!isPlainObject(signal.candidate)) throw new ValidationError('"data.candidate" must be an object', { field: 'data.candidate' });
    return { to, data: { type: 'candidate', candidate: signal.candidate } };
  }

  if (typeof signal.sdp !== 'string' || signal.sdp.length === 0) {
    throw new ValidationError('"data.sdp" is required for offer/answer', { field: 'data.sdp' });
  }
  return { to, data: { type: signal.type, sdp: signal.sdp } };
}

export function validateMediaState(payload) {
  const data = isPlainObject(payload) ? payload : {};
  return { micEnabled: data.micEnabled !== false };
}