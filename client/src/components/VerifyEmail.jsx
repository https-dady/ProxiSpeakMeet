import { useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

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

  const handleVerify = async (event) => {
    event.preventDefault();

    if (loading || resending) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail) {
      setError('Enter the email address you registered with.');
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
          'Email verified successfully. Redirecting to sign in…',
      );

      window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            verifiedEmail: normalizedEmail,
          },
        });
      }, 1000);
    } catch (err) {
      setError(err.message || 'Unable to verify your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter your registered email address first.');
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
        const resendError = new Error(
          payload.error ||
            payload.message ||
            'Unable to resend the verification code.',
        );

        resendError.retryAfterSeconds = payload.retryAfterSeconds;

        throw resendError;
      }

      setOtp('');

      setNotice(
        payload.message ||
          'If the account requires verification, a new code will be sent.',
      );
    } catch (err) {
      setError(err.message || 'Unable to resend the verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="grid min-h-dvh w-full grid-cols-1 overflow-x-hidden bg-[#F6F6F6] font-sans text-[#1E1E1E] lg:grid-cols-2">

      {/* Branding panel */}
      <section className="relative hidden min-h-dvh flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-[radial-gradient(ellipse_at_20%_15%,rgba(243,24,76,0.10),transparent_40%),radial-gradient(ellipse_at_80%_80%,rgba(90,209,154,0.07),transparent_38%),#1E1E1E] p-8 isolate lg:flex xl:p-14">

        <div className="pointer-events-none absolute -right-[18%] top-[25%] aspect-square w-[70%] rounded-full border border-[rgba(243,24,76,0.12)] shadow-[0_0_0_45px_rgba(243,24,76,0.02),0_0_0_95px_rgba(243,24,76,0.015)]" />

        <div className="pointer-events-none absolute bottom-[15%] right-[10%] h-44 w-44 rounded-full bg-[rgba(243,24,76,0.08)] blur-[75px]" />

        <Link
          to="/login"
          className="relative z-10 inline-flex w-fit items-center gap-3 text-[19px] font-extrabold tracking-tight text-[#F6F6F6] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
        >
          <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] border border-[rgba(243,24,76,0.30)] bg-[rgba(243,24,76,0.12)] text-[22px] font-extrabold text-[#F3184C]">
            P
          </span>

          <span>
            ProxiSpeak
            <span className="text-[#F3184C]"> Meet</span>
          </span>
        </Link>

        <div className="relative z-10 my-auto w-full max-w-[590px] py-16">

          <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#F3184C]">
            <span className="h-0.5 w-[19px] rounded-full bg-[#5ad19a]" />
            ONE LAST STEP
          </span>

          <h1 className="mt-[22px] text-[clamp(36px,4.1vw,64px)] font-extrabold leading-[1.12] tracking-[-2.7px] [overflow-wrap:anywhere] text-[#F6F6F6]">
            Make it official.
            <br />
            Start{' '}
            <span className="text-[#F3184C]">
              connecting.
            </span>
          </h1>

          <p className="mt-[23px] max-w-[455px] text-[13px] leading-[1.95] text-[#B8B8B8]">
            Verify your email to secure your account and join your team
            in a virtual workspace built for natural conversations.
          </p>

          <blockquote className="relative mt-[38px] max-w-[460px] rounded-2xl border border-[rgba(243,24,76,0.16)] bg-white/[0.04] px-6 py-5 backdrop-blur-xl">

            <span className="block h-[31px] font-serif text-[46px] leading-none text-[#5ad19a]">
              “
            </span>

            <p className="my-3 mb-4 text-xs leading-[1.9] text-[#F6F6F6]">
              The best ideas happen when people can connect without
              barriers.
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

      {/* Verification panel */}
      <section className="relative flex min-h-dvh min-w-0 flex-col items-center justify-center bg-[#F6F6F6] px-[22px] py-[25px] sm:px-8 lg:px-[clamp(30px,5.2vw,84px)] lg:py-[60px]">

        {/* Mobile branding */}
        <div className="mb-[42px] inline-flex w-full max-w-[460px] items-center gap-3 text-[17px] font-extrabold tracking-tight text-[#1E1E1E] lg:hidden">

          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl border border-[rgba(243,24,76,0.30)] bg-[rgba(243,24,76,0.12)] text-xl text-[#F3184C]">
            P
          </span>

          <span>ProxiSpeak Meet</span>
        </div>

        <div className="my-auto w-full max-w-[430px]">

          <Link
            to="/signup"
            className="mb-[30px] inline-flex items-center gap-2 text-[11px] font-bold text-[#686868] no-underline transition-colors hover:text-[#F3184C] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
          >
            <span aria-hidden="true">←</span>
            Back to sign up
          </Link>

          <div className="mb-[29px]">

            <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#F3184C]">
              <span className="h-0.5 w-[19px] rounded-full bg-[#269B67]" />
              EMAIL VERIFICATION
            </span>

            <h2 className="mt-[15px] text-[clamp(26px,2.6vw,36px)] font-extrabold leading-[1.25] tracking-[-1.3px] [overflow-wrap:anywhere] text-[#1E1E1E]">
              Check your inbox
            </h2>

            <p className="mt-3 text-xs leading-[1.85] text-[#686868]">
              Enter the six-digit code sent to your email address to
              activate your ProxiSpeak account.
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
              className="mb-5 break-words rounded-[10px] border border-[rgba(38,155,103,0.22)] bg-[rgba(38,155,103,0.08)] px-3.5 py-3 text-[11px] leading-[1.8] text-[#207A52]"
              role="status"
            >
              {notice}
            </div>
          )}

          <form
            className="grid w-full gap-5"
            onSubmit={handleVerify}
          >

            <div className="grid min-w-0 gap-[9px]">

              <label
                htmlFor="verification-email"
                className="text-[11px] font-bold leading-relaxed text-[#303030]"
              >
                Email address
              </label>

              <input
                id="verification-email"
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
                className="block min-h-[49px] w-full min-w-0 rounded-[11px] border border-[#E5E5E5] bg-white px-[15px] py-[13px] text-xs leading-[1.5] text-[#1E1E1E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#929292] hover:border-[#D5D5D5] focus-visible:border-[#F3184C] focus-visible:shadow-[0_0_0_3px_rgba(243,24,76,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="grid min-w-0 gap-[9px]">

              <label
                htmlFor="verification-otp"
                className="text-[11px] font-bold leading-relaxed text-[#303030]"
              >
                Verification code
              </label>

              <input
                id="verification-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                maxLength={6}
                required
                disabled={loading || resending}
                className="block min-h-[54px] w-full min-w-0 rounded-[11px] border border-[#E5E5E5] bg-white px-[15px] py-[13px] text-center text-lg font-bold tracking-[9px] text-[#1E1E1E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[11px] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#929292] hover:border-[#D5D5D5] focus-visible:border-[#F3184C] focus-visible:shadow-[0_0_0_3px_rgba(243,24,76,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-[11px] border border-transparent bg-[#F3184C] px-[18px] py-[13px] text-xs font-extrabold leading-[1.5] text-white transition-[transform,background,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#D91543] hover:shadow-[0_9px_25px_rgba(243,24,76,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C] disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={loading || resending}
            >
              {loading ? 'Verifying email...' : 'Verify email'}

              {!loading && (
                <span className="text-[17px] leading-none" aria-hidden="true">
                  →
                </span>
              )}
            </button>

          </form>

          <div className="mt-[25px] flex flex-wrap items-center justify-center gap-2 text-center text-[11px] leading-[1.8] text-[#686868]">

            <span>Didn't receive the code?</span>

            <button
              className="border-0 bg-transparent p-0 font-extrabold text-[#F3184C] transition-colors hover:text-[#D91543] hover:underline hover:underline-offset-[3px] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={handleResend}
              disabled={resending || loading}
            >
              {resending ? 'Sending...' : 'Resend code'}
            </button>

          </div>

          <p className="mt-[24px] text-center text-[11px] leading-[1.8] text-[#686868]">
            Already verified?{' '}
            <Link
              to="/login"
              className="font-extrabold text-[#F3184C] no-underline hover:text-[#D91543] hover:underline hover:underline-offset-[3px]"
            >
              Sign in
            </Link>
          </p>

          <div className="mt-[30px] flex items-center justify-center gap-2 text-center text-[10px] leading-[1.8] text-[#929292]">
            <span className="text-[8px] text-[#269B67]" aria-hidden="true">
              ●
            </span>

            Your account verification helps keep your workspace secure.
          </div>

        </div>

        <footer className="mt-[38px] flex w-full max-w-[430px] flex-wrap justify-between gap-2.5 text-[9px] leading-[1.8] text-[#929292] max-[760px]:mt-auto max-[760px]:max-w-[460px] max-[760px]:pt-10 max-[380px]:flex-col max-[380px]:gap-1">

          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>

          <span>Built for better connections.</span>

        </footer>

      </section>
    </main>
  );
}