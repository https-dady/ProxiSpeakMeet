import { ValidationError } from '../utils/errors.js';

/**
 * Validate that the socket has a consistent, active membership
 * in its authoritative room.
 *
 * The socket identity, Socket.IO room membership and presence
 * record must all agree before room-scoped events are accepted.
 */
export function requireActiveRoomMembership({
  identity,
  socket,
  store,
}) {
  if (!identity?.roomId) {
    throw new ValidationError('join a room first');
  }

  const roomId = identity.roomId;
  const user = store.get(socket.id);

  const membershipIsConsistent =
    socket.data?.userId === socket.id &&
    socket.data?.roomId === roomId &&
    socket.rooms?.has(roomId) === true &&
    Boolean(user) &&
    user.id === socket.id &&
    user.roomId === roomId;

  if (!membershipIsConsistent) {
    throw new ValidationError(
      'active room membership is required',
    );
  }

  return {
    roomId,
    user,
  };
}