import mongoose from 'mongoose';

import { NotFoundError } from '../utils/errors.js';

/**
 * Authorize an authenticated Socket.IO connection to enter a room.
 *
 * Public rooms:
 *   Any authenticated account may join.
 *
 * Private rooms:
 *   Only the owner and explicitly invited accounts may join.
 *
 * Missing room access metadata fails closed.
 */
export async function authorizeSocketRoomJoin({
  socket,
  roomId,
  getRoomAccess,
}) {
  const account = socket?.data?.authenticatedUser;

  if (
    !account?.userId ||
    !mongoose.isValidObjectId(account.userId)
  ) {
    throw new NotFoundError('Room not found.');
  }

  if (
    typeof roomId !== 'string' ||
    !roomId.trim()
  ) {
    throw new NotFoundError('Room not found.');
  }

  if (typeof getRoomAccess !== 'function') {
    throw new Error(
      'Room access service is not configured.',
    );
  }

  const access = await getRoomAccess(
    roomId.trim().toLowerCase(),
  );

  if (!access) {
    throw new NotFoundError('Room not found.');
  }

  // Public rooms are available to authenticated accounts.
  if (access.visibility === 'public') {
    return true;
  }

  // Unknown visibility values must never grant access.
  if (access.visibility !== 'private') {
    throw new NotFoundError('Room not found.');
  }

  const userId = new mongoose.Types.ObjectId(
    account.userId,
  ).toString();

  const ownerId = access.ownerId
    ? String(access.ownerId)
    : null;

  const allowedUsers = Array.isArray(access.allowedUsers)
    ? access.allowedUsers.map((id) => String(id))
    : [];

  const isOwner = ownerId === userId;
  const isInvited = allowedUsers.includes(userId);

  if (!isOwner && !isInvited) {
    // Do not reveal whether a private room exists.
    throw new NotFoundError('Room not found.');
  }

  return true;
}

export default authorizeSocketRoomJoin;