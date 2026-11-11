import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

import Room from '../models/Room.js';
import User from '../models/User.js';
import {
  buildDefaultRoom,
  invalidateRoomCache,
} from '../services/roomService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const MAX_ALLOWED_USERS = 100;

function generateRoomId() {
  return randomUUID().slice(0, 13).toLowerCase();
}

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validateText(value, field, maxLength) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw createValidationError(`${field} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw createValidationError(
      `${field} cannot exceed ${maxLength} characters.`,
    );
  }

  return normalized;
}

function validateAllowedUsers(value, ownerId) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_ALLOWED_USERS) {
    throw createValidationError(
      `allowedUsers must be an array containing at most ${MAX_ALLOWED_USERS} user IDs.`,
    );
  }

  const uniqueIds = new Set();
  const allowedUsers = [];

  for (const id of value) {
    if (
      typeof id !== 'string' ||
      !mongoose.isValidObjectId(id)
    ) {
      throw createValidationError(
        'An invalid user ID was supplied.',
      );
    }

    const normalizedId = new mongoose.Types.ObjectId(id).toString();

    if (normalizedId === ownerId) {
      continue;
    }

    if (!uniqueIds.has(normalizedId)) {
      uniqueIds.add(normalizedId);
      allowedUsers.push(normalizedId);
    }
  }

  return allowedUsers;
}

async function verifyInvitedUsers(userIds) {
  if (userIds.length === 0) {
    return;
  }

  const verifiedUsers = await User.find({
    _id: {
      $in: userIds,
    },
    isEmailVerified: true,
  })
    .select('_id')
    .lean();

  const verifiedUserIds = new Set(
    verifiedUsers.map((user) => user._id.toString()),
  );

  const hasInvalidInvitee = userIds.some(
    (userId) => !verifiedUserIds.has(userId),
  );

  if (hasInvalidInvitee) {
    throw createValidationError(
      'One or more invited accounts do not exist or are not verified.',
    );
  }
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
    const authenticatedUserId = req.user?.userId;

    if (!mongoose.isValidObjectId(authenticatedUserId)) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid authenticated account.',
      });
    }

    const ownerId = new mongoose.Types.ObjectId(
      authenticatedUserId,
    ).toString();

    const body = req.body ?? {};

    const name =
      validateText(body.name, 'name', 100) || 'Unnamed Office';

    const description =
      validateText(body.description, 'description', 500) || '';

    const visibility = body.visibility ?? 'public';

    if (!['public', 'private'].includes(visibility)) {
      throw createValidationError(
        'visibility must be either public or private.',
      );
    }

    const allowedUsers = validateAllowedUsers(
      body.allowedUsers,
      ownerId,
    );

    if (visibility === 'public' && allowedUsers.length > 0) {
      throw createValidationError(
        'Public rooms cannot have a private access list.',
      );
    }

    if (visibility === 'private') {
      await verifyInvitedUsers(allowedUsers);
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