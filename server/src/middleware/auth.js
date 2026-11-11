import jwt from 'jsonwebtoken';
import {config} from '../config/index.js';
/**
 * JWT Authentication Middleware
 *
 * Reads the JWT from the Authorization header,
 * verifies its signature and expiry, and attaches
 * the authenticated user's information to req.user.
 *
 * Expected header:
 * Authorization: Bearer <token>
 */
export function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  // Check whether the Authorization header exists.
  if (
    typeof authorization !== 'string' ||
    !authorization.startsWith('Bearer ')
  ) {
    return res.status(401).json({
      error: 'Authentication token is required.',
    });
  }

  // Extract the token.
  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: 'Authentication token is missing.',
    });
  }

  // Get the configured JWT secret.
  const secret = config.auth.jwtSecret;

  if (!secret || secret.length < 32) {
    return res.status(500).json({
      error: 'Authentication service is not configured correctly.',
    });
  }

  try {
    // Verify token signature, expiry and algorithm.
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    });

    // Validate the expected JWT payload.
    if (
      !decoded ||
      typeof decoded.userId !== 'string' ||
      !decoded.userId.trim()
    ) {
      return res.status(401).json({
        error: 'Invalid authentication token.',
      });
    }

    // Attach authenticated user information to the request.
    req.user = {
      userId: decoded.userId,
      username:
        typeof decoded.username === 'string'
          ? decoded.username
          : '',
    };

    return next();
  } catch (error) {
    // Handle invalid and expired JWT tokens.
    if (
      error.name === 'TokenExpiredError' ||
      error.name === 'JsonWebTokenError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        error: 'Your session is invalid or expired. Please sign in again.',
      });
    }

    // Pass unexpected errors to centralized error handling.
    return next(error);
  }
}

export default authenticateToken;