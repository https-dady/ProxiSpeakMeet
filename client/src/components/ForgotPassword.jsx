import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

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
    <main className="grid min-h-dvh w-full grid-cols-1 overflow-x-hidden bg-[#1E1E1E] font-sans text-[#F6F6F6] lg:grid-cols-2">

      {/* Branding panel */}
      <section className="relative hidden min-h-dvh flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-[radial-gradient(ellipse_at_20%_15%,rgba(243,24,76,0.13),transparent_40%),radial-gradient(ellipse_at_80%_80%,rgba(90,209,154,0.07),transparent_38%),#1E1E1E] p-8 isolate lg:flex xl:p-14">

        <div className="pointer-events-none absolute -right-[18%] top-[25%] aspect-square w-[70%] rounded-full border border-[rgba(243,24,76,0.12)] shadow-[0_0_0_45px_rgba(243,24,76,0.025),0_0_0_95px_rgba(243,24,76,0.02)]" />

        <div className="pointer-events-none absolute bottom-[15%] right-[10%] h-44 w-44 rounded-full bg-[rgba(243,24,76,0.08)] blur-[75px]" />

        <Link
          to="/login"
          className="relative z-10 inline-flex w-fit items-center gap-3 text-[19px] font-extrabold tracking-tight text-[#F6F6F6] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
        >
          <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] border border-[rgba(243,24,76,0.4)] bg-[rgba(243,24,76,0.12)] text-[22px] font-extrabold text-[#F3184C]">
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
            YOUR SPACE AWAITS
          </span>

          <h1 className="mt-[22px] text-[clamp(36px,4.1vw,64px)] font-extrabold leading-[1.12] tracking-[-2.7px]">
            Reconnect with
            <br />
            your{' '}
            <span className="text-[#F3184C]">
              people.
            </span>
          </h1>

          <p className="mt-[23px] max-w-[455px] text-[13px] leading-[1.95] text-[#B8B8B8]">
            Your virtual office is still here. Recover your account securely
            and get back to the conversations that matter.
          </p>

          <blockquote className="relative mt-[38px] max-w-[460px] rounded-2xl border border-[rgba(243,24,76,0.16)] bg-[#303030] px-6 py-5 backdrop-blur-xl">

            <span className="block h-[31px] font-serif text-[46px] leading-none text-[#5ad19a]">
              “
            </span>

            <p className="my-3 mb-4 text-xs leading-[1.9] text-[#F6F6F6]">
              Great ideas begin when people feel connected. Let's get you
              back in the room.
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

      {/* Recovery panel */}
      <section className="relative flex min-h-dvh min-w-0 flex-col items-center justify-center bg-[radial-gradient(ellipse_at_100%_0%,rgba(243,24,76,0.045),transparent_35%),#F6F6F6] px-[22px] py-[25px] text-[#1E1E1E] sm:px-8 lg:px-[clamp(30px,5.2vw,84px)] lg:py-[60px]">

        {/* Mobile branding */}
        <div className="mb-[42px] inline-flex w-full max-w-[460px] items-center gap-3 text-[17px] font-extrabold tracking-tight text-[#1E1E1E] lg:hidden">

          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl border border-[rgba(243,24,76,0.4)] bg-[rgba(243,24,76,0.12)] text-xl text-[#F3184C]">
            P
          </span>

          <span>ProxiSpeak Meet</span>
        </div>

        <div className="my-auto w-full max-w-[430px]">

          {/* Back navigation */}
          <Link
            to="/login"
            className="mb-[30px] inline-flex items-center gap-2 text-[11px] font-bold text-[#686868] no-underline transition-colors hover:text-[#F3184C] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
          >
            <span aria-hidden="true">←</span>
            Back to sign in
          </Link>

          {/* Heading */}
          <div className="mb-[29px]">

            <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2.1px] text-[#F3184C]">
              <span className="h-0.5 w-[19px] rounded-full bg-[#5ad19a]" />
              ACCOUNT RECOVERY
            </span>

            <h2 className="mt-[15px] text-[clamp(26px,2.6vw,36px)] font-extrabold leading-[1.25] tracking-[-1.3px] [overflow-wrap:anywhere]">
              Forgot your password?
            </h2>

            <p className="mt-3 text-xs leading-[1.85] text-[#686868]">
              Enter your registered email address. We'll send you a
              verification code to reset your password.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 break-words rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-[11px] leading-[1.8] text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Success */}
          {notice && (
            <div
              className="mb-5 break-words rounded-[10px] border border-[rgba(38,155,103,0.22)] bg-[rgba(38,155,103,0.08)] px-3.5 py-3 text-[11px] leading-[1.8] text-[#207A52]"
              role="status"
            >
              {notice}
            </div>
          )}

          {/* Recovery form */}
          <form
            className="grid w-full gap-5"
            onSubmit={handleSubmit}
          >

            <div className="grid min-w-0 gap-[9px]">

              <label
                htmlFor="recovery-email"
                className="text-[11px] font-bold leading-relaxed text-[#303030]"
              >
                Email address
              </label>

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
                className="block min-h-[49px] w-full min-w-0 rounded-[11px] border border-[#E5E5E5] bg-white px-[15px] py-[13px] text-xs leading-[1.5] text-[#1E1E1E] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-[#929292] hover:border-[#D5D5D5] focus-visible:border-[#F3184C] focus-visible:bg-white focus-visible:shadow-[0_0_0_3px_rgba(243,24,76,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            <button
              className="mt-[5px] flex min-h-[50px] w-full items-center justify-center gap-3 rounded-[11px] border border-transparent bg-[#F3184C] px-[18px] py-[13px] text-xs font-extrabold leading-[1.5] text-white transition-[transform,background,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#D91543] hover:shadow-[0_9px_25px_rgba(243,24,76,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C] disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Sending request...' : 'Continue'}

              {!loading && (
                <span className="text-[17px] leading-none" aria-hidden="true">
                  →
                </span>
              )}
            </button>

          </form>

          {/* Login navigation */}
          <p className="mt-[25px] text-center text-[11px] leading-[1.8] text-[#686868]">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-extrabold text-[#F3184C] no-underline hover:text-[#D91543] hover:underline hover:underline-offset-[3px] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3184C]"
            >
              Sign in
            </Link>
          </p>

          {/* Security note */}
          <div className="mt-[30px] flex items-center justify-center gap-2 text-center text-[10px] leading-[1.8] text-[#929292]">
            <span className="text-[8px] text-[#269B67]" aria-hidden="true">
              ●
            </span>

            Your account recovery request is handled securely.
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-[38px] flex w-full max-w-[430px] flex-wrap justify-between gap-2.5 text-[9px] leading-[1.8] text-[#929292] max-[760px]:mt-auto max-[760px]:max-w-[460px] max-[760px]:pt-10 max-[380px]:flex-col max-[380px]:gap-1">

          <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>

          <span>Built for better connections.</span>

        </footer>

      </section>
    </main>
  );
}