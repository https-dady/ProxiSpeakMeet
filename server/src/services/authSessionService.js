import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';

import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_SESSION_DAYS = 30;

function getSessionExpiry() {
  return new Date(
    Date.now() +
      REFRESH_SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
}

function hashRefreshToken(token) {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

function generateRefreshToken() {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

function isValidRefreshToken(token) {
  return (
    typeof token === 'string' &&
    /^[a-f0-9]{96}$/.test(token)
  );
}

function normalizeUser(user) {
  return {
    userId: user._id.toString(),
    username: user.username,
  };
}

export async function createAuthSession(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new Error(
      'A valid user ID is required to create an auth session.',
    );
  }

  const user = await User.findById(userId)
    .select('_id username isEmailVerified')
    .lean();

  if (!user || !user.isEmailVerified) {
    throw new Error(
      'A verified account is required to create an auth session.',
    );
  }

  const refreshToken = generateRefreshToken();

  const session = await AuthSession.create({
    userId: user._id,
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

export async function rotateAuthSession(refreshToken) {
  if (!isValidRefreshToken(refreshToken)) {
    return null;
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const sessionMongo = await mongoose.startSession();

  let rotatedSession = null;

  try {
    await sessionMongo.withTransaction(async () => {
      const existingSession = await AuthSession.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
      }).session(sessionMongo);

      if (!existingSession) {
        return;
      }

      const user = await User.findById(
        existingSession.userId,
      )
        .select('_id username isEmailVerified')
        .session(sessionMongo);

      if (!user || !user.isEmailVerified) {
        await AuthSession.deleteOne({
          _id: existingSession._id,
        }).session(sessionMongo);

        return;
      }

      const nextRefreshToken = generateRefreshToken();
      const nextExpiry = getSessionExpiry();

      await AuthSession.create(
        [
          {
            userId: user._id,
            tokenHash: hashRefreshToken(nextRefreshToken),
            expiresAt: nextExpiry,
            lastUsedAt: new Date(),
          },
        ],
        {
          session: sessionMongo,
        },
      );

      const deletion = await AuthSession.deleteOne(
        {
          _id: existingSession._id,
          tokenHash,
        },
        {
          session: sessionMongo,
        },
      );

      if (deletion.deletedCount !== 1) {
        throw new Error(
          'Refresh session was already consumed.',
        );
      }

      rotatedSession = {
        user: normalizeUser(user),
        refreshToken: nextRefreshToken,
        expiresAt: nextExpiry,
      };
    });

    return rotatedSession;
  } finally {
    await sessionMongo.endSession();
  }
}

export async function revokeAuthSession(refreshToken) {
  if (!isValidRefreshToken(refreshToken)) {
    return false;
  }

  const result = await AuthSession.deleteOne({
    tokenHash: hashRefreshToken(refreshToken),
  });

  return result.deletedCount > 0;
}

export async function revokeAllAuthSessions(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw new Error(
      'A valid user ID is required to revoke auth sessions.',
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