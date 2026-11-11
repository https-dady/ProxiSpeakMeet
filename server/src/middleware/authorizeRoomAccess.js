import mongoose from 'mongoose';

import { getRoomAccess } from '../services/roomService.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * Protect an individual room using its persisted visibility and access list.
 *
 * Requires authenticateToken to run before this middleware.
 *
 * Expected:
 * req.params.roomId
 * req.user.userId
 */
export async function authorizeRoomAccess(req, res, next) {
  try {
    const userId = req.user?.userId;
    const roomId = req.params?.roomId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication is required.',
      });
    }

    if (typeof roomId !== 'string' || !roomId.trim()) {
      throw new NotFoundError('Room not found.');
    }

    const access = await getRoomAccess(roomId.trim().toLowerCase());

    if (!access) {
      throw new NotFoundError('Room not found.');
    }

    // Public rooms are accessible to authenticated accounts.
    if (access.visibility === 'public') {
      req.roomAccess = access;
      return next();
    }

    const normalizedUserId = new mongoose.Types.ObjectId(
      userId,
    ).toString();

    const isOwner =
      access.ownerId === normalizedUserId;

    const isAllowed =
      access.allowedUsers.includes(normalizedUserId);

    if (!isOwner && !isAllowed) {
      throw new NotFoundError('Room not found.');
    }

    req.roomAccess = access;

    return next();
  } catch (error) {
    return next(error);
  }
}

export default authorizeRoomAccess;