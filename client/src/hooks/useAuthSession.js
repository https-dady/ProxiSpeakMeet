import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');
const SESSION_ENDPOINT = `${API_BASE_URL}/api/auth/me`;

function readStoredSession() {
  return {
    token: localStorage.getItem('token'),
    username: localStorage.getItem('username'),
  };
}

function clearStoredSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('email');
}

function normalizeUser(user) {
  if (
    !user ||
    typeof user.username !== 'string' ||
    !user.username.trim()
  ) {
    return null;
  }

  return {
    userId:
      typeof user.userId === 'string'
        ? user.userId
        : '',
    username: user.username.trim(),
  };
}

export function useAuthSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * Establishes the client session after a successful login.
   *
   * App.jsx calls this through:
   * handleLogin(username) -> login({ token, username })
   */
  const login = useCallback(({ token, username }) => {
    if (
      typeof token !== 'string' ||
      !token.trim() ||
      typeof username !== 'string' ||
      !username.trim()
    ) {
      throw new Error(
        'A valid authentication token and username are required.',
      );
    }

    localStorage.setItem('token', token);
    localStorage.setItem('username', username.trim());

    setUser({
      userId: '',
      username: username.trim(),
    });

    setError('');
    setLoading(false);
  }, []);

  /**
   * Clears the local authentication session.
   */
  const logout = useCallback(() => {
    clearStoredSession();

    setUser(null);
    setError('');
    setLoading(false);
  }, []);

  /**
   * Verifies a saved JWT with the backend.
   *
   * Expected backend response:
   * {
   *   "user": {
   *     "userId": "...",
   *     "username": "..."
   *   }
   * }
   */
  const verifySession = useCallback(async (signal) => {
    const session = readStoredSession();

    if (!session.token || !session.username) {
      clearStoredSession();

      if (!signal?.aborted) {
        setUser(null);
        setError('');
        setLoading(false);
      }

      return false;
    }

    if (signal?.aborted) {
      return false;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(SESSION_ENDPOINT, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        signal,
      });

      if (signal?.aborted) {
        return false;
      }

      if (response.status === 401) {
        clearStoredSession();

        setUser(null);
        setError('');

        return false;
      }

      if (!response.ok) {
        let message = `Session verification failed (${response.status}).`;

        try {
          const payload = await response.json();

          if (payload?.error || payload?.message) {
            message = payload.error || payload.message;
          }
        } catch {
          // Keep the default HTTP error message.
        }

        throw new Error(message);
      }

      const payload = await response.json();

      if (signal?.aborted) {
        return false;
      }

      const verifiedUser = normalizeUser(payload?.user);

      if (!verifiedUser) {
        throw new Error(
          'The server returned an invalid session response.',
        );
      }

      localStorage.setItem(
        'username',
        verifiedUser.username,
      );

      setUser(verifiedUser);
      setError('');

      return true;
    } catch (err) {
      if (
        err?.name === 'AbortError' ||
        signal?.aborted
      ) {
        return false;
      }

      /*
       * Do not delete a potentially valid token for a network error
       * or server-side 5xx response. The user can retry verification.
       */
      setUser(null);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to verify your login session.',
      );

      return false;
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * On initial mount, restore the saved session.
   * Cleanup aborts the request if the component unmounts.
   */
  useEffect(() => {
    const controller = new AbortController();

    void verifySession(controller.signal);

    return () => {
      controller.abort();
    };
  }, [verifySession]);

  return {
    user,
    loading,
    error,
    login,
    logout,
    verifySession,
  };
}

export default useAuthSession;