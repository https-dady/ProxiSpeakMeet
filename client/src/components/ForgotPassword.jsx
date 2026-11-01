import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your registered email address.');
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
            'Unable to process your request. Please try again.',
        );
      }

      setNotice(
        payload.message ||
          'If an eligible account exists, password-reset instructions have been sent to its email address.',
      );

      navigate(
        `/reset-password?email=${encodeURIComponent(normalizedEmail)}`,
        {
          state: {
            email: normalizedEmail,
            message:
              payload.message ||
              'Check your email for the password-reset OTP.',
          },
        },
      );
    } catch (err) {
      setError(
        err.message ||
          'Unable to connect to the server. Please try again.',
      );
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
          <span className="auth-eyebrow">YOUR SPACE AWAITS</span>

          <h1>
            Reconnect with
            <br />
            your <span>people.</span>
          </h1>

          <p className="auth-brand-description">
            Your virtual office is still here. Recover your account securely
            and get back to the conversations that matter.
          </p>

          <blockquote className="auth-quote">
            <span className="auth-quote-mark">“</span>

            <p>
              Great ideas begin when people feel connected. Let's get you
              back in the room.
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
          <Link to="/login" className="auth-back-link">
            <span aria-hidden="true">←</span> Back to sign in
          </Link>

          <div className="auth-form-heading">
            <span className="auth-eyebrow">ACCOUNT RECOVERY</span>

            <h2>Forgot your password?</h2>

            <p>
              Enter your registered email address. We'll send you a
              verification code to reset your password.
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
              <label htmlFor="recovery-email">Email address</label>

              <input
                id="recovery-email"
                name="email"
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

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Sending request...' : 'Continue'}
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