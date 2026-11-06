import { createHash, randomBytes } from 'node:crypto';

import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_SESSION_DAYS = 30;

const REFRESH_SESSION_DURATION =
  REFRESH_SESSION_DAYS * 24 * 60 * 60 * 1000;

const getSessionExpiry = () =>
  new Date(Date.now() + REFRESH_SESSION_DURATION);

const hashRefreshToken = (token) =>
  createHash('sha256')
    .update(token)
    .digest('hex');

const generateRefreshToken = () =>
  randomBytes(REFRESH_TOKEN_BYTES).toString('hex');

const isValidRefreshToken = (token) =>
  typeof token === 'string' &&
  /^[a-f0-9]{96}$/.test(token);

/**
 * Creates a new persistent authentication session.
 *
 * Raw refresh token is returned only once.
 * Only its SHA-256 hash is stored in MongoDB.
 */
export async function createAuthSession(userId) {
  if (!userId) {
    throw new Error(
      'User ID is required to create an auth session.',
    );
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
 * Atomically rotates an existing refresh token.
 *
 * The old token hash is replaced using findOneAndUpdate.
 * Concurrent requests cannot successfully reuse the same
 * refresh token because the old hash stops matching after
 * the first successful update.
 */
export async function rotateAuthSession(refreshToken) {
  if (!isValidRefreshToken(refreshToken)) {
    return null;
  }

  const previousTokenHash =
    hashRefreshToken(refreshToken);

  const nextRefreshToken = generateRefreshToken();

  const nextTokenHash =
    hashRefreshToken(nextRefreshToken);

  const now = new Date();

  /*
   * Locate the active session without consuming it.
   */
  const existingSession = await AuthSession.findOne({
    tokenHash: previousTokenHash,
    expiresAt: { $gt: now },
  }).select('_id userId');

  if (!existingSession) {
    return null;
  }

  /*
   * Verify the account before rotating the token.
   */
  const user = await User.findById(
    existingSession.userId,
  ).select('_id username isEmailVerified');

  if (!user || !user.isEmailVerified) {
    await AuthSession.deleteOne({
      _id: existingSession._id,
      tokenHash: previousTokenHash,
    });

    return null;
  }

  const nextExpiry = getSessionExpiry();

  /*
   * Atomic compare-and-replace:
   *
   * Only one request can replace the old token hash.
   * Any concurrent request using the same old token
   * will receive null.
   */
  const updatedSession =
    await AuthSession.findOneAndUpdate(
      {
        _id: existingSession._id,
        tokenHash: previousTokenHash,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          tokenHash: nextTokenHash,
          expiresAt: nextExpiry,
          lastUsedAt: now,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).select('_id');

  if (!updatedSession) {
    return null;
  }

  return {
    user: {
      userId: user._id.toString(),
      username: user.username,
    },
    refreshToken: nextRefreshToken,
    sessionId: updatedSession._id.toString(),
    expiresAt: nextExpiry,
  };
}

/**
 * Revokes one authentication session.
 */
export async function revokeAuthSession(refreshToken) {
  if (!isValidRefreshToken(refreshToken)) {
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
 * Used for account-security operations such as
 * password changes and credential compromise.
 */
export async function revokeAllAuthSessions(userId) {
  if (!userId) {
    throw new Error(
      'User ID is required to revoke auth sessions.',
    );
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