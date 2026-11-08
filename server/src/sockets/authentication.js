import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import config from '../config/index.js';
import User from '../models/User.js';
import { getRoomAccess } from '../services/roomService.js';

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

/**
 * Socket.IO authentication middleware.
 *
 * Responsibilities:
 * - Verify JWT authentication.
 * - Resolve the account from MongoDB.
 * - Reject deleted or unverified accounts.
 * - Attach trusted identity to socket.data.
 * - Enforce private-room authorization before room:join handlers execute.
 */
export function createSocketAuthentication({
  secret = config.auth.jwtSecret,
  UserModel = User,
  roomAccessLookup = getRoomAccess,
} = {}) {
  return async function authenticateSocket(socket, next) {
    try {
      if (!secret || secret.length < 32) {
        throw new Error(
          'Socket authentication is not configured.',
        );
      }

      const handshakeToken = socket.handshake?.auth?.token;

      const authorization =
        socket.handshake?.headers?.authorization;

      let token = '';

      if (
        typeof handshakeToken === 'string' &&
        handshakeToken.trim()
      ) {
        token = handshakeToken.trim();
      } else if (
        typeof authorization === 'string' &&
        authorization.startsWith('Bearer ')
      ) {
        token = authorization.slice(7).trim();
      }

      if (!token) {
        throw new Error('Authentication required.');
      }

      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      });

      if (
        !decoded ||
        typeof decoded.userId !== 'string' ||
        !mongoose.Types.ObjectId.isValid(decoded.userId)
      ) {
        throw new Error('Invalid authentication token.');
      }

      const account = await UserModel.findById(
        decoded.userId,
      ).select('_id username email isEmailVerified');

      if (!account) {
        throw new Error('Account no longer exists.');
      }

      if (account.isEmailVerified !== true) {
        throw new Error('Email verification is required.');
      }

      if (
        typeof account.username !== 'string' ||
        !account.username.trim()
      ) {
        throw new Error('Invalid account identity.');
      }

      const authenticatedUser = Object.freeze({
        userId: account._id.toString(),
        username: account.username,
        email: account.email,
      });

      socket.data.authenticatedUser = authenticatedUser;

      /**
       * Socket packet middleware runs before registered event handlers.
       * This prevents unauthorized clients from reaching room:join.
       */
      socket.use(async (packet, packetNext) => {
        const eventName = packet[0];

        if (eventName !== 'room:join') {
          return packetNext();
        }

        const payload = packet[1] ?? {};
        const rawRoomId = payload?.roomId ?? 'lobby';

        const acknowledgement =
          typeof packet[packet.length - 1] === 'function'
            ? packet[packet.length - 1]
            : null;

        const rejectJoin = (message, status = 404) => {
          if (acknowledgement) {
            acknowledgement({
              ok: false,
              error: message,
              status,
            });

            return;
          }

          const error = new Error(message);
          error.data = {
            code: 'ROOM_ACCESS_DENIED',
            status,
          };

          return packetNext(error);
        };

        if (
          typeof rawRoomId !== 'string' ||
          !ROOM_ID_PATTERN.test(rawRoomId.toLowerCase())
        ) {
          return rejectJoin('Room not found.', 404);
        }

        const roomId = rawRoomId.toLowerCase();

        try {
          const access = await roomAccessLookup(roomId);

          /**
           * Missing persisted room metadata is allowed here for
           * legacy/default rooms. The room service will resolve or
           * create the default room during the normal join lifecycle.
           *
           * Database lookup errors are handled separately and fail closed.
           */
          if (!access) {
            return packetNext();
          }

          if (access.visibility !== 'private') {
            return packetNext();
          }

          const userId = authenticatedUser.userId;

          const isOwner =
            access.ownerId === userId;

          const isAllowed =
            Array.isArray(access.allowedUsers) &&
            access.allowedUsers.includes(userId);

          if (!isOwner && !isAllowed) {
            return rejectJoin('Room not found.', 404);
          }

          return packetNext();
        } catch (error) {
          console.error(
            '[socket-auth] room authorization lookup failed:',
            error.message,
          );

          return rejectJoin(
            'Room authorization is temporarily unavailable.',
            503,
          );
        }
      });

      return next();
    } catch (error) {
      const authenticationError = new Error(
        'Authentication failed. Please sign in again.',
      );

      authenticationError.data = {
        code: 'SOCKET_AUTHENTICATION_FAILED',
      };

      return next(authenticationError);
    }
  };
}

export default createSocketAuthentication;