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

  const inputClass =
    'block min-h-[49px] w-full min-w-0 rounded-[11px] border border-[#E5E5E5] bg-white px-[15px] py-[13px] text-xs leading-[1.5] text-[#1E1E1E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#929292] hover:border-[#D5D5D5] focus-visible:border-[#F3184C] focus-visible:shadow-[0_0_0_3px_rgba(243,24,76,0.12)] disabled:cursor-not-allowed disabled:opacity-60';

  const labelClass =
    'mb-[9px] block text-[11px] font-bold leading-relaxed text-[#303030]';

  return (
    <main className="grid min-h-dvh w-full grid-cols-1 overflow-x-hidden bg-[#1E1E1E] font-sans text-[#F6F6F6] lg:grid-cols-2">

      {/* Branding panel */}
      <section className="relative hidden min-h-dvh flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-[radial-gradient(ellipse_at_20%_15%,rgba(243,24,76,0.12),transparent_40%),radial-gradient(ellipse_at_80%_80%,rgba(38,155,103,0.07),transparent_38%),#1E1E1E] p-8 isolate lg:flex xl:p-14">

        <div className="pointer-events-none absolute -right-[18%] top-[25%] aspect-square w-[70%] rounded-full border border-[rgba(243,24,76,0.12)] shadow-[0_0_0_45px_rgba(243,24,76,0.02),0_0_0_95px_rgba(243,24,76,0.015)]" />

        <div className="pointer-events-none absolute bottom-[15%] right-[10%] h-44 w-44 rounded-full bg-[#F3184C]/10 blur-[75px]" />

        <Link
          to="/login"
          className="relative z-10 inline-flex w-fit items-center gap-3 text-[19px] font-extrabold tracking-tight text-[#F6F6F6] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
        >
          <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] border border-[#F3184C]/30 bg-[#F3184C]/10 text-[22px] font-extrabold text-[#F3184C]">
            P
          </span>

          <span>
            ProxiSpeak
            <span className="text-[#F3184C]"> Meet</span>
          </span>
        </Link>

        <div className="relative z-10 my-auto w-full max-w-[590px] py-16">

          <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#F3184C]">
            <span className="h-0.5 w-[19px] rounded-full bg-[#269B67]" />
            A FRESH START
          </span>

          <h1 className="mt-[22px] text-[clamp(36px,4.1vw,64px)] font-extrabold leading-[1.12] tracking-[-2.7px]">
            Your next great
            <br />
            conversation{' '}
            <span className="text-[#F3184C]">
              awaits.
            </span>
          </h1>

          <p className="mt-[23px] max-w-[455px] text-[13px] leading-[1.95] text-[#B8B8B8]">
            Secure your account and return to a workspace built for natural
            conversations, collaboration, and connection.
          </p>

          <blockquote className="relative mt-[38px] max-w-[460px] rounded-2xl border border-white/[0.08] bg-[#303030] px-6 py-5 backdrop-blur-xl">

            <span className="block h-[31px] font-serif text-[46px] leading-none text-[#F3184C]">
              “
            </span>

            <p className="my-3 mb-4 text-xs leading-[1.9] text-[#F6F6F6]">
              Better connections start with being there. Let's get you back
              to your workspace.
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

      {/* Password reset panel */}
      <section className="relative flex min-h-dvh min-w-0 flex-col justify-between bg-[#F6F6F6] px-5 py-8 text-[#1E1E1E] sm:px-10 lg:px-[clamp(30px,5.2vw,84px)] lg:py-10">

        {/* Mobile branding */}
        <Link
          to="/login"
          className="relative inline-flex w-fit items-center gap-3 text-[17px] font-extrabold tracking-tight text-[#1E1E1E] no-underline lg:hidden"
        >
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-[#F3184C] text-xl text-white">
            P
          </span>

          <span>
            ProxiSpeak
            <span className="text-[#F3184C]"> Meet</span>
          </span>
        </Link>

        <div className="relative mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-12">

          <Link
            to="/forgot-password"
            className="mb-[30px] inline-flex w-fit items-center gap-2 text-[11px] font-bold text-[#686868] no-underline transition-colors hover:text-[#F3184C] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
          >
            <span aria-hidden="true">←</span>
            Back
          </Link>

          <div className="mb-[29px]">

            <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#F3184C]">
              <span className="h-0.5 w-[19px] rounded-full bg-[#269B67]" />
              SECURE YOUR ACCOUNT
            </span>

            <h2 className="mt-[15px] text-[clamp(26px,2.6vw,36px)] font-extrabold leading-[1.25] tracking-[-1.3px]">
              Reset your password
            </h2>

            <p className="mt-3 text-xs leading-[1.85] text-[#686868]">
              Enter the six-digit code from your email and choose a new
              password.
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

          {notice && (
            <div
              className="mb-5 break-words rounded-[10px] border border-[#269B67]/20 bg-[#269B67]/[0.08] px-3.5 py-3 text-[11px] leading-[1.8] text-[#207A52]"
              role="status"
            >
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-[18px]">

            <div>
              <label
                htmlFor="reset-email"
                className={labelClass}
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
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="reset-otp"
                className={labelClass}
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
                  setOtp(
                    event.target.value.replace(/\D/g, '').slice(0, 6),
                  );
                  setError('');
                }}
                maxLength={6}
                required
                disabled={loading || completed}
                className={`${inputClass} tracking-[0.3em] placeholder:tracking-normal`}
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">

                <span className="text-[#929292]">
                  Didn't receive the code?
                </span>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || completed || cooldown > 0}
                  className="font-extrabold text-[#F3184C] transition-colors hover:text-[#D91543] disabled:cursor-not-allowed disabled:opacity-40"
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
                className={labelClass}
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
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="reset-confirm-password"
                className={labelClass}
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
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading || completed}
              className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-[11px] bg-[#F3184C] px-5 py-4 text-xs font-extrabold text-white transition-[transform,background,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#D91543] hover:shadow-[0_9px_25px_rgba(243,24,76,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Please wait...'
                : completed
                  ? 'Password reset successful'
                  : 'Reset password'}

              {!loading && !completed && (
                <span aria-hidden="true" className="text-[17px]">
                  →
                </span>
              )}
            </button>

          </form>

          <p className="mt-8 text-center text-[11px] text-[#686868]">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-extrabold text-[#F3184C] transition-colors hover:text-[#D91543]"
            >
              Sign in
            </Link>
          </p>
        </div>

        <footer className="relative flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E5E5] pt-5 text-[9px] text-[#929292]">
          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>
          <span>Built for better connections.</span>
        </footer>

      </section>
    </main>
  );
}