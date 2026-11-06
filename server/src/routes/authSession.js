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

const COOKIE_NAME = 'psm_refresh_token';

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const isProduction = config.isProduction;

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/api/auth/session',
  maxAge: COOKIE_MAX_AGE,
};

const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/api/auth/session',
};

/**
 * Validate browser Origin against configured client origins.
 */
function validateOrigin(req, res) {
  const origin = req.get('origin');

  if (!origin) {
    res.status(403).json({
      error: 'Request origin is required.',
    });

    return false;
  }

  let normalizedOrigin;

  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    res.status(403).json({
      error: 'Invalid request origin.',
    });

    return false;
  }

  const allowedOrigins = config.server.clientOrigins;

  const isAllowed = allowedOrigins.includes(normalizedOrigin);

  const isLocalDevelopment =
    !isProduction &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      normalizedOrigin,
    );

  if (!isAllowed && !isLocalDevelopment) {
    res.status(403).json({
      error: 'Request origin is not authorized.',
    });

    return false;
  }

  return true;
}

/**
 * Extract refresh token from HttpOnly cookie.
 */
function getRefreshToken(req) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) return null;

  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');

    if (separator === -1) continue;

    const name = item.slice(0, separator).trim();

    if (name !== COOKIE_NAME) continue;

    return item.slice(separator + 1).trim();
  }

  return null;
}

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, clearCookieOptions);
}

function createAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
    },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.jwtExpiresIn || '24h',
      algorithm: 'HS256',
    },
  );
}

/**
 * POST /api/auth/session/start
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      '_id username isEmailVerified',
    );

    if (!user || !user.isEmailVerified) {
      return res.status(401).json({
        error: 'Account is unavailable or unverified.',
      });
    }

    const session = await createAuthSession(user._id);

    setRefreshCookie(res, session.refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Persistent session established.',
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('Session creation failed:', error.message);

    return res.status(500).json({
      error: 'Unable to establish persistent session.',
    });
  }
});

/**
 * POST /api/auth/session/refresh
 */
router.post('/refresh', async (req, res) => {
  if (!validateOrigin(req, res)) return;

  try {
    const refreshToken = getRefreshToken(req);

    if (!refreshToken) {
      clearRefreshCookie(res);

      return res.status(401).json({
        error: 'Refresh session is missing.',
      });
    }

    const session = await rotateAuthSession(refreshToken);

    if (!session) {
      clearRefreshCookie(res);

      return res.status(401).json({
        error: 'Refresh session is invalid or expired.',
      });
    }

    const accessToken = createAccessToken({
      _id: session.user.userId,
      username: session.user.username,
    });

    setRefreshCookie(res, session.refreshToken);

    return res.status(200).json({
      token: accessToken,
      user: session.user,
    });
  } catch (error) {
    console.error('Session refresh failed:', error.message);

    return res.status(500).json({
      error: 'Unable to refresh authentication session.',
    });
  }
});

/**
 * POST /api/auth/session/logout
 */
router.post('/logout', async (req, res) => {
  if (!validateOrigin(req, res)) return;

  try {
    const refreshToken = getRefreshToken(req);

    if (refreshToken) {
      await revokeAuthSession(refreshToken);
    }

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Session terminated successfully.',
    });
  } catch (error) {
    console.error('Session logout failed:', error.message);

    clearRefreshCookie(res);

    return res.status(500).json({
      error: 'Unable to terminate authentication session.',
    });
  }
});

export default router;