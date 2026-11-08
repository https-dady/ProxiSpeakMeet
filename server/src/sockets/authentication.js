import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import config from '../config/index.js';
import User from '../models/User.js';

/**
 * Socket.IO authentication middleware.
 *
 * Responsibilities:
 * - Read JWT from Socket.IO handshake.
 * - Verify token signature and expiry.
 * - Resolve the actual account from MongoDB.
 * - Reject invalid, deleted or unverified accounts.
 * - Attach trusted account identity to socket.data.
 *
 * Supported token locations:
 * - socket.handshake.auth.token
 * - Authorization: Bearer <token>
 */
export function createSocketAuthentication({
  secret = config.auth.jwtSecret,
  UserModel = User,
} = {}) {
  return async function authenticateSocket(socket, next) {
    try {
      if (!secret || secret.length < 32) {
        throw new Error('Socket authentication is not configured.');
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

      socket.data.authenticatedUser = Object.freeze({
        userId: account._id.toString(),
        username: account.username,
        email: account.email,
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