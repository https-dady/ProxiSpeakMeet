/**
 * Socket.io client wrapper.
 *
 * Owns connection lifecycle, authentication, reconnect behaviour
 * and the typed event bus. The rest of the app subscribes with
 * on() and never touches the raw socket.
 */

import { io } from 'socket.io-client';
import config from '../config.js';

function getAuthToken() {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

export function createSocketClient({
  url = config.serverUrl,
} = {}) {
  const socket = io(url, {
    transports: ['websocket', 'polling'],

    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,

    timeout: 10000,

    /*
     * Resolve the token for every new connection attempt.
     * This also supports reconnecting with a refreshed token.
     */
    auth: (callback) => {
      callback({
        token: getAuthToken(),
      });
    },

    autoConnect: true,
  });

  const listeners = new Map();
  const stateHandlers = new Set();

  socket.onAny((event, payload) => {
    for (const handler of listeners.get(event) ?? []) {
      try {
        handler(payload);
      } catch (err) {
        console.error(
          `[socket] handler for "${event}" threw`,
          err,
        );
      }
    }
  });

  const setStatus = (status, detail) => {
    for (const handler of stateHandlers) {
      try {
        handler(status, detail);
      } catch (err) {
        console.error(
          '[socket] status handler threw',
          err,
        );
      }
    }
  };

  socket.on('connect', () => {
    setStatus('online');
  });

  socket.on('disconnect', (reason) => {
    setStatus('reconnecting', reason);
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    setStatus(
      'reconnecting',
      `attempt ${attempt}`,
    );
  });

  socket.io.on('error', (err) => {
    setStatus(
      'error',
      err?.message ?? String(err),
    );
  });

  socket.on('connect_error', (err) => {
    setStatus(
      'error',
      err?.message ?? 'connection failed',
    );
  });

  return {
    socket,

    get connected() {
      return socket.connected;
    },

    /**
     * Subscribe to a server event.
     * Returns an unsubscribe function.
     */
    on(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }

      listeners.get(event).add(handler);

      return () => {
        const handlers = listeners.get(event);

        handlers?.delete(handler);

        if (handlers?.size === 0) {
          listeners.delete(event);
        }
      };
    },

    /**
     * Subscribe to connection state changes.
     */
    onStatus(handler) {
      stateHandlers.add(handler);

      return () => {
        stateHandlers.delete(handler);
      };
    },

    /**
     * Promise wrapper around Socket.IO acknowledgement.
     */
    request(event, payload, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        if (!socket.connected) {
          reject(new Error('not connected'));
          return;
        }

        const timer = setTimeout(() => {
          reject(
            new Error(`${event} timed out`),
          );
        }, timeoutMs);

        socket.emit(event, payload, (ack) => {
          clearTimeout(timer);

          if (!ack) {
            resolve({ ok: true });
            return;
          }

          if (ack.ok === false) {
            reject(
              Object.assign(
                new Error(
                  ack.error || 'Socket request failed.',
                ),
                {
                  field: ack.field,
                },
              ),
            );

            return;
          }

          resolve(ack);
        });
      });
    },

    /**
     * Fire-and-forget event.
     */
    emit(event, payload) {
      if (!socket.connected) {
        return false;
      }

      socket.emit(event, payload);

      return true;
    },

    /**
     * Disconnect and clean up all registered listeners.
     */
    disconnect() {
      socket.removeAllListeners();

      socket.io.removeAllListeners();

      listeners.clear();
      stateHandlers.clear();

      socket.disconnect();
    },
  };
}

export default createSocketClient;