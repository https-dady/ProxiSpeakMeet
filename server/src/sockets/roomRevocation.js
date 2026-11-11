import mongoose from 'mongoose';

/**
 * Disconnect every authenticated socket belonging to a user
 * from a specific room.
 *
 * Uses Socket.IO fetchSockets(), so it also works with the
 * configured Redis adapter across multiple server instances.
 *
 * The normal socket disconnect lifecycle handles:
 * - Meeting history completion
 * - PeerGraph cleanup
 * - Presence removal
 * - Socket.IO room membership removal
 */
export async function disconnectRevokedRoomMember({
  io,
  roomId,
  userId,
}) {
  if (!io || typeof io.in !== 'function') {
    throw new Error('Socket.IO server is not available.');
  }

  if (
    typeof roomId !== 'string' ||
    !roomId.trim()
  ) {
    throw new TypeError('A valid room ID is required.');
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw new TypeError('A valid user ID is required.');
  }

  const normalizedRoomId = roomId.trim().toLowerCase();

  const normalizedUserId = new mongoose.Types.ObjectId(
    userId,
  ).toString();

  const roomSockets = await io
    .in(normalizedRoomId)
    .fetchSockets();

  let disconnectedCount = 0;

  for (const socket of roomSockets) {
    const authenticatedUserId =
      socket.data?.authenticatedUser?.userId;

    if (!mongoose.isValidObjectId(authenticatedUserId)) {
      continue;
    }

    const normalizedSocketUserId = new mongoose.Types.ObjectId(
      authenticatedUserId,
    ).toString();

    if (normalizedSocketUserId !== normalizedUserId) {
      continue;
    }

    socket.disconnect(true);
    disconnectedCount += 1;
  }

  return {
    roomId: normalizedRoomId,
    userId: normalizedUserId,
    disconnectedCount,
  };
}