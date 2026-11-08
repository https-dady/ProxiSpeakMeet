import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

function FieldIcon({ type }) {
  if (type === 'user') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }

  if (type === 'lock') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v3" />
      </svg>
    );
  }

  return null;
}

function PasswordToggle({ visible, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl border-0 bg-[#F0EEFF] text-[#5546F5] shadow-none transition-all duration-200 hover:scale-105 hover:bg-[#E5E0FF] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5546F5] disabled:opacity-50"
    >
      {visible ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9 7 9 7a15 15 0 0 1-3 3.8" />
          <path d="M6.2 6.2C4.1 7.6 3 12 3 12s3.5 7 9 7a10 10 0 0 0 4-.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export default function Login({ onLogin }) {
  const location = useLocation();

  const [form, setForm] = useState({
    identifier:
      location.state?.verifiedEmail ||
      location.state?.email ||
      '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [notice, setNotice] = useState(
    location.state?.passwordReset
      ? 'Your password has been reset successfully. You can now sign in.'
      : location.state?.verifiedEmail
        ? 'Email verified successfully. You can now sign in.'
        : '',
  );

  const [verificationEmail, setVerificationEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError('');
    setNotice('');

    if (name === 'identifier') {
      setVerificationEmail('');
    }
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
    setVerificationEmail('');

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

      if (
        response.status === 403 &&
        payload.emailVerificationRequired
      ) {
        setVerificationEmail(
          payload.email ||
            (identifier.includes('@') ? identifier : ''),
        );

        setError(
          'Your email is not verified yet. Verify your email before signing in.',
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          payload.error ||
            payload.message ||
            'Unable to sign in. Please try again.',
        );
      }

      if (
        typeof payload.token !== 'string' ||
        !payload.token.trim()
      ) {
        throw new Error(
          'The server did not return a valid authentication token.',
        );
      }

      if (typeof onLogin !== 'function') {
        throw new Error(
          'Login is not connected to the application session.',
        );
      }

      const username = payload.username || identifier;

      localStorage.setItem('token', payload.token);
      localStorage.setItem('username', username);

      if (payload.email) {
        localStorage.setItem('email', payload.email);
      } else {
        localStorage.removeItem('email');
      }

      await onLogin(username);

      setError('');
      setNotice('');

    } catch (err) {
      setError(
        err.message ||
          'Unable to connect to the server. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const verificationUrl = verificationEmail
    ? `/verify-email?email=${encodeURIComponent(verificationEmail)}`
    : '/verify-email';

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#F5F4FC] font-sans text-[#202334]">

      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">

        {/* LEFT BRANDING PANEL */}

        <section className="relative hidden overflow-hidden bg-[#EFEDFF] p-10 lg:flex lg:flex-col lg:justify-between xl:p-16">

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 top-20 h-[420px] w-[420px] rounded-full border border-[#5546F5]/10 shadow-[0_0_0_60px_rgba(85,70,245,0.025),0_0_0_120px_rgba(85,70,245,0.02)]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-20 h-[400px] w-[400px] rounded-full bg-[#5546F5]/10 blur-[100px]"
          />

          {/* BRAND */}

          <Link
            to="/login"
            aria-label="ProxiSpeak Meet home"
            className="relative z-10 inline-flex w-fit items-center gap-3 no-underline"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#5546F5] text-2xl font-black text-white shadow-lg shadow-[#5546F5]/20 transition-transform duration-300 hover:rotate-6 hover:scale-105">
              P
            </span>

            <span className="text-xl font-extrabold tracking-tight text-[#202334]">
              ProxiSpeak
              <span className="text-[#5546F5]"> Meet</span>
            </span>
          </Link>

          {/* HERO */}

          <div className="relative z-10 my-auto max-w-[560px] py-10">

            <span className="inline-flex items-center gap-2 rounded-full border border-[#5546F5]/15 bg-white/70 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#5546F5]" />
              YOUR PEOPLE, CLOSER
            </span>

            <h1 className="mt-8 text-[clamp(40px,4.5vw,66px)] font-extrabold leading-[1.12] tracking-[-2.5px]">
              Work together.

              <br />

              Connect
              <span className="text-[#5546F5]"> naturally.</span>
            </h1>

            <p className="mt-7 max-w-[440px] text-sm leading-[2] text-[#777990]">
              Step into a shared virtual office where spontaneous
              conversations and collaboration feel natural.
              Move closer and let ideas flow.
            </p>

            {/* FEATURE CARDS */}

            <div className="mt-10 grid max-w-[500px] grid-cols-2 gap-4">

              <div className="group rounded-[24px] border border-white/90 bg-white/75 p-5 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-[#5546F5]/20 hover:shadow-xl">

                <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-[#EFEDFF] text-[#5546F5] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>

                <h3 className="text-sm font-bold text-[#202334]">
                  Virtual Office
                </h3>

                <p className="mt-2 text-xs leading-6 text-[#85879A]">
                  Meet your team in a shared workspace.
                </p>

              </div>

              <div className="group rounded-[24px] border border-white/90 bg-white/75 p-5 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-[#5546F5]/20 hover:shadow-xl">

                <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-[#EFEDFF] text-[#5546F5] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v18M8 7a4 4 0 1 1 8 0c0 2-2 3-2 5h-4c0-2-2-3-2-5Z" />
                    <path d="M9 17h6M10 20h4" />
                  </svg>
                </div>

                <h3 className="text-sm font-bold text-[#202334]">
                  Natural Audio
                </h3>

                <p className="mt-2 text-xs leading-6 text-[#85879A]">
                  Conversations powered by proximity.
                </p>

              </div>

            </div>

            {/* QUOTE */}

            <blockquote className="mt-5 max-w-[500px] rounded-[24px] border border-white/90 bg-white/75 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">

              <span className="text-3xl font-serif text-[#5546F5]">
                “
              </span>

              <p className="mt-2 text-sm leading-7 text-[#55576C]">
                You don't always need another meeting.
                Sometimes, you just need to be close enough to talk.
              </p>

              <footer className="mt-4 text-[10px] font-extrabold tracking-[1.5px] text-[#9294A7]">
                THE PROXISPEAK PHILOSOPHY
              </footer>

            </blockquote>

          </div>

          {/* FOOTER */}

          <footer className="relative z-10 flex flex-wrap justify-between gap-3 text-[10px] font-semibold tracking-wide text-[#9294A7]">
            <span>LESS FRICTION. MORE CONNECTION.</span>
            <span>PROXISPEAK MEET</span>
          </footer>

        </section>

        {/* RIGHT LOGIN PANEL */}

        <section className="flex min-h-dvh flex-col items-center justify-center bg-white px-5 py-8 sm:px-10 lg:px-10 xl:px-14">

          {/* MOBILE BRAND */}

          <Link
            to="/login"
            aria-label="ProxiSpeak Meet home"
            className="mb-7 inline-flex items-center gap-3 self-start no-underline lg:hidden"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#5546F5] text-xl font-black text-white">
              P
            </span>

            <span className="text-lg font-extrabold text-[#202334]">
              ProxiSpeak
              <span className="text-[#5546F5]"> Meet</span>
            </span>
          </Link>

          <div className="my-auto w-full max-w-[480px]">

            {/* LOGIN CARD */}

            <div className="rounded-[28px] border border-[#ECEAF7] bg-[#FBFAFF] p-5 shadow-[0_18px_60px_rgba(53,43,125,0.07)] transition-shadow duration-500 hover:shadow-[0_22px_70px_rgba(53,43,125,0.10)] sm:p-7 lg:p-6 xl:p-8">

              {/* HEADING */}

              <div className="mb-7">

                <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">
                  <span className="h-2 w-2 rounded-full bg-[#5546F5]" />
                  WELCOME BACK
                </span>

                <h2 className="mt-3 text-[clamp(29px,3vw,38px)] font-extrabold leading-tight tracking-[-1.5px] text-[#202334]">
                  Sign in to your space
                </h2>

                <p className="mt-3 text-sm leading-7 text-[#85879A]">
                  Pick up where your conversations left off.
                </p>

              </div>

              {/* ERROR */}

              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700"
                >
                  {error}

                  {error.includes('not verified') && (
                    <div className="mt-3">
                      <Link
                        to={verificationUrl}
                        state={{ email: verificationEmail }}
                        className="font-bold text-[#5546F5] underline underline-offset-4"
                      >
                        Continue to email verification
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* SUCCESS */}

              {notice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-6 text-green-700"
                >
                  {notice}
                </div>
              )}

              {/* FORM */}

              <form
                className="grid w-full gap-5"
                onSubmit={handleSubmit}
                noValidate
              >

                {/* IDENTIFIER */}

                <div className="grid min-w-0 gap-2">

                  <label
                    htmlFor="login-identifier"
                    className="text-xs font-bold text-[#45465A]"
                  >
                    Username or email address
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="user" />
                    </span>

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
                      className="min-h-[54px] w-full rounded-2xl border border-[#E8E6F2] bg-white pl-12 pr-4 text-sm font-medium text-[#202334] outline-none transition-all duration-300 placeholder:text-[#A6A5B5] hover:border-[#CFC9F8] focus:border-[#7768F7] focus:shadow-[0_0_0_4px_rgba(85,70,245,0.09)] disabled:opacity-60"
                    />

                  </div>

                </div>

                {/* PASSWORD */}

                <div className="grid min-w-0 gap-2">

                  <div className="flex items-center justify-between gap-3">

                    <label
                      htmlFor="login-password"
                      className="text-xs font-bold text-[#45465A]"
                    >
                      Password
                    </label>

                    <Link
                      to="/forgot-password"
                      className="text-xs font-bold text-[#5546F5] transition-colors hover:text-[#4032D5] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5546F5]"
                    >
                      Forgot password?
                    </Link>

                  </div>

                  <div className="relative">

                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="lock" />
                    </span>

                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      className="min-h-[54px] w-full rounded-2xl border border-[#E8E6F2] bg-white pl-12 pr-14 text-sm font-medium text-[#202334] outline-none transition-all duration-300 placeholder:text-[#A6A5B5] hover:border-[#CFC9F8] focus:border-[#7768F7] focus:shadow-[0_0_0_4px_rgba(85,70,245,0.09)] disabled:opacity-60"
                    />

                    <PasswordToggle
                      visible={showPassword}
                      onToggle={() => setShowPassword((value) => !value)}
                      disabled={loading}
                    />

                  </div>

                </div>

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={loading}
                  className="group mt-2 flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl border border-[#5546F5] bg-[#5546F5] px-5 py-3 text-sm font-extrabold text-white shadow-[0_9px_24px_rgba(85,70,245,0.20)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#4536E5] hover:shadow-[0_15px_32px_rgba(85,70,245,0.28)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5546F5] disabled:cursor-wait disabled:opacity-60"
                >

                  {loading ? 'Signing in...' : 'Sign in'}

                  {!loading && (
                    <span
                      aria-hidden="true"
                      className="text-lg transition-transform duration-300 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  )}

                </button>

              </form>

              {/* SIGNUP */}

              <p className="mt-6 text-center text-xs text-[#85879A]">

                New to ProxiSpeak?{' '}

                <Link
                  to="/signup"
                  className="font-extrabold text-[#5546F5] transition-colors hover:text-[#4032D5] hover:underline hover:underline-offset-4"
                >
                  Create an account
                </Link>

              </p>

              {/* BOTTOM NOTE */}

              <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-[#EAE7FA] bg-[#F2F0FF] px-4 py-3 text-center text-[10px] text-[#77758E]">

                <span className="text-[#5546F5]" aria-hidden="true">
                  ●
                </span>

                Your workspace is just a sign-in away.

              </div>

            </div>

          </div>

          {/* FOOTER */}

          <footer className="mt-6 flex w-full max-w-[480px] flex-wrap justify-between gap-3 text-[10px] text-[#A0A1AF]">

            <span>
              © {new Date().getFullYear()} ProxiSpeak Meet
            </span>

            <span>
              Built for better connections.
            </span>

          </footer>

        </section>

      </div>

    </main>
  );
}