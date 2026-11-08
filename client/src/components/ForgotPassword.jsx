import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

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

      const successMessage =
        payload.message ||
        'If an eligible account exists, password-reset instructions have been sent to its email address.';

      setNotice(successMessage);

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

            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#5546F5] text-2xl font-black text-white shadow-lg shadow-[#5546F5]/20">
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

              <span className="h-2 w-2 rounded-full bg-[#5546F5]" />

              YOUR SPACE AWAITS

            </span>

            <h1 className="mt-8 text-[clamp(40px,4.5vw,66px)] font-extrabold leading-[1.12] tracking-[-2.5px]">

              Reconnect with

              <br />

              your{' '}

              <span className="text-[#5546F5]">
                people.
              </span>

            </h1>

            <p className="mt-7 max-w-[430px] text-sm leading-[2] text-[#777990]">

              Your virtual office is still here. Recover your account
              securely and get back to the conversations that matter.

            </p>

            {/* FEATURE CARD */}

            <div className="mt-10 max-w-[430px] rounded-2xl border border-white/80 bg-white/75 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">

              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#EFEDFF] text-[#5546F5]">

                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <rect x="4" y="10" width="16" height="11" rx="3" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  <path d="M12 14v3" />
                </svg>

              </div>

              <h3 className="text-sm font-bold text-[#202334]">
                Secure account recovery
              </h3>

              <p className="mt-2 text-xs leading-6 text-[#85879A]">
                Verify your registered email and safely reset your password.
              </p>

            </div>

            {/* QUOTE */}

            <blockquote className="mt-5 max-w-[430px] rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm">

              <span className="text-3xl font-serif text-[#5546F5]">
                “
              </span>

              <p className="mt-2 text-sm leading-7 text-[#55576C]">
                Great ideas begin when people feel connected.
                Let's get you back in the room.
              </p>

              <footer className="mt-4 text-[10px] font-extrabold tracking-[1.5px] text-[#9294A7]">
                THE PROXISPEAK PHILOSOPHY
              </footer>

            </blockquote>

          </div>

          {/* FOOTER */}

          <footer className="relative z-10 flex flex-wrap justify-between gap-3 text-[10px] font-semibold tracking-wide text-[#9294A7]">

            <span>
              LESS FRICTION. MORE CONNECTION.
            </span>

            <span>
              PROXISPEAK MEET
            </span>

          </footer>

        </section>

        {/* RIGHT RECOVERY PANEL */}

        <section className="flex min-h-dvh flex-col items-center justify-center bg-white px-5 py-8 sm:px-10 lg:px-10 xl:px-14">

          {/* MOBILE BRAND */}

          <Link
            to="/login"
            className="mb-8 inline-flex items-center gap-3 self-start no-underline lg:hidden"
          >

            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#5546F5] text-xl font-black text-white">
              P
            </span>

            <span className="text-lg font-extrabold text-[#202334]">
              ProxiSpeak
              <span className="text-[#5546F5]"> Meet</span>
            </span>

          </Link>

          <div className="my-auto w-full max-w-[480px]">

            {/* RECOVERY CARD */}

            <div className="rounded-[28px] border border-[#ECEAF7] bg-[#FBFAFF] p-5 shadow-[0_18px_60px_rgba(53,43,125,0.07)] transition-shadow duration-500 hover:shadow-[0_22px_70px_rgba(53,43,125,0.10)] sm:p-7 lg:p-6 xl:p-8">

              {/* BACK NAVIGATION */}

              <Link
                to="/login"
                className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[#85879A] transition-all duration-200 hover:-translate-x-1 hover:text-[#5546F5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5546F5]"
              >

                <span aria-hidden="true" className="text-lg">
                  ←
                </span>

                Back to sign in

              </Link>

              {/* ICON */}

              <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#EFEDFF] text-[#5546F5]">

                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="10" width="16" height="11" rx="3" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  <path d="M12 14v3" />
                </svg>

              </div>

              {/* HEADING */}

              <div className="mb-7">

                <span className="text-[10px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">
                  ACCOUNT RECOVERY
                </span>

                <h2 className="mt-3 text-[clamp(28px,3vw,38px)] font-extrabold leading-tight tracking-[-1.5px] text-[#202334]">

                  Forgot your password?

                </h2>

                <p className="mt-3 text-sm leading-7 text-[#85879A]">

                  No worries. Enter your registered email address
                  and we'll help you get back into your workspace.

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
                onSubmit={handleSubmit}
                className="grid gap-5"
                noValidate
              >

                <div className="grid gap-2">

                  <label
                    htmlFor="recovery-email"
                    className="text-xs font-bold text-[#45465A]"
                  >
                    Email address
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <MailIcon />
                    </span>

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
                      className="min-h-[54px] w-full rounded-2xl border border-[#E8E6F2] bg-white pl-12 pr-4 text-sm font-medium text-[#202334] outline-none transition-all duration-300 placeholder:text-[#A6A5B5] hover:border-[#CFC9F8] focus:border-[#7768F7] focus:shadow-[0_0_0_4px_rgba(85,70,245,0.09)] disabled:opacity-60"
                    />

                  </div>

                  <p className="text-[10px] leading-5 text-[#9291A6]">
                    Enter the email address associated with your account.
                  </p>

                </div>

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl border border-[#5546F5] bg-[#5546F5] px-5 py-3 text-sm font-extrabold text-white shadow-[0_9px_24px_rgba(85,70,245,0.20)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#4536E5] hover:shadow-[0_15px_32px_rgba(85,70,245,0.28)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5546F5] disabled:cursor-wait disabled:opacity-60"
                >

                  {loading ? 'Sending request...' : 'Continue'}

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

              {/* LOGIN LINK */}

              <p className="mt-7 text-center text-xs text-[#85879A]">

                Remember your password?{' '}

                <Link
                  to="/login"
                  className="font-extrabold text-[#5546F5] transition-colors hover:text-[#4032D5] hover:underline hover:underline-offset-4"
                >
                  Sign in
                </Link>

              </p>

              {/* SECURITY NOTE */}

              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#EAE7FA] bg-[#F2F0FF] px-4 py-4">

                <span className="mt-0.5 text-[#5546F5]" aria-hidden="true">
                  ◈
                </span>

                <p className="text-[11px] leading-6 text-[#77758E]">
                  Your account recovery request is handled securely.
                  We'll never ask you to share your password.
                </p>

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