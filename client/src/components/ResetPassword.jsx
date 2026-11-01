import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(
    location.state?.email || searchParams.get('email') || '',
  );

  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || !normalizedOtp || !password || !confirmPassword) {
      setError('Please complete all fields.');
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError('Enter the six-digit OTP sent to your email.');
      return;
    }

    if (password.length < 8) {
      setError('Your new password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE_URL}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          otp: normalizedOtp,
          password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            payload.message ||
            'Unable to reset your password. Check your OTP and try again.',
        );
      }

      setNotice('Your password has been reset successfully.');

      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            verifiedEmail: normalizedEmail,
            passwordReset: true,
          },
        });
      }, 1200);
    } catch (err) {
      setError(
        err.message ||
          'Unable to connect to the server. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter your registered email address first.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            payload.message ||
            'Unable to request a new OTP.',
        );
      }

      setNotice(
        payload.message ||
          'If an eligible account exists, a new password-reset OTP has been requested.',
      );
      setOtp('');
    } catch (err) {
      setError(err.message || 'Unable to request a new OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-brand-panel">
        <Link to="/login" className="auth-brand">
          <span className="auth-brand-mark">P</span>
          <span>
            ProxiSpeak<span className="auth-brand-light"> Meet</span>
          </span>
        </Link>

        <div className="auth-brand-content">
          <span className="auth-eyebrow">A FRESH START</span>

          <h1>
            Your next great
            <br />
            conversation <span>awaits.</span>
          </h1>

          <p className="auth-brand-description">
            Secure your account and return to a workspace built for natural
            conversations, collaboration, and connection.
          </p>

          <blockquote className="auth-quote">
            <span className="auth-quote-mark">“</span>

            <p>
              Better connections start with being there. Let's get you back
              to your workspace.
            </p>

            <footer>THE PROXISPEAK PHILOSOPHY</footer>
          </blockquote>
        </div>

        <div className="auth-brand-footer">
          <span>Less friction. More connection.</span>
          <span>PROXIMITY-POWERED CONVERSATIONS</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <span className="auth-brand-mark">P</span>
          <span>ProxiSpeak Meet</span>
        </div>

        <div className="auth-form-container">
          <Link to="/forgot-password" className="auth-back-link">
            <span aria-hidden="true">←</span> Back
          </Link>

          <div className="auth-form-heading">
            <span className="auth-eyebrow">SECURE YOUR ACCOUNT</span>

            <h2>Reset your password</h2>

            <p>
              Enter the six-digit code from your email and choose a new
              password.
            </p>
          </div>

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="auth-alert auth-alert-success" role="status">
              {notice}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="reset-email">Email address</label>

              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reset-otp">Email verification code</label>

              <input
                id="reset-otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                maxLength={6}
                required
                disabled={loading}
              />

              <button
                className="auth-inline-link auth-resend-button"
                type="button"
                onClick={handleResend}
                disabled={loading}
              >
                Didn't receive the code? Request another
              </button>
            </div>

            <div className="auth-field">
              <label htmlFor="reset-password">New password</label>

              <input
                id="reset-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError('');
                }}
                minLength={8}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reset-confirm-password">
                Confirm new password
              </label>

              <input
                id="reset-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Enter your new password again"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError('');
                }}
                minLength={8}
                required
                disabled={loading}
              />
            </div>

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Resetting password...' : 'Reset password'}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">
            Remember your password? <Link to="/login">Sign in</Link>
          </p>
        </div>

        <footer className="auth-panel-footer">
          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>
          <span>Built for better connections.</span>
        </footer>
      </section>
    </main>
  );
}