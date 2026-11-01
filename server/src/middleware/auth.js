import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return secret;
}

/**
 * Verify the JWT supplied through the Authorization header.
 *
 * Expected header:
 * Authorization: Bearer <token>
 *
 * On success:
 * req.user = {
 *   userId: string,
 *   username: string
 * }
 */
export function authenticateToken(req, res, next) {
  const authorization = req.get('authorization');

  if (!authorization) {
    return res.status(401).json({
      ok: false,
      error: 'Authentication token is required.',
    });
  }

  const parts = authorization.trim().split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== 'bearer' ||
    !parts[1]
  ) {
    return res.status(401).json({
      ok: false,
      error: 'Authorization header must use Bearer token format.',
    });
  }

  let secret;

  try {
    secret = getJwtSecret();
  } catch (error) {
    return next(error);
  }

  try {
    const payload = jwt.verify(parts[1], secret, {
      algorithms: ['HS256'],
    });

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.userId !== 'string' ||
      !payload.userId ||
      typeof payload.username !== 'string' ||
      !payload.username
    ) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication token is invalid.',
      });
    }

    req.user = {
      userId: payload.userId,
      username: payload.username,
    };

    return next();
  } catch (error) {
    if (
      error.name === 'TokenExpiredError' ||
      error.name === 'JsonWebTokenError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        ok: false,
        error:
          error.name === 'TokenExpiredError'
            ? 'Authentication token has expired. Please log in again.'
            : 'Authentication token is invalid.',
      });
    }

    return next(error);
  }
}

export default authenticateToken;