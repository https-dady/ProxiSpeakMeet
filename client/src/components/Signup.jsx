import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();

    if (username.length < 3) {
      setError('Username must contain at least 3 characters.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password: form.password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok && !payload.emailVerificationRequired) {
        throw new Error(
          payload.error ||
            payload.message ||
            'Unable to create your account. Please try again.',
        );
      }

      navigate(
        `/verify-email?email=${encodeURIComponent(email)}`,
        {
          replace: true,
          state: {
            email,
            message: payload.message || '',
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
          <span className="auth-eyebrow">YOUR PEOPLE, CLOSER</span>

          <h1>
            Work together.
            <br />
            Connect <span>naturally.</span>
          </h1>

          <p className="auth-brand-description">
            Create your account and step into a virtual office where
            spontaneous conversations and collaboration feel natural.
          </p>

          <blockquote className="auth-quote">
            <span className="auth-quote-mark">“</span>

            <p>
              You don't always need another meeting. Sometimes, you just
              need to be close enough to talk.
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
            <span className="auth-eyebrow">GET STARTED</span>

            <h2>Create your account</h2>

            <p>
              A few details, one email verification, and you're ready to
              connect.
            </p>
          </div>

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="signup-username">Username</label>

              <input
                id="signup-username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Choose a username"
                value={form.username}
                onChange={handleChange}
                minLength={3}
                maxLength={50}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signup-email">Email address</label>

              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signup-password">Password</label>

              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange}
                minLength={8}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signup-confirm-password">
                Confirm password
              </label>

              <input
                id="signup-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={form.confirmPassword}
                onChange={handleChange}
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
              {loading ? 'Creating account...' : 'Create account'}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>

          <p className="auth-legal-note">
            We'll send a verification code to your email before your
            account can sign in.
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