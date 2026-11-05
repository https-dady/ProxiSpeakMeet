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
        throw new Error(
          'The server did not return a valid authentication token.',
        );
      }

      if (typeof onLogin !== 'function') {
        throw new Error(
          'The login page is not connected to the application session. Please refresh and try again.',
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

      // App.jsx owns the authenticated view.
      // Do not navigate to an unregistered /rooms route.
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
    <main className="grid min-h-dvh w-full grid-cols-1 overflow-x-hidden bg-[#080b14] font-sans text-[#edf2ff] lg:grid-cols-2">

      {/* Branding panel */}
      <section className="relative hidden min-h-dvh flex-col justify-between overflow-hidden border-r border-[#263149] bg-[radial-gradient(ellipse_at_20%_15%,rgba(129,117,255,0.13),transparent_40%),radial-gradient(ellipse_at_80%_80%,rgba(90,209,154,0.07),transparent_38%),#0d131c] p-8 isolate lg:flex xl:p-14">

        <div className="pointer-events-none absolute -right-[18%] top-[25%] aspect-square w-[70%] rounded-full border border-[rgba(129,117,255,0.12)] shadow-[0_0_0_45px_rgba(129,117,255,0.025),0_0_0_95px_rgba(129,117,255,0.02)]" />

        <div className="pointer-events-none absolute bottom-[15%] right-[10%] h-44 w-44 rounded-full bg-[rgba(129,117,255,0.08)] blur-[75px]" />

        <Link
          to="/login"
          className="relative z-10 inline-flex w-fit items-center gap-3 text-[19px] font-extrabold tracking-tight text-[#edf2ff] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8175ff]"
        >
          <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] border border-[rgba(129,117,255,0.4)] bg-[rgba(129,117,255,0.12)] text-[22px] font-extrabold text-[#a69cff] shadow-[0_6px_24px_rgba(0,0,0,0.16)]">
            P
          </span>

          <span>
            ProxiSpeak
            <span className="text-[#a69cff]"> Meet</span>
          </span>
        </Link>

        <div className="relative z-10 my-auto w-full max-w-[590px] py-16">

          <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#a69cff]">
            <span className="h-0.5 w-[19px] rounded-full bg-[#5ad19a]" />
            YOUR VIRTUAL WORKSPACE
          </span>

          <h1 className="mt-[22px] text-[clamp(36px,4.1vw,64px)] font-extrabold leading-[1.12] tracking-[-2.7px] [overflow-wrap:anywhere]">
            Great conversations
            <br />
            happen{' '}
            <span className="text-[#a69cff]">
              naturally.
            </span>
          </h1>

          <p className="mt-[23px] max-w-[455px] text-[13px] leading-[1.95] text-[#9ba9c2]">
            Move closer. Start talking. Experience a virtual office where
            conversations flow as naturally as they do in person.
          </p>

          <blockquote className="relative mt-[38px] max-w-[460px] rounded-2xl border border-[rgba(129,117,255,0.16)] bg-white/[0.025] px-6 py-5 backdrop-blur-xl">

            <span className="block h-[31px] font-serif text-[46px] leading-none text-[#5ad19a]">
              “
            </span>

            <p className="my-3 mb-4 text-xs leading-[1.9] text-[#d5def1]">
              Distance shouldn't get in the way of great conversations.
              Sometimes, all it takes is moving a little closer.
            </p>

            <footer className="text-[9px] font-extrabold tracking-[1.5px] text-[#7889a5]">
              THE PROXISPEAK PHILOSOPHY
            </footer>

          </blockquote>
        </div>

        <div className="relative z-10 flex flex-wrap justify-between gap-3 text-[9px] leading-[1.7] text-[#7889a5]">
          <span>Less friction. More connection.</span>
          <span className="tracking-[1.1px]">
            PROXIMITY-POWERED CONVERSATIONS
          </span>
        </div>
      </section>

      {/* Login panel */}
      <section className="relative flex min-h-dvh min-w-0 flex-col items-center justify-center bg-[radial-gradient(ellipse_at_100%_0%,rgba(129,117,255,0.045),transparent_35%),#080b14] px-[22px] py-[25px] sm:px-8 lg:px-[clamp(30px,5.2vw,84px)] lg:py-[60px]">

        {/* Mobile branding */}
        <div className="mb-[42px] inline-flex w-full max-w-[460px] items-center gap-3 text-[17px] font-extrabold tracking-tight text-[#edf2ff] lg:hidden">

          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl border border-[rgba(129,117,255,0.4)] bg-[rgba(129,117,255,0.12)] text-xl text-[#a69cff]">
            P
          </span>

          <span>ProxiSpeak Meet</span>
        </div>

        <div className="my-auto w-full max-w-[430px]">

          {/* Heading */}
          <div className="mb-[29px]">

            <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#a69cff]">
              <span className="h-0.5 w-[19px] rounded-full bg-[#5ad19a]" />
              WELCOME BACK
            </span>

            <h2 className="mt-[15px] text-[clamp(26px,2.6vw,36px)] font-extrabold leading-[1.25] tracking-[-1.3px] [overflow-wrap:anywhere]">
              Sign in to your space
            </h2>

            <p className="mt-3 text-xs leading-[1.85] text-[#9ba9c2]">
              Pick up where your conversations left off.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="mb-5 break-words rounded-[10px] border border-[rgba(255,107,129,0.25)] bg-[rgba(255,107,129,0.08)] px-3.5 py-3 text-[11px] leading-[1.8] text-[#ff9eae]"
              role="alert"
            >
              {error}

              {error.includes('not verified') && (
                <div className="mt-2">
                  <Link
                    to="/signup"
                    className="font-bold text-[#a69cff] underline underline-offset-[3px] hover:text-[#5ad19a]"
                  >
                    Continue to email verification
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Success message */}
          {notice && (
            <div
              className="mb-5 rounded-[10px] border border-[rgba(90,209,154,0.22)] bg-[rgba(90,209,154,0.08)] px-3.5 py-3 text-[11px] leading-[1.8] text-[#8fe3b9]"
              role="status"
            >
              {notice}
            </div>
          )}

          {/* Login form */}
          <form
            className="grid w-full gap-5 max-[760px]:gap-[18px]"
            onSubmit={handleSubmit}
          >

            {/* Identifier */}
            <div className="grid min-w-0 gap-[9px]">

              <label
                htmlFor="login-identifier"
                className="text-[11px] font-bold leading-relaxed text-[#d5def1]"
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
                className="block min-h-[49px] w-full min-w-0 rounded-[11px] border border-[#263149] bg-[#101625] px-[15px] py-[13px] text-xs leading-[1.5] text-[#edf2ff] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#7889a5] hover:border-[rgba(143,164,202,0.35)] focus-visible:border-[#8175ff] focus-visible:bg-[#151e30] focus-visible:shadow-[0_0_0_3px_rgba(129,117,255,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div className="grid min-w-0 gap-[9px]">

              <div className="flex flex-wrap items-center justify-between gap-2">

                <label
                  htmlFor="login-password"
                  className="text-[11px] font-bold leading-relaxed text-[#d5def1]"
                >
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="text-[10px] font-bold leading-[1.7] text-[#a69cff] no-underline transition-colors hover:text-[#5ad19a] hover:underline hover:underline-offset-[3px] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8175ff]"
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
                className="block min-h-[49px] w-full min-w-0 rounded-[11px] border border-[#263149] bg-[#101625] px-[15px] py-[13px] text-xs leading-[1.5] text-[#edf2ff] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#7889a5] hover:border-[rgba(143,164,202,0.35)] focus-visible:border-[#8175ff] focus-visible:bg-[#151e30] focus-visible:shadow-[0_0_0_3px_rgba(129,117,255,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* Submit */}
            <button
              className="mt-[5px] flex min-h-[50px] w-full items-center justify-center gap-3 rounded-[11px] border border-transparent bg-[#8175ff] px-[18px] py-[13px] text-xs font-extrabold leading-[1.5] text-[#080b14] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#958bff] hover:shadow-[0_9px_25px_rgba(129,117,255,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5ad19a] disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}

              {!loading && (
                <span
                  className="text-[17px] leading-none transition-transform duration-200"
                  aria-hidden="true"
                >
                  →
                </span>
              )}
            </button>

          </form>

          {/* Signup navigation */}
          <p className="mt-[25px] text-center text-[11px] leading-[1.8] text-[#9ba9c2]">
            New to ProxiSpeak?{' '}
            <Link
              to="/signup"
              className="font-extrabold text-[#a69cff] no-underline hover:text-[#5ad19a] hover:underline hover:underline-offset-[3px] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8175ff]"
            >
              Create an account
            </Link>
          </p>

          {/* Security note */}
          <div className="mt-[30px] flex items-center justify-center gap-2 text-center text-[10px] leading-[1.8] text-[#7889a5]">
            <span className="text-[8px] text-[#5ad19a]" aria-hidden="true">
              ●
            </span>

            Your workspace is just a sign-in away.
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-[38px] flex w-full max-w-[430px] flex-wrap justify-between gap-2.5 text-[9px] leading-[1.8] text-[#7889a5] max-[760px]:mt-auto max-[760px]:max-w-[460px] max-[760px]:pt-10 max-[380px]:flex-col max-[380px]:gap-1">

          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>

          <span>Built for better connections.</span>

        </footer>

      </section>
    </main>
  );
}