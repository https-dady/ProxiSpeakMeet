import { Router } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { corsOrigin } from '../utils/origin.js';

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

const originPolicy = corsOrigin(config);

/**
 * Enforce the same origin policy used by Express CORS.
 */
function validateRequestOrigin(req, res) {
  const origin = req.get('origin');

  if (!origin) {
    return true;
  }

  if (originPolicy === true) {
    return true;
  }

  if (typeof originPolicy !== 'function') {
    return false;
  }

  let allowed = false;

  originPolicy(origin, (error, result) => {
    allowed = !error && result === true;
  });

  if (!allowed) {
    res.status(403).json({
      error: 'Request origin is not allowed.',
    });

    return false;
  }

  return true;
}

/**
 * Read the refresh token from the Cookie header.
 */
function readRefreshToken(req) {
  const cookieHeader = req.headers.cookie;

  if (typeof cookieHeader !== 'string') {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const name = cookie
      .slice(0, separatorIndex)
      .trim();

    if (name !== COOKIE_NAME) {
      continue;
    }

    const token = cookie
      .slice(separatorIndex + 1)
      .trim();

    return /^[a-f0-9]{96}$/.test(token)
      ? token
      : null;
  }

  return null;
}

function setRefreshCookie(res, token) {
  res.cookie(
    COOKIE_NAME,
    token,
    COOKIE_OPTIONS,
  );
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
    path: COOKIE_OPTIONS.path,
  });
}

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