import { Router } from 'express';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { config } from '../config/index.js';
import { authenticateToken } from '../middleware/auth.js';

import {
  createAuthSession,
  rotateAuthSession,
  revokeAuthSession,
} from '../services/authSessionService.js';

const router = Router();

const REFRESH_COOKIE_NAME = 'psm_refresh_token';

const REFRESH_COOKIE_MAX_AGE =
  30 * 24 * 60 * 60 * 1000;

const isProduction =
  process.env.NODE_ENV === 'production';

/**
 * Cookie configuration.
 *
 * HttpOnly prevents JavaScript access to refresh tokens.
 * Secure is enabled in production.
 */
function getCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth/session',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  };
}

/**
 * Extract refresh token from request cookies.
 */
function getRefreshToken(req) {
  const cookieHeader = req.headers.cookie;

  if (typeof cookieHeader !== 'string') {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');

    if (separator === -1) continue;

    const name = cookie.slice(0, separator).trim();

    if (name !== REFRESH_COOKIE_NAME) continue;

    return cookie.slice(separator + 1).trim();
  }

  return null;
}

/**
 * Create access token.
 */
function createAccessToken(user) {
  const secret = config.auth.jwtSecret;

  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or invalid.');
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
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
 * Set refresh cookie.
 */
function setRefreshCookie(res, token) {
  res.cookie(
    REFRESH_COOKIE_NAME,
    token,
    getCookieOptions(),
  );
}

/**
 * Clear refresh cookie.
 */
function clearRefreshCookie(res) {
  res.clearCookie(
    REFRESH_COOKIE_NAME,
    {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/session',
    },
  );
}

/**
 * POST /api/auth/session/start
 *
 * Creates a persistent session after successful login.
 *
 * Requires the existing access token.
 */
router.post(
  '/start',
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(
        req.user.userId,
      ).select('_id username isEmailVerified');

      if (!user || !user.isEmailVerified) {
        return res.status(401).json({
          error: 'Account is unavailable or unverified.',
        });
      }

      const session = await createAuthSession(user._id);

      setRefreshCookie(
        res,
        session.refreshToken,
      );

      return res.status(200).json({
        success: true,
        message: 'Persistent session created.',
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      console.error(
        'Session creation failed:',
        error.message,
      );

      return res.status(500).json({
        error: 'Unable to create persistent session.',
      });
    }
  },
);

/**
 * POST /api/auth/session/refresh
 *
 * Rotates the refresh token and issues a new access token.
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = getRefreshToken(req);

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

    const user = {
      _id: session.user.userId,
      username: session.user.username,
    };

    const accessToken = createAccessToken(user);

    setRefreshCookie(
      res,
      session.refreshToken,
    );

    return res.status(200).json({
      token: accessToken,
      user: {
        userId: session.user.userId,
        username: session.user.username,
      },
    });
  } catch (error) {
    console.error(
      'Session refresh failed:',
      error.message,
    );

    return res.status(500).json({
      error: 'Unable to refresh your session.',
    });
  }
});

/**
 * POST /api/auth/session/logout
 *
 * Revokes the current persistent session.
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = getRefreshToken(req);

    if (refreshToken) {
      await revokeAuthSession(refreshToken);
    }

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Session logged out successfully.',
    });
  } catch (error) {
    console.error(
      'Session logout failed:',
      error.message,
    );

    clearRefreshCookie(res);

    return res.status(500).json({
      error: 'Unable to terminate your session.',
    });
  }
});

export default router;