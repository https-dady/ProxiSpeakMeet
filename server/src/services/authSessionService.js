import { createHash, randomBytes } from 'node:crypto';

import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_SESSION_DAYS = 30;

const getSessionExpiry = () =>
  new Date(
    Date.now() +
      REFRESH_SESSION_DAYS * 24 * 60 * 60 * 1000,
  );

const hashRefreshToken = (token) =>
  createHash('sha256')
    .update(token)
    .digest('hex');

const generateRefreshToken = () =>
  randomBytes(REFRESH_TOKEN_BYTES).toString('hex');

/**
 * Creates a new persistent authentication session.
 *
 * The raw refresh token is returned only once.
 * Only its SHA-256 hash is stored in MongoDB.
 */
export async function createAuthSession(userId) {
  if (!userId) {
    throw new Error('User ID is required to create an auth session.');
  }

  const refreshToken = generateRefreshToken();

  const session = await AuthSession.create({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getSessionExpiry(),
    lastUsedAt: new Date(),
  });

  return {
    refreshToken,
    sessionId: session._id.toString(),
    expiresAt: session.expiresAt,
  };
}

/**
 * Atomically consumes an existing refresh token and rotates it.
 *
 * A refresh token can only be used once.
 * Reusing an already consumed token will fail.
 */
export async function rotateAuthSession(refreshToken) {
  if (
    typeof refreshToken !== 'string' ||
    !/^[a-f0-9]{96}$/.test(refreshToken)
  ) {
    return null;
  }

  const tokenHash = hashRefreshToken(refreshToken);

  const existingSession = await AuthSession.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!existingSession) {
    return null;
  }

  const user = await User.findById(existingSession.userId).select(
    '_id username isEmailVerified',
  );

  if (!user || !user.isEmailVerified) {
    return null;
  }

  const nextSession = await createAuthSession(user._id);

  return {
    user: {
      userId: user._id.toString(),
      username: user.username,
    },
    refreshToken: nextSession.refreshToken,
    sessionId: nextSession.sessionId,
    expiresAt: nextSession.expiresAt,
  };
}

/**
 * Revokes one authentication session.
 */
export async function revokeAuthSession(refreshToken) {
  if (
    typeof refreshToken !== 'string' ||
    !/^[a-f0-9]{96}$/.test(refreshToken)
  ) {
    return false;
  }

  const result = await AuthSession.deleteOne({
    tokenHash: hashRefreshToken(refreshToken),
  });

  return result.deletedCount > 0;
}

/**
 * Revokes every active session belonging to a user.
 *
 * Useful after password changes or account security events.
 */
export async function revokeAllAuthSessions(userId) {
  if (!userId) {
    throw new Error('User ID is required to revoke auth sessions.');
  }

  const result = await AuthSession.deleteMany({
    userId,
  });

  return result.deletedCount;
}

export default {
  createAuthSession,
  rotateAuthSession,
  revokeAuthSession,
  revokeAllAuthSessions,
};