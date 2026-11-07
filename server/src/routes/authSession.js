import { Router } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config/index.js';
import { authenticateToken } from '../middleware/auth.js';

import {
  createAuthSession,
  rotateAuthSession,
  revokeAuthSession,
} from '../services/authSessionService.js';

const router = Router();

const COOKIE_NAME = 'proxispeak_refresh';

const COOKIE_PATH = '/api/auth/session';

const COOKIE_MAX_AGE =
  30 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? 'none' : 'lax',
  path: COOKIE_PATH,
  maxAge: COOKIE_MAX_AGE,
};

function readRefreshToken(req) {
  const cookieHeader = req.headers.cookie;

  if (typeof cookieHeader !== 'string') {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const name = cookie.slice(0, separator).trim();

    if (name !== COOKIE_NAME) {
      continue;
    }

    try {
      return decodeURIComponent(
        cookie.slice(separator + 1).trim(),
      );
    } catch {
      return null;
    }
  }

  return null;
}

function setRefreshCookie(res, token) {
  res.cookie(
    COOKIE_NAME,
    token,
    cookieOptions,
  );
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    path: COOKIE_PATH,
  });
}

function issueAccessToken(user) {
  const secret = config.auth.jwtSecret;

  if (
    typeof secret !== 'string' ||
    secret.length < 32
  ) {
    throw new Error(
      'JWT_SECRET is missing or invalid.',
    );
  }

  return jwt.sign(
    {
      userId: user.userId,
      username: user.username,
    },
    secret,
    {
      expiresIn: config.auth.jwtExpiresIn || '24h',
      algorithm: 'HS256',
    },
  );
}

/**
 * POST /api/auth/session/start
 *
 * Requires a valid access token.
 * Creates a persistent refresh session and sets
 * the refresh token in an HttpOnly cookie.
 */
router.post(
  '/start',
  authenticateToken,
  async (req, res, next) => {
    try {
      const session = await createAuthSession(
        req.user.userId,
      );

      setRefreshCookie(
        res,
        session.refreshToken,
      );

      return res.status(201).json({
        ok: true,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * POST /api/auth/session/refresh
 *
 * Rotates the refresh token and returns a new
 * short-lived access token.
 */
router.post(
  '/refresh',
  async (req, res, next) => {
    try {
      const refreshToken = readRefreshToken(req);

      if (!refreshToken) {
        clearRefreshCookie(res);

        return res.status(401).json({
          error: 'Refresh session is missing.',
        });
      }

      const session = await rotateAuthSession(
        refreshToken,
      );

      if (!session) {
        clearRefreshCookie(res);

        return res.status(401).json({
          error: 'Refresh session is invalid or expired.',
        });
      }

      const token = issueAccessToken(
        session.user,
      );

      setRefreshCookie(
        res,
        session.refreshToken,
      );

      return res.status(200).json({
        ok: true,
        token,
        user: session.user,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * POST /api/auth/session/logout
 *
 * Revokes the refresh session and clears its cookie.
 */
router.post(
  '/logout',
  async (req, res, next) => {
    try {
      const refreshToken = readRefreshToken(req);

      if (refreshToken) {
        await revokeAuthSession(refreshToken);
      }

      clearRefreshCookie(res);

      return res.status(200).json({
        ok: true,
        message: 'Session ended successfully.',
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;