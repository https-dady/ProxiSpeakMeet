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

      const accountRequiresVerification =
        response.status === 201 ||
        (response.status === 502 &&
          payload.emailVerificationRequired === true);

      if (!accountRequiresVerification) {
        throw new Error(
          payload.error ||
            payload.message ||
            'Unable to create your account. Please try again.',
        );
      }

      const emailDeliveryFailed = response.status === 502;

      navigate(
        `/verify-email?email=${encodeURIComponent(email)}`,
        {
          replace: true,
          state: {
            email,
            message:
              payload.message ||
              (emailDeliveryFailed
                ? 'Your account was created, but the verification email could not be sent. Request a new code below.'
                : 'Verification code sent to your email address.'),
            emailDeliveryFailed,
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
    <main className="grid min-h-dvh w-full grid-cols-1 overflow-x-hidden bg-[#1E1E1E] font-sans text-[#F6F6F6] lg:grid-cols-2">

      {/* LEFT BRANDING PANEL */}

      <section className="relative hidden min-h-dvh flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-[#1E1E1E] p-8 isolate lg:flex xl:p-14">

        <div className="pointer-events-none absolute -right-[18%] top-[25%] aspect-square w-[70%] rounded-full border border-white/[0.06] shadow-[0_0_0_45px_rgba(255,255,255,0.015),0_0_0_95px_rgba(255,255,255,0.01)]" />

        <div className="pointer-events-none absolute bottom-[15%] right-[10%] h-44 w-44 rounded-full bg-[#F3184C]/10 blur-[75px]" />

        <Link
          to="/login"
          className="relative z-10 inline-flex w-fit items-center gap-3 text-[19px] font-extrabold tracking-tight text-[#F6F6F6] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
        >
          <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] border border-[#F3184C]/30 bg-[#F3184C] text-[22px] font-extrabold text-white shadow-[0_8px_25px_rgba(243,24,76,0.22)]">
            P
          </span>

          <span>
            ProxiSpeak
            <span className="text-[#F3184C]"> Meet</span>
          </span>
        </Link>

        <div className="relative z-10 my-auto w-full max-w-[590px] py-16">

          <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#F3184C]">
            <span className="h-0.5 w-[19px] rounded-full bg-[#F3184C]" />
            YOUR PEOPLE, CLOSER
          </span>

          <h1 className="mt-[22px] text-[clamp(36px,4.1vw,64px)] font-extrabold leading-[1.12] tracking-[-2.7px] [overflow-wrap:anywhere]">
            Work together.
            <br />
            Connect{' '}
            <span className="text-[#F3184C]">
              naturally.
            </span>
          </h1>

          <p className="mt-[23px] max-w-[455px] text-[13px] leading-[1.95] text-[#A5A5A5]">
            Create your account and step into a virtual office where
            spontaneous conversations and collaboration feel natural.
          </p>

          <blockquote className="relative mt-[38px] max-w-[460px] rounded-2xl border border-white/[0.08] bg-[#303030] px-6 py-5 backdrop-blur-xl">

            <span className="block h-[31px] font-serif text-[46px] leading-none text-[#F3184C]">
              “
            </span>

            <p className="my-3 mb-4 text-xs leading-[1.9] text-[#F6F6F6]">
              You don't always need another meeting. Sometimes, you just
              need to be close enough to talk.
            </p>

            <footer className="text-[9px] font-extrabold tracking-[1.5px] text-[#929292]">
              THE PROXISPEAK PHILOSOPHY
            </footer>

          </blockquote>
        </div>

        <div className="relative z-10 flex flex-wrap justify-between gap-3 text-[9px] leading-[1.7] text-[#929292]">
          <span>Less friction. More connection.</span>
          <span className="tracking-[1.1px]">
            PROXIMITY-POWERED CONVERSATIONS
          </span>
        </div>
      </section>

      {/* RIGHT SIGNUP PANEL */}

      <section className="relative flex min-h-dvh min-w-0 flex-col items-center justify-center bg-[#F6F6F6] px-[22px] py-[25px] text-[#1E1E1E] sm:px-8 lg:px-[clamp(30px,5.2vw,84px)] lg:py-[45px]">

        <div className="mb-[30px] inline-flex w-full max-w-[460px] items-center gap-3 text-[17px] font-extrabold tracking-tight text-[#1E1E1E] lg:hidden">

          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-[#F3184C] text-xl text-white">
            P
          </span>

          <span>ProxiSpeak Meet</span>
        </div>

        <div className="my-auto w-full max-w-[430px]">

          <div className="mb-[25px]">

            <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#F3184C]">
              <span className="h-0.5 w-[19px] rounded-full bg-[#F3184C]" />
              GET STARTED
            </span>

            <h2 className="mt-[15px] text-[clamp(26px,2.6vw,36px)] font-extrabold leading-[1.25] tracking-[-1.3px] [overflow-wrap:anywhere]">
              Create your account
            </h2>

            <p className="mt-3 text-xs leading-[1.85] text-[#686868]">
              A few details, one email verification, and you're ready to
              connect.
            </p>
          </div>

          {error && (
            <div
              className="mb-5 break-words rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-[11px] leading-[1.8] text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <form
            className="grid w-full gap-[17px]"
            onSubmit={handleSubmit}
          >

            <div className="grid min-w-0 gap-[8px]">
              <label
                htmlFor="signup-username"
                className="text-[11px] font-bold leading-relaxed text-[#303030]"
              >
                Username
              </label>

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
                className="block min-h-[46px] w-full min-w-0 rounded-[11px] border border-[#E5E5E5] bg-white px-[15px] py-[12px] text-xs leading-[1.5] text-[#1E1E1E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#929292] hover:border-[#D5D5D5] focus-visible:border-[#F3184C] focus-visible:shadow-[0_0_0_3px_rgba(243,24,76,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="grid min-w-0 gap-[8px]">
              <label
                htmlFor="signup-email"
                className="text-[11px] font-bold leading-relaxed text-[#303030]"
              >
                Email address
              </label>

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
                className="block min-h-[46px] w-full min-w-0 rounded-[11px] border border-[#E5E5E5] bg-white px-[15px] py-[12px] text-xs leading-[1.5] text-[#1E1E1E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#929292] hover:border-[#D5D5D5] focus-visible:border-[#F3184C] focus-visible:shadow-[0_0_0_3px_rgba(243,24,76,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="grid min-w-0 gap-[8px]">
              <label
                htmlFor="signup-password"
                className="text-[11px] font-bold leading-relaxed text-[#303030]"
              >
                Password
              </label>

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
                className="block min-h-[46px] w-full min-w-0 rounded-[11px] border border-[#E5E5E5] bg-white px-[15px] py-[12px] text-xs leading-[1.5] text-[#1E1E1E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#929292] hover:border-[#D5D5D5] focus-visible:border-[#F3184C] focus-visible:shadow-[0_0_0_3px_rgba(243,24,76,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="grid min-w-0 gap-[8px]">
              <label
                htmlFor="signup-confirm-password"
                className="text-[11px] font-bold leading-relaxed text-[#303030]"
              >
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
                className="block min-h-[46px] w-full min-w-0 rounded-[11px] border border-[#E5E5E5] bg-white px-[15px] py-[12px] text-xs leading-[1.5] text-[#1E1E1E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#929292] hover:border-[#D5D5D5] focus-visible:border-[#F3184C] focus-visible:shadow-[0_0_0_3px_rgba(243,24,76,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              className="mt-[3px] flex min-h-[49px] w-full items-center justify-center gap-3 rounded-[11px] border border-transparent bg-[#F3184C] px-[18px] py-[13px] text-xs font-extrabold leading-[1.5] text-white transition-[transform,background,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#D91543] hover:shadow-[0_9px_25px_rgba(243,24,76,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C] disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create account'}

              {!loading && (
                <span className="text-[17px] leading-none" aria-hidden="true">
                  →
                </span>
              )}
            </button>

          </form>

          <p className="mt-[22px] text-center text-[11px] leading-[1.8] text-[#686868]">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-extrabold text-[#F3184C] no-underline hover:text-[#D91543] hover:underline hover:underline-offset-[3px] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
            >
              Sign in
            </Link>
          </p>

          <div className="mt-[24px] flex items-start justify-center gap-2 rounded-[10px] border border-[#E5E5E5] bg-white px-4 py-3 text-[10px] leading-[1.8] text-[#686868]">
            <span className="mt-0.5 shrink-0 text-[#269B67]" aria-hidden="true">
              ●
            </span>

            <span>
              We'll send a verification code to your email before your
              account can sign in.
            </span>
          </div>

        </div>

        <footer className="mt-[30px] flex w-full max-w-[430px] flex-wrap justify-between gap-2.5 text-[9px] leading-[1.8] text-[#929292] max-[760px]:mt-auto max-[760px]:max-w-[460px] max-[760px]:pt-8 max-[380px]:flex-col max-[380px]:gap-1">
          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>
          <span>Built for better connections.</span>
        </footer>

      </section>
    </main>
  );
}