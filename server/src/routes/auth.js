import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { createHash, randomInt } from 'node:crypto';

import User from '../models/User.js';
import { config } from '../config/index.js';
import { sendOtpEmail } from '../services/emailService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/auth/me
 *
 * Verifies the current JWT and returns the authenticated user's public
 * account information. Used by the client to restore a session on refresh.
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      '_id username isEmailVerified',
    );

    if (!user || !user.isEmailVerified) {
      return res.status(401).json({
        error: 'This account is unavailable or its email is not verified.',
      });
    }

    return res.status(200).json({
      user: {
        userId: user._id.toString(),
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Session verification failed:', error.message);

    return res.status(500).json({
      error: 'Unable to verify your session right now.',
    });
  }
});

const OTP_LENGTH = 6;
const PASSWORD_MIN_LENGTH = 8;

const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeUsername = (value) =>
  typeof value === 'string' ? value.trim() : '';

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const createOtp = () =>
  randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');

const hashOtp = (otp) =>
  createHash('sha256').update(otp).digest('hex');

const otpMatches = (providedOtp, storedHash) => {
  if (
    typeof providedOtp !== 'string' ||
    !new RegExp(`^\\d{${OTP_LENGTH}}$`).test(providedOtp) ||
    typeof storedHash !== 'string'
  ) {
    return false;
  }

  return hashOtp(providedOtp) === storedHash;
};

const otpExpiry = (minutes) =>
  new Date(Date.now() + minutes * 60 * 1000);

const isExpired = (date) =>
  !(date instanceof Date) || date.getTime() <= Date.now();

const resendIsBlocked = (lastSentAt) => {
  if (!lastSentAt) return false;

  const cooldownMs = config.email.otpResendCooldownSeconds * 1000;

  return Date.now() - new Date(lastSentAt).getTime() < cooldownMs;
};

const resendSecondsRemaining = (lastSentAt) => {
  if (!lastSentAt) return 0;

  const cooldownMs = config.email.otpResendCooldownSeconds * 1000;
  const elapsed = Date.now() - new Date(lastSentAt).getTime();

  return Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000));
};

const issueToken = (user) => {
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
    },
  );
};

const genericResetMessage = {
  message:
    'If an account exists for that email, password-reset instructions will be sent.',
};

function handleDatabaseError(error, res) {
  if (error?.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0];

    if (duplicateField === 'email') {
      res.status(409).json({
        error: 'An account with this email already exists.',
      });
      return true;
    }

    if (duplicateField === 'username') {
      res.status(409).json({
        error: 'This username is already taken.',
      });
      return true;
    }
  }

  return false;
}

/**
 * POST /api/auth/register
 *
 * Creates an unverified account and sends an email verification OTP.
 */
router.post('/register', async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email and password are required.',
      });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        error: 'Username must contain between 3 and 50 characters.',
      });
    }

    if (!isValidEmail(email) || email.length > 254) {
      return res.status(400).json({
        error: 'Please provide a valid email address.',
      });
    }

    if (
      typeof password !== 'string' ||
      password.length < PASSWORD_MIN_LENGTH
    ) {
      return res.status(400).json({
        error: 'Password must contain at least 8 characters.',
      });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(409).json({
          error: 'This username is already taken.',
        });
      }

      return res.status(409).json({
        error: 'An account with this email already exists.',
      });
    }

    const otp = createOtp();

    const user = new User({
      username,
      email,
      password,
      isEmailVerified: false,
      emailVerificationOtpHash: hashOtp(otp),
      emailVerificationOtpExpiresAt: otpExpiry(
        config.email.verificationOtpTtlMinutes,
      ),
      emailVerificationOtpLastSentAt: new Date(),
    });

    await user.save();

    try {
      await sendOtpEmail({
        to: email,
        otp,
        purpose: 'email-verification',
      });
    } catch (emailError) {
      await User.updateOne(
        { _id: user._id, isEmailVerified: false },
        {
          $unset: {
            emailVerificationOtpHash: 1,
            emailVerificationOtpExpiresAt: 1,
            emailVerificationOtpLastSentAt: 1,
          },
        },
      );

      console.error('Signup verification email failed:', emailError.message);

      return res.status(502).json({
        error:
          'Account created, but the verification email could not be sent. Please request a new code.',
        emailVerificationRequired: true,
      });
    }

    return res.status(201).json({
      message: 'Verification code sent to your email address.',
      emailVerificationRequired: true,
      email,
    });
  } catch (error) {
    if (handleDatabaseError(error, res)) return;

    console.error('Registration failed:', error.message);

    return res.status(500).json({
      error: 'Unable to create your account right now.',
    });
  }
});

/**
 * POST /api/auth/verify-email
 *
 * Verifies the signup OTP and activates the account.
 */
router.post('/verify-email', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = req.body?.otp;

    if (!email || typeof otp !== 'string') {
      return res.status(400).json({
        error: 'Email and verification code are required.',
      });
    }

    const user = await User.findOne({ email }).select(
      '+emailVerificationOtpHash +emailVerificationOtpExpiresAt',
    );

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired verification code.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        message: 'Email is already verified. You can log in.',
      });
    }

    if (
      isExpired(user.emailVerificationOtpExpiresAt) ||
      !otpMatches(otp, user.emailVerificationOtpHash)
    ) {
      return res.status(400).json({
        error: 'Invalid or expired verification code.',
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationOtpExpiresAt = undefined;
    user.emailVerificationOtpLastSentAt = undefined;

    await user.save();

    return res.status(200).json({
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Email verification failed:', error.message);

    return res.status(500).json({
      error: 'Unable to verify your email right now.',
    });
  }
});

/**
 * POST /api/auth/resend-verification
 *
 * Resends a signup verification OTP.
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        error: 'Please provide a valid email address.',
      });
    }

    const user = await User.findOne({ email }).select(
      '+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpLastSentAt',
    );

    if (!user) {
      return res.status(200).json({
        message:
          'If the account requires verification, a new code will be sent.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        message: 'Email is already verified. You can log in.',
      });
    }

    if (resendIsBlocked(user.emailVerificationOtpLastSentAt)) {
      return res.status(429).json({
        error: 'Please wait before requesting another code.',
        retryAfterSeconds: resendSecondsRemaining(
          user.emailVerificationOtpLastSentAt,
        ),
      });
    }

    const otp = createOtp();

    user.emailVerificationOtpHash = hashOtp(otp);
    user.emailVerificationOtpExpiresAt = otpExpiry(
      config.email.verificationOtpTtlMinutes,
    );
    user.emailVerificationOtpLastSentAt = new Date();

    await user.save();

    try {
      await sendOtpEmail({
        to: user.email,
        otp,
        purpose: 'email-verification',
      });
    } catch (emailError) {
      console.error('Resending verification email failed:', emailError.message);

      return res.status(502).json({
        error: 'Unable to send the verification email. Please try again later.',
      });
    }

    return res.status(200).json({
      message: 'A new verification code has been sent.',
    });
  } catch (error) {
    console.error('Resend verification failed:', error.message);

    return res.status(500).json({
      error: 'Unable to resend the verification code.',
    });
  }
});

/**
 * POST /api/auth/login
 *
 * Only verified accounts may receive a JWT.
 */
router.post('/login', async (req, res) => {
  try {
    const identifier =
      typeof req.body?.identifier === 'string'
        ? req.body.identifier.trim()
        : typeof req.body?.username === 'string'
          ? req.body.username.trim()
          : '';

    const password = req.body?.password;

    if (!identifier || typeof password !== 'string' || !password) {
      return res.status(400).json({
        error: 'Username or email and password are required.',
      });
    }

    const query = identifier.includes('@')
      ? { email: normalizeEmail(identifier) }
      : { username: identifier };

    const user = await User.findOne(query).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        error: 'Invalid username/email or password.',
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        emailVerificationRequired: true,
        email: user.email,
      });
    }

    const token = issueToken(user);

    return res.status(200).json({
      token,
      username: user.username,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    });
  } catch (error) {
    console.error('Login failed:', error.message);

    return res.status(500).json({
      error: 'Unable to log in right now.',
    });
  }
});

/**
 * POST /api/auth/forgot-password
 *
 * Always returns a generic message to avoid exposing account existence.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        error: 'Please provide a valid email address.',
      });
    }

    const user = await User.findOne({ email });

    if (!user || !user.isEmailVerified) {
      return res.status(200).json(genericResetMessage);
    }

    const userWithResetFields = await User.findById(user._id).select(
      '+passwordResetOtpLastSentAt',
    );

    if (resendIsBlocked(userWithResetFields.passwordResetOtpLastSentAt)) {
      return res.status(200).json(genericResetMessage);
    }

    const otp = createOtp();

    userWithResetFields.passwordResetOtpHash = hashOtp(otp);
    userWithResetFields.passwordResetOtpExpiresAt = otpExpiry(
      config.email.passwordResetOtpTtlMinutes,
    );
    userWithResetFields.passwordResetOtpLastSentAt = new Date();

    await userWithResetFields.save();

    try {
      await sendOtpEmail({
        to: user.email,
        otp,
        purpose: 'password-reset',
      });
    } catch (emailError) {
      console.error('Password reset email failed:', emailError.message);

      return res.status(502).json({
        error: 'Unable to send the password reset email. Please try again later.',
      });
    }

    return res.status(200).json(genericResetMessage);
  } catch (error) {
    console.error('Forgot password failed:', error.message);

    return res.status(500).json({
      error: 'Unable to process your request right now.',
    });
  }
});

/**
 * POST /api/auth/verify-reset-otp
 *
 * Checks a reset OTP without changing the password.
 */
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = req.body?.otp;

    if (!email || typeof otp !== 'string') {
      return res.status(400).json({
        error: 'Email and reset code are required.',
      });
    }

    const user = await User.findOne({ email }).select(
      '+passwordResetOtpHash +passwordResetOtpExpiresAt',
    );

    if (
      !user ||
      !user.isEmailVerified ||
      isExpired(user.passwordResetOtpExpiresAt) ||
      !otpMatches(otp, user.passwordResetOtpHash)
    ) {
      return res.status(400).json({
        error: 'Invalid or expired password reset code.',
      });
    }

    return res.status(200).json({
      message: 'Reset code verified. You can set a new password.',
    });
  } catch (error) {
    console.error('Reset OTP verification failed:', error.message);

    return res.status(500).json({
      error: 'Unable to verify the reset code right now.',
    });
  }
});

/**
 * POST /api/auth/reset-password
 *
 * Requires the correct, unexpired reset OTP.
 */
router.post('/reset-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = req.body?.otp;
    const password = req.body?.password;

    if (!email || typeof otp !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Email, reset code and new password are required.',
      });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        error: 'Password must contain at least 8 characters.',
      });
    }

    const user = await User.findOne({ email }).select(
      '+passwordResetOtpHash +passwordResetOtpExpiresAt',
    );

    if (
      !user ||
      !user.isEmailVerified ||
      isExpired(user.passwordResetOtpExpiresAt) ||
      !otpMatches(otp, user.passwordResetOtpHash)
    ) {
      return res.status(400).json({
        error: 'Invalid or expired password reset code.',
      });
    }

    user.password = password;
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    user.passwordResetOtpLastSentAt = undefined;

    await user.save();

    return res.status(200).json({
      message: 'Password reset successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Password reset failed:', error.message);

    return res.status(500).json({
      error: 'Unable to reset your password right now.',
    });
  }
});

export default router;