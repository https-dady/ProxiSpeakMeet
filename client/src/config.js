/**
 * Client configuration. Values come from Vite env vars with safe defaults so
 * the app also runs without a .env file.
 */
const env = import.meta.env;

/**
 * Where the Socket.io server lives.
 *
 * - `vite dev` (PORT mode): the API runs on :4000, so default to it.
 * - production build: the same Express process serves this bundle AND the
 *   websocket on one port, so connect to the page's own origin. That is what
 *   makes a single-Web-Service deploy (Render) work with no extra config and no
 *   Vite proxy.
 */
const sameOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000';
const defaultServerUrl = env.PROD ? sameOrigin : 'http://localhost:4000';

export const config = Object.freeze({
  serverUrl: env.VITE_SERVER_URL || defaultServerUrl,
  defaultRoom: env.VITE_DEFAULT_ROOM || 'lobby',

  /** Local movement (pixels/second) — delta-time based, never per-frame. */
  movement: Object.freeze({
    speed: 420,
    clickSpeed: 300, // auto-walk speed towards a click target
    acceleration: 2200,
    friction: 1800,
    avatarRadius: 14,
  }),

  /** Network budget: never flood the socket, even at 60 FPS. */
  network: Object.freeze({
    positionThrottleMs: 100, // 10 Hz
    heartbeatMs: 10000,
  }),

  /** Audio engine defaults (overridden by the server on join). */
  audio: Object.freeze({
    earshotRadiusPx: 100,
    fullVolumeRadiusPx: 35,
    updateIntervalMs: 50, // 20 Hz audio refresh, 60 Hz rendering
    speakingThreshold: 0.045,
    maxVoices: 12, // hard cap on simultaneous Web Audio voices
  }),

  /** UI refresh rate for readouts (the canvas runs at 60 FPS independently). */
  uiTickMs: 250,

  /** Client-side copy of the mid-project-review budget (for HUD readouts). */
  audit: Object.freeze({
    budgetMs: 20,
  }),
});

export default config;