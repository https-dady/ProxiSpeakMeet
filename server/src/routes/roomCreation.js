import { Router } from 'express';
import { randomUUID } from 'node:crypto';

import { getRoom } from '../services/roomService.js';

const router = Router();

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

/**
 * Generate a unique, URL-safe room identifier.
 *
 * Example:
 * 7f3a2c91-6b21
 */
function generateRoomId() {
  return randomUUID().slice(0, 13).toLowerCase();
}

/**
 * POST /api/rooms
 *
 * Creates a unique room using the existing room service.
 *
 * The room service handles caching and persistence retries, allowing
 * rooms to remain usable when MongoDB is temporarily unavailable.
 */
router.post('/', async (req, res, next) => {
  try {
    let roomId = '';
    let room = null;

    // UUID collisions are extraordinarily unlikely, but we still
    // verify that a generated identifier is not already in use.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateRoomId();

      if (!ROOM_ID_PATTERN.test(candidate)) {
        continue;
      }

      const existingRoom = await findExistingRoom(candidate);

      if (existingRoom) {
        continue;
      }

      roomId = candidate;
      break;
    }

    if (!roomId) {
      const error = new Error(
        'Unable to allocate a unique room identifier. Please try again.',
      );

      error.status = 503;
      return next(error);
    }

    // Use the existing room service rather than implementing a
    // separate room storage mechanism.
    room = await getRoom(roomId, { persist: true });

    if (!room || room.roomId !== roomId) {
      const error = new Error(
        'The room could not be initialized successfully.',
      );

      error.status = 500;
      return next(error);
    }

    return res.status(201).json({
      message: 'Room created successfully.',
      roomId: room.roomId,
      room: {
        roomId: room.roomId,
        name: room.name,
        description: room.description,
        width: room.width,
        height: room.height,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Look up a room without creating a new one.
 *
 * The existing room catalogue includes persisted, cached and pending
 * rooms, so it is used to avoid allocating an identifier already in use.
 */
async function findExistingRoom(roomId) {
  const { listRooms } = await import('../services/roomService.js');

  const rooms = await listRooms();

  return rooms.some((room) => room.roomId === roomId);
}

export default router;