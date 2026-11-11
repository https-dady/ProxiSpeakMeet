import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');

const AUTH_ENDPOINT = `${API_BASE_URL}/api/auth`;
const SESSION_ENDPOINT = `${AUTH_ENDPOINT}/me`;
const SESSION_START_ENDPOINT = `${AUTH_ENDPOINT}/session/start`;
const SESSION_REFRESH_ENDPOINT = `${AUTH_ENDPOINT}/session/refresh`;
const SESSION_LOGOUT_ENDPOINT = `${AUTH_ENDPOINT}/session/logout`;

let refreshPromise = null;
let sessionStartPromise = null;

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

async function establishPersistentSession(token) {
  if (sessionStartPromise) {
    return sessionStartPromise;
  }

  sessionStartPromise = (async () => {
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
  })();

  try {
    return await sessionStartPromise;
  } finally {
    sessionStartPromise = null;
  }
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const response = await fetch(SESSION_REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

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
        'The server returned an invalid refreshed token.',
      );
    }

    const refreshedUser = normalizeUser(payload.user);

    localStorage.setItem('token', payload.token);

    if (refreshedUser?.username) {
      localStorage.setItem(
        'username',
        refreshedUser.username,
      );
    }

    return {
      token: payload.token,
      user: refreshedUser,
    };
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

  const login = useCallback(async ({ token, username }) => {
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

    setLoading(true);
    setError('');

    try {
      await establishPersistentSession(token);
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to initialize persistent session.',
      );

      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
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

    await logoutRequest;
  }, []);

  const verifySession = useCallback(async (signal) => {
    if (signal?.aborted) {
      return false;
    }

    let session = readStoredSession();
    let accessToken = session.token;

    setLoading(true);
    setError('');

    try {
      /*
       * No local access token:
       * Try the HttpOnly refresh cookie first.
       */
      if (!accessToken) {
        const refreshed = await refreshAccessToken();

        if (signal?.aborted) {
          return false;
        }

        if (!refreshed) {
          clearStoredSession();
          setUser(null);
          return false;
        }

        accessToken = refreshed.token;
      }

      let response = await fetch(SESSION_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      });

      if (signal?.aborted) {
        return false;
      }

      /*
       * Access token expired:
       * Refresh and retry /me once.
       */
      if (response.status === 401) {
        const refreshed = await refreshAccessToken();

        if (signal?.aborted) {
          return false;
        }

        if (!refreshed) {
          clearStoredSession();
          setUser(null);
          return false;
        }

        accessToken = refreshed.token;

        response = await fetch(SESSION_ENDPOINT, {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          signal,
        });
      }

      if (signal?.aborted) {
        return false;
      }

      if (response.status === 401 || response.status === 403) {
        clearStoredSession();
        setUser(null);
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
       * Preserve credentials on network/server errors.
       * A temporary outage must not destroy a valid session.
       */
      setUser(null);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to verify authentication session.',
      );

      return false;
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

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