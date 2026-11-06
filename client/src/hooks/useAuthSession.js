import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');

const AUTH_ENDPOINT = `${API_BASE_URL}/api/auth`;
const SESSION_ENDPOINT = `${AUTH_ENDPOINT}/me`;
const SESSION_START_ENDPOINT = `${AUTH_ENDPOINT}/session/start`;
const SESSION_REFRESH_ENDPOINT = `${AUTH_ENDPOINT}/session/refresh`;
const SESSION_LOGOUT_ENDPOINT = `${AUTH_ENDPOINT}/session/logout`;

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

async function readPayload(response) {
  return response.json().catch(() => ({}));
}

export function useAuthSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * Creates the persistent HttpOnly refresh session.
   *
   * Login already returns an access token.
   * This endpoint exchanges that authenticated identity
   * for a persistent refresh-token cookie.
   */
  const establishPersistentSession = useCallback(
    async (token) => {
      const response = await fetch(SESSION_START_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await readPayload(response);

      if (!response.ok) {
        throw new Error(
          payload.error ||
            'Unable to establish persistent session.',
        );
      }

      return true;
    },
    [],
  );

  /**
   * Rotates the refresh token and obtains a new access token.
   *
   * The refresh token is sent automatically through
   * the HttpOnly cookie.
   */
  const refreshAccessToken = useCallback(async () => {
    const response = await fetch(SESSION_REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = await readPayload(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return null;
      }

      throw new Error(
        payload.error ||
          'Unable to refresh authentication session.',
      );
    }

    if (
      typeof payload.token !== 'string' ||
      !payload.token.trim()
    ) {
      throw new Error(
        'The server returned an invalid refreshed token.',
      );
    }

    localStorage.setItem('token', payload.token);

    if (payload.user?.username) {
      localStorage.setItem(
        'username',
        payload.user.username,
      );
    }

    return payload.token;
  }, []);

  /**
   * Establishes the client session after successful login.
   *
   * App.jsx calls:
   * login({ token, username })
   */
  const login = useCallback(
    ({ token, username }) => {
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

      const normalizedUsername = username.trim();

      localStorage.setItem('token', token);
      localStorage.setItem('username', normalizedUsername);

      setUser({
        userId: '',
        username: normalizedUsername,
      });

      setError('');
      setLoading(false);

      /*
       * Establish the HttpOnly refresh cookie.
       *
       * Do not clear the access token if this request fails.
       * The login itself has already succeeded.
       */
      void establishPersistentSession(token).catch((err) => {
        console.error(
          'Persistent session initialization failed:',
          err.message,
        );

        setError(
          'You are signed in, but automatic session renewal could not be initialized. Please check your connection.',
        );
      });
    },
    [establishPersistentSession],
  );

  /**
   * Clears the local session and revokes the
   * persistent server-side refresh session.
   */
  const logout = useCallback(() => {
    const logoutRequest = fetch(SESSION_LOGOUT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    }).catch((err) => {
      console.error(
        'Server logout request failed:',
        err.message,
      );
    });

    clearStoredSession();

    setUser(null);
    setError('');
    setLoading(false);

    return logoutRequest;
  }, []);

  /**
   * Verifies the current access token.
   *
   * If expired:
   * 1. Refresh the access token.
   * 2. Retry /me.
   * 3. Restore the authenticated user.
   */
  const verifySession = useCallback(
    async (signal) => {
      let session = readStoredSession();

      if (signal?.aborted) {
        return false;
      }

      if (!session.token || !session.username) {
        clearStoredSession();

        if (!signal?.aborted) {
          setUser(null);
          setError('');
          setLoading(false);
        }

        return false;
      }

      setLoading(true);
      setError('');

      try {
        let response = await fetch(SESSION_ENDPOINT, {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          signal,
        });

        if (signal?.aborted) {
          return false;
        }

        /*
         * Access token expired or invalid.
         * Attempt refresh before logging out.
         */
        if (response.status === 401) {
          const refreshedToken = await refreshAccessToken();

          if (signal?.aborted) {
            return false;
          }

          if (!refreshedToken) {
            clearStoredSession();

            setUser(null);
            setError('');

            return false;
          }

          response = await fetch(SESSION_ENDPOINT, {
            method: 'GET',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${refreshedToken}`,
            },
            signal,
          });
        }

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
          const payload = await readPayload(response);

          throw new Error(
            payload.error ||
              `Session verification failed (${response.status}).`,
          );
        }

        const payload = await readPayload(response);

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
         * Network errors must not destroy a potentially
         * valid authentication session.
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
    },
    [refreshAccessToken],
  );

  /**
   * Restore session when the application mounts.
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