import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(
    location.state?.email || searchParams.get('email') || '',
  );

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleVerify = async (event) => {
    event.preventDefault();

    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail) {
      setError('Enter the email address you registered with.');
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError('Enter the six-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE_URL}/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          otp: normalizedOtp,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            payload.message ||
            'Email verification failed. Check the code and try again.',
        );
      }

      setNotice('Email verified successfully. Redirecting to sign in…');

      window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            verifiedEmail: normalizedEmail,
          },
        });
      }, 1000);
    } catch (err) {
      setError(err.message || 'Unable to verify your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter your registered email address first.');
      return;
    }

    setResending(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/resend-verification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            payload.message ||
            'Unable to resend the verification code.',
        );
      }

      setOtp('');
      setNotice(
        payload.message ||
          'If the account is eligible, a new verification code has been sent.',
      );
    } catch (err) {
      setError(err.message || 'Unable to resend the verification code.');
    } finally {
      setResending(false);
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
          <span className="auth-eyebrow">ONE LAST STEP</span>

          <h1>
            Make it official.
            <br />
            Start <span>connecting.</span>
          </h1>

          <p className="auth-brand-description">
            Verify your email to secure your account and join your team in
            a virtual workspace built for natural conversations.
          </p>

          <blockquote className="auth-quote">
            <span className="auth-quote-mark">“</span>

            <p>
              The best ideas happen when people can connect without
              barriers.
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
          <Link to="/signup" className="auth-back-link">
            <span aria-hidden="true">←</span> Back to sign up
          </Link>

          <div className="auth-form-heading">
            <span className="auth-eyebrow">EMAIL VERIFICATION</span>

            <h2>Check your inbox</h2>

            <p>
              Enter the six-digit code sent to your email address to
              activate your ProxiSpeak account.
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

          <form className="auth-form" onSubmit={handleVerify}>
            <div className="auth-field">
              <label htmlFor="verification-email">Email address</label>

              <input
                id="verification-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                  setNotice('');
                }}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="verification-otp">Verification code</label>

              <input
                id="verification-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                maxLength={6}
                required
                disabled={loading}
              />
            </div>

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Verifying email...' : 'Verify email'}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="auth-resend-row">
            <span>Didn't receive the code?</span>

            <button
              className="auth-inline-link auth-resend-button"
              type="button"
              onClick={handleResend}
              disabled={resending || loading}
            >
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          </div>

          <p className="auth-switch">
            Already verified? <Link to="/login">Sign in</Link>
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