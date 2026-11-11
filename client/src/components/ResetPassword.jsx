import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;
const RESEND_COOLDOWN_SECONDS = 60;

function FieldIcon({ type }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (type === 'email') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  if (type === 'otp') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M7 9h.01M12 9h.01M17 9h.01M7 15h10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}

function PasswordToggle({ visible, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl border-0 bg-[#F0EEFF] text-[#5546F5] shadow-none transition-all duration-200 hover:bg-[#E5E0FF] hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5546F5] disabled:opacity-50"
    >
      {visible ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 3l18 18" strokeLinecap="round" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9 7 9 7a15 15 0 0 1-3 3.8" />
          <path d="M6.2 6.2C4.1 7.6 3 12 3 12s3.5 7 9 7a10 10 0 0 0 4-.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    location.state?.message || '',
  );

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

    if (
      !normalizedEmail ||
      !normalizedOtp ||
      !password ||
      !confirmPassword
    ) {
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
      }, 1500);

    } catch (err) {
      setError(
        err.message ||
          'Unable to connect to the server. Please try again.',
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

  const inputClass =
    'min-h-[49px] w-full min-w-0 rounded-2xl border border-[#E8E6F2] bg-white pl-12 pr-4 text-[12px] font-medium text-[#202334] outline-none transition-all duration-300 placeholder:text-[#A6A5B5] hover:border-[#CFC9F8] focus:border-[#7768F7] focus:shadow-[0_0_0_4px_rgba(85,70,245,0.09)] disabled:opacity-60';

  const passwordInputClass =
    'min-h-[49px] w-full min-w-0 rounded-2xl border border-[#E8E6F2] bg-white pl-12 pr-14 text-[12px] font-medium text-[#202334] outline-none transition-all duration-300 placeholder:text-[#A6A5B5] hover:border-[#CFC9F8] focus:border-[#7768F7] focus:shadow-[0_0_0_4px_rgba(85,70,245,0.09)] disabled:opacity-60';

  const labelClass =
    'mb-2 block text-[11px] font-bold tracking-wide text-[#45465A]';

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

              A FRESH START

            </span>

            <h1 className="mt-8 text-[clamp(40px,4.5vw,66px)] font-extrabold leading-[1.12] tracking-[-2.5px]">

              Your next great

              <br />

              conversation

              <span className="text-[#5546F5]">
                {' '}awaits.
              </span>

            </h1>

            <p className="mt-7 max-w-[430px] text-sm leading-[2] text-[#777990]">

              Secure your account and return to a workspace
              built for natural conversations, collaboration,
              and connection.

            </p>

            {/* FEATURE CARD */}

            <div className="mt-10 max-w-[430px] rounded-2xl border border-white/80 bg-white/75 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">

              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#EFEDFF] text-[#5546F5]">

                <FieldIcon type="lock" />

              </div>

              <h3 className="text-sm font-bold text-[#202334]">
                Secure account recovery
              </h3>

              <p className="mt-2 text-xs leading-6 text-[#85879A]">
                Verify your email and safely reset your password.
              </p>

            </div>

            <blockquote className="mt-5 max-w-[430px] rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm">

              <span className="text-3xl font-serif text-[#5546F5]">
                “
              </span>

              <p className="mt-2 text-sm leading-7 text-[#55576C]">
                Better connections start with being there.
                Let's get you back to your workspace.
              </p>

              <footer className="mt-4 text-[10px] font-extrabold tracking-[1.5px] text-[#9294A7]">
                THE PROXISPEAK PHILOSOPHY
              </footer>

            </blockquote>

          </div>

          <footer className="relative z-10 flex flex-wrap justify-between gap-3 text-[10px] font-semibold tracking-wide text-[#9294A7]">

            <span>
              LESS FRICTION. MORE CONNECTION.
            </span>

            <span>
              PROXISPEAK MEET
            </span>

          </footer>

        </section>

        {/* RIGHT RESET PANEL */}

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

            <span className="text-lg font-extrabold">
              ProxiSpeak
              <span className="text-[#5546F5]"> Meet</span>
            </span>

          </Link>

          <div className="my-auto w-full max-w-[510px]">

            {/* FORM CARD */}

            <div className="rounded-[28px] border border-[#ECEAF7] bg-[#FBFAFF] p-5 shadow-[0_18px_60px_rgba(53,43,125,0.07)] transition-shadow duration-500 hover:shadow-[0_22px_70px_rgba(53,43,125,0.10)] sm:p-7 lg:p-6 xl:p-7">

              {/* BACK */}

              <Link
                to="/forgot-password"
                className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#85879A] transition-all duration-200 hover:-translate-x-1 hover:text-[#5546F5]"
              >
                <span aria-hidden="true">←</span>
                Back
              </Link>

              {/* HEADING */}

              <div className="mb-5">

                <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">
                  <span className="h-2 w-2 rounded-full bg-[#5546F5]" />
                  SECURE YOUR ACCOUNT
                </span>

                <h2 className="mt-3 text-[clamp(28px,2.6vw,36px)] font-extrabold leading-tight tracking-[-1.5px] text-[#202334]">
                  Reset your password
                </h2>

                <p className="mt-2 text-xs leading-6 text-[#85879A]">
                  Verify your email and choose a new password
                  to get back to your workspace.
                </p>

              </div>

              {/* SUCCESS */}

              {notice && (

                <div
                  role="status"
                  aria-live="polite"
                  className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-6 text-green-700"
                >
                  {notice}
                </div>

              )}

              {/* ERROR */}

              {error && (

                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700"
                >
                  {error}
                </div>

              )}

              {/* RESET FORM */}

              <form
                onSubmit={handleSubmit}
                className="grid gap-3.5"
                noValidate
              >

                {/* EMAIL */}

                <div>

                  <label htmlFor="reset-email" className={labelClass}>
                    Email address
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="email" />
                    </span>

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
                      className={inputClass}
                    />

                  </div>

                </div>

                {/* OTP */}

                <div>

                  <label htmlFor="reset-otp" className={labelClass}>
                    Email verification code
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="otp" />
                    </span>

                    <input
                      id="reset-otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(event) => {
                        setOtp(
                          event.target.value.replace(/\D/g, '').slice(0, 6),
                        );
                        setError('');
                      }}
                      maxLength={6}
                      required
                      disabled={loading || completed}
                      className={`${inputClass} tracking-[0.35em] placeholder:tracking-normal`}
                    />

                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">

                    <span className="text-[10px] text-[#9291A6]">
                      Didn't receive the code?
                    </span>

                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading || completed || cooldown > 0}
                      className="rounded-lg border-0 bg-transparent px-2 py-1 text-[10px] font-extrabold text-[#5546F5] shadow-none transition-colors hover:bg-[#EFEDFF] hover:text-[#4032D5] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading
                        ? 'Please wait...'
                        : cooldown > 0
                          ? `Resend in ${cooldown}s`
                          : 'Resend code'}
                    </button>

                  </div>

                </div>

                {/* NEW PASSWORD */}

                <div>

                  <label htmlFor="reset-password" className={labelClass}>
                    New password
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="lock" />
                    </span>

                    <input
                      id="reset-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
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
                      className={passwordInputClass}
                    />

                    <PasswordToggle
                      visible={showPassword}
                      onToggle={() => setShowPassword((value) => !value)}
                      disabled={loading || completed}
                    />

                  </div>

                </div>

                {/* CONFIRM PASSWORD */}

                <div>

                  <label
                    htmlFor="reset-confirm-password"
                    className={labelClass}
                  >
                    Confirm new password
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="lock" />
                    </span>

                    <input
                      id="reset-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Enter your password again"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setError('');
                      }}
                      minLength={8}
                      required
                      disabled={loading || completed}
                      className={passwordInputClass}
                    />

                    <PasswordToggle
                      visible={showConfirmPassword}
                      onToggle={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      disabled={loading || completed}
                    />

                  </div>

                </div>

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={loading || completed}
                  className="group mt-1 flex min-h-[51px] w-full items-center justify-center gap-3 rounded-2xl border border-[#5546F5] bg-[#5546F5] px-5 py-3 text-sm font-extrabold text-white shadow-[0_9px_24px_rgba(85,70,245,0.20)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#4536E5] hover:shadow-[0_15px_32px_rgba(85,70,245,0.28)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5546F5] disabled:cursor-wait disabled:opacity-60"
                >

                  {loading
                    ? 'Please wait...'
                    : completed
                      ? 'Password reset successful'
                      : 'Reset password'}

                  {!loading && !completed && (
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

              <p className="mt-5 text-center text-xs text-[#85879A]">
                Remember your password?{' '}
                <Link
                  to="/login"
                  className="font-extrabold text-[#5546F5] transition-colors hover:text-[#4032D5] hover:underline hover:underline-offset-4"
                >
                  Sign in
                </Link>
              </p>

              {/* SECURITY NOTE */}

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#EAE7FA] bg-[#F2F0FF] px-4 py-3">

                <span className="mt-0.5 shrink-0 text-[#5546F5]" aria-hidden="true">
                  ◈
                </span>

                <p className="text-[10px] leading-[1.7] text-[#77758E]">
                  Your password reset is protected by email OTP verification.
                  Never share your verification code with anyone.
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