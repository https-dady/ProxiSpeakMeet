/**
 * Strict payload validation and normalization for client-originated socket events.
 * Keep this module free of socket/server state so it can be unit-tested directly.
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
const MAX_SDP_LENGTH = MAX_SIGNAL_BYTES;

export const AVATARS = ['circle', 'square', 'triangle', 'hex'];

function requirePayloadObject(payload, field = 'payload') {
  if (!isPlainObject(payload)) {
    throw new ValidationError(`"${field}" must be an object`, { field });
  }

  return payload;
}

/**
 * Validate the room-join payload.
 *
 * Room dimensions are deliberately not used to clamp spawn coordinates here.
 * The socket handler loads the selected room and validates its spawn against
 * that room's actual geometry.
 */
export function validateRoomJoin(payload, { world } = {}) {
  const data = payload === undefined || payload === null
    ? {}
    : requirePayloadObject(payload);

  const rawRoomId = requireString(
    data.roomId ?? 'lobby',
    'roomId',
    { min: 1, max: 48 },
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
    { min: 1, max: 24 },
  );

  const color = data.color === undefined || data.color === null
    ? '#4f8cff'
    : requireString(data.color, 'color', { pattern: HEX_COLOR });

  let avatar = 'circle';

  if (data.avatar !== undefined && data.avatar !== null) {
    avatar = requireString(data.avatar, 'avatar', { min: 1, max: 16 });

    if (!AVATARS.includes(avatar)) {
      throw new ValidationError(
        `"avatar" must be one of: ${AVATARS.join(', ')}`,
        { field: 'avatar' },
      );
    }
  }

  let spawn = null;

  if (data.spawn !== undefined && data.spawn !== null) {
    const spawnData = requirePayloadObject(data.spawn, 'spawn');

    const x = requireFiniteNumber(spawnData.x, 'spawn.x', {
      min: -1e6,
      max: 1e6,
    });

    const y = requireFiniteNumber(spawnData.y, 'spawn.y', {
      min: -1e6,
      max: 1e6,
    });

    // Room-aware boundary checks happen in the socket handler after getRoom().
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
 * Coordinates are bounded to the active room's dimensions, and travel between
 * updates is limited to the configured maximum speed plus a small jitter margin.
 */
export function validatePosition(
  payload,
  {
    world,
    previous,
    maxSpeedPxPerSec,
    now,
    minDtMs = 16,
  } = {},
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

  if (!Number.isFinite(maxSpeedPxPerSec) || maxSpeedPxPerSec < 0) {
    throw new ValidationError('valid max movement speed is required');
  }

  if (!Number.isFinite(now)) {
    throw new ValidationError(
      'valid timestamp is required for position validation',
    );
  }

  const data = requirePayloadObject(payload);

  const x = requireFiniteNumber(data.x, 'x', {
    min: -1e6,
    max: 1e6,
  });

  const y = requireFiniteNumber(data.y, 'y', {
    min: -1e6,
    max: 1e6,
  });

  const angle = data.angle === undefined
    ? previous?.angle ?? 0
    : requireFiniteNumber(data.angle, 'angle', {
        min: -1e9,
        max: 1e9,
      });

  const bounded = {
    x: round2(clamp(x, 0, world.width)),
    y: round2(clamp(y, 0, world.height)),
    angle: round2(
      ((angle % (Math.PI * 2)) + Math.PI * 2) %
        (Math.PI * 2),
    ),
  };

  if (previous) {
    if (
      !Number.isFinite(previous.x) ||
      !Number.isFinite(previous.y) ||
      !Number.isFinite(previous.updatedAt)
    ) {
      throw new ValidationError('previous position state is invalid');
    }

    const dt = Math.max(minDtMs, now - previous.updatedAt) / 1000;

    const distance = Math.hypot(
      bounded.x - previous.x,
      bounded.y - previous.y,
    );

    const maxDistance = maxSpeedPxPerSec * dt * 1.35;

    if (distance > maxDistance && distance > 0) {
      const ratio = maxDistance / distance;

      bounded.x = round2(
        previous.x + (bounded.x - previous.x) * ratio,
      );

      bounded.y = round2(
        previous.y + (bounded.y - previous.y) * ratio,
      );

      bounded.clamped = true;
    }
  }

  return bounded;
}

/**
 * Validate and normalize WebRTC offer, answer, and ICE candidate messages.
 */
export function validateSignal(payload) {
  const data = requirePayloadObject(payload);

  const to = requireString(data.to, 'to', {
    min: 1,
    max: 64,
  });

  const signal = requirePayloadObject(data.data, 'data');

  if (!SIGNAL_TYPES.has(signal.type)) {
    throw new ValidationError(
      '"data.type" must be offer | answer | candidate',
      { field: 'data.type' },
    );
  }

  let normalizedSignal;

  if (signal.type === 'candidate') {
    if (
      signal.candidate === null ||
      signal.candidate === undefined
    ) {
      normalizedSignal = {
        type: 'candidate',
        candidate: null,
      };
    } else {
      const candidate = requirePayloadObject(
        signal.candidate,
        'data.candidate',
      );

      if (typeof candidate.candidate !== 'string') {
        throw new ValidationError(
          '"data.candidate.candidate" must be a string',
          { field: 'data.candidate.candidate' },
        );
      }

      if (
        candidate.sdpMid !== undefined &&
        candidate.sdpMid !== null &&
        typeof candidate.sdpMid !== 'string'
      ) {
        throw new ValidationError(
          '"data.candidate.sdpMid" must be a string or null',
          { field: 'data.candidate.sdpMid' },
        );
      }

      if (
        candidate.sdpMLineIndex !== undefined &&
        candidate.sdpMLineIndex !== null &&
        (
          !Number.isInteger(candidate.sdpMLineIndex) ||
          candidate.sdpMLineIndex < 0
        )
      ) {
        throw new ValidationError(
          '"data.candidate.sdpMLineIndex" must be a non-negative integer or null',
          { field: 'data.candidate.sdpMLineIndex' },
        );
      }

      if (
        candidate.usernameFragment !== undefined &&
        candidate.usernameFragment !== null &&
        typeof candidate.usernameFragment !== 'string'
      ) {
        throw new ValidationError(
          '"data.candidate.usernameFragment" must be a string or null',
          { field: 'data.candidate.usernameFragment' },
        );
      }

      normalizedSignal = {
        type: 'candidate',
        candidate: {
          candidate: candidate.candidate,
          ...(candidate.sdpMid !== undefined
            ? { sdpMid: candidate.sdpMid }
            : {}),
          ...(candidate.sdpMLineIndex !== undefined
            ? { sdpMLineIndex: candidate.sdpMLineIndex }
            : {}),
          ...(candidate.usernameFragment !== undefined
            ? { usernameFragment: candidate.usernameFragment }
            : {}),
        },
      };
    }
  } else {
    if (
      typeof signal.sdp !== 'string' ||
      signal.sdp.trim().length === 0
    ) {
      throw new ValidationError(
        '"data.sdp" is required for offer/answer',
        { field: 'data.sdp' },
      );
    }

    if (signal.sdp.length > MAX_SDP_LENGTH) {
      throw new ValidationError(
        'signal payload too large',
        {
          field: 'data.sdp',
          size: signal.sdp.length,
        },
      );
    }

    normalizedSignal = {
      type: signal.type,
      sdp: signal.sdp,
    };
  }

  const size = Buffer.byteLength(JSON.stringify(normalizedSignal));

  if (size > MAX_SIGNAL_BYTES) {
    throw new ValidationError(
      'signal payload too large',
      {
        field: 'data',
        size,
      },
    );
  }

  return {
    to,
    data: normalizedSignal,
  };
}

/**
 * Normalize the microphone state sent by a peer.
 */
export function validateMediaState(payload) {
  const data = payload === undefined || payload === null
    ? {}
    : requirePayloadObject(payload);

  if (
    data.micEnabled !== undefined &&
    typeof data.micEnabled !== 'boolean'
  ) {
    throw new ValidationError(
      '"micEnabled" must be a boolean when provided',
      { field: 'micEnabled' },
    );
  }

  return {
    micEnabled: data.micEnabled !== false,
  };
}