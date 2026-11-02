import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

export default function Login({ onLogin }) {
  const location = useLocation();

  const [form, setForm] = useState({
    identifier: location.state?.verifiedEmail || '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    location.state?.verifiedEmail
      ? 'Email verified successfully. You can now sign in.'
      : '',
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError('');
    setNotice('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const identifier = form.identifier.trim();

    if (!identifier || !form.password) {
      setError('Enter your username/email and password.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password: form.password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (
          response.status === 403 &&
          payload.emailVerificationRequired
        ) {
          setError(
            'Your email is not verified yet. Verify your email before signing in.',
          );

          return;
        }

        throw new Error(
          payload.error ||
            payload.message ||
            'Unable to sign in. Please try again.',
        );
      }

      if (typeof payload.token !== 'string' || !payload.token.trim()) {
        throw new Error('The server did not return a valid authentication token.');
      }

      if (typeof onLogin !== 'function') {
        throw new Error('The login page is not connected to the application session. Please refresh and try again.');
      }

      const username = payload.username || identifier;

      localStorage.setItem('token', payload.token);
      localStorage.setItem('username', username);

      if (payload.email) {
        localStorage.setItem('email', payload.email);
      } else {
        localStorage.removeItem('email');
      }

      // App.jsx owns the authenticated view; do not navigate to an unregistered /rooms route.
      onLogin(username);
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
          <span className="auth-eyebrow">YOUR VIRTUAL WORKSPACE</span>

          <h1>
            Great conversations
            <br />
            happen <span>naturally.</span>
          </h1>

          <p className="auth-brand-description">
            Move closer. Start talking. Experience a virtual office where
            conversations flow as naturally as they do in person.
          </p>

          <blockquote className="auth-quote">
            <span className="auth-quote-mark">“</span>

            <p>
              Distance shouldn't get in the way of great conversations.
              Sometimes, all it takes is moving a little closer.
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
          <div className="auth-form-heading">
            <span className="auth-eyebrow">WELCOME BACK</span>

            <h2>Sign in to your space</h2>

            <p>
              Pick up where your conversations left off.
            </p>
          </div>

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              {error}
              {error.includes('not verified') && (
                <div className="auth-verification-link">
                  <Link to="/signup">
                    Continue to email verification
                  </Link>
                </div>
              )}
            </div>
          )}

          {notice && (
            <div className="auth-alert auth-alert-success" role="status">
              {notice}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="login-identifier">
                Username or email address
              </label>

              <input
                id="login-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                placeholder="Enter your username or email"
                value={form.identifier}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="login-password">Password</label>

                <Link to="/forgot-password" className="auth-inline-link">
                  Forgot password?
                </Link>
              </div>

              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">
            New to ProxiSpeak?{' '}
            <Link to="/signup">Create an account</Link>
          </p>

          <div className="auth-security-note">
            <span aria-hidden="true">●</span>
            Your workspace is just a sign-in away.
          </div>
        </div>

        <footer className="auth-panel-footer">
          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>
          <span>Built for better connections.</span>
        </footer>
      </section>
    </main>
  );
}