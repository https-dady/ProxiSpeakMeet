import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;
const RESEND_COOLDOWN_SECONDS = 60;

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
  const [completed, setCompleted] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const cooldownIntervalRef = useRef(null);
  const redirectTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }

      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const startCooldown = () => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    setCooldown(RESEND_COOLDOWN_SECONDS);

    cooldownIntervalRef.current = setInterval(() => {
      setCooldown((previous) => {
        if (previous <= 1) {
          clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
          return 0;
        }

        return previous - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading || completed) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || !normalizedOtp || !password || !confirmPassword) {
      setError('Please complete all fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
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

      setCompleted(true);
      setNotice(
        payload.message || 'Your password has been reset successfully.',
      );

      redirectTimeoutRef.current = setTimeout(() => {
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
        err.message || 'Unable to connect to the server. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading || completed || cooldown > 0) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter your registered email address first.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
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
          'If an account exists for that email, password-reset instructions will be sent.',
      );

      setOtp('');
      startCooldown();
    } catch (err) {
      setError(err.message || 'Unable to request a new OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080b14] text-[#edf2ff] lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-[#263149] bg-[#101625] px-12 py-10 lg:flex xl:px-20">
        <div className="pointer-events-none absolute -left-32 top-32 h-96 w-96 rounded-full bg-[#8175ff]/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-20 bottom-20 h-80 w-80 rounded-full bg-[#5ad19a]/5 blur-[110px]" />

        <Link to="/login" className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8175ff] text-xl font-bold text-white shadow-lg shadow-[#8175ff]/20">
            P
          </span>

          <span className="text-xl font-semibold tracking-tight">
            ProxiSpeak <span className="text-[#a69cff]">Meet</span>
          </span>
        </Link>

        <div className="relative max-w-xl">
          <span className="mb-6 inline-flex rounded-full border border-[#8175ff]/30 bg-[#8175ff]/10 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-[#a69cff]">
            A FRESH START
          </span>

          <h1 className="text-5xl font-bold leading-[1.15] tracking-tight xl:text-6xl">
            Your next great conversation{' '}
            <span className="text-[#a69cff]">awaits.</span>
          </h1>

          <p className="mt-7 max-w-lg text-base leading-8 text-[#9ba9c2]">
            Secure your account and return to a workspace built for natural
            conversations, collaboration, and connection.
          </p>

          <div className="mt-12 rounded-2xl border border-[#263149] bg-[#151e30]/80 p-7 backdrop-blur">
            <span className="text-4xl text-[#8175ff]">“</span>

            <p className="mt-2 text-lg leading-8 text-[#edf2ff]">
              Better connections start with being there. Let's get you back
              to your workspace.
            </p>

            <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-[#9ba9c2]">
              THE PROXISPEAK PHILOSOPHY
            </p>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-[#71809a]">
          <span>Less friction. More connection.</span>
          <span>PROXIMITY-POWERED CONVERSATIONS</span>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col justify-between px-5 py-8 sm:px-10 lg:px-12 xl:px-20">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#8175ff]/5 blur-[110px]" />

        <Link to="/login" className="relative flex items-center gap-3 lg:hidden">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8175ff] font-bold text-white">
            P
          </span>

          <span className="text-lg font-semibold">
            ProxiSpeak <span className="text-[#a69cff]">Meet</span>
          </span>
        </Link>

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <Link
            to="/forgot-password"
            className="mb-9 inline-flex w-fit items-center gap-2 text-sm text-[#9ba9c2] transition hover:text-[#a69cff]"
          >
            <span aria-hidden="true">←</span>
            Back
          </Link>

          <div className="mb-8">
            <span className="mb-4 inline-flex rounded-full border border-[#8175ff]/30 bg-[#8175ff]/10 px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] text-[#a69cff]">
              SECURE YOUR ACCOUNT
            </span>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Reset your password
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#9ba9c2]">
              Enter the six-digit code from your email and choose a new
              password.
            </p>
          </div>

          {error && (
            <div
              className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              className="mb-5 rounded-xl border border-[#5ad19a]/20 bg-[#5ad19a]/10 px-4 py-3 text-sm leading-6 text-[#5ad19a]"
              role="status"
            >
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="reset-email"
                className="mb-2 block text-sm font-medium text-[#edf2ff]"
              >
                Email address
              </label>

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
                disabled={loading || completed}
                className="w-full rounded-xl border border-[#263149] bg-[#151e30] px-4 py-3.5 text-sm text-[#edf2ff] outline-none transition placeholder:text-[#71809a] focus:border-[#8175ff] focus:ring-2 focus:ring-[#8175ff]/20 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="reset-otp"
                className="mb-2 block text-sm font-medium text-[#edf2ff]"
              >
                Email verification code
              </label>

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
                disabled={loading || completed}
                className="w-full rounded-xl border border-[#263149] bg-[#151e30] px-4 py-3.5 text-sm tracking-[0.3em] text-[#edf2ff] outline-none transition placeholder:tracking-normal placeholder:text-[#71809a] focus:border-[#8175ff] focus:ring-2 focus:ring-[#8175ff]/20 disabled:opacity-60"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#71809a]">
                  Didn't receive the code?
                </span>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || completed || cooldown > 0}
                  className="font-semibold text-[#a69cff] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading
                    ? 'Please wait...'
                    : cooldown > 0
                      ? `Request another in ${cooldown}s`
                      : 'Request another'}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="reset-password"
                className="mb-2 block text-sm font-medium text-[#edf2ff]"
              >
                New password
              </label>

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
                disabled={loading || completed}
                className="w-full rounded-xl border border-[#263149] bg-[#151e30] px-4 py-3.5 text-sm text-[#edf2ff] outline-none transition placeholder:text-[#71809a] focus:border-[#8175ff] focus:ring-2 focus:ring-[#8175ff]/20 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="reset-confirm-password"
                className="mb-2 block text-sm font-medium text-[#edf2ff]"
              >
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
                disabled={loading || completed}
                className="w-full rounded-xl border border-[#263149] bg-[#151e30] px-4 py-3.5 text-sm text-[#edf2ff] outline-none transition placeholder:text-[#71809a] focus:border-[#8175ff] focus:ring-2 focus:ring-[#8175ff]/20 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading || completed}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#8175ff] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-[#8175ff]/15 transition hover:bg-[#7164f0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Please wait...'
                : completed
                  ? 'Password reset successful'
                  : 'Reset password'}

              {!loading && !completed && (
                <span aria-hidden="true">→</span>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#9ba9c2]">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-semibold text-[#a69cff] transition hover:text-white"
            >
              Sign in
            </Link>
          </p>
        </div>

        <footer className="relative flex flex-wrap items-center justify-between gap-2 border-t border-[#263149] pt-5 text-xs text-[#71809a]">
          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>
          <span>Built for better connections.</span>
        </footer>
      </section>
    </main>
  );
}