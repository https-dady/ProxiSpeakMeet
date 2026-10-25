/**
 * Payload validation for every socket event the server accepts.
 */
import { ValidationError } from '../utils/errors.js';
import {
  isPlainObject,
  requireFiniteNumber,
  requireString,
  round2,
  clamp,
} from '../utils/validate.js';

const ROOM_ID = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SIGNAL_TYPES = new Set(['offer', 'answer', 'candidate']);
const MAX_SIGNAL_BYTES = 96 * 1024;

export const AVATARS = ['circle', 'square', 'triangle', 'hex'];

/**
 * Validate the room-join payload.
 *
 * Room dimensions are deliberately not used to clamp spawn coordinates here.
 * The socket handler loads the selected room and validates its spawn against
 * that room's actual geometry.
 */
export function validateRoomJoin(payload, { world } = {}) {
  const data = isPlainObject(payload) ? payload : {};

  const rawRoomId = requireString(
    data.roomId ?? 'lobby',
    'roomId',
    {
      min: 1,
      max: 48,
    },
  );

  const roomId = rawRoomId.toLowerCase();

  if (!ROOM_ID.test(roomId)) {
    throw new ValidationError(
      '"roomId" may only contain a-z, 0-9, "-" and "_" and must start with a letter or number',
      { field: 'roomId' },
    );
  }

  const name = requireString(
    data.name ?? 'Guest',
    'name',
    {
      min: 1,
      max: 24,
    },
  );

  const color =
    data.color === undefined || data.color === null
      ? '#4f8cff'
      : requireString(data.color, 'color', {
          pattern: HEX_COLOR,
        });

  const avatar = AVATARS.includes(data.avatar)
    ? data.avatar
    : 'circle';

  let spawn = null;

  if (data.spawn !== undefined && data.spawn !== null) {
    if (!isPlainObject(data.spawn)) {
      throw new ValidationError(
        '"spawn" must be an object containing finite x and y coordinates',
        { field: 'spawn' },
      );
    }

    const x = requireFiniteNumber(
      data.spawn.x,
      'spawn.x',
    );

    const y = requireFiniteNumber(
      data.spawn.y,
      'spawn.y',
    );

    /*
     * Do not clamp against the global world dimensions.
     * The selected room's dimensions are not available in this validator.
     * The room-aware socket handler performs the boundary check.
     */
    spawn = { x, y };
  }

  return {
    roomId,
    name,
    color,
    avatar,
    spawn,
  };
}

/**
 * Validate and normalize an authoritative movement update.
 *
 * Coordinates are bounded to the supplied world's dimensions. The socket
 * handler must supply the active room's dimensions, not global dimensions.
 * The anti-teleport check limits travel between authoritative updates.
 */
export function validatePosition(
  payload,
  {
    world,
    previous,
    maxSpeedPxPerSec,
    now,
    minDtMs = 16,
  },
) {
  if (
    !world ||
    !Number.isFinite(world.width) ||
    !Number.isFinite(world.height) ||
    world.width <= 0 ||
    world.height <= 0
  ) {
    throw new ValidationError(
      'valid world dimensions are required for position validation',
    );
  }

  const data = isPlainObject(payload) ? payload : {};

  const x = requireFiniteNumber(
    data.x,
    'x',
    {
      min: -1e6,
      max: 1e6,
    },
  );

  const y = requireFiniteNumber(
    data.y,
    'y',
    {
      min: -1e6,
      max: 1e6,
    },
  );

  const angle =
    data.angle === undefined
      ? previous?.angle ?? 0
      : requireFiniteNumber(data.angle, 'angle');

  const bounded = {
    x: round2(clamp(x, 0, world.width)),
    y: round2(clamp(y, 0, world.height)),
    angle: round2(
      ((angle % (Math.PI * 2)) + Math.PI * 2) %
        (Math.PI * 2),
    ),
  };

  /*
   * Anti-cheat: a client cannot teleport.
   * Movement beyond the configured speed is clamped to the maximum
   * physically reachable distance since the previous update.
   */
  if (previous) {
    const dt =
      Math.max(minDtMs, now - previous.updatedAt) / 1000;

    const distance = Math.hypot(
      bounded.x - previous.x,
      bounded.y - previous.y,
    );

    const maxDistance =
      maxSpeedPxPerSec * dt * 1.35;

    if (distance > maxDistance && distance > 0) {
      const ratio = maxDistance / distance;

      bounded.x = round2(
        previous.x +
          (bounded.x - previous.x) * ratio,
      );

      bounded.y = round2(
        previous.y +
          (bounded.y - previous.y) * ratio,
      );

      bounded.clamped = true;
    }
  }

  return bounded;
}

/**
 * Validate WebRTC signaling messages.
 */
export function validateSignal(payload) {
  const data = isPlainObject(payload) ? payload : {};

  const to = requireString(
    data.to,
    'to',
    {
      min: 1,
      max: 64,
    },
  );

  const signal = isPlainObject(data.data)
    ? data.data
    : null;

  if (!signal) {
    throw new ValidationError(
      '"data" must be an object',
      { field: 'data' },
    );
  }

  if (!SIGNAL_TYPES.has(signal.type)) {
    throw new ValidationError(
      '"data.type" must be offer | answer | candidate',
      { field: 'data.type' },
    );
  }

  const size = Buffer.byteLength(
    JSON.stringify(signal),
  );

  if (size > MAX_SIGNAL_BYTES) {
    throw new ValidationError(
      'signal payload too large',
      {
        field: 'data',
        size,
      },
    );
  }

  if (signal.type === 'candidate') {
    // End-of-candidates marker has no candidate field.
    if (
      signal.candidate === null ||
      signal.candidate === undefined
    ) {
      return {
        to,
        data: {
          type: 'candidate',
          candidate: null,
        },
      };
    }

    if (!isPlainObject(signal.candidate)) {
      throw new ValidationError(
        '"data.candidate" must be an object',
        { field: 'data.candidate' },
      );
    }

    return {
      to,
      data: {
        type: 'candidate',
        candidate: signal.candidate,
      },
    };
  }

  if (
    typeof signal.sdp !== 'string' ||
    signal.sdp.length === 0
  ) {
    throw new ValidationError(
      '"data.sdp" is required for offer/answer',
      { field: 'data.sdp' },
    );
  }

  return {
    to,
    data: {
      type: signal.type,
      sdp: signal.sdp,
    },
  };
}

/**
 * Normalize the microphone state sent by a peer.
 */
export function validateMediaState(payload) {
  const data = isPlainObject(payload) ? payload : {};

  return {
    micEnabled: data.micEnabled !== false,
  };
}