/**
 * Client configuration.
 * Values come from Vite environment variables with safe defaults.
 */

const env = import.meta.env;

/**
 * Socket.IO server configuration.
 *
 * Production:
 *   Connect directly to the deployed Render backend.
 *
 * Development:
 *   Connect to the local backend on port 4000.
 *
 * VITE_SERVER_URL overrides the default server URL.
 */

const defaultServerUrl = env.PROD
  ? 'https://proxispeakmeet-2.onrender.com'
  : 'http://localhost:4000';

const serverUrl = (
  env.VITE_SERVER_URL || defaultServerUrl
).replace(/\/+$/, '');

export const config = Object.freeze({
  serverUrl,

  defaultRoom: env.VITE_DEFAULT_ROOM || 'lobby',

  /**
   * Local movement (pixels/second).
   * Delta-time based, never per-frame.
   */
  movement: Object.freeze({
    speed: 420,
    clickSpeed: 300,
    acceleration: 2200,
    friction: 1800,
    avatarRadius: 14,
  }),

  /**
   * Network budget.
   * Prevents flooding the socket with position updates.
   */
  network: Object.freeze({
    positionThrottleMs: 100,
    heartbeatMs: 10000,
  }),

  /**
   * Audio engine defaults.
   * These values can be overridden by the server on join.
   */
  audio: Object.freeze({
    earshotRadiusPx: 100,
    fullVolumeRadiusPx: 35,
    updateIntervalMs: 50,
    speakingThreshold: 0.045,
    maxVoices: 12,
  }),

  /**
   * UI refresh rate.
   * The canvas renders independently at 60 FPS.
   */
  uiTickMs: 250,

  /**
   * Client-side audit budget.
   */
  audit: Object.freeze({
    budgetMs: 20,
  }),
});

export default config;