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
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="min-h-dvh w-full bg-[#F5F4FC] font-sans text-[#202334]">

      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">

        {/* LEFT BRANDING SECTION */}

        <section className="relative hidden overflow-hidden bg-[#EFEDFF] p-10 lg:flex lg:flex-col lg:justify-between xl:p-16">

          {/* Background decorations */}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 top-20 h-[420px] w-[420px] rounded-full border border-[#5546F5]/10 shadow-[0_0_0_60px_rgba(85,70,245,0.025),0_0_0_120px_rgba(85,70,245,0.02)]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-20 h-[400px] w-[400px] rounded-full bg-[#5546F5]/10 blur-[100px]"
          />

          {/* Brand */}

          <Link
            to="/login"
            aria-label="ProxiSpeak Meet home"
            className="relative z-10 inline-flex w-fit items-center gap-3 no-underline"
          >

            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#5546F5] text-2xl font-black text-white shadow-lg shadow-[#5546F5]/20">
              P
            </span>

            <span className="text-xl font-extrabold tracking-tight text-[#202334]">
              ProxiSpeak
              <span className="text-[#5546F5]">
                {' '}Meet
              </span>
            </span>

          </Link>

          {/* Hero content */}

          <div className="relative z-10 my-auto max-w-[560px] py-16">

            <span className="inline-flex items-center gap-2 rounded-full border border-[#5546F5]/15 bg-white/70 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">

              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[#5546F5]"
              />

              YOUR VIRTUAL WORKSPACE

            </span>

            <h1 className="mt-8 text-[clamp(40px,4.5vw,66px)] font-extrabold leading-[1.12] tracking-[-2.5px] text-[#202334]">

              Work together.

              <br />

              <span className="text-[#5546F5]">
                Naturally.
              </span>

            </h1>

            <p className="mt-7 max-w-[430px] text-sm leading-[2] text-[#777990]">

              Experience a virtual office where conversations
              happen naturally. Move closer, connect with your
              team and work together from anywhere.

            </p>

            {/* Feature cards */}

            <div className="mt-12 grid max-w-[470px] grid-cols-2 gap-4">

              <div className="rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm">

                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#EFEDFF] text-xl text-[#5546F5]">
                  ◉
                </div>

                <h3 className="text-sm font-bold text-[#202334]">
                  Virtual Office
                </h3>

                <p className="mt-2 text-xs leading-6 text-[#85879A]">
                  Meet your team in a shared workspace.
                </p>

              </div>

              <div className="rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm">

                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#EFEDFF] text-xl text-[#5546F5]">
                  ♧
                </div>

                <h3 className="text-sm font-bold text-[#202334]">
                  Natural Audio
                </h3>

                <p className="mt-2 text-xs leading-6 text-[#85879A]">
                  Conversations powered by proximity.
                </p>

              </div>

            </div>

          </div>

          {/* Footer */}

          <footer className="relative z-10 flex flex-wrap justify-between gap-3 text-[10px] font-semibold tracking-wide text-[#9294A7]">

            <span>
              LESS FRICTION. MORE CONNECTION.
            </span>

            <span>
              PROXISPEAK MEET
            </span>

          </footer>

        </section>

        {/* RIGHT LOGIN SECTION */}

        <section className="flex min-h-dvh flex-col items-center justify-center bg-white px-5 py-10 sm:px-10 lg:px-12 xl:px-20">

          <div className="my-auto w-full max-w-[440px]">

            {/* Mobile brand */}

            <Link
              to="/login"
              className="mb-12 inline-flex items-center gap-3 no-underline lg:hidden"
            >

              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#5546F5] text-xl font-black text-white">
                P
              </span>

              <span className="text-lg font-extrabold text-[#202334]">
                ProxiSpeak
                <span className="text-[#5546F5]">
                  {' '}Meet
                </span>
              </span>

            </Link>

            {/* Heading */}

            <div className="mb-9">

              <span className="text-[11px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">
                WELCOME BACK
              </span>

              <h2 className="mt-4 text-[clamp(30px,3vw,40px)] font-extrabold leading-tight tracking-[-1.5px] text-[#202334]">
                Sign in to your space
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#85879A]">
                Pick up where your conversations left off.
              </p>

            </div>

            {/* Error */}

            {error && (

              <div
                role="alert"
                aria-live="assertive"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-xs leading-6 text-red-700"
              >

                {error}

                {error.includes('not verified') && (

                  <div className="mt-3">

                    <Link
                      to={verificationUrl}
                      state={{
                        email: verificationEmail,
                      }}
                      className="font-bold text-[#5546F5] underline underline-offset-4"
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
                aria-live="polite"
                className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-xs leading-6 text-green-700"
              >
                {notice}
              </div>

            )}

            {/* Login form */}

            <form
              onSubmit={handleSubmit}
              className="grid w-full gap-6"
              noValidate
            >

              {/* Username / Email */}

              <div className="grid gap-2.5">

                <label
                  htmlFor="login-identifier"
                  className="text-xs font-bold text-[#34364A]"
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
                  aria-invalid={Boolean(error)}
                  className="min-h-[56px] w-full rounded-xl border border-[#E9E8F0] bg-[#FAFAFC] px-4 text-sm text-[#202334] outline-none transition-all placeholder:text-[#A4A5B4] hover:border-[#C8C5DC] focus:border-[#5546F5] focus:bg-white focus:ring-4 focus:ring-[#5546F5]/10 disabled:cursor-not-allowed disabled:opacity-60"
                />

              </div>

              {/* Password */}

              <div className="grid gap-2.5">

                <div className="flex items-center justify-between gap-3">

                  <label
                    htmlFor="login-password"
                    className="text-xs font-bold text-[#34364A]"
                  >
                    Password
                  </label>

                  <Link
                    to="/forgot-password"
                    className="text-xs font-bold text-[#5546F5] transition-colors hover:text-[#4032D5] hover:underline hover:underline-offset-4"
                  >
                    Forgot password?
                  </Link>

                </div>

                <div className="relative">

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
                    aria-invalid={Boolean(error)}
                    className="min-h-[56px] w-full rounded-xl border border-[#E9E8F0] bg-[#FAFAFC] px-4 pr-16 text-sm text-[#202334] outline-none transition-all placeholder:text-[#A4A5B4] hover:border-[#C8C5DC] focus:border-[#5546F5] focus:bg-white focus:ring-4 focus:ring-[#5546F5]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    disabled={loading}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-bold text-[#777990] transition-colors hover:text-[#5546F5] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#5546F5] disabled:opacity-50"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>

                </div>

              </div>

              {/* Submit */}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-[#5546F5] px-5 py-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(85,70,245,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#4637E5] hover:shadow-[0_12px_28px_rgba(85,70,245,0.24)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5546F5] disabled:cursor-wait disabled:opacity-60"
              >

                {loading ? 'Signing in...' : 'Sign in'}

                {!loading && (
                  <span aria-hidden="true" className="text-lg">
                    →
                  </span>
                )}

              </button>

            </form>

            {/* Signup */}

            <p className="mt-9 text-center text-sm text-[#85879A]">

              New to ProxiSpeak?{' '}

              <Link
                to="/signup"
                className="font-extrabold text-[#5546F5] transition-colors hover:text-[#4032D5] hover:underline hover:underline-offset-4"
              >
                Create an account
              </Link>

            </p>

            {/* Security note */}

            <div className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] text-[#9294A7]">

              <span
                aria-hidden="true"
                className="text-[#5546F5]"
              >
                ●
              </span>

              Your workspace is just a sign-in away.

            </div>

          </div>

          {/* Footer */}

          <footer className="mt-12 flex w-full max-w-[440px] flex-wrap justify-between gap-3 text-[10px] text-[#A0A1AF]">

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