import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');

function readStoredSession() {
  return {
    token: localStorage.getItem('token'),
    username: localStorage.getItem('username'),
  };
}

function clearStoredSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
}

export function useAuthSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setError('');
    setLoading(false);
  }, []);

  const verifySession = useCallback(async (signal) => {
    setLoading(true);
    setError('');

    const session = readStoredSession();

    if (!session.token || !session.username) {
      clearStoredSession();
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        signal,
      });

      if (signal?.aborted) {
        return;
      }

      if (response.status === 401) {
        clearStoredSession();
        setUser(null);
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Session verification failed (${response.status}).`,
        );
      }

      const payload = await response.json();
      const verifiedUser = payload?.user;

      if (
        !verifiedUser ||
        typeof verifiedUser.userId !== 'string' ||
        typeof verifiedUser.username !== 'string' ||
        !verifiedUser.username
      ) {
        throw new Error(
          'The server returned an invalid authentication response.',
        );
      }

      localStorage.setItem('username', verifiedUser.username);

      setUser({
        userId: verifiedUser.userId,
        username: verifiedUser.username,
      });
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return;
      }

      // A temporary network/server error does not prove that the
      // saved token is invalid. Keep the session for a later retry.
      setError(
        err.message || 'Unable to verify your login session.',
      );

      setUser(null);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void verifySession(controller.signal);

    return () => controller.abort();
  }, [verifySession]);

  const login = useCallback(({ token, username }) => {
    if (
      typeof token !== 'string' ||
      !token ||
      typeof username !== 'string' ||
      !username
    ) {
      throw new Error('A valid login token and username are required.');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('username', username);

    setUser({
      username,
      userId: '',
    });

    setError('');
    setLoading(false);
  }, []);

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