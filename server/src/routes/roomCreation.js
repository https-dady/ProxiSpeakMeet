import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

import Room from '../models/Room.js';
import { buildDefaultRoom, invalidateRoomCache } from '../services/roomService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const MAX_ALLOWED_USERS = 100;

function generateRoomId() {
  return randomUUID().slice(0, 13).toLowerCase();
}

function validateText(value, field, maxLength) {
  if (value === undefined) return undefined;

  if (typeof value !== 'string') {
    const error = new Error(`${field} must be a string.`);
    error.status = 400;
    throw error;
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    const error = new Error(
      `${field} cannot exceed ${maxLength} characters.`,
    );
    error.status = 400;
    throw error;
  }

  return normalized;
}

function validateAllowedUsers(value, ownerId) {
  if (value === undefined) return [];

  if (!Array.isArray(value) || value.length > MAX_ALLOWED_USERS) {
    const error = new Error(
      `allowedUsers must be an array containing at most ${MAX_ALLOWED_USERS} user IDs.`,
    );
    error.status = 400;
    throw error;
  }

  const uniqueIds = new Set();
  const allowedUsers = [];

  for (const id of value) {
    if (
      typeof id !== 'string' ||
      !mongoose.isValidObjectId(id)
    ) {
      const error = new Error('An invalid user ID was supplied.');
      error.status = 400;
      throw error;
    }

    const normalizedId = new mongoose.Types.ObjectId(id).toString();

    if (normalizedId === ownerId.toString()) {
      continue;
    }

    if (!uniqueIds.has(normalizedId)) {
      uniqueIds.add(normalizedId);
      allowedUsers.push(normalizedId);
    }
  }

  return allowedUsers;
}

/**
 * POST /api/rooms
 *
 * Creates a room owned by the authenticated account.
 *
 * Supported body:
 * {
 *   "name": "Design Team",
 *   "description": "Private team workspace",
 *   "visibility": "private",
 *   "allowedUsers": ["MongoDB user ID"]
 * }
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const ownerId = req.user.userId;

    if (!mongoose.isValidObjectId(ownerId)) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid authenticated account.',
      });
    }

    const body = req.body ?? {};

    const name =
      validateText(body.name, 'name', 100) || 'Unnamed Office';

    const description =
      validateText(body.description, 'description', 500) || '';

    const visibility = body.visibility ?? 'public';

    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({
        ok: false,
        error: 'visibility must be either public or private.',
      });
    }

    const allowedUsers = validateAllowedUsers(
      body.allowedUsers,
      ownerId,
    );

    if (visibility === 'public' && allowedUsers.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Public rooms cannot have a private access list.',
      });
    }

    let roomId = '';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateRoomId();

      if (!ROOM_ID_PATTERN.test(candidate)) {
        continue;
      }

      const existingRoom = await Room.exists({
        roomId: candidate,
      });

      if (!existingRoom) {
        roomId = candidate;
        break;
      }
    }

    if (!roomId) {
      return res.status(503).json({
        ok: false,
        error: 'Unable to allocate a unique room ID. Please try again.',
      });
    }

    const blueprint = buildDefaultRoom(roomId);

    const room = await Room.create({
      ...blueprint,
      name,
      description,
      ownerId,
      visibility,
      allowedUsers,
    });

    // Remove any stale in-memory entry for this generated ID.
    invalidateRoomCache(roomId);

    return res.status(201).json({
      ok: true,
      message: 'Room created successfully.',
      roomId: room.roomId,
      room: {
        roomId: room.roomId,
        name: room.name,
        description: room.description,
        visibility: room.visibility,
        ownerId: room.ownerId,
        width: room.width,
        height: room.height,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;