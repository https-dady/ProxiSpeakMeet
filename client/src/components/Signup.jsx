import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import config from '../config.js';

const API_BASE_URL = `${String(config.serverUrl).replace(/\/+$/, '')}/api/auth`;

function FieldIcon({ type }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (type === 'user') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.5-3.5 3-5.5 7-5.5s6.5 2 7 5.5" />
      </svg>
    );
  }

  if (type === 'email') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    if (username.length < 3 || username.length > 50) {
      setError('Username must contain between 3 and 50 characters.');
      return;
    }

    if (!email) {
      setError('Please enter your email address.');
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
        (
          response.status === 502 &&
          payload.emailVerificationRequired === true
        );

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
              (
                emailDeliveryFailed
                  ? 'Your account was created, but the verification email could not be sent. Request a new code below.'
                  : 'Verification code sent to your email address.'
              ),
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

  const inputClass =
    'min-h-[50px] w-full rounded-2xl border border-[#E8E6F2] bg-white pl-12 pr-14 text-[13px] font-medium text-[#202334] outline-none transition-all duration-300 placeholder:text-[#A6A5B5] hover:border-[#CFC9F8] focus:border-[#7768F7] focus:bg-white focus:shadow-[0_0_0_4px_rgba(85,70,245,0.09),0_5px_16px_rgba(85,70,245,0.05)] disabled:opacity-60';

  const fieldClass = 'grid min-w-0 gap-2';

  const labelClass =
    'text-[11px] font-bold tracking-wide text-[#45465A]';

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#F5F4FC] font-sans text-[#202334]">

      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">

        {/* LEFT BRANDING */}

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

          <div className="relative z-10 my-auto max-w-[560px] py-10">

            <span className="inline-flex items-center gap-2 rounded-full border border-[#5546F5]/15 bg-white/70 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">
              <span className="h-2 w-2 rounded-full bg-[#5546F5]" />
              YOUR PEOPLE, CLOSER
            </span>

            <h1 className="mt-8 text-[clamp(40px,4.5vw,66px)] font-extrabold leading-[1.12] tracking-[-2.5px]">
              Work together.
              <br />
              Connect
              <span className="text-[#5546F5]"> naturally.</span>
            </h1>

            <p className="mt-7 max-w-[430px] text-sm leading-[2] text-[#777990]">
              Create your account and step into a virtual office where
              conversations and collaboration feel natural.
            </p>

            <div className="mt-12 grid max-w-[470px] grid-cols-2 gap-4">

              <div className="rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#EFEDFF] text-xl text-[#5546F5]">
                  ◉
                </div>
                <h3 className="text-sm font-bold">Virtual Office</h3>
                <p className="mt-2 text-xs leading-6 text-[#85879A]">
                  Meet your team in a shared workspace.
                </p>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#EFEDFF] text-xl text-[#5546F5]">
                  ♧
                </div>
                <h3 className="text-sm font-bold">Natural Audio</h3>
                <p className="mt-2 text-xs leading-6 text-[#85879A]">
                  Conversations powered by proximity.
                </p>
              </div>

            </div>

            <blockquote className="mt-5 max-w-[470px] rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm">
              <span className="text-3xl font-serif text-[#5546F5]">“</span>
              <p className="mt-2 text-sm leading-7 text-[#55576C]">
                You don't always need another meeting. Sometimes,
                you just need to be close enough to talk.
              </p>
              <footer className="mt-4 text-[10px] font-extrabold tracking-[1.5px] text-[#9294A7]">
                THE PROXISPEAK PHILOSOPHY
              </footer>
            </blockquote>

          </div>

          <footer className="relative z-10 flex flex-wrap justify-between gap-3 text-[10px] font-semibold tracking-wide text-[#9294A7]">
            <span>LESS FRICTION. MORE CONNECTION.</span>
            <span>PROXISPEAK MEET</span>
          </footer>

        </section>

        {/* RIGHT SIGNUP */}

        <section className="flex min-h-dvh flex-col items-center justify-center bg-white px-5 py-8 sm:px-10 lg:px-10 xl:px-14">

          {/* MOBILE BRAND */}

          <Link
            to="/login"
            className="mb-7 inline-flex items-center gap-3 self-start no-underline lg:hidden"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#5546F5] text-xl font-black text-white">
              P
            </span>
            <span className="text-lg font-extrabold">
              ProxiSpeak <span className="text-[#5546F5]">Meet</span>
            </span>
          </Link>

          <div className="my-auto w-full max-w-[510px]">

            {/* FORM CARD */}

            <div className="rounded-[28px] border border-[#ECEAF7] bg-[#FBFAFF] p-5 shadow-[0_18px_60px_rgba(53,43,125,0.07)] transition-shadow duration-500 hover:shadow-[0_22px_70px_rgba(53,43,125,0.10)] sm:p-7 lg:p-6 xl:p-7">

              {/* HEADING */}

              <div className="mb-5">

                <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[2px] text-[#5546F5]">
                  <span className="h-2 w-2 rounded-full bg-[#5546F5]" />
                  GET STARTED
                </span>

                <h2 className="mt-3 text-[clamp(28px,2.6vw,36px)] font-extrabold leading-tight tracking-[-1.5px] text-[#202334]">
                  Create your account
                </h2>

                <p className="mt-2 text-xs leading-6 text-[#85879A]">
                  Join your team and start connecting naturally.
                </p>

              </div>

              {/* ERROR */}

              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700"
                >
                  {error}
                </div>
              )}

              {/* FORM */}

              <form onSubmit={handleSubmit} className="grid gap-4" noValidate>

                {/* USERNAME */}

                <div className={fieldClass}>

                  <label htmlFor="signup-username" className={labelClass}>
                    Username
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="user" />
                    </span>

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
                      aria-invalid={Boolean(error)}
                      className={inputClass}
                    />
                  </div>

                </div>

                {/* EMAIL */}

                <div className={fieldClass}>

                  <label htmlFor="signup-email" className={labelClass}>
                    Email address
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="email" />
                    </span>

                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={handleChange}
                      maxLength={254}
                      required
                      disabled={loading}
                      aria-invalid={Boolean(error)}
                      className={inputClass}
                    />
                  </div>

                </div>

                {/* PASSWORD */}

                <div className={fieldClass}>

                  <label htmlFor="signup-password" className={labelClass}>
                    Password
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="lock" />
                    </span>

                    <input
                      id="signup-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                      value={form.password}
                      onChange={handleChange}
                      minLength={8}
                      required
                      disabled={loading}
                      aria-invalid={Boolean(error)}
                      className={inputClass}
                    />

                    <PasswordToggle
                      visible={showPassword}
                      onToggle={() => setShowPassword((value) => !value)}
                      disabled={loading}
                    />
                  </div>

                  <p className="text-[10px] text-[#9291A6]">
                    Use at least 8 characters.
                  </p>

                </div>

                {/* CONFIRM PASSWORD */}

                <div className={fieldClass}>

                  <label
                    htmlFor="signup-confirm-password"
                    className={labelClass}
                  >
                    Confirm password
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#9995B6]">
                      <FieldIcon type="lock" />
                    </span>

                    <input
                      id="signup-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Enter your password again"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      minLength={8}
                      required
                      disabled={loading}
                      aria-invalid={
                        Boolean(
                          form.confirmPassword &&
                          form.password !== form.confirmPassword
                        )
                      }
                      className={inputClass}
                    />

                    <PasswordToggle
                      visible={showConfirmPassword}
                      onToggle={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      disabled={loading}
                    />
                  </div>

                </div>

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={loading}
                  className="group mt-1 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-[#5546F5] bg-[#5546F5] px-5 py-3 text-sm font-extrabold text-white shadow-[0_9px_24px_rgba(85,70,245,0.20)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#4536E5] hover:shadow-[0_15px_32px_rgba(85,70,245,0.28)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5546F5] disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? 'Creating account...' : 'Create account'}

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

              <p className="mt-5 text-center text-xs text-[#85879A]">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-extrabold text-[#5546F5] transition-colors hover:text-[#4032D5] hover:underline hover:underline-offset-4"
                >
                  Sign in
                </Link>
              </p>

              {/* VERIFICATION NOTE */}

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#EAE7FA] bg-[#F2F0FF] px-4 py-3">

                <span className="mt-0.5 shrink-0 text-[#5546F5]" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
                  </svg>
                </span>

                <p className="text-[10px] leading-[1.7] text-[#77758E]">
                  We'll send a verification code to your email.
                  Your account must be verified before you can sign in.
                </p>

              </div>

            </div>

          </div>

          {/* FOOTER */}

          <footer className="mt-5 flex w-full max-w-[510px] flex-wrap justify-between gap-3 text-[10px] text-[#A0A1AF]">
            <span>© {new Date().getFullYear()} ProxiSpeak Meet</span>
            <span>Built for better connections.</span>
          </footer>

        </section>

      </div>

    </main>
  );
}