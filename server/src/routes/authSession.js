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

const REFRESH_SESSION_DAYS = 30;

const REFRESH_SESSION_MAX_AGE =
  REFRESH_SESSION_DAYS * 24 * 60 * 60 * 1000;

const COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? 'none' : 'lax',
  path: '/api/auth/session',
  maxAge: REFRESH_SESSION_MAX_AGE,
});

/**
 * Validate request origin for cookie-based operations.
 *
 * Browser requests include Origin. Requests without Origin
 * are allowed for server-to-server clients.
 */
function validateRequestOrigin(req, res) {
  const requestOrigin = req.get('origin');

  if (!requestOrigin) {
    return true;
  }

  const allowedOrigins = config.server.clientOrigins;

  if (
    Array.isArray(allowedOrigins) &&
    allowedOrigins.length > 0 &&
    !allowedOrigins.includes(requestOrigin)
  ) {
    res.status(403).json({
      error: 'Request origin is not allowed.',
    });

    return false;
  }

  return true;
}

/**
 * Read the refresh token from the Cookie header.
 *
 * This avoids requiring an additional cookie-parser dependency.
 */
function readRefreshToken(req) {
  const cookieHeader = req.headers.cookie;

  if (typeof cookieHeader !== 'string') {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookie
      .slice(0, separatorIndex)
      .trim();

    if (name !== COOKIE_NAME) {
      continue;
    }

    const value = cookie
      .slice(separatorIndex + 1)
      .trim();

    return /^[a-f0-9]{96}$/.test(value)
      ? value
      : null;
  }

  return null;
}

/**
 * Set the HttpOnly refresh-token cookie.
 */
function setRefreshCookie(res, refreshToken) {
  res.cookie(
    COOKIE_NAME,
    refreshToken,
    COOKIE_OPTIONS,
  );
}

/**
 * Clear the refresh-token cookie.
 *
 * Cookie path and security attributes must match
 * the original cookie configuration.
 */
function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
    path: COOKIE_OPTIONS.path,
  });
}

/**
 * Create a short-lived access JWT.
 *
 * Payload matches authenticateToken middleware:
 * { userId, username }
 */
function createAccessToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      username: user.username,
    },
    config.auth.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: config.auth.jwtExpiresIn,
    },
  );
}

/**
 * POST /api/auth/session/start
 *
 * Creates a persistent refresh session after successful login.
 *
 * Requires:
 * Authorization: Bearer <access-token>
 *
 * The refresh token is returned only as an HttpOnly cookie.
 */
router.post(
  '/start',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user?.userId;

      if (
        typeof userId !== 'string' ||
        !userId.trim()
      ) {
        return res.status(401).json({
          error: 'A valid authenticated user is required.',
        });
      }

      const session = await createAuthSession(userId);

      setRefreshCookie(
        res,
        session.refreshToken,
      );

      return res.status(201).json({
        ok: true,
        message: 'Persistent session established.',
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      console.error(
        'Persistent session creation failed:',
        error.message,
      );

      return res.status(500).json({
        error: 'Unable to establish persistent session.',
      });
    }
  },
);

/**
 * POST /api/auth/session/refresh
 *
 * Rotates the refresh token and issues a new access JWT.
 *
 * Refresh token:
 * - Read from HttpOnly cookie.
 * - Validated and rotated server-side.
 * - Never returned in the response body.
 */
router.post(
  '/refresh',
  async (req, res) => {
    try {
      if (!validateRequestOrigin(req, res)) {
        return;
      }

      const refreshToken = readRefreshToken(req);

      if (!refreshToken) {
        clearRefreshCookie(res);

        return res.status(401).json({
          error: 'Refresh session is missing or invalid.',
        });
      }

      const session = await rotateAuthSession(
        refreshToken,
      );

      if (!session) {
        clearRefreshCookie(res);

        return res.status(401).json({
          error: 'Refresh session has expired or is invalid.',
        });
      }

      const accessToken = createAccessToken(
        session.user,
      );

      setRefreshCookie(
        res,
        session.refreshToken,
      );

      return res.status(200).json({
        ok: true,
        token: accessToken,
        user: session.user,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      console.error(
        'Session refresh failed:',
        error.message,
      );

      return res.status(500).json({
        error: 'Unable to refresh authentication session.',
      });
    }
  },
);

/**
 * POST /api/auth/session/logout
 *
 * Revokes the current refresh session and clears
 * the browser's HttpOnly refresh-token cookie.
 */
router.post(
  '/logout',
  async (req, res) => {
    try {
      if (!validateRequestOrigin(req, res)) {
        return;
      }

      const refreshToken = readRefreshToken(req);

      if (refreshToken) {
        await revokeAuthSession(refreshToken);
      }

      clearRefreshCookie(res);

      return res.status(200).json({
        ok: true,
        message: 'Session logged out successfully.',
      });
    } catch (error) {
      console.error(
        'Session logout failed:',
        error.message,
      );

      clearRefreshCookie(res);

      return res.status(500).json({
        error: 'Unable to complete session logout.',
      });
    }
  },
);

export default router;