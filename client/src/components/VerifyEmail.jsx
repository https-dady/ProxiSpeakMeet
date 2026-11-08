import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
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

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const emailDeliveryFailed =
    location.state?.emailDeliveryFailed === true;

  const [email, setEmail] = useState(
    location.state?.email || searchParams.get('email') || '',
  );

  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState('');

  const [notice, setNotice] = useState(
    emailDeliveryFailed
      ? 'Your account was created, but the verification email could not be sent. Request a new code below.'
      : location.state?.message || '',
  );

  const [cooldown, setCooldown] = useState(0);

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

  const startCooldown = (seconds = 60) => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    const duration = Math.max(1, Math.ceil(seconds));

    setCooldown(duration);

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

  const handleVerify = async (event) => {
    event.preventDefault();

    if (loading || resending) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail) {
      setError('Enter the email address you registered with.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError('Enter the six-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE_URL}/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          otp: normalizedOtp,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            payload.message ||
            'Email verification failed. Check the code and try again.',
        );
      }

      setNotice(
        payload.message ||
          'Email verified successfully. Redirecting to sign in...',
      );

      redirectTimeoutRef.current = setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            verifiedEmail: normalizedEmail,
          },
        });
      }, 1200);

    } catch (err) {
      setError(
        err.message || 'Unable to verify your email.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || loading || cooldown > 0) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter your registered email address first.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setResending(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/resend-verification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (
          response.status === 429 &&
          Number.isFinite(Number(payload.retryAfterSeconds))
        ) {
          startCooldown(payload.retryAfterSeconds);
        }

        throw new Error(
          payload.error ||
            payload.message ||
            'Unable to resend the verification code.',
        );
      }

      setOtp('');

      setNotice(
        payload.message ||
          'If the account requires verification, a new code will be sent.',
      );

      startCooldown(60);

    } catch (err) {
      setError(
        err.message || 'Unable to resend the verification code.',
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#F5F4FC] font-sans text-[#202334]">

      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">

        {/* =================================================
            LEFT BRANDING PANEL
        ================================================= */}

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

              ONE LAST STEP

            </span>

            <h1 className="mt-8 text-[clamp(40px,4.5vw,66px)] font-extrabold leading-[1.12] tracking-[-2.5px]">

              Make it official.

              <br />

              Start

              <span className="text-[#5546F5]">
                {' '}connecting.
              </span>

            </h1>

            <p className="mt-7 max-w-[430px] text-sm leading-[2] text-[#777990]">

              Verify your email to secure your account and
              join your team in a virtual workspace built
              for natural conversations.

            </p>

            {/* FEATURE CARD */}

            <div className="mt-10 max-w-[430px] rounded-2xl border border-white/80 bg-white/75 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">

              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#EFEDFF] text-[#5546F5]">

                <MailIcon />

              </div>

              <h3 className="text-sm font-bold text-[#202334]">
                Verified and secure
              </h3>

              <p className="mt-2 text-xs leading-6 text-[#85879A]">
                Confirm your email to activate your account
                and keep your workspace protected.
              </p>

            </div>

            {/* QUOTE */}

            <blockquote className="mt-5 max-w-[430px] rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm">

              <span className="text-3xl font-serif text-[#5546F5]">
                “
              </span>

              <p className="mt-2 text-sm leading-7 text-[#55576C]">
                The best ideas happen when people can connect
                without barriers.
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

        {/* =================================================
            RIGHT VERIFICATION PANEL
        ================================================= */}

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

          <div className="my-auto w-full max-w-[510px]">

            {/* FORM CARD */}

            <div className="rounded-[28px] border border-[#ECEAF7] bg-[#FBFAFF] p-5 shadow-[0_18px_60px_rgba(53,43,125,0.07)] transition-shadow duration-500 hover:shadow-[0_22px_70px_rgba(53,43,125,0.10)] sm:p-7 lg:p-6 xl:p-7">

              {/* BACK */}

              <Link
                to="/signup"
                className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#85879A] transition-all duration-200 hover:-translate-x-1 hover:text-[#5546F5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5546F5]"
              >

                <span aria-hidden="true" className="text-lg">
                  ←
                </span>

                Back to sign up

              </Link>

              {/* ICON */}

              <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#EFEDFF] text-[#5546F5] transition-transform duration-300 hover:scale-105">

                <MailIcon />

              </div>

              {/* HEADING */}

              <div className="mb-6">

                <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">

                  <span className="h-2 w-2 rounded-full bg-[#5546F5]" />

                  EMAIL VERIFICATION

                </span>

                <h2 className="mt-3 text-[clamp(28px,2.6vw,36px)] font-extrabold leading-tight tracking-[-1.5px] text-[#202334]">

                  Check your inbox

                </h2>

                <p className="mt-3 text-xs leading-6 text-[#85879A]">

                  Enter the six-digit code sent to your email
                  address to activate your ProxiSpeak account.

                </p>

              </div>

              {/* ERROR */}

              {error && (

                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-5 break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700"
                >
                  {error}
                </div>

              )}

              {/* SUCCESS NOTICE */}

              {notice && (

                <div
                  role="status"
                  aria-live="polite"
                  className="mb-5 break-words rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-6 text-green-700"
                >
                  {notice}
                </div>

              )}

              {/* FORM */}

              <form
                onSubmit={handleVerify}
                className="grid gap-5"
                noValidate
              >

                {/* EMAIL */}

                <div className="grid min-w-0 gap-2">

                  <label
                    htmlFor="verification-email"
                    className="text-[11px] font-bold tracking-wide text-[#45465A]"
                  >
                    Email address
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="3" />
                        <path d="m4 7 8 6 8-6" />
                      </svg>
                    </span>

                    <input
                      id="verification-email"
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
                      disabled={loading || resending}
                      className="min-h-[50px] w-full rounded-2xl border border-[#E8E6F2] bg-white pl-12 pr-4 text-xs font-medium text-[#202334] outline-none transition-all duration-300 placeholder:text-[#A6A5B5] hover:border-[#CFC9F8] focus:border-[#7768F7] focus:shadow-[0_0_0_4px_rgba(85,70,245,0.09)] disabled:opacity-60"
                    />

                  </div>

                </div>

                {/* OTP */}

                <div className="grid min-w-0 gap-2">

                  <label
                    htmlFor="verification-otp"
                    className="text-[11px] font-bold tracking-wide text-[#45465A]"
                  >
                    Verification code
                  </label>

                  <input
                    id="verification-otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(event) => {
                      setOtp(
                        event.target.value.replace(/\D/g, '').slice(0, 6),
                      );
                      setError('');
                    }}
                    maxLength={6}
                    required
                    disabled={loading || resending}
                    className="min-h-[58px] w-full rounded-2xl border border-[#E8E6F2] bg-white px-4 text-center text-xl font-bold tracking-[0.65em] text-[#5546F5] outline-none transition-all duration-300 placeholder:text-xs placeholder:font-medium placeholder:tracking-normal placeholder:text-[#A6A5B5] hover:border-[#CFC9F8] focus:border-[#7768F7] focus:shadow-[0_0_0_4px_rgba(85,70,245,0.09)] disabled:opacity-60"
                  />

                  <p className="text-[10px] text-[#9291A6]">
                    Enter the six-digit code from your email.
                  </p>

                </div>

                {/* VERIFY BUTTON */}

                <button
                  type="submit"
                  disabled={loading || resending}
                  className="group flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-[#5546F5] bg-[#5546F5] px-5 py-3 text-sm font-extrabold text-white shadow-[0_9px_24px_rgba(85,70,245,0.20)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#4536E5] hover:shadow-[0_15px_32px_rgba(85,70,245,0.28)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5546F5] disabled:cursor-wait disabled:opacity-60"
                >

                  {loading ? 'Verifying email...' : 'Verify email'}

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

              {/* RESEND */}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-[#85879A]">

                <span>
                  Didn't receive the code?
                </span>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resending || cooldown > 0}
                  className="rounded-lg border-0 bg-transparent px-2 py-1 font-extrabold text-[#5546F5] shadow-none transition-colors hover:bg-[#EFEDFF] hover:text-[#4032D5] disabled:cursor-not-allowed disabled:opacity-40"
                >

                  {resending
                    ? 'Sending...'
                    : cooldown > 0
                      ? `Resend in ${cooldown}s`
                      : 'Resend code'}

                </button>

              </div>

              {/* LOGIN */}

              <p className="mt-5 text-center text-xs text-[#85879A]">

                Already verified?{' '}

                <Link
                  to="/login"
                  className="font-extrabold text-[#5546F5] transition-colors hover:text-[#4032D5] hover:underline hover:underline-offset-4"
                >
                  Sign in
                </Link>

              </p>

              {/* SECURITY NOTE */}

              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#EAE7FA] bg-[#F2F0FF] px-4 py-4">

                <span className="mt-0.5 shrink-0 text-[#5546F5]" aria-hidden="true">
                  ◈
                </span>

                <p className="text-[10px] leading-[1.7] text-[#77758E]">
                  Email verification helps protect your account
                  and keeps your virtual workspace secure.
                </p>

              </div>

            </div>

          </div>

          {/* FOOTER */}

          <footer className="mt-5 flex w-full max-w-[510px] flex-wrap justify-between gap-3 text-[10px] text-[#A0A1AF]">

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