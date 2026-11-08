import { Router } from 'express';
import mongoose from 'mongoose';

import Room from '../models/Room.js';
import User from '../models/User.js';

import { authenticateToken } from '../middleware/auth.js';
import { invalidateRoomCache } from '../services/roomService.js';
import { disconnectRevokedRoomMember } from '../sockets/roomRevocation.js';

const router = Router();

const MAX_ALLOWED_USERS = 100;

function sendError(res, status, message) {
  return res.status(status).json({
    ok: false,
    error: message,
  });
}

function normalizeId(value) {
  return new mongoose.Types.ObjectId(value).toString();
}

function validateIds(req, res, next) {
  const { roomId, userId } = req.params;

  if (
    typeof roomId !== 'string' ||
    !roomId.trim() ||
    roomId.trim().length > 48
  ) {
    return sendError(res, 400, 'Invalid room ID.');
  }

  if (!mongoose.isValidObjectId(userId)) {
    return sendError(res, 400, 'Invalid user ID.');
  }

  req.normalizedRoomId = roomId.trim().toLowerCase();
  req.normalizedTargetUserId = normalizeId(userId);

  return next();
}

async function loadOwnedPrivateRoom(req, res) {
  const authenticatedUserId = req.user?.userId;

  if (!mongoose.isValidObjectId(authenticatedUserId)) {
    sendError(res, 401, 'Authentication required.');
    return null;
  }

  const ownerId = normalizeId(authenticatedUserId);

  const room = await Room.findOne({
    roomId: req.normalizedRoomId,
    visibility: 'private',
  });

  if (!room) {
    sendError(res, 404, 'Room not found.');
    return null;
  }

  if (!room.ownerId || normalizeId(room.ownerId) !== ownerId) {
    sendError(res, 404, 'Room not found.');
    return null;
  }

  return room;
}

/**
 * POST /api/rooms/access/:roomId/members/:userId
 *
 * Only the private-room owner can invite a verified account.
 */
router.post(
  '/:roomId/members/:userId',
  authenticateToken,
  validateIds,
  async (req, res, next) => {
    try {
      const room = await loadOwnedPrivateRoom(req, res);

      if (!room) return;

      const targetUserId = req.normalizedTargetUserId;
      const ownerId = normalizeId(req.user.userId);

      if (targetUserId === ownerId) {
        return sendError(
          res,
          400,
          'The room owner already has access.',
        );
      }

      const targetUser = await User.findOne({
        _id: targetUserId,
        isEmailVerified: true,
      })
        .select('_id')
        .lean();

      if (!targetUser) {
        return sendError(
          res,
          404,
          'Verified account not found.',
        );
      }

      const currentUsers = (room.allowedUsers ?? []).map(
        (id) => normalizeId(id),
      );

      if (currentUsers.includes(targetUserId)) {
        return res.status(200).json({
          ok: true,
          message: 'User already has access to this room.',
        });
      }

      if (currentUsers.length >= MAX_ALLOWED_USERS) {
        return sendError(
          res,
          400,
          'The room invitation limit has been reached.',
        );
      }

      room.allowedUsers.push(targetUserId);

      await room.save();

      invalidateRoomCache(room.roomId);

      return res.status(200).json({
        ok: true,
        message: 'User invited successfully.',
        roomId: room.roomId,
        userId: targetUserId,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * DELETE /api/rooms/access/:roomId/members/:userId
 *
 * Removes an invitee and terminates their active room sockets.
 */
router.delete(
  '/:roomId/members/:userId',
  authenticateToken,
  validateIds,
  async (req, res, next) => {
    try {
      const room = await loadOwnedPrivateRoom(req, res);

      if (!room) return;

      const targetUserId = req.normalizedTargetUserId;
      const ownerId = normalizeId(req.user.userId);

      if (targetUserId === ownerId) {
        return sendError(
          res,
          400,
          'The room owner cannot revoke their own access.',
        );
      }

      const currentUsers = (room.allowedUsers ?? []).map(
        (id) => normalizeId(id),
      );

      if (!currentUsers.includes(targetUserId)) {
        return sendError(
          res,
          404,
          'Room invitation not found.',
        );
      }

      room.allowedUsers = currentUsers.filter(
        (id) => id !== targetUserId,
      );

      // Persist revocation before disconnecting active sockets.
      await room.save();

      invalidateRoomCache(room.roomId);

      const io = req.app.get('io');

      if (!io) {
        return sendError(
          res,
          503,
          'Room access was revoked, but active-session termination is unavailable.',
        );
      }

      const result = await disconnectRevokedRoomMember({
        io,
        roomId: room.roomId,
        userId: targetUserId,
      });

      return res.status(200).json({
        ok: true,
        message: 'Room access revoked successfully.',
        roomId: room.roomId,
        userId: targetUserId,
        disconnectedSockets: result.disconnectedCount,
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;