import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');

const AUTH_ENDPOINT = `${API_BASE_URL}/api/auth`;

const SESSION_ENDPOINT = `${AUTH_ENDPOINT}/me`;
const SESSION_START_ENDPOINT = `${AUTH_ENDPOINT}/session/start`;
const SESSION_REFRESH_ENDPOINT = `${AUTH_ENDPOINT}/session/refresh`;
const SESSION_LOGOUT_ENDPOINT = `${AUTH_ENDPOINT}/session/logout`;

/*
 * Prevent duplicate refresh requests across components
 * and concurrent API operations in this browser tab.
 */
let refreshPromise = null;

/*
 * Prevent duplicate session initialization for the same token.
 */
const sessionStartPromises = new Map();

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

/*
 * Establish persistent authentication session.
 *
 * The backend stores the refresh token in an
 * HttpOnly cookie. It is never exposed to JavaScript.
 */
async function establishPersistentSession(token) {
  if (sessionStartPromises.has(token)) {
    return sessionStartPromises.get(token);
  }

  const request = (async () => {
    const response = await fetch(
      SESSION_START_ENDPOINT,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const payload = await readPayload(response);

    if (!response.ok) {
      throw new Error(
        payload.error ||
          'Unable to establish persistent session.',
      );
    }

    return true;
  })();

  sessionStartPromises.set(token, request);

  try {
    return await request;
  } finally {
    if (sessionStartPromises.get(token) === request) {
      sessionStartPromises.delete(token);
    }
  }
}

/*
 * Refresh an expired access token.
 *
 * Multiple simultaneous callers share one refresh request.
 */
async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const response = await fetch(
      SESSION_REFRESH_ENDPOINT,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      },
    );

    const payload = await readPayload(response);

    if (!response.ok) {
      if (
        response.status === 401 ||
        response.status === 403
      ) {
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
        'Invalid access token received from server.',
      );
    }

    localStorage.setItem('token', payload.token);

    if (
      typeof payload.user?.username === 'string' &&
      payload.user.username.trim()
    ) {
      localStorage.setItem(
        'username',
        payload.user.username.trim(),
      );
    }

    return payload.token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export function useAuthSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /*
   * LOGIN
   *
   * Contract:
   * login({ token, username })
   *
   * Resolves only after persistent session initialization.
   */
  const login = useCallback(
    async ({ token, username }) => {
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

      const normalizedToken = token.trim();
      const normalizedUsername = username.trim();

      setLoading(true);
      setError('');

      /*
       * Store credentials temporarily so the session
       * can survive a network retry during initialization.
       */
      localStorage.setItem('token', normalizedToken);

      localStorage.setItem(
        'username',
        normalizedUsername,
      );

      try {
        await establishPersistentSession(normalizedToken);

        const authenticatedUser = {
          userId: '',
          username: normalizedUsername,
        };

        setUser(authenticatedUser);
        setError('');

        return true;
      } catch (err) {
        clearStoredSession();

        setUser(null);

        const message =
          err instanceof Error
            ? err.message
            : 'Unable to initialize persistent session.';

        setError(message);

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /*
   * LOGOUT
   *
   * Clear local credentials immediately.
   * Revoke the server-side refresh session.
   */
  const logout = useCallback(async () => {
    const request = fetch(
      SESSION_LOGOUT_ENDPOINT,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      },
    );

    clearStoredSession();

    setUser(null);
    setError('');
    setLoading(false);

    try {
      await request;
    } catch (err) {
      console.error(
        'Server logout request failed:',
        err.message,
      );
    }
  }, []);

  /*
   * VERIFY SESSION
   *
   * 1. Read saved access token.
   * 2. Verify through /me.
   * 3. Refresh if the access token expired.
   * 4. Retry /me with the refreshed token.
   * 5. Restore authenticated user.
   */
  const verifySession = useCallback(
    async (signal) => {
      const session = readStoredSession();

      if (signal?.aborted) {
        return false;
      }

      if (!session.token || !session.username) {
        clearStoredSession();

        setUser(null);
        setError('');
        setLoading(false);

        return false;
      }

      setLoading(true);
      setError('');

      try {
        let response = await fetch(
          SESSION_ENDPOINT,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${session.token}`,
            },
            signal,
          },
        );

        if (signal?.aborted) {
          return false;
        }

        /*
         * Access token expired or invalid.
         * Try refreshing before ending the session.
         */
        if (response.status === 401) {
          const refreshedToken =
            await refreshAccessToken();

          if (signal?.aborted) {
            return false;
          }

          if (!refreshedToken) {
            clearStoredSession();

            setUser(null);
            setError('');

            return false;
          }

          response = await fetch(
            SESSION_ENDPOINT,
            {
              method: 'GET',
              credentials: 'include',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${refreshedToken}`,
              },
              signal,
            },
          );
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

        const verifiedUser = normalizeUser(
          payload?.user,
        );

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
         * Network failures must not automatically erase
         * potentially valid saved credentials.
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
    [],
  );

  /*
   * INITIAL SESSION RESTORATION
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