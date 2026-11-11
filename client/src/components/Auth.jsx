import React, { useState } from 'react';
import config from '../config.js';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiBaseUrl = String(config.serverUrl).replace(/\/+$/, '');

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    const normalizedUsername = username.trim();

    if (
      normalizedUsername.length < USERNAME_MIN_LENGTH ||
      normalizedUsername.length > USERNAME_MAX_LENGTH
    ) {
      setError('Username must be between 3 and 50 characters long.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (!isLogin && password.length < PASSWORD_MIN_LENGTH) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    const endpoint = isLogin
      ? '/api/auth/login'
      : '/api/auth/register';

    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            `Request failed with status ${response.status}.`,
        );
        return;
      }

      if (isLogin) {
        if (
          typeof data.token !== 'string' ||
          !data.token ||
          typeof data.username !== 'string' ||
          !data.username
        ) {
          setError('The server returned an invalid login response.');
          return;
        }

        localStorage.setItem('token', data.token);

        setSuccess('Login successful.');

        if (typeof onLogin === 'function') {
          onLogin(data.username);
        }

        return;
      }

      setSuccess(
        data.message || 'Account created successfully. Please log in.',
      );

      setIsLogin(true);
      setPassword('');
    } catch (requestError) {
      setError(
        'Unable to connect to the server. Please check your connection and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    if (isSubmitting) {
      return;
    }

    setIsLogin((currentMode) => !currentMode);
    setError('');
    setSuccess('');
    setPassword('');
  };

  const styles = {
    page: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      boxSizing: 'border-box',
      padding: '24px',
      backgroundColor: '#0f172a',
      fontFamily: 'system-ui, sans-serif',
    },

    card: {
      boxSizing: 'border-box',
      width: '100%',
      maxWidth: '400px',
      padding: '40px',
      borderRadius: '12px',
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    },

    header: {
      textAlign: 'center',
      marginBottom: '30px',
    },

    title: {
      color: '#f8fafc',
      margin: '0 0 10px',
      fontSize: '24px',
    },

    subtitle: {
      color: '#94a3b8',
      margin: 0,
      fontSize: '14px',
    },

    message: {
      padding: '12px',
      borderRadius: '6px',
      marginBottom: '20px',
      fontSize: '14px',
      textAlign: 'center',
      lineHeight: 1.5,
    },

    error: {
      backgroundColor: '#7f1d1d',
      color: '#fecaca',
      border: '1px solid #991b1b',
    },

    success: {
      backgroundColor: '#064e3b',
      color: '#a7f3d0',
      border: '1px solid #065f46',
    },

    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
    },

    input: {
      boxSizing: 'border-box',
      width: '100%',
      padding: '12px 15px',
      borderRadius: '8px',
      border: '1px solid #334155',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      outline: 'none',
      fontSize: '15px',
    },

    submitButton: {
      padding: '12px',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: isSubmitting ? '#64748b' : '#3b82f6',
      color: '#ffffff',
      fontSize: '16px',
      fontWeight: '600',
      cursor: isSubmitting ? 'not-allowed' : 'pointer',
      marginTop: '10px',
      opacity: isSubmitting ? 0.8 : 1,
    },

    switchButton: {
      width: '100%',
      marginTop: '20px',
      padding: '8px',
      background: 'transparent',
      border: 'none',
      color: '#94a3b8',
      fontSize: '14px',
      cursor: isSubmitting ? 'not-allowed' : 'pointer',
      textDecoration: 'underline',
    },
  };

  return (
    <div style={styles.page}>
      <main style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.title}>ProxiSpeak Meet</h1>

          <p style={styles.subtitle}>
            {isLogin
              ? 'Sign in to your account'
              : 'Create a new account'}
          </p>
        </header>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              ...styles.message,
              ...styles.error,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            aria-live="polite"
            style={{
              ...styles.message,
              ...styles.success,
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label
            htmlFor="auth-username"
            style={{
              color: '#cbd5e1',
              fontSize: '14px',
            }}
          >
            Username
          </label>

          <input
            id="auth-username"
            type="text"
            name="username"
            placeholder="Enter your username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            autoComplete="username"
            required
            disabled={isSubmitting}
            style={styles.input}
          />

          <label
            htmlFor="auth-password"
            style={{
              color: '#cbd5e1',
              fontSize: '14px',
            }}
          >
            Password
          </label>

          <input
            id="auth-password"
            type="password"
            name="password"
            placeholder={
              isLogin
                ? 'Enter your password'
                : 'Create a password (minimum 8 characters)'
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={isLogin ? undefined : PASSWORD_MIN_LENGTH}
            autoComplete={
              isLogin ? 'current-password' : 'new-password'
            }
            required
            disabled={isSubmitting}
            style={styles.input}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            style={styles.submitButton}
          >
            {isSubmitting
              ? 'Please wait...'
              : isLogin
                ? 'Access Dashboard'
                : 'Create Account'}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          disabled={isSubmitting}
          style={styles.switchButton}
        >
          {isLogin
            ? 'Need an account? Sign up here'
            : 'Already have an account? Log in'}
        </button>
      </main>
    </div>
  );
}