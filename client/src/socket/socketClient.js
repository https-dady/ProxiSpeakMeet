/**
 * Socket.io client wrapper.
 *
 * Owns connection lifecycle, reconnect behaviour and the typed event bus.
 * The rest of the application subscribes through on() and onStatus().
 */
import { io } from 'socket.io-client';
import config from '../config.js';

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
    autoConnect: true,
  });

  const listeners = new Map();
  const stateHandlers = new Set();

  let currentStatus = 'connecting';
  let currentDetail = '';

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

  const setStatus = (status, detail = '') => {
    currentStatus = status;
    currentDetail = detail;

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

    get status() {
      return currentStatus;
    },

    /**
     * Subscribe to a server event.
     * Returns an unsubscribe function.
     */
    on(event, handler) {
      if (
        typeof event !== 'string' ||
        typeof handler !== 'function'
      ) {
        throw new TypeError(
          'A valid event name and handler are required.',
        );
      }

      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }

      const handlers = listeners.get(event);

      handlers.add(handler);

      return () => {
        handlers.delete(handler);

        if (handlers.size === 0) {
          listeners.delete(event);
        }
      };
    },

    /**
     * Subscribe to connection status.
     *
     * Immediately reports the current status so callers
     * cannot miss an initial connection that happened
     * before subscription.
     */
    onStatus(handler) {
      if (typeof handler !== 'function') {
        throw new TypeError(
          'A valid status handler is required.',
        );
      }

      stateHandlers.add(handler);

      try {
        handler(
          socket.connected ? 'online' : currentStatus,
          currentDetail,
        );
      } catch (err) {
        console.error(
          '[socket] initial status handler threw',
          err,
        );
      }

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
          reject(
            new Error('not connected'),
          );

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
            resolve({
              ok: true,
            });

            return;
          }

          if (ack.ok === false) {
            reject(
              Object.assign(
                new Error(
                  ack.error || `${event} failed`,
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
     * Emit a fire-and-forget event.
     */
    emit(event, payload) {
      if (!socket.connected) {
        return false;
      }

      socket.emit(event, payload);

      return true;
    },

    /**
     * Disconnect and release all listeners.
     */
    disconnect() {
      socket.removeAllListeners();
      socket.io.removeAllListeners();

      listeners.clear();
      stateHandlers.clear();

      socket.disconnect();

      currentStatus = 'idle';
      currentDetail = '';
    },
  };
}

export default createSocketClient;