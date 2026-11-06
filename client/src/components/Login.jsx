import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

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

      // Wait for application authentication integration.
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
    <main className="grid min-h-dvh w-full grid-cols-1 overflow-hidden bg-[#1E1E1E] font-sans text-[#F6F6F6] lg:grid-cols-2">

      {/* LEFT BRANDING PANEL */}

      <section className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-[#1E1E1E] p-10 lg:flex xl:p-16">

        {/* Decorative elements */}

        <div className="pointer-events-none absolute -right-32 top-20 h-[450px] w-[450px] rounded-full border border-white/[0.05] shadow-[0_0_0_60px_rgba(255,255,255,0.015),0_0_0_120px_rgba(255,255,255,0.01)]" />

        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-[#F3184C]/[0.08] blur-[100px]" />

        {/* Brand */}

        <Link
          to="/login"
          className="relative z-10 inline-flex w-fit items-center gap-3 text-xl font-extrabold tracking-tight text-[#F6F6F6] no-underline"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#F3184C] text-xl font-black text-white shadow-[0_8px_25px_rgba(243,24,76,0.25)]">
            P
          </span>

          <span>
            ProxiSpeak
            <span className="text-[#F3184C]"> Meet</span>
          </span>
        </Link>

        {/* Hero content */}

        <div className="relative z-10 my-auto max-w-[580px] py-16">

          <span className="inline-flex items-center gap-2 rounded-full border border-[#F3184C]/30 bg-[#F3184C]/10 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#F3184C]">

            <span className="h-1.5 w-1.5 rounded-full bg-[#F3184C]" />

            YOUR VIRTUAL WORKSPACE

          </span>

          <h1 className="mt-8 text-[clamp(42px,4.5vw,68px)] font-extrabold leading-[1.12] tracking-[-2.8px]">

            Great conversations

            <br />

            happen{' '}

            <span className="text-[#F3184C]">
              naturally.
            </span>

          </h1>

          <p className="mt-7 max-w-[440px] text-sm leading-[2] text-[#A5A5A5]">
            Move closer. Start talking. Experience a virtual office where
            conversations flow as naturally as they do in person.
          </p>

          {/* Philosophy card */}

          <blockquote className="mt-12 max-w-[450px] rounded-2xl border border-white/[0.08] bg-[#303030] p-7">

            <span className="block text-5xl font-serif leading-none text-[#F3184C]">
              “
            </span>

            <p className="mt-3 text-sm leading-[1.9] text-[#F6F6F6]">
              Distance shouldn't get in the way of great conversations.
              Sometimes, all it takes is moving a little closer.
            </p>

            <footer className="mt-5 text-[10px] font-extrabold tracking-[1.8px] text-[#929292]">
              THE PROXISPEAK PHILOSOPHY
            </footer>

          </blockquote>

        </div>

        {/* Footer */}

        <div className="relative z-10 flex flex-wrap justify-between gap-3 text-[10px] text-[#929292]">

          <span>
            Less friction. More connection.
          </span>

          <span className="tracking-[1px]">
            PROXIMITY-POWERED CONVERSATIONS
          </span>

        </div>

      </section>

      {/* RIGHT LOGIN PANEL */}

      <section className="relative flex min-h-dvh min-w-0 flex-col items-center justify-center bg-[#F6F6F6] px-6 py-8 text-[#1E1E1E] sm:px-10 lg:px-[clamp(35px,6vw,90px)]">

        {/* Mobile branding */}

        <div className="mb-12 inline-flex w-full max-w-[440px] items-center gap-3 lg:hidden">

          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F3184C] text-xl font-black text-white">
            P
          </span>

          <span className="text-lg font-extrabold">
            ProxiSpeak Meet
          </span>

        </div>

        <div className="my-auto w-full max-w-[430px]">

          {/* Heading */}

          <div className="mb-10">

            <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#F3184C]">

              <span className="h-0.5 w-5 rounded-full bg-[#F3184C]" />

              WELCOME BACK

            </span>

            <h2 className="mt-5 text-[clamp(30px,3vw,40px)] font-extrabold leading-tight tracking-[-1.5px]">
              Sign in to your space
            </h2>

            <p className="mt-3 text-sm leading-[1.8] text-[#686868]">
              Pick up where your conversations left off.
            </p>

          </div>

          {/* Error */}

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700"
            >
              {error}

              {error.includes('not verified') && (
                <div className="mt-3">

                  <Link
                    to={verificationUrl}
                    state={{
                      email: verificationEmail,
                    }}
                    className="font-bold text-[#F3184C] underline underline-offset-4"
                  >
                    Continue to email verification
                  </Link>

                </div>
              )}
            </div>
          )}

          {/* Success */}

          {notice && (
            <div
              role="status"
              className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-700"
            >
              {notice}
            </div>
          )}

          {/* Login form */}

          <form
            className="grid w-full gap-6"
            onSubmit={handleSubmit}
          >

            {/* Username / Email */}

            <div className="grid gap-2.5">

              <label
                htmlFor="login-identifier"
                className="text-xs font-bold text-[#303030]"
              >
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
                className="min-h-[54px] w-full rounded-xl border border-[#E1E1E1] bg-white px-4 text-sm text-[#1E1E1E] outline-none transition-all placeholder:text-[#A0A0A0] hover:border-[#BDBDBD] focus:border-[#F3184C] focus:ring-4 focus:ring-[#F3184C]/10 disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* Password */}

            <div className="grid gap-2.5">

              <div className="flex items-center justify-between gap-3">

                <label
                  htmlFor="login-password"
                  className="text-xs font-bold text-[#303030]"
                >
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-[#F3184C] transition-colors hover:text-[#C9143F] hover:underline hover:underline-offset-4"
                >
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
                className="min-h-[54px] w-full rounded-xl border border-[#E1E1E1] bg-white px-4 text-sm text-[#1E1E1E] outline-none transition-all placeholder:text-[#A0A0A0] hover:border-[#BDBDBD] focus:border-[#F3184C] focus:ring-4 focus:ring-[#F3184C]/10 disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* Submit button */}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex min-h-[54px] w-full items-center justify-center gap-3 rounded-xl bg-[#F3184C] px-5 py-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(243,24,76,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#D91543] hover:shadow-[0_12px_28px_rgba(243,24,76,0.25)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C] disabled:cursor-wait disabled:opacity-60"
            >

              {loading ? 'Signing in...' : 'Sign in'}

              {!loading && (
                <span className="text-lg" aria-hidden="true">
                  →
                </span>
              )}

            </button>

          </form>

          {/* Signup */}

          <p className="mt-9 text-center text-sm text-[#686868]">

            New to ProxiSpeak?{' '}

            <Link
              to="/signup"
              className="font-extrabold text-[#F3184C] transition-colors hover:text-[#C9143F] hover:underline hover:underline-offset-4"
            >
              Create an account
            </Link>

          </p>

          {/* Bottom note */}

          <div className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] text-[#929292]">

            <span className="text-[#F3184C]">
              ●
            </span>

            Your workspace is just a sign-in away.

          </div>

        </div>

        {/* Footer */}

        <footer className="mt-12 flex w-full max-w-[430px] flex-wrap justify-between gap-3 text-[10px] text-[#929292]">

          <span>
            © {new Date().getFullYear()} ProxiSpeak Meet
          </span>

          <span>
            Built for better connections.
          </span>

        </footer>

      </section>

    </main>
  );
}