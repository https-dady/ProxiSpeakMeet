import express from 'express';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret || secret.length < 32) {
    const error = new Error(
      'JWT_SECRET must be configured with at least 32 characters before authentication can be used.',
    );

    error.status = 500;
    throw error;
  }

  return secret;
}

function getRequestCredentials(body) {
  const username =
    typeof body?.username === 'string'
      ? body.username.trim()
      : '';

  const password = body?.password;

  return { username, password };
}

/**
 * POST /api/auth/register
 *
 * Creates a new user account.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = getRequestCredentials(req.body);

    if (!username || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Username and password are required.',
      });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        error: 'Username must be between 3 and 50 characters.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must contain at least 8 characters.',
      });
    }

    const existingUser = await User.findOne({ username })
      .select('_id')
      .lean();

    if (existingUser) {
      return res.status(409).json({
        error: 'Username is already taken.',
      });
    }

    const user = new User({
      username,
      password,
    });

    await user.save();

    return res.status(201).json({
      message: 'Account created successfully.',
      username: user.username,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Username is already taken.',
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message,
      });
    }

    return next(error);
  }
});

/**
 * POST /api/auth/login
 *
 * Verifies credentials and issues a JWT.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = getRequestCredentials(req.body);

    if (!username || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Username and password are required.',
      });
    }

    const user = await User.findOne({ username })
      .select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        error: 'Invalid username or password.',
      });
    }

    const secret = getJwtSecret();

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
      },
      secret,
      {
        expiresIn: '24h',
        algorithm: 'HS256',
      },
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      username: user.username,
    });
  } catch (error) {
    if (
      error.status === 500 &&
      error.message.startsWith('JWT_SECRET')
    ) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return next(error);
  }
});

/**
 * GET /api/auth/me
 *
 * Returns the identity associated with a valid JWT.
 *
 * Required header:
 * Authorization: Bearer <token>
 */
router.get('/me', authenticateToken, (req, res) => {
  return res.status(200).json({
    message: 'Authenticated successfully.',
    user: {
      userId: req.user.userId,
      username: req.user.username,
    },
  });
});

export default router;