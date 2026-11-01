import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

export default function Signup() {
  const navigate = useNavigate();

  const [step, setStep] = useState('signup');

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    otp: '',
  });

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === 'otp' ? value.replace(/\D/g, '').slice(0, 6) : value,
    }));

    setError('');
    setNotice('');
  };

  const request = async (endpoint, body) => {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = new Error(
        payload.error || payload.message || 'Request failed. Please try again.',
      );

      err.status = response.status;
      err.payload = payload;

      throw err;
    }

    return payload;
  };

  const handleSignup = async (event) => {
    event.preventDefault();

    if (loading) return;

    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();

    if (username.length < 3 || username.length > 50) {
      setError('Username must contain between 3 and 50 characters.');
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
    setNotice('');

    try {
      await request('register', {
        username,
        email,
        password: form.password,
      });

      setForm((current) => ({
        ...current,
        username,
        email,
        password: '',
        confirmPassword: '',
        otp: '',
      }));

      setStep('verify');
      setNotice(`A verification code has been sent to ${email}.`);
    } catch (err) {
      // The backend may create an unverified account before email delivery
      // fails. Let the user proceed to verification/resend in that case.
      if (err.payload?.emailVerificationRequired) {
        setStep('verify');
        setNotice(
          'Your account is awaiting email verification. Request a new code below.',
        );
      } else {
        setError(err.message || 'Unable to create your account.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    if (loading) return;

    if (!/^\d{6}$/.test(form.otp)) {
      setError('Enter the six-digit verification code from your email.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      await request('verify-email', {
        email: form.email,
        otp: form.otp,
      });

      setNotice('Email verified successfully. Redirecting to login...');

      window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { verifiedEmail: form.email },
        });
      }, 1000);
    } catch (err) {
      setError(err.message || 'Email verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || loading) return;

    setResending(true);
    setError('');
    setNotice('');

    try {
      const payload = await request('resend-verification', {
        email: form.email,
      });

      setNotice(payload.message || 'A new verification code has been requested.');
    } catch (err) {
      const retryMessage =
        err.payload?.retryAfterSeconds != null
          ? ` Please wait ${err.payload.retryAfterSeconds} seconds.`
          : '';

      setError(`${err.message}${retryMessage}`);
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-brand-panel">
        <Link to="/login" className="auth-brand">
          <span className="auth-brand-mark">P</span>
          <span>ProxiSpeak<span className="auth-brand-light"> Meet</span></span>
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
              The best ideas rarely happen in meetings. They happen when
              people connect.
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
          {step === 'signup' ? (
            <>
              <div className="auth-form-heading">
                <span className="auth-eyebrow">GET STARTED</span>
                <h2>Create your account</h2>
                <p>
                  Join your team and bring conversations closer together.
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

              <form className="auth-form" onSubmit={handleSignup}>
                <div className="auth-field">
                  <label htmlFor="signup-username">Username</label>
                  <input
                    id="signup-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Choose a username"
                    minLength={3}
                    maxLength={50}
                    value={form.username}
                    onChange={handleChange}
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
                    maxLength={254}
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
                    minLength={8}
                    value={form.password}
                    onChange={handleChange}
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
                    minLength={8}
                    value={form.confirmPassword}
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
                  {loading ? 'Creating account...' : 'Create account'}
                  {!loading && <span aria-hidden="true">→</span>}
                </button>
              </form>

              <p className="auth-switch">
                Already have an account? <Link to="/login">Sign in</Link>
              </p>

              <p className="auth-terms">
                By creating an account, you agree to use ProxiSpeak Meet
                responsibly.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                className="auth-back-button"
                onClick={() => {
                  setStep('signup');
                  setError('');
                  setNotice('');
                  setForm((current) => ({ ...current, otp: '' }));
                }}
                disabled={loading}
              >
                ← Back to signup
              </button>

              <div className="auth-form-heading">
                <span className="auth-eyebrow">ONE LAST STEP</span>
                <h2>Verify your email</h2>
                <p>
                  We sent a six-digit verification code to
                  {' '}
                  <strong>{form.email}</strong>.
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
                  <label htmlFor="signup-otp">Verification code</label>
                  <input
                    id="signup-otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={form.otp}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    aria-describedby="signup-otp-help"
                  />
                  <small id="signup-otp-help">
                    The code expires after{' '}
                    {config.emailVerificationOtpTtlMinutes || 10} minutes.
                  </small>
                </div>

                <button
                  className="auth-submit"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Verify email'}
                  {!loading && <span aria-hidden="true">→</span>}
                </button>
              </form>

              <div className="auth-resend">
                <span>Didn't receive the code?</span>
                <button
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
            </>
          )}
        </div>

        <footer className="auth-panel-footer">
          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>
          <span>Built for better connections.</span>
        </footer>
      </section>
    </main>
  );
}