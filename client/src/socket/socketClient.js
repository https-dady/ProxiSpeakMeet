/**
 * Socket.io client wrapper.
 *
 * Owns connection lifecycle, reconnect behaviour and the typed event bus. The
 * rest of the app subscribes with `on()` and never touches the raw socket.
 */
import { io } from 'socket.io-client';
import config from '../config.js';

export function createSocketClient({ url = config.serverUrl } = {}) {
  const socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    autoConnect: true,
  });

  const listeners = new Map(); // event -> Set<handler>
  const stateHandlers = new Set();

  socket.onAny((event, payload) => {
    for (const handler of listeners.get(event) ?? []) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[socket] handler for "${event}" threw`, err);
      }
    }
  });

  const setStatus = (status, detail) => {
    for (const handler of stateHandlers) handler(status, detail);
  };

  socket.on('connect', () => setStatus('online'));
  socket.on('disconnect', (reason) => setStatus('reconnecting', reason));
  socket.io.on('reconnect_attempt', (attempt) => setStatus('reconnecting', `attempt ${attempt}`));
  socket.io.on('error', (err) => setStatus('error', err?.message ?? String(err)));
  socket.on('connect_error', (err) => setStatus('error', err?.message ?? 'connection failed'));

  return {
    socket,
    get connected() {
      return socket.connected;
    },

    /** Subscribe to a server event; returns an unsubscribe function. */
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event)?.delete(handler);
    },

    onStatus(handler) {
      stateHandlers.add(handler);
      return () => stateHandlers.delete(handler);
    },

    /** Promise wrapper around the Socket.io acknowledgement callback. */
    request(event, payload, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        if (!socket.connected) return reject(new Error('not connected'));
        const timer = setTimeout(() => reject(new Error(`${event} timed out`)), timeoutMs);
        socket.emit(event, payload, (ack) => {
          clearTimeout(timer);
          if (!ack) return resolve({ ok: true }); // fire-and-forget event
          if (ack.ok === false) return reject(Object.assign(new Error(ack.error), { field: ack.field }));
          return resolve(ack);
        });
      });
    },

    emit(event, payload) {
      if (!socket.connected) return false;
      socket.emit(event, payload);
      return true;
    },

    disconnect() {
      socket.removeAllListeners();
      listeners.clear();
      stateHandlers.clear();
      socket.disconnect();
    },
  };
}

export default createSocketClient;